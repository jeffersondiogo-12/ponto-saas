exports.up = function (knex) {
  return knex.schema.createTable('banco_horas_lancamentos', (table) => {
    table.bigIncrements('id').primary();
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionarios').onDelete('CASCADE');
    table.date('data_referencia').notNullable();

    table
      .enu('tipo', ['credito', 'debito', 'ajuste_manual', 'pagamento', 'expiracao'], {
        useNative: true,
        enumName: 'banco_horas_lancamento_tipo',
      })
      .notNullable();

    // Convencao: positivo = credito ao saldo do funcionario, negativo = debito.
    // Mantemos o ledger append-only (nunca fazemos UPDATE em saldo) para auditoria
    // e para poder reconstruir o saldo em qualquer data pedida em fiscalizacao.
    table.integer('minutos').notNullable();
    table.integer('saldo_acumulado_apos').notNullable();

    table.uuid('apontamento_diario_id').references('id').inTable('apontamentos_diarios').onDelete('SET NULL');
    table.text('observacao');
    table.uuid('criado_por_usuario_id').references('id').inTable('usuarios').onDelete('SET NULL');
    table.timestamp('criado_em').notNullable().defaultTo(knex.fn.now());

    table.index(['empresa_id', 'funcionario_id', 'data_referencia']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('banco_horas_lancamentos');
  await knex.raw('DROP TYPE IF EXISTS banco_horas_lancamento_tipo');
};
