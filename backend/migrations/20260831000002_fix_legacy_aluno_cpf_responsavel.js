/**
 * Alguns bancos antigos possuem a coluna legada cpf_responsavel com o texto
 * "not null" como valor padrao e uma restricao UNIQUE. O cadastro atual usa
 * as tabelas responsaveis e responsavel_alunos, portanto essa coluna nao deve
 * bloquear novos alunos (e um mesmo responsavel pode ter mais de um filho).
 */
exports.up = async function (knex) {
  await knex.schema.raw('ALTER TABLE alunos DROP CONSTRAINT IF EXISTS alunos_cpf_responsavel_key');
  await knex.schema.raw('DROP INDEX IF EXISTS alunos_cpf_responsavel_key');

  const possuiColunaLegada = await knex.schema.hasColumn('alunos', 'cpf_responsavel');
  if (!possuiColunaLegada) return;

  await knex.schema.raw(`
    ALTER TABLE alunos ALTER COLUMN cpf_responsavel DROP DEFAULT;
    ALTER TABLE alunos ALTER COLUMN cpf_responsavel DROP NOT NULL;
  `);

  await knex('alunos')
    .whereNotNull('cpf_responsavel')
    .whereRaw("LOWER(BTRIM(cpf_responsavel)) IN ('not null', 'null', 'undefined', '')")
    .update({ cpf_responsavel: null });
};

// Nao recria a unicidade incorreta nem os valores invalidos removidos.
exports.down = async function () {};
