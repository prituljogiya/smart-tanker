import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { TankerRequest } from './entities/request.entity';
import { QuotaUsage } from './entities/quota-usage.entity';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { RulesEngineService } from './rules-engine.service';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { TankersModule } from '../tankers/tankers.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([TankerRequest, QuotaUsage]),
    BullModule.registerQueue({ name: 'notifications' }),
    TenantsModule,
    UsersModule,
    TankersModule,
    RealtimeModule,
  ],
  providers: [RequestsService, RulesEngineService, NotificationsProcessor],
  controllers: [RequestsController],
  exports: [RequestsService],
})
export class RequestsModule {}
