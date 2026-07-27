exports.up = function (knex) {
  return knex.schema.createTable('usuarios', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // Nulo somente para o papel super_admin (opera fora de uma empresa especifica).
    table.uuid('empresa_id').references('id').inTable('empresas').onDelete('CASCADE');
    table.string('nome', 150).notNullable();
    table.string('email', 150).notNullable();
    table.string('senha_hash', 200).notNullable();
    table
      .enu('papel', ['super_admin', 'admin', 'rh', 'gestor'], {
        useNative: true,
        enumName: 'usuario_papel',
      })
      .notNullable()
      .defaultTo('admin');
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamp('ultimo_login_em');
    table.timestamps(true, true);

    table.unique(['email']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('usuarios');
  await knex.raw('DROP TYPE IF EXISTS usuario_papel');
};
