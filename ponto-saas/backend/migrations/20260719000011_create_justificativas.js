exports.up = function (knex) {
  return knex.schema.createTable('justificativas', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionarios').onDelete('CASCADE');

    table
      .enu(
        'tipo',
        ['atestado_medico', 'falta_justificada', 'ferias', 'licenca', 'folga_compensatoria', 'outro'],
        { useNative: true, enumName: 'justificativa_tipo' }
      )
      .notNullable();

    table.date('data_inicio').notNullable();
    table.date('data_fim').notNullable();
    table.string('anexo_url', 300);

    table
      .enu('status', ['pendente', 'aprovado', 'recusado'], {
        useNative: true,
        enumName: 'justificativa_status',
      })
      .notNullable()
      .defaultTo('pendente');
    table.uuid('aprovado_por').references('id').inTable('usuarios').onDelete('SET NULL');
    table.timestamp('aprovado_em');
    table.text('observacao');

    table.timestamps(true, true);

    table.index(['empresa_id', 'funcionario_id', 'data_inicio', 'data_fim']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('justificativas');
  await knex.raw('DROP TYPE IF EXISTS justificativa_tipo');
  await knex.raw('DROP TYPE IF EXISTS justificativa_status');
};
