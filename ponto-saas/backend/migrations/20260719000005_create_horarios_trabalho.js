exports.up = function (knex) {
  return knex.schema.createTable('horarios_trabalho', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.string('nome', 120).notNullable(); // ex: "Comercial 8h", "Escala 12x36"
    table
      .enu('tipo', ['fixo_semanal', 'escala_12x36', 'flexivel'], {
        useNative: true,
        enumName: 'horario_tipo',
      })
      .notNullable()
      .defaultTo('fixo_semanal');

    // Estrutura para tipo = fixo_semanal, chaveada por dia da semana (0=domingo .. 6=sabado):
    // { "1": { "entrada": "08:00", "saida": "18:00", "intervalos": [{"inicio":"12:00","fim":"13:00"}] }, ... }
    // Para escala_12x36, guardamos apenas o par de horarios do plantao + data de referencia do ciclo.
    table.jsonb('config_semana').notNullable().defaultTo('{}');

    table.integer('carga_horaria_semanal_minutos').notNullable().defaultTo(2640); // 44h = padrao CLT art.58
    table.integer('tolerancia_minutos').notNullable().defaultTo(10); // tolerancia de atraso/saida antecipada

    // Regras do banco de horas aplicaveis aos funcionarios deste horario.
    // O prazo maximo legal depende do TIPO de acordo (CLT art.59 §§2-6): verbal/tacito = mesmo mes,
    // individual escrito = ate 6 meses, coletivo = ate 12 meses. Isso fica configuravel por empresa,
    // nunca hard-coded, porque depende do acordo real que a empresa tem com cada funcionario/sindicato.
    table
      .enu('banco_horas_tipo_acordo', ['nenhum', 'tacito_mensal', 'individual_escrito', 'coletivo'], {
        useNative: true,
        enumName: 'banco_horas_tipo_acordo',
      })
      .notNullable()
      .defaultTo('nenhum');
    table.integer('banco_horas_prazo_compensacao_dias'); // prazo de compensacao do banco de horas, em dias
    table.integer('limite_horas_extras_dia_minutos').notNullable().defaultTo(120); // maximo 2h/dia (CLT art.59)

    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('horarios_trabalho');
  await knex.raw('DROP TYPE IF EXISTS horario_tipo');
  await knex.raw('DROP TYPE IF EXISTS banco_horas_tipo_acordo');
};
