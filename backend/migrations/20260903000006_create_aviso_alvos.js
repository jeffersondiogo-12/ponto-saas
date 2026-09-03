exports.up = function up(knex) {
  return knex.schema.createTable('aviso_alvos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('aviso_id').notNullable().references('id').inTable('avisos_escola').onDelete('CASCADE');
    table.uuid('filial_id').nullable().references('id').inTable('filiais').onDelete('CASCADE');
    table.uuid('turma_id').nullable().references('id').inTable('turmas').onDelete('CASCADE');
    table.unique(['aviso_id', 'filial_id', 'turma_id']);
    table.index(['aviso_id', 'filial_id']);
    table.index(['aviso_id', 'turma_id']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('aviso_alvos');
};
