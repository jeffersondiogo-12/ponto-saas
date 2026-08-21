/**
 * Adiciona 'evo_ws' ao enum dispositivo_protocolo: o protocolo real do Evo
 * Facial (WebSocket + JSON, equipamento como client), confirmado a partir do
 * PDF "Protocolo WebSocket EVO FACIAL - Revisao 5" fornecido pelo
 * fabricante. Ate aqui so existiam 'zk_tcp' (hipotese nao confirmada,
 * protocolo TCP generico) e 'http_rest' (nunca implementado).
 *
 * ALTER TYPE ... ADD VALUE nao pode rodar dentro da mesma transacao em que o
 * valor novo e usado (e em versoes do Postgres anteriores a 12, nao podia
 * rodar em transacao nenhuma) - por isso `exports.config` abaixo desativa o
 * wrap automatico de transacao do Knex so para esta migration.
 */
exports.config = { transaction: false };

exports.up = async function (knex) {
  await knex.raw("ALTER TYPE dispositivo_protocolo ADD VALUE IF NOT EXISTS 'evo_ws'");
};

exports.down = async function () {
  // Postgres nao suporta remover um valor de enum (nao existe "DROP VALUE").
  // A unica forma de reverter seria recriar o tipo inteiro migrando a coluna
  // para um tipo temporario - arriscado demais para um down() que na pratica
  // quase nunca roda, e o valor extra no enum e inofensivo se ficar pra
  // tras (nenhuma linha e obrigada a usa-lo). Decisao deliberada: no-op.
};
