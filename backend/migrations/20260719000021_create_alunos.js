exports.up = function (knex) {
  return knex.schema.createTable('alunos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('filial_id').notNullable().references('id').inTable('filiais').onDelete('CASCADE');
    table.uuid('turma_id').references('id').inTable('turmas').onDelete('SET NULL');

    table.string('matricula', 30).notNullable();
    table.string('nome', 150).notNullable();
    table.date('data_nascimento');
    table.string('nome_responsavel', 150);
    table.string('contato_responsavel', 100);
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique(['empresa_id', 'matricula']);
    table.index(['turma_id']);
    table.index(['empresa_id', 'ativo']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('alunos');
};
