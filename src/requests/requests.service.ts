import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { TankerRequest, RequestStatus, PaymentStatus } from './entities/request.entity';
import { RulesEngineService } from './rules-engine.service';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { TankersService } from '../tankers/tankers.service';
import { TankerStatus } from '../tankers/entities/tanker.entity';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service';

interface CreateRequestDto {
  residentId: string;
  lat: number;
  lng: number;
  addressText: string;
  requestedCapacityLiters: number;
}

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(TankerRequest)
    private readonly requestsRepo: Repository<TankerRequest>,
    private readonly rulesEngine: RulesEngineService,
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
    private readonly tankersService: TankersService,
    private readonly realtimePublisher: RealtimePublisherService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  /** Step 1-3 of the booking flow: rules engine decides amount due, then
   *  either auto-confirms (free) or leaves the request pending payment. */
  async create(tenantId: string, dto: CreateRequestDto): Promise<TankerRequest> {
    const tenant = await this.tenantsService.findById(tenantId);
    const resident = await this.usersService.findById(tenantId, dto.residentId);

    const pricing = await this.rulesEngine.computePrice(tenant, resident, dto.requestedCapacityLiters);

    const status = pricing.amountDue === 0 ? RequestStatus.CONFIRMED : RequestStatus.PENDING_PAYMENT;
    const paymentStatus = pricing.amountDue === 0 ? PaymentStatus.NOT_APPLICABLE : PaymentStatus.PENDING;

    // repo.create() can't express a raw SQL value (ST_SetSRID(...)) for the
    // geography column, so this uses the insert query builder directly.
    const insertResult = await this.requestsRepo
      .createQueryBuilder()
      .insert()
      .into(TankerRequest)
      .values({
        tenantId,
        residentId: dto.residentId,
        requestedCapacityLiters: dto.requestedCapacityLiters,
        location: () => `ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)`,
        addressText: dto.addressText,
        amountDue: pricing.amountDue,
        paymentStatus,
        status,
      } as any)
      .returning('id')
      .execute();

    const savedId = insertResult.identifiers[0].id as string;
    const saved = await this.findById(tenantId, savedId);

    if (saved.status === RequestStatus.CONFIRMED) {
      await this.enqueueForDispatch(saved, dto.lat, dto.lng);
    }

    return saved;
  }

  /** Called by the payment webhook once Razorpay/Cashfree confirms payment. */
  async markPaid(tenantId: string, requestId: string, lat: number, lng: number): Promise<TankerRequest> {
    const request = await this.findById(tenantId, requestId);
    if (request.paymentStatus === PaymentStatus.PAID) return request; // idempotent

    request.paymentStatus = PaymentStatus.PAID;
    request.status = RequestStatus.CONFIRMED;
    const saved = await this.requestsRepo.save(request);

    await this.enqueueForDispatch(saved, lat, lng);
    return saved;
  }

  /** Step 3 of the flow: find the nearest available tanker and assign it. */
  private async enqueueForDispatch(request: TankerRequest, lat: number, lng: number): Promise<void> {
    const candidates = await this.tankersService.findNearestAvailable(request.tenantId, lat, lng, 1);
    if (candidates.length === 0) {
      // No tanker free right now - leave status CONFIRMED; an admin can
      // manually assign later, or a scheduled job can retry.
      await this.notificationsQueue.add('no-tanker-available', { requestId: request.id });
      return;
    }

    const tanker = candidates[0];
    request.tankerId = tanker.id;
    request.status = RequestStatus.ASSIGNED;
    await this.requestsRepo.save(request);
    await this.tankersService.setStatus(request.tenantId, tanker.id, TankerStatus.EN_ROUTE);

    await this.notificationsQueue.add('tanker-assigned', {
      requestId: request.id,
      tankerId: tanker.id,
      residentId: request.residentId,
    });

    this.realtimePublisher.publishRequestUpdate(request.tenantId, request.id, {
      status: request.status,
      tankerId: tanker.id,
    });
  }

  /** Driver marks arrival; resident enters the OTP shown in their app to confirm. */
  async confirmDelivery(tenantId: string, requestId: string, otp: string): Promise<TankerRequest> {
    const request = await this.findById(tenantId, requestId);
    if (request.status !== RequestStatus.EN_ROUTE && request.status !== RequestStatus.ASSIGNED) {
      throw new BadRequestException('Request is not ready for delivery confirmation');
    }
    if (!request.deliveryOtp || request.deliveryOtp !== otp) {
      throw new BadRequestException('Invalid delivery OTP');
    }

    request.status = RequestStatus.DELIVERED;
    request.deliveredAt = new Date();
    const saved = await this.requestsRepo.save(request);

    if (request.tankerId) {
      await this.tankersService.setStatus(tenantId, request.tankerId, TankerStatus.AVAILABLE);
    }

    this.realtimePublisher.publishRequestUpdate(tenantId, requestId, { status: 'delivered' });
    await this.notificationsQueue.add('delivery-confirmed', { requestId });

    return saved;
  }

  async findById(tenantId: string, id: string): Promise<TankerRequest> {
    const request = await this.requestsRepo.findOne({ where: { tenantId, id } });
    if (!request) throw new NotFoundException(`Request ${id} not found`);
    return request;
  }

  async findForResident(tenantId: string, residentId: string): Promise<TankerRequest[]> {
    return this.requestsRepo.find({ where: { tenantId, residentId }, order: { createdAt: 'DESC' } });
  }
}
