exports.up = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE presencas_sala
      DROP CONSTRAINT IF EXISTS presencas_sala_turma_id_aluno_id_professor_id_data_unique;
    ALTER TABLE presencas_sala
      DROP CONSTRAINT IF EXISTS presencas_sala_atribuicao_unique;
    ALTER TABLE presencas_sala
      DROP CONSTRAINT IF EXISTS presencas_sala_atribuicao_fk;
    ALTER TABLE presencas_sala
      ADD CONSTRAINT presencas_sala_atribuicao_unique
      UNIQUE (atribuicao_id, aluno_id, data);
    ALTER TABLE presencas_sala
      ADD CONSTRAINT presencas_sala_atribuicao_fk
      FOREIGN KEY (atribuicao_id) REFERENCES turma_professores(id) ON DELETE SET NULL;
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS presencas_sala_atribuicao_fk;
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS presencas_sala_atribuicao_unique;
    ALTER TABLE presencas_sala
      ADD CONSTRAINT presencas_sala_turma_id_aluno_id_professor_id_data_unique
      UNIQUE (turma_id, aluno_id, professor_id, data);
  `);
};