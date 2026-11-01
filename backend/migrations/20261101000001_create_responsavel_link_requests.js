exports.up = async function (knex) {
  await knex.schema.createTable('pedidos_vinculo_responsaveis', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('aluno_id').notNullable().references('id').inTable('alunos').onDelete('CASCADE');
    table.uuid('responsavel_id').notNullable().references('id').inTable('responsaveis').onDelete('CASCADE');
    table.uuid('decidido_por').references('id').inTable('usuarios').onDelete('SET NULL');
    table.string('parentesco', 40);
    table.enu('status', ['pendente', 'aprovado', 'rejeitado'], {
      useNative: true,
      enumName: 'pedido_vinculo_responsavel_status',
    }).notNullable().defaultTo('pendente');
    table.timestamp('decidido_em');
    table.timestamps(true, true);
    table.index(['empresa_id', 'status', 'created_at']);
    table.index(['aluno_id', 'status']);
  });

  await knex.raw(`
    CREATE UNIQUE INDEX uq_pedidos_vinculo_responsavel_pendente
    ON pedidos_vinculo_responsaveis (responsavel_id, aluno_id)
    WHERE status = 'pendente'
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('pedidos_vinculo_responsaveis');
  await knex.raw('DROP TYPE IF EXISTS pedido_vinculo_responsavel_status');
};
