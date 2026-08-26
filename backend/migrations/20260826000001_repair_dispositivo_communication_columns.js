/** Repara colunas de comunicacao caso uma migration anterior tenha sido marcada sem conclui-las. */
exports.up = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE dispositivos
      ADD COLUMN IF NOT EXISTS ultima_conexao_ws_em TIMESTAMP,
      ADD COLUMN IF NOT EXISTS ultimo_devinfo JSONB
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE dispositivos
      DROP COLUMN IF EXISTS ultima_conexao_ws_em,
      DROP COLUMN IF EXISTS ultimo_devinfo
  `);
};
