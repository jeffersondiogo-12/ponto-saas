exports.up = async function up(knex) {
  await knex('permissoes_papeis')
    .where({ papel: 'gestor', recurso: 'avisos' })
    .update({ permitido: true });
};

exports.down = async function down(knex) {
  await knex('permissoes_papeis')
    .where({ papel: 'gestor', recurso: 'avisos' })
    .update({ permitido: false });
};
