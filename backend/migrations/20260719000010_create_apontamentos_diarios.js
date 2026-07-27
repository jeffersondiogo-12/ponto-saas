exports.up = function (knex) {
  return knex.schema.createTable('apontamentos_diarios', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionarios').onDelete('CASCADE');
    table.date('data').notNullable();

    // Sequencia de batidas do dia, ja ordenada e pareada, mantida por transparencia/auditoria.
    // Formato: [{ "hora": "08:02", "tipo": "entrada", "registro_ponto_id": 123 }, ...]
    table.jsonb('batidas').notNullable().defaultTo('[]');

    table.integer('horas_previstas_minutos').notNullable().defaultTo(0);
    table.integer('horas_trabalhadas_minutos').notNullable().defaultTo(0);
    table.integer('saldo_minutos').notNullable().defaultTo(0); // trabalhadas - previstas
    table.integer('extras_50_minutos').notNullable().defaultTo(0);
    table.integer('extras_100_minutos').notNullable().defaultTo(0); // domingos/feriados, se aplicavel
    table.integer('adicional_noturno_minutos').notNullable().defaultTo(0); // 22h-5h, CLT art.73
    table.integer('atraso_minutos').notNullable().defaultTo(0);
    table.boolean('falta').notNullable().defaultTo(false);
    table.boolean('feriado').notNullable().defaultTo(false);
    table.uuid('justificativa_id'); // FK adicionada apos a tabela justificativas existir

    table
      .enu('status', ['pendente', 'aprovado', 'ajustado'], {
        useNative: true,
        enumName: 'apontamento_status',
      })
      .notNullable()
      .defaultTo('pendente');
    table.text('observacao');

    table.timestamps(true, true);

    table.unique(['funcionario_id', 'data']);
    table.index(['empresa_id', 'data']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('apontamentos_diarios');
  await knex.raw('DROP TYPE IF EXISTS apontamento_status');
};
