exports.up = function (knex) {
  return knex.schema.createTable('dispositivos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('filial_id').references('id').inTable('filiais').onDelete('SET NULL');

    // --- Bloco "EQUIPAMENTO" ---
    table.string('descricao', 150).notNullable(); // "DESCRICAO DO EQUIPAMENTO"
    table.string('modelo', 80).notNullable().defaultTo('Facial AI 5'); // "MODELO DO EQUIPAMENTO"
    table
      .enu('tipo_biometria', ['facial', 'digital', 'cartao', 'senha', 'misto'], {
        useNative: true,
        enumName: 'dispositivo_tipo_biometria',
      })
      .notNullable()
      .defaultTo('facial');
    table
      .enu('situacao', ['ativo', 'inativo'], { useNative: true, enumName: 'dispositivo_situacao' })
      .notNullable()
      .defaultTo('ativo');
    table.string('fuso_horario', 60).notNullable().defaultTo('America/Sao_Paulo');
    table.boolean('enviar_comprovante_email').notNullable().defaultTo(false);

    // --- Bloco "CONFIGURACAO" ---
    table
      .enu('modo_conexao', ['client', 'server'], { useNative: true, enumName: 'dispositivo_modo_conexao' })
      .notNullable()
      .defaultTo('client');
    table.specificType('ip', 'inet').notNullable();
    table.integer('porta').notNullable().defaultTo(4370);
    table.boolean('nao_validar_empresa').notNullable().defaultTo(false);
    table.string('numero_serie', 60).notNullable();
    table.string('mac_address', 17); // 00:00:00:00:00:00
    table.bigInteger('ultimo_nsr').notNullable().defaultTo(0); // ultimo NSR sincronizado (para coleta incremental)
    table.timestamp('ultima_coleta_em');
    table.string('ultima_coleta_status', 30); // sucesso | falha | nunca_executada

    // --- Bloco "AUTENTICACAO" ---
    table.string('usuario_dispositivo', 60);
    table.text('senha_dispositivo_cifrada'); // AES-256-GCM, ver src/utils/crypto.js — NUNCA texto puro
    table.string('identificador_equipamento', 100);

    // Qual adapter de comunicacao usar. 'desconhecido' ate validarmos contra o hardware real
    // ou recebermos o SDK do fabricante (Evo Sistemas Inteligentes).
    table
      .enu('protocolo', ['zk_tcp', 'http_rest', 'desconhecido'], {
        useNative: true,
        enumName: 'dispositivo_protocolo',
      })
      .notNullable()
      .defaultTo('desconhecido');

    table.timestamps(true, true);

    table.unique(['empresa_id', 'numero_serie']);
    table.index(['empresa_id', 'situacao']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('dispositivos');
  await knex.raw('DROP TYPE IF EXISTS dispositivo_tipo_biometria');
  await knex.raw('DROP TYPE IF EXISTS dispositivo_situacao');
  await knex.raw('DROP TYPE IF EXISTS dispositivo_modo_conexao');
  await knex.raw('DROP TYPE IF EXISTS dispositivo_protocolo');
};
