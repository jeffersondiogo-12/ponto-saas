exports.up = function (knex) {
  return knex.schema.createTable('funcionario_dispositivos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionarios').onDelete('CASCADE');
    table.uuid('dispositivo_id').notNullable().references('id').inTable('dispositivos').onDelete('CASCADE');
    // Codigo/ID que o PROPRIO relogio usa internamente para esse funcionario
    // (necessario porque cada marca/dispositivo tem sua propria numeracao de usuarios).
    table.string('id_no_dispositivo', 40).notNullable();
    table.timestamps(true, true);

    table.unique(['dispositivo_id', 'id_no_dispositivo']);
    table.unique(['funcionario_id', 'dispositivo_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('funcionario_dispositivos');
};
