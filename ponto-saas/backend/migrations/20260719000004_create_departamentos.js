exports.up = function (knex) {
  return knex.schema.createTable('departamentos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.string('nome', 120).notNullable();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('departamentos');
};
