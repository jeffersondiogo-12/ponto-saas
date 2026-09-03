exports.up = async function up(knex) {
  const existe = await knex.schema.hasColumn('avisos_escola', 'enviado_em');
  if (!existe) {
    await knex.schema.alterTable('avisos_escola', (table) => {
      table.timestamp('enviado_em').nullable();
    });
  }

  await knex('avisos_escola').whereNull('enviado_em').update({ enviado_em: knex.ref('publicado_em') });
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_avisos_pendentes ON avisos_escola (publicado_em) WHERE enviado_em IS NULL'
  );
};

exports.down = async function down(knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_avisos_pendentes');
  const existe = await knex.schema.hasColumn('avisos_escola', 'enviado_em');
  if (existe) {
    await knex.schema.alterTable('avisos_escola', (table) => table.dropColumn('enviado_em'));
  }
};
