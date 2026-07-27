exports.up = async function (knex) {
  const tabelas = ['responsaveis', 'responsavel_alunos', 'push_tokens'];
  for (const tabela of tabelas) {
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
  const tabelas = ['responsaveis', 'responsavel_alunos', 'push_tokens'];
  for (const tabela of tabelas) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.raw(`DROP TRIGGER IF EXISTS trg_${tabela}_updated_at ON ${tabela}`);
  }
};
