exports.up = function up(knex) {
  return knex.schema.createTable('aviso_leituras', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('aviso_id').notNullable().references('id').inTable('avisos_escola').onDelete('CASCADE');
    table.uuid('responsavel_id').notNullable().references('id').inTable('responsaveis').onDelete('CASCADE');
    table.timestamp('lido_em').notNullable().defaultTo(knex.fn.now());
    table.unique(['aviso_id', 'responsavel_id']);
    table.index(['aviso_id', 'lido_em']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('aviso_leituras');
};
