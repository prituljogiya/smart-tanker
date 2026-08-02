import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Roles(Role.RESIDENT)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { lat: number; lng: number; addressText: string; requestedCapacityLiters: number },
  ) {
    return this.requestsService.create(user.tenantId, { residentId: user.userId, ...body });
  }

  @Get('mine')
  @Roles(Role.RESIDENT)
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.requestsService.findForResident(user.tenantId, user.userId);
  }

  @Get(':id')
  @Roles(Role.RESIDENT, Role.DRIVER, Role.TENANT_ADMIN, Role.SUPER_ADMIN)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requestsService.findById(user.tenantId, id);
  }

  @Post(':id/confirm-delivery')
  @Roles(Role.DRIVER)
  confirmDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { otp: string },
  ) {
    return this.requestsService.confirmDelivery(user.tenantId, id, body.otp);
  }
}
