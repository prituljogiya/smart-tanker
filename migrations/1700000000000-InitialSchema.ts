import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates every table used by the MVP, enables PostGIS, and sets up
 * row-level security (RLS) as the second layer of tenant isolation
 * described in the architecture doc (section 4 / 6): even if application
 * code has a bug and forgets a WHERE tenant_id = ... clause, Postgres
 * itself will refuse to return another tenant's rows.
 *
 * RLS relies on a session variable `app.current_tenant_id` being set at
 * the start of each request/transaction - see
 * src/common/middleware/tenant-context.middleware.ts (to be added) which
 * should run `SET app.current_tenant_id = '<tenantId>'` using the tenantId
 * from the verified JWT before any query executes.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(`
      CREATE TYPE tenant_type AS ENUM ('government', 'private');
    `);
    await queryRunner.query(`
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR NOT NULL,
        type tenant_type NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        rules JSONB NOT NULL DEFAULT '{}',
        branding_config JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TYPE user_role AS ENUM ('resident', 'driver', 'tenant_admin', 'super_admin');
      CREATE TYPE household_category AS ENUM ('residential', 'bpl', 'commercial');
    `);
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        role user_role NOT NULL,
        display_name VARCHAR NOT NULL,
        phone_encrypted TEXT NOT NULL,
        phone_hash VARCHAR(64) NOT NULL,
        address_encrypted TEXT,
        household_category household_category,
        password_hash VARCHAR,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, phone_hash)
      );
    `);

    await queryRunner.query(`
      CREATE TYPE tanker_status AS ENUM ('available', 'en_route', 'delivering', 'offline');
    `);
    await queryRunner.query(`
      CREATE TABLE tankers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        vehicle_number VARCHAR NOT NULL,
        capacity_liters INT NOT NULL,
        driver_id UUID REFERENCES users(id),
        status tanker_status NOT NULL DEFAULT 'offline',
        last_location GEOGRAPHY(Point, 4326),
        last_location_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_tankers_tenant_status ON tankers (tenant_id, status);
      CREATE INDEX idx_tankers_last_location ON tankers USING GIST (last_location);
    `);

    await queryRunner.query(`
      CREATE TYPE request_status AS ENUM (
        'pending_payment', 'confirmed', 'assigned', 'en_route', 'delivered', 'cancelled', 'expired'
      );
      CREATE TYPE payment_status AS ENUM ('n/a', 'pending', 'paid', 'failed', 'refunded');
    `);
    await queryRunner.query(`
      CREATE TABLE requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        resident_id UUID NOT NULL REFERENCES users(id),
        tanker_id UUID REFERENCES tankers(id),
        requested_capacity_liters INT NOT NULL,
        location GEOGRAPHY(Point, 4326) NOT NULL,
        address_text VARCHAR NOT NULL,
        status request_status NOT NULL DEFAULT 'pending_payment',
        amount_due NUMERIC(10,2) NOT NULL DEFAULT 0,
        payment_status payment_status NOT NULL DEFAULT 'n/a',
        delivery_otp VARCHAR(6),
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_requests_tenant_status ON requests (tenant_id, status);
      CREATE INDEX idx_requests_location ON requests USING GIST (location);
    `);

    await queryRunner.query(`
      CREATE TABLE quota_usage (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        user_id UUID NOT NULL REFERENCES users(id),
        month VARCHAR(7) NOT NULL,
        tankers_used INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, user_id, month)
      );
    `);

    await queryRunner.query(`
      CREATE TYPE payment_gateway_status AS ENUM ('pending', 'success', 'failed', 'refunded');
    `);
    await queryRunner.query(`
      CREATE TABLE payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        request_id UUID NOT NULL REFERENCES requests(id),
        amount NUMERIC(10,2) NOT NULL,
        gateway_txn_id VARCHAR NOT NULL UNIQUE,
        gateway VARCHAR NOT NULL DEFAULT 'razorpay',
        status payment_gateway_status NOT NULL DEFAULT 'pending',
        method VARCHAR,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE location_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        tanker_id UUID NOT NULL REFERENCES tankers(id),
        location GEOGRAPHY(Point, 4326) NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_location_logs_tanker_time ON location_logs (tanker_id, recorded_at);
    `);
    // Partition-by-month note: at scale, convert location_logs to a
    // partitioned table (PARTITION BY RANGE (recorded_at)) per the
    // architecture doc's "Database growth" scalability guidance.

    await queryRunner.query(`
      CREATE TABLE complaints (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        request_id UUID NOT NULL REFERENCES requests(id),
        description TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // --- Row-level security: second layer of tenant isolation ---
    const tenantScopedTables = [
      'users',
      'tankers',
      'requests',
      'quota_usage',
      'payments',
      'location_logs',
      'complaints',
    ];
    for (const table of tenantScopedTables) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation_${table} ON ${table}
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS complaints`);
    await queryRunner.query(`DROP TABLE IF EXISTS location_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS payments`);
    await queryRunner.query(`DROP TABLE IF EXISTS quota_usage`);
    await queryRunner.query(`DROP TABLE IF EXISTS requests`);
    await queryRunner.query(`DROP TABLE IF EXISTS tankers`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_gateway_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS request_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS tanker_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS household_category`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role`);
    await queryRunner.query(`DROP TYPE IF EXISTS tenant_type`);
  }
}
