exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('push_web'))) {
    await knex.schema.createTable('push_web', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('responsavel_id').notNullable().references('id').inTable('responsaveis').onDelete('CASCADE');
      table.text('endpoint').notNullable().unique();
      table.string('p256dh', 200).notNullable();
      table.string('auth', 200).notNullable();
      table.timestamps(true, true);
      table.index('responsavel_id');
    });
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS push_web_responsavel_id_index ON public.push_web USING btree (responsavel_id)');
  const trigger = await knex('pg_trigger as pt')
    .join('pg_class as pc', 'pc.oid', 'pt.tgrelid')
    .join('pg_namespace as pn', 'pn.oid', 'pc.relnamespace')
    .where({ 'pn.nspname': 'public', 'pc.relname': 'push_web', 'pt.tgname': 'trg_push_web_updated_at' })
    .whereNot('pt.tgisinternal', true)
    .first('pt.tgname');
  if (!trigger) {
    await knex.raw('CREATE TRIGGER trg_push_web_updated_at BEFORE UPDATE ON public.push_web FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at()');
  }
};

exports.down = async function (knex) {
  await knex.raw('DROP TRIGGER IF EXISTS trg_push_web_updated_at ON public.push_web');
  await knex.raw('DROP INDEX IF EXISTS public.push_web_responsavel_id_index');
};