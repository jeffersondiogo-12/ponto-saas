exports.up = async function (knex) {
  await knex.schema.alterTable('registros_ponto', (table) => {
    // Mesma tabela/pipeline de coleta serve tanto funcionarios (unidades tipo
    // "empresa") quanto alunos (unidades tipo "escola") - o dispositivo nao
    // sabe nem precisa saber a diferenca, so reporta um ID interno, e quem
    // resolve pra qual cadastro esse ID pertence e a ingestao (ver
    // ponto.service.js). Evita duplicar toda a camada de comunicacao com o
    // equipamento para um segundo "tipo de pessoa".
    table.uuid('aluno_id').references('id').inTable('alunos').onDelete('SET NULL');
  });

  await knex.schema.raw(`
    ALTER TABLE registros_ponto
      ADD CONSTRAINT chk_registros_pessoa_unica
      CHECK (NOT (funcionario_id IS NOT NULL AND aluno_id IS NOT NULL))
  `);

  await knex.schema.raw('CREATE INDEX idx_registros_ponto_aluno_data ON registros_ponto (empresa_id, aluno_id, data_hora)');

  // As novas tabelas tambem ganham o updated_at automatico (mesmo padrao das demais).
  const novasTabelas = ['turmas', 'alunos', 'aluno_dispositivos'];
  for (const tabela of novasTabelas) {
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
  const novasTabelas = ['turmas', 'alunos', 'aluno_dispositivos'];
  for (const tabela of novasTabelas) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.raw(`DROP TRIGGER IF EXISTS trg_${tabela}_updated_at ON ${tabela}`);
  }

  await knex.schema.raw('DROP INDEX IF EXISTS idx_registros_ponto_aluno_data');
  await knex.schema.raw('ALTER TABLE registros_ponto DROP CONSTRAINT IF EXISTS chk_registros_pessoa_unica');
  await knex.schema.alterTable('registros_ponto', (table) => {
    table.dropColumn('aluno_id');
  });
};
