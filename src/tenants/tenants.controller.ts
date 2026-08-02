import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  findOne(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() body: { name: string; type: string; rules?: Record<string, any> }) {
    return this.tenantsService.create(body as any);
  }

  @Patch(':id/rules')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  updateRules(@Param('id') id: string, @Body() rules: Record<string, any>) {
    return this.tenantsService.updateRules(id, rules);
  }
}
