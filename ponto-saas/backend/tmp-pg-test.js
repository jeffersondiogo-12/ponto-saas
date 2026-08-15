const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:atlasdiogo1214@aws-0-ca-central-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false,
    servername: 'aws-0-ca-central-1.pooler.supabase.com',
    checkServerIdentity: () => undefined,
  },
});

client.connect()
  .then(() => client.query('select 1 as ok'))
  .then(res => {
    console.log('ok', JSON.stringify(res.rows));
    return client.end();
  })
  .catch(err => {
    console.error('err', err.code || err.name, err.message);
    return client.end().catch(() => {});
  });
