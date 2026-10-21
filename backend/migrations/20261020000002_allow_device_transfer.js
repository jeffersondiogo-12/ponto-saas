exports.up = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS dispositivos_numero_serie_unique');
  await knex.schema.raw(
    'ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS dispositivos_empresa_id_numero_serie_unique'
  );
  await knex.schema.raw(
    // Preserve the existing exact-string uniqueness for active equipment,
    // while allowing the same serial to remain in inactive history.
    "CREATE UNIQUE INDEX dispositivos_numero_serie_ativo_unique ON dispositivos (numero_serie) WHERE situacao = 'ativo'"
  );
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS dispositivos_numero_serie_ativo_unique');
  await knex.schema.raw(
    'CREATE UNIQUE INDEX dispositivos_numero_serie_unique ON dispositivos (numero_serie)'
  );
};
