exports.up = async function (knex) {
  await knex.schema.raw(`
    CREATE OR REPLACE FUNCTION definir_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  const tabelasComUpdatedAt = [
    'empresas',
    'usuarios',
    'filiais',
    'departamentos',
    'horarios_trabalho',
    'funcionarios',
    'dispositivos',
    'funcionario_dispositivos',
    'apontamentos_diarios',
    'justificativas',
    'feriados',
  ];

  for (const tabela of tabelasComUpdatedAt) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.raw(`
      CREATE TRIGGER trg_${tabela}_updated_at
      BEFORE UPDATE ON ${tabela}
      FOR EACH ROW
      EXECUTE FUNCTION definir_updated_at();
    `);
  }
};

exports.down = async function (knex) {
  const tabelasComUpdatedAt = [
    'empresas',
    'usuarios',
    'filiais',
    'departamentos',
    'horarios_trabalho',
    'funcionarios',
    'dispositivos',
    'funcionario_dispositivos',
    'apontamentos_diarios',
    'justificativas',
    'feriados',
  ];

  for (const tabela of tabelasComUpdatedAt) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.raw(`DROP TRIGGER IF EXISTS trg_${tabela}_updated_at ON ${tabela}`);
  }

  await knex.schema.raw('DROP FUNCTION IF EXISTS definir_updated_at()');
};
