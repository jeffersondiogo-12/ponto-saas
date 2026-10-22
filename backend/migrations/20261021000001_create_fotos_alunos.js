/**
 * Foto do aluno guardada no sistema, para a tela mostrar e para o envio ao
 * equipamento facial usar a mesma imagem (autorizado pelo Jefferson em
 * 2026-10-21, revendo o R3 do produto).
 *
 * Tabela propria, e nao coluna em `alunos`: a listagem faz `a.*`, e cada
 * aluno carregaria a foto inteira. A imagem fica cifrada (mesma chave
 * derivada da fila `faces_alunos_pendentes`) e sai junto com o aluno.
 */
exports.up = function (knex) {
  return knex.schema.createTable('fotos_alunos', (table) => {
    table.uuid('aluno_id').primary().references('id').inTable('alunos').onDelete('CASCADE');
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.text('foto_cifrada').notNullable();
    table.timestamps(true, true);

    table.index(['empresa_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('fotos_alunos');
};
