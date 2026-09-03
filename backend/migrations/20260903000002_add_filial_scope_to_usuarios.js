exports.up = async function up(knex) {
  const existe = await knex.schema.hasColumn('usuarios', 'filial_id');
  if (!existe) {
    await knex.schema.alterTable('usuarios', (table) => {
      table.uuid('filial_id').nullable().references('id').inTable('filiais').onDelete('SET NULL');
      table.index(['empresa_id', 'filial_id']);
    });
  }
};

exports.down = async function down(knex) {
  const existe = await knex.schema.hasColumn('usuarios', 'filial_id');
  if (existe) {
    await knex.schema.alterTable('usuarios', (table) => {
      table.dropColumn('filial_id');
    });
  }
};
