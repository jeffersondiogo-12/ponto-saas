require('dotenv').config();

/**
 * Configuracao do Knex por ambiente.
 * Em producao, prefira sempre variaveis de ambiente (nunca credenciais no codigo).
 */
const sslOptions = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: false, servername: process.env.DB_HOST, checkServerIdentity: () => undefined }
  : false;

const connection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: sslOptions }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'ponto',
      password: process.env.DB_PASSWORD || 'ponto',
      database: process.env.DB_NAME || 'ponto_saas',
      ssl: sslOptions,
    };

const base = {
  client: 'pg',
  connection,
  pool: { min: 2, max: 10 },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
  },
};

module.exports = {
  development: base,
  production: {
    ...base,
    pool: { min: 2, max: 20 },
  },
};
