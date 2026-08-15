exports.up = function (knex) {
  return knex.schema.createTable('funcionarios', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('filial_id').references('id').inTable('filiais').onDelete('SET NULL');
    table.uuid('departamento_id').references('id').inTable('departamentos').onDelete('SET NULL');
    table.uuid('horario_trabalho_id').references('id').inTable('horarios_trabalho').onDelete('SET NULL');

    table.string('matricula', 30).notNullable(); // codigo interno do funcionario na empresa
    table.string('nome', 150).notNullable();
    table.string('cpf', 14).notNullable(); // 000.000.000-00
    table.string('pis', 20); // usado no AFD quando o CPF nao estiver disponivel (Portaria 671 art.96)
    table.string('cargo', 100);
    table.date('data_admissao').notNullable();
    table.date('data_demissao');
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique(['empresa_id', 'matricula']);
    table.unique(['empresa_id', 'cpf']);
    table.index(['empresa_id', 'ativo']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('funcionarios');
};
