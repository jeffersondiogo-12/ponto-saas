exports.up = function (knex) {
  return knex.schema.createTable('aluno_dispositivos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('aluno_id').notNullable().references('id').inTable('alunos').onDelete('CASCADE');
    table.uuid('dispositivo_id').notNullable().references('id').inTable('dispositivos').onDelete('CASCADE');
    table.string('id_no_dispositivo', 40).notNullable();
    table.timestamps(true, true);

    table.unique(['dispositivo_id', 'id_no_dispositivo']);
    table.unique(['aluno_id', 'dispositivo_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('aluno_dispositivos');
};
