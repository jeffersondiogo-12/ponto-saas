exports.up = async function (knex) {
  await knex.schema.raw(`
    CREATE TYPE filial_tipo AS ENUM ('empresa', 'escola')
  `);

  await knex.schema.alterTable('filiais', (table) => {
    table.specificType('tipo', 'filial_tipo').notNullable().defaultTo('empresa');
  });

  await knex.schema.alterTable('usuarios', (table) => {
    // NULL = acesso a todas as unidades/tipos da empresa (ex: suporte, admin
    // geral). Preenchido = usuario enxerga so as telas do TIPO daquela unidade
    // (ex: um usuario de uma unidade tipo "escola" ve telas de turma/aluno).
    table.uuid('filial_id').references('id').inTable('filiais').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('usuarios', (table) => {
    table.dropColumn('filial_id');
  });
  await knex.schema.alterTable('filiais', (table) => {
    table.dropColumn('tipo');
  });
  await knex.schema.raw('DROP TYPE IF EXISTS filial_tipo');
};
