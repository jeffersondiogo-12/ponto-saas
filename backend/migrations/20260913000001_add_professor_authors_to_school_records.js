exports.up = async function up(knex) {
  const notasTemCriador = await knex.schema.hasColumn('notas_alunos', 'criado_por_usuario_id');
  if (!notasTemCriador) {
    await knex.schema.alterTable('notas_alunos', (table) => {
      table.uuid('criado_por_usuario_id').references('id').inTable('usuarios').onDelete('SET NULL');
      table.index(['empresa_id', 'criado_por_usuario_id', 'aluno_id', 'created_at']);
    });
  }

  const observacoesTemCriador = await knex.schema.hasColumn('observacoes_alunos', 'criado_por_usuario_id');
  if (!observacoesTemCriador) {
    await knex.schema.alterTable('observacoes_alunos', (table) => {
      table.uuid('criado_por_usuario_id').references('id').inTable('usuarios').onDelete('SET NULL');
      table.index(['empresa_id', 'criado_por_usuario_id', 'aluno_id', 'created_at']);
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn('observacoes_alunos', 'criado_por_usuario_id')) {
    await knex.schema.alterTable('observacoes_alunos', (table) => table.dropColumn('criado_por_usuario_id'));
  }
  if (await knex.schema.hasColumn('notas_alunos', 'criado_por_usuario_id')) {
    await knex.schema.alterTable('notas_alunos', (table) => table.dropColumn('criado_por_usuario_id'));
  }
};
