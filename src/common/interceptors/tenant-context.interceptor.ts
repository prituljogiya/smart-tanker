import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Observable, from, switchMap } from 'rxjs';

/**
 * Sets `app.current_tenant_id` for the duration of each request so the
 * row-level security policies created in the initial migration can
 * enforce tenant isolation at the database level, as a second line of
 * defense behind the tenantId checks already in each service method.
 *
 * NOTE: this uses a dedicated connection per request via query runner,
 * which is the correct approach for RLS with a pooled ORM but does cost
 * a bit more than a plain pooled query. For very high-throughput read
 * endpoints that don't touch sensitive tables, this can be skipped.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;
    if (!tenantId) return next.handle();

    const queryRunner = this.dataSource.createQueryRunner();
    request.queryRunner = queryRunner; // services can use this for tenant-scoped queries

    return from(queryRunner.connect())
      .pipe(
        switchMap(() => queryRunner.query(`SET app.current_tenant_id = '${tenantId}'`)),
        switchMap(() => next.handle()),
      );
  }
}
