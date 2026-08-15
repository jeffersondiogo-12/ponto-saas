exports.up = function (knex) {
  return knex.schema.createTable('auditoria_logs', (table) => {
    table.bigIncrements('id').primary();
    table.uuid('empresa_id').references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('usuario_id').references('id').inTable('usuarios').onDelete('SET NULL');
    table.string('acao', 60).notNullable(); // ex: "atualizar_registro_ponto", "aprovar_justificativa"
    table.string('entidade', 60).notNullable(); // ex: "registros_ponto"
    table.string('entidade_id', 60);
    table.jsonb('dados_antes');
    table.jsonb('dados_depois');
    table.string('ip_origem', 45);
    table.timestamp('criado_em').notNullable().defaultTo(knex.fn.now());

    table.index(['empresa_id', 'entidade', 'entidade_id']);
    table.index(['criado_em']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('auditoria_logs');
};
