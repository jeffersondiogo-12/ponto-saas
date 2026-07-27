exports.up = function (knex) {
  return knex.schema.createTable('afd_exports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.date('periodo_inicio').notNullable();
    table.date('periodo_fim').notNullable();
    table.bigInteger('nsr_inicial');
    table.bigInteger('nsr_final');
    table.integer('quantidade_registros').notNullable().defaultTo(0);
    table.string('arquivo_path', 300).notNullable();
    table.uuid('gerado_por').references('id').inTable('usuarios').onDelete('SET NULL');
    table.timestamp('gerado_em').notNullable().defaultTo(knex.fn.now());

    table.index(['empresa_id', 'gerado_em']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('afd_exports');
};
