exports.up = async function (knex) {
  await knex.schema.alterTable('responsaveis', (table) => {
    table.string('cpf', 14);
  });
  await knex.schema.alterTable('alunos', (table) => {
    table.string('cpf', 14);
  });

  await knex.schema.raw('CREATE UNIQUE INDEX IF NOT EXISTS uq_responsaveis_empresa_cpf ON responsaveis (empresa_id, cpf) WHERE cpf IS NOT NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_alunos_empresa_cpf ON alunos (empresa_id, cpf)');

  await knex.schema.createTable('notas_alunos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('aluno_id').notNullable().references('id').inTable('alunos').onDelete('CASCADE');
    table.string('disciplina', 100).notNullable();
    table.string('etapa', 50).notNullable();
    table.decimal('nota', 5, 2);
    table.text('observacao');
    table.timestamps(true, true);
    table.index(['aluno_id', 'etapa']);
  });

  await knex.schema.createTable('observacoes_alunos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('aluno_id').notNullable().references('id').inTable('alunos').onDelete('CASCADE');
    table.string('titulo', 150).notNullable();
    table.text('texto').notNullable();
    table.string('autor_nome', 150);
    table.timestamps(true, true);
    table.index(['aluno_id', 'created_at']);
  });

  await knex.schema.createTable('avisos_escola', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('filial_id').references('id').inTable('filiais').onDelete('CASCADE');
    table.string('titulo', 150).notNullable();
    table.text('mensagem').notNullable();
    table.timestamp('publicado_em').notNullable().defaultTo(knex.fn.now());
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.index(['empresa_id', 'filial_id', 'publicado_em']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('avisos_escola');
  await knex.schema.dropTableIfExists('observacoes_alunos');
  await knex.schema.dropTableIfExists('notas_alunos');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_alunos_empresa_cpf');
  await knex.schema.raw('DROP INDEX IF EXISTS uq_responsaveis_empresa_cpf');
  await knex.schema.alterTable('alunos', (table) => table.dropColumn('cpf'));
  await knex.schema.alterTable('responsaveis', (table) => table.dropColumn('cpf'));
};
