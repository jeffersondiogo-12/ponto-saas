exports.up = async function (knex) {
  await knex.schema.raw(`
    UPDATE turma_professores
    SET dias_semana = to_jsonb(ARRAY[
      CASE WHEN substring(dias_semana::text, 1, 1)::int BETWEEN 0 AND 6 THEN substring(dias_semana::text, 1, 1)::int END,
      CASE WHEN substring(dias_semana::text, 2, 1)::int BETWEEN 0 AND 6 THEN substring(dias_semana::text, 2, 1)::int END,
      CASE WHEN substring(dias_semana::text, 3, 1)::int BETWEEN 0 AND 6 THEN substring(dias_semana::text, 3, 1)::int END
    ]::int[])
    WHERE jsonb_typeof(dias_semana) = 'number'
      AND dias_semana::text ~ '^"?[0-6]{1,7}"?$';

    UPDATE turma_professores
    SET dias_semana = '[]'::jsonb
    WHERE jsonb_typeof(dias_semana) <> 'array';

    ALTER TABLE turma_professores
      ADD CONSTRAINT chk_turma_professores_dias_array CHECK (jsonb_typeof(dias_semana) = 'array'),
      ADD CONSTRAINT chk_turma_professores_horario_valido CHECK (hora_fim > hora_inicio);

    ALTER TABLE presencas_sala
      DROP CONSTRAINT IF EXISTS presencas_sala_atribuicao_fk,
      ALTER COLUMN atribuicao_id SET NOT NULL,
      ADD CONSTRAINT presencas_sala_atribuicao_fk
        FOREIGN KEY (atribuicao_id) REFERENCES turma_professores(id) ON DELETE RESTRICT;

    ALTER TABLE notas_alunos
      ADD CONSTRAINT chk_notas_alunos_bimestre CHECK (bimestre BETWEEN 1 AND 4),
      ADD CONSTRAINT chk_notas_alunos_valor CHECK (nota BETWEEN 0 AND 10);

    ALTER TABLE presencas_sala
      ADD CONSTRAINT chk_presencas_sala_justificativa
        CHECK (falta_justificada = false OR length(trim(justificativa)) > 0);
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS chk_presencas_sala_justificativa;
    ALTER TABLE notas_alunos DROP CONSTRAINT IF EXISTS chk_notas_alunos_valor;
    ALTER TABLE notas_alunos DROP CONSTRAINT IF EXISTS chk_notas_alunos_bimestre;
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS presencas_sala_atribuicao_fk;
    ALTER TABLE presencas_sala ALTER COLUMN atribuicao_id DROP NOT NULL;
    ALTER TABLE presencas_sala ADD CONSTRAINT presencas_sala_atribuicao_fk
      FOREIGN KEY (atribuicao_id) REFERENCES turma_professores(id) ON DELETE SET NULL;
    ALTER TABLE turma_professores DROP CONSTRAINT IF EXISTS chk_turma_professores_horario_valido;
    ALTER TABLE turma_professores DROP CONSTRAINT IF EXISTS chk_turma_professores_dias_array;
  `);
};