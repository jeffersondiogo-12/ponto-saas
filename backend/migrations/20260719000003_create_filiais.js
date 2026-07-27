exports.up = function (knex) {
  return knex.schema.createTable('filiais', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.string('nome', 150).notNullable();
    table.string('cnpj', 18); // pode ter CNPJ proprio (filial) ou ficar em branco
    table.string('endereco', 300);
    table.string('fuso_horario', 60).notNullable().defaultTo('America/Sao_Paulo');
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('filiais');
};
