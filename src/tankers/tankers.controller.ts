import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { TankersService } from './tankers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { TankerStatus } from './entities/tanker.entity';

@Controller('tankers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TankersController {
  constructor(private readonly tankersService: TankersService) {}

  @Get()
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN)
  findFleet(@CurrentUser() user: AuthenticatedUser) {
    return this.tankersService.findFleet(user.tenantId);
  }

  @Get('nearest')
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.RESIDENT)
  findNearest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.tankersService.findNearestAvailable(user.tenantId, body.lat, body.lng);
  }

  @Patch(':id/status')
  @Roles(Role.DRIVER, Role.TENANT_ADMIN)
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { status: TankerStatus },
  ) {
    return this.tankersService.setStatus(user.tenantId, id, body.status);
  }
}
