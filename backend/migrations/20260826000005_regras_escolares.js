/** Campos para chamada vinculada ao facial e avaliacao bimestral. */
exports.up = async function (knex) {
  await knex.schema.alterTable('presencas_sala', (table) => {
    table.boolean('falta_justificada').notNullable().defaultTo(false);
    table.text('justificativa');
  });

  await knex.schema.alterTable('notas_alunos', (table) => {
    table.integer('bimestre');
    table.string('tipo_avaliacao', 30);
    table.string('atividade', 150);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('notas_alunos', (table) => {
    table.dropColumn('atividade');
    table.dropColumn('tipo_avaliacao');
    table.dropColumn('bimestre');
  });
  await knex.schema.alterTable('presencas_sala', (table) => {
    table.dropColumn('justificativa');
    table.dropColumn('falta_justificada');
  });
};
