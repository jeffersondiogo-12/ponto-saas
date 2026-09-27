exports.up = async function (knex) {
  await knex.schema.createTable('push_web', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('responsavel_id').notNullable().references('id').inTable('responsaveis').onDelete('CASCADE');
    table.text('endpoint').notNullable().unique();
    table.string('p256dh', 200).notNullable();
    table.string('auth', 200).notNullable();
    table.timestamps(true, true);
    table.index('responsavel_id');
  });
  await knex.raw('CREATE TRIGGER trg_push_web_updated_at BEFORE UPDATE ON push_web FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at()');
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('push_web');
};