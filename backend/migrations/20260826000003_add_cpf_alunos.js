/** Persiste o CPF que o painel ja solicita no cadastro do aluno. */
exports.up = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE alunos
      ADD COLUMN IF NOT EXISTS cpf VARCHAR(11)
  `);
};

exports.down = async function () {};
