/**
 * Excecoes de permissao por usuario individual, por cima do padrao do cargo
 * (permissoes_papeis). Se existir uma linha aqui para
 * usuario_id+recurso+acao, ela manda mais que a regra do cargo - nos dois
 * sentidos: tanto pra liberar algo que o cargo nega quanto pra negar algo
 * que o cargo libera.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('permissoes_usuarios', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('usuario_id').notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
    table.string('recurso', 80).notNullable();
    table.enu('acao', ['ver', 'adicionar', 'atualizar', 'deletar'], { useNative: false }).notNullable();
    table.boolean('permitido').notNullable();
    table.timestamps(true, true);

    table.unique(['usuario_id', 'recurso', 'acao']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('permissoes_usuarios');
};
