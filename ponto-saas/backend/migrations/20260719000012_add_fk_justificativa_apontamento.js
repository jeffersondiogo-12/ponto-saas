exports.up = function (knex) {
  return knex.schema.alterTable('apontamentos_diarios', (table) => {
    table.foreign('justificativa_id').references('id').inTable('justificativas').onDelete('SET NULL');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('apontamentos_diarios', (table) => {
    table.dropForeign('justificativa_id');
  });
};
