exports.up = async function (knex) {
  await knex.schema.raw('ALTER TABLE alunos ALTER COLUMN matricula DROP NOT NULL');
};

exports.down = async function (knex) {
  throw new Error('Nao e possivel reverter: existem alunos que podem estar sem matricula.');
};
