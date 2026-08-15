exports.up = function (knex) {
  return knex.schema.createTable('responsaveis', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // Um responsavel pode ter filhos em unidades diferentes da MESMA empresa
    // (ex: uma rede de escolas) - por isso amarra na empresa, nao na filial.
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.string('nome', 150).notNullable();
    table.string('email', 150).notNullable();
    table.string('senha_hash', 200).notNullable();
    table.string('telefone', 20);
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamp('ultimo_login_em');
    table.timestamps(true, true);

    table.unique(['email']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('responsaveis');
};
