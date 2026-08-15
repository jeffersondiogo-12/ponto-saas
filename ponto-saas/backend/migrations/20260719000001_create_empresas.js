exports.up = function (knex) {
  return knex.schema.createTable('empresas', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('razao_social', 200).notNullable();
    table.string('nome_fantasia', 200);
    table.string('cnpj', 18).notNullable().unique(); // formato 00.000.000/0000-00
    table.string('email', 150);
    table.string('telefone', 20);
    table.string('endereco', 300);
    // Limite legal (CLT art. 74 §2) muda o comportamento de obrigatoriedade
    // de ponto eletronico; guardamos para exibir avisos e nao para bloquear.
    table.integer('quantidade_funcionarios_estimada').defaultTo(0);
    table.string('plano', 30).notNullable().defaultTo('basico');
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('empresas');
};
