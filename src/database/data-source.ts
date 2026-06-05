import { DataSource, DataSourceOptions } from 'typeorm';
import config from '../config/configuration';

/**
 * Standalone DataSource used by the TypeORM CLI and by the AppModule factory.
 * Entities are auto-discovered via the glob so new entities are picked up
 * without touching this file.
 */
const cfg = config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: cfg.database.host,
  port: cfg.database.port,
  username: cfg.database.user,
  password: cfg.database.password,
  database: cfg.database.name,
  synchronize: cfg.database.synchronize,
  logging: cfg.database.logging,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
