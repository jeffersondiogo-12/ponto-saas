exports.up = async function (knex) {
  // gen_random_uuid() depende desta extensao (Postgres 12 e anteriores;
  // no Postgres 13+ ela costuma vir pronta, mas habilitar aqui evita
  // depender da versao especifica do servidor).
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');
};

exports.down = async function (knex) {
  await knex.raw('DROP EXTENSION IF EXISTS pgcrypto');
};
