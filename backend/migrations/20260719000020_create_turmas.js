exports.up = function (knex) {
  return knex.schema.createTable('turmas', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('filial_id').notNullable().references('id').inTable('filiais').onDelete('CASCADE');
    table.string('nome', 100).notNullable(); // ex: "5o Ano A", "Infantil II B"
    table
      .enu('turno', ['manha', 'tarde', 'integral', 'noite'], { useNative: true, enumName: 'turma_turno' })
      .notNullable()
      .defaultTo('manha');
    table.integer('ano_letivo').notNullable();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index(['filial_id', 'ano_letivo']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('turmas');
  await knex.raw('DROP TYPE IF EXISTS turma_turno');
};
