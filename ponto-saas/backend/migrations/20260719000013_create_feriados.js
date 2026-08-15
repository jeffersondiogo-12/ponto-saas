exports.up = function (knex) {
  return knex.schema.createTable('feriados', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // Nulo = feriado nacional, valido para todas as empresas.
    table.uuid('empresa_id').references('id').inTable('empresas').onDelete('CASCADE');
    table.date('data').notNullable();
    table.string('descricao', 150).notNullable();
    table
      .enu('abrangencia', ['nacional', 'estadual', 'municipal', 'ponto_facultativo'], {
        useNative: true,
        enumName: 'feriado_abrangencia',
      })
      .notNullable()
      .defaultTo('nacional');
    table.timestamps(true, true);

    table.index(['data']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('feriados');
  await knex.raw('DROP TYPE IF EXISTS feriado_abrangencia');
};
