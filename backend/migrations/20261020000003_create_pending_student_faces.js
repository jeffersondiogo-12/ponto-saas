exports.up = function (knex) {
  return knex.schema.createTable('faces_alunos_pendentes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('filial_id').notNullable().references('id').inTable('filiais').onDelete('CASCADE');
    table.uuid('dispositivo_id').notNullable().references('id').inTable('dispositivos').onDelete('CASCADE');
    table.uuid('aluno_id').notNullable().references('id').inTable('alunos').onDelete('CASCADE');
    table.string('id_no_dispositivo', 40).notNullable();
    table.text('foto_cifrada').notNullable();
    table.integer('tentativas').notNullable().defaultTo(0);
    table.text('ultimo_erro');
    table.timestamps(true, true);

    table.unique(['dispositivo_id', 'aluno_id']);
    table.index(['dispositivo_id', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('faces_alunos_pendentes');
};
