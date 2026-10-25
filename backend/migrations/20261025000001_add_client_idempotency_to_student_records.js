exports.up = async function (knex) {
  await knex.schema.alterTable('notas_alunos', (table) => {
    table.string('id_cliente', 40).nullable();
  });
  await knex.schema.alterTable('observacoes_alunos', (table) => {
    table.string('id_cliente', 40).nullable();
  });

  await knex.schema.raw('CREATE UNIQUE INDEX IF NOT EXISTS uq_notas_alunos_id_cliente ON notas_alunos (id_cliente)');
  await knex.schema.raw('CREATE UNIQUE INDEX IF NOT EXISTS uq_observacoes_alunos_id_cliente ON observacoes_alunos (id_cliente)');
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS uq_observacoes_alunos_id_cliente');
  await knex.schema.raw('DROP INDEX IF EXISTS uq_notas_alunos_id_cliente');
  await knex.schema.alterTable('observacoes_alunos', (table) => {
    table.dropColumn('id_cliente');
  });
  await knex.schema.alterTable('notas_alunos', (table) => {
    table.dropColumn('id_cliente');
  });
};
