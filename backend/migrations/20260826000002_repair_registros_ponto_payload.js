/** Garante o payload bruto quando a migration original ficou registrada sem concluir. */
exports.up = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE registros_ponto
      ADD COLUMN IF NOT EXISTS payload_bruto JSONB
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE registros_ponto
      DROP COLUMN IF EXISTS payload_bruto
  `);
};
