import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tanker } from './entities/tanker.entity';
import { TankersService } from './tankers.service';
import { TankersController } from './tankers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tanker])],
  providers: [TankersService],
  controllers: [TankersController],
  exports: [TankersService],
})
export class TankersModule {}
