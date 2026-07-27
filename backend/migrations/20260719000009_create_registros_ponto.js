exports.up = function (knex) {
  return knex.schema.createTable('registros_ponto', (table) => {
    // bigincrements: volume alto (uma linha por batida, por empresa, todos os dias) e
    // o NSR/ordenacao sequencial pedido pela Portaria 671 casa bem com PK numerica crescente.
    table.bigIncrements('id').primary();
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('dispositivo_id').references('id').inTable('dispositivos').onDelete('SET NULL');
    table.uuid('funcionario_id').references('id').inTable('funcionarios').onDelete('SET NULL');

    // NSR de origem no dispositivo. Nulo para batidas que nao vieram de um REP (manual/app).
    table.bigInteger('nsr');

    table.timestamp('data_hora', { useTz: true }).notNullable();

    // Codigo bruto que o dispositivo relatou (varia por fabricante: 0/1 check-in/out, etc).
    table.integer('tipo_verificacao_bruto');
    table
      .enu(
        'tipo_batida',
        ['entrada', 'saida', 'entrada_intervalo', 'saida_intervalo', 'indefinido'],
        { useNative: true, enumName: 'registro_tipo_batida' }
      )
      .notNullable()
      .defaultTo('indefinido');

    table
      .enu('origem', ['dispositivo', 'manual', 'app', 'importacao'], {
        useNative: true,
        enumName: 'registro_origem',
      })
      .notNullable()
      .defaultTo('dispositivo');

    table.decimal('latitude', 10, 7); // preenchido em batidas por app (geolocalizacao)
    table.decimal('longitude', 10, 7);
    table.string('foto_url', 300);

    // Preenchido quando a batida ainda nao pode ser associada a um funcionario conhecido
    // (ex.: id_no_dispositivo desconhecido) - fica visivel numa fila de pendencias no painel.
    table.string('id_bruto_nao_resolvido', 40);

    table.boolean('processado').notNullable().defaultTo(false); // ja entrou em algum apontamento_diario?
    table.uuid('criado_por_usuario_id').references('id').inTable('usuarios').onDelete('SET NULL'); // se origem=manual
    table.timestamp('criado_em').notNullable().defaultTo(knex.fn.now());

    // Uma batida do MESMO dispositivo com o MESMO nsr e o mesmo registro - protege contra
    // reprocessar a mesma marcacao em re-sincronizacoes (idempotencia da coleta).
    table.unique(['dispositivo_id', 'nsr']);
    table.index(['empresa_id', 'funcionario_id', 'data_hora']);
    table.index(['processado']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('registros_ponto');
  await knex.raw('DROP TYPE IF EXISTS registro_tipo_batida');
  await knex.raw('DROP TYPE IF EXISTS registro_origem');
};
