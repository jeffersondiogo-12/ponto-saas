exports.up = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE dispositivos
      ADD CONSTRAINT chk_dispositivos_porta_valida CHECK (porta BETWEEN 1 AND 65535),
      ADD CONSTRAINT chk_dispositivos_nsr_positivo CHECK (ultimo_nsr >= 0)
  `);

  await knex.schema.raw(`
    ALTER TABLE horarios_trabalho
      ADD CONSTRAINT chk_horarios_tolerancia_positiva CHECK (tolerancia_minutos >= 0),
      ADD CONSTRAINT chk_horarios_carga_semanal_positiva CHECK (carga_horaria_semanal_minutos > 0),
      ADD CONSTRAINT chk_horarios_limite_extras_positivo CHECK (limite_horas_extras_dia_minutos >= 0),
      ADD CONSTRAINT chk_horarios_prazo_compensacao_positivo
        CHECK (banco_horas_prazo_compensacao_dias IS NULL OR banco_horas_prazo_compensacao_dias > 0)
  `);

  await knex.schema.raw(`
    ALTER TABLE funcionarios
      ADD CONSTRAINT chk_funcionarios_demissao_apos_admissao
        CHECK (data_demissao IS NULL OR data_demissao >= data_admissao)
  `);

  await knex.schema.raw(`
    ALTER TABLE registros_ponto
      ADD CONSTRAINT chk_registros_nsr_positivo CHECK (nsr IS NULL OR nsr >= 0)
  `);

  await knex.schema.raw(`
    ALTER TABLE justificativas
      ADD CONSTRAINT chk_justificativas_fim_apos_inicio CHECK (data_fim >= data_inicio)
  `);

  await knex.schema.raw(`
    ALTER TABLE apontamentos_diarios
      ADD CONSTRAINT chk_apontamentos_previstas_positivo CHECK (horas_previstas_minutos >= 0),
      ADD CONSTRAINT chk_apontamentos_trabalhadas_positivo CHECK (horas_trabalhadas_minutos >= 0),
      ADD CONSTRAINT chk_apontamentos_extras50_positivo CHECK (extras_50_minutos >= 0),
      ADD CONSTRAINT chk_apontamentos_extras100_positivo CHECK (extras_100_minutos >= 0),
      ADD CONSTRAINT chk_apontamentos_noturno_positivo CHECK (adicional_noturno_minutos >= 0),
      ADD CONSTRAINT chk_apontamentos_atraso_positivo CHECK (atraso_minutos >= 0)
  `);

  await knex.schema.raw(`
    ALTER TABLE empresas
      ADD CONSTRAINT chk_empresas_qtd_funcionarios_positiva CHECK (quantidade_funcionarios_estimada >= 0)
  `);

  await knex.schema.raw(`
    ALTER TABLE banco_horas_lancamentos
      ADD CONSTRAINT chk_banco_horas_minutos_nao_zero CHECK (minutos <> 0)
  `);
};

exports.down = async function (knex) {
  const constraints = [
    ['dispositivos', 'chk_dispositivos_porta_valida'],
    ['dispositivos', 'chk_dispositivos_nsr_positivo'],
    ['horarios_trabalho', 'chk_horarios_tolerancia_positiva'],
    ['horarios_trabalho', 'chk_horarios_carga_semanal_positiva'],
    ['horarios_trabalho', 'chk_horarios_limite_extras_positivo'],
    ['horarios_trabalho', 'chk_horarios_prazo_compensacao_positivo'],
    ['funcionarios', 'chk_funcionarios_demissao_apos_admissao'],
    ['registros_ponto', 'chk_registros_nsr_positivo'],
    ['justificativas', 'chk_justificativas_fim_apos_inicio'],
    ['apontamentos_diarios', 'chk_apontamentos_previstas_positivo'],
    ['apontamentos_diarios', 'chk_apontamentos_trabalhadas_positivo'],
    ['apontamentos_diarios', 'chk_apontamentos_extras50_positivo'],
    ['apontamentos_diarios', 'chk_apontamentos_extras100_positivo'],
    ['apontamentos_diarios', 'chk_apontamentos_noturno_positivo'],
    ['apontamentos_diarios', 'chk_apontamentos_atraso_positivo'],
    ['empresas', 'chk_empresas_qtd_funcionarios_positiva'],
    ['banco_horas_lancamentos', 'chk_banco_horas_minutos_nao_zero'],
  ];

  for (const [tabela, constraint] of constraints) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.raw(`ALTER TABLE ${tabela} DROP CONSTRAINT IF EXISTS ${constraint}`);
  }
};
