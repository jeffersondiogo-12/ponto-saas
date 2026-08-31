exports.up = async function (knex) {
  await knex.schema.alterTable('avisos_escola', (table) => {
    table.uuid('turma_id').nullable().references('id').inTable('turmas').onDelete('CASCADE');
  });
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_avisos_escola_turma ON avisos_escola (empresa_id, turma_id, publicado_em)');
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_avisos_escola_turma');
  await knex.schema.alterTable('avisos_escola', (table) => {
    table.dropColumn('turma_id');
  });
};
