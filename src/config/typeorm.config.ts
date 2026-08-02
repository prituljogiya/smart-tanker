import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'smart_tanker',
  password: process.env.DB_PASSWORD || 'change_me',
  database: process.env.DB_NAME || 'smart_tanker',
  entities: ['src/**/*.entity.ts'],
  migrations: ['migrations/*.ts'],
  synchronize: false, // always use migrations - never auto-sync in this multi-tenant schema
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(typeOrmConfig);
