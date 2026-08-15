exports.up = async function (knex) {
  await knex.schema.alterTable('alunos', (table) => {
    table.string('cpf', 20);
    table.string('foto_url', 500);
    table.string('horario_entrada', 10);
    table.string('horario_saida', 10);
    table.index(['empresa_id', 'cpf']);
  });

  await knex.schema.createTable('professores', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('filial_id').references('id').inTable('filiais').onDelete('SET NULL');
    table.string('nome', 150).notNullable();
    table.string('email', 150).notNullable();
    table.string('senha_hash', 200).notNullable();
    table.string('telefone', 30);
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique(['empresa_id', 'email']);
    table.index(['filial_id']);
  });

  await knex.schema.createTable('professor_turmas', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('professor_id').notNullable().references('id').inTable('professores').onDelete('CASCADE');
    table.uuid('turma_id').notNullable().references('id').inTable('turmas').onDelete('CASCADE');
    table.string('turno', 20).notNullable().defaultTo('manha');
    table.timestamps(true, true);

    table.unique(['professor_id', 'turma_id']);
    table.index(['turma_id']);
  });

  await knex.schema.createTable('chamadas', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('turma_id').notNullable().references('id').inTable('turmas').onDelete('CASCADE');
    table.uuid('professor_id').notNullable().references('id').inTable('professores').onDelete('CASCADE');
    table.date('data').notNullable();
    table.string('status', 30).notNullable().defaultTo('aberta');
    table.timestamps(true, true);

    table.unique(['turma_id', 'data']);
    table.index(['professor_id', 'data']);
  });

  await knex.schema.createTable('presencas', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('chamada_id').notNullable().references('id').inTable('chamadas').onDelete('CASCADE');
    table.uuid('aluno_id').notNullable().references('id').inTable('alunos').onDelete('CASCADE');
    table.string('status', 30).notNullable().defaultTo('presente');
    table.text('observacao');
    table.timestamps(true, true);

    table.unique(['chamada_id', 'aluno_id']);
    table.index(['aluno_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('presencas');
  await knex.schema.dropTableIfExists('chamadas');
  await knex.schema.dropTableIfExists('professor_turmas');
  await knex.schema.dropTableIfExists('professores');

  await knex.schema.alterTable('alunos', (table) => {
    table.dropColumns('cpf', 'foto_url', 'horario_entrada', 'horario_saida');
  });
};
