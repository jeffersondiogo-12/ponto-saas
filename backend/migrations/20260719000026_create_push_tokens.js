exports.up = function (knex) {
  return knex.schema.createTable('push_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('responsavel_id').notNullable().references('id').inTable('responsaveis').onDelete('CASCADE');
    table.string('token', 200).notNullable(); // ExponentPushToken[...]
    table
      .enu('plataforma', ['ios', 'android'], { useNative: true, enumName: 'push_token_plataforma' })
      .notNullable();
    table.timestamps(true, true);

    table.unique(['token']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('push_tokens');
  await knex.raw('DROP TYPE IF EXISTS push_token_plataforma');
};
