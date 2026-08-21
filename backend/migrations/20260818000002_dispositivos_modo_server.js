/**
 * Ajustes na tabela `dispositivos` para suportar de verdade o modo_conexao
 * 'server' (o equipamento e quem inicia a conexao, via WebSocket - ver
 * EvoFacialAdapter.js e evoFacialServidor.js). Esse enum ja existia desde a
 * migration original, mas nada no sistema o implementava ainda.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('dispositivos', (table) => {
    // Num dispositivo 'server' o instalador nao necessariamente sabe o IP do
    // equipamento no cadastro (pode estar em DHCP, atras de NAT 4G, etc) - o
    // proprio equipamento informa isso no "reg" (campo devinfo.curip), e o
    // servidor WebSocket preenche isto automaticamente a cada registro.
    table.specificType('ip', 'inet').nullable().alter();

    // Ultima vez que o equipamento completou um handshake "reg" com sucesso,
    // e o ultimo bloco devinfo que ele reportou (numero de serie, firmware,
    // capacidade, contadores de uso etc). Como o WebSocket e mantido por um
    // processo de longa duracao, "conectado agora" e um estado em memoria
    // (ver evoFacialServidor.js), nao uma coluna - persistir um booleano
    // aqui ficaria desatualizado se o processo cair sem limpar o estado.
    // Estas duas colunas servem para auditoria/exibicao mesmo quando o
    // equipamento esta offline no momento da consulta.
    table.timestamp('ultima_conexao_ws_em');
    table.jsonb('ultimo_devinfo');
  });

  // O numero de serie de um equipamento fisico e unico globalmente (de
  // fabrica) - a restricao original (empresa_id, numero_serie) permitia, em
  // tese, duas empresas cadastrarem o "mesmo" numero de serie sem erro. Isso
  // deixou de ser só uma questao teorica: quando o equipamento se registra
  // via WebSocket, a unica informacao que ele manda e o `sn` (sem
  // empresa_id) - o servidor PRECISA conseguir localizar exatamente um
  // dispositivo por numero de serie, em toda a base, para saber a quem
  // aquela conexao pertence.
  await knex.schema.raw(
    'ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS dispositivos_empresa_id_numero_serie_unique'
  );
  await knex.schema.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS dispositivos_numero_serie_unique ON dispositivos (numero_serie)'
  );
};

exports.down = async function (knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS dispositivos_numero_serie_unique');
  await knex.schema.raw(
    'ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_empresa_id_numero_serie_unique UNIQUE (empresa_id, numero_serie)'
  );

  await knex.schema.alterTable('dispositivos', (table) => {
    table.dropColumn('ultima_conexao_ws_em');
    table.dropColumn('ultimo_devinfo');
  });

  // Nao reverte "ip" para NOT NULL aqui: se algum dispositivo 'server' tiver
  // sido cadastrado sem IP nesse meio tempo, o rollback quebraria com uma
  // violacao de NOT NULL. Ajuste manual se realmente precisar reverter isso.
};
