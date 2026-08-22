exports.up = async function (knex) {
  await knex.raw("ALTER TYPE usuario_papel ADD VALUE IF NOT EXISTS 'professor'");

  await knex.schema.createTable('turma_professores', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('turma_id').notNullable().references('id').inTable('turmas').onDelete('CASCADE');
    table.uuid('professor_id').notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
    table.string('materia', 100).notNullable();
    table.jsonb('dias_semana').notNullable().defaultTo('[]');
    table.time('hora_inicio').notNullable();
    table.time('hora_fim').notNullable();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.unique(['turma_id', 'professor_id', 'materia']);
    table.index(['professor_id', 'ativo']);
  });

  await knex.schema.createTable('presencas_sala', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('turma_id').notNullable().references('id').inTable('turmas').onDelete('CASCADE');
    table.uuid('aluno_id').notNullable().references('id').inTable('alunos').onDelete('CASCADE');
    table.uuid('professor_id').notNullable().references('id').inTable('usuarios').onDelete('RESTRICT');
    table.date('data').notNullable();
    table.boolean('presente').notNullable().defaultTo(true);
    table.text('observacao');
    table.timestamps(true, true);
    table.unique(['turma_id', 'aluno_id', 'professor_id', 'data']);
    table.index(['aluno_id', 'data']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('presencas_sala');
  await knex.schema.dropTableIfExists('turma_professores');
};
