/**
 * O protocolo do Evo Facial manda, por batida, alguns campos que nao tem
 * coluna propria em registros_ponto (mode = metodo de verificacao usado,
 * temp = temperatura de equipamentos com termica, event, verifymode, e os
 * campos extras de equipamentos 4G). Em vez de criar uma coluna nova toda
 * vez que um protocolo novo reporta mais um campo, guardamos o registro
 * bruto (por batida) como veio do equipamento - importante inclusive para
 * defensabilidade em uma eventual fiscalizacao (ver README secao 5): da pra
 * mostrar exatamente o que o equipamento reportou, nao so o que o sistema
 * decidiu extrair dele.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('registros_ponto', (table) => {
    table.jsonb('payload_bruto');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('registros_ponto', (table) => {
    table.dropColumn('payload_bruto');
  });
};
