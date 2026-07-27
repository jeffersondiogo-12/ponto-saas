exports.up = function (knex) {
  return knex.schema.createTable('responsavel_alunos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('responsavel_id').notNullable().references('id').inTable('responsaveis').onDelete('CASCADE');
    table.uuid('aluno_id').notNullable().references('id').inTable('alunos').onDelete('CASCADE');
    table.string('parentesco', 40); // ex: "mae", "pai", "avo" - so informativo
    table.timestamps(true, true);

    table.unique(['responsavel_id', 'aluno_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('responsavel_alunos');
};
