exports.up = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE horarios_turmas
      DROP CONSTRAINT IF EXISTS horarios_turmas_turma_id_dia_semana_unique;
    ALTER TABLE horarios_turmas
      ALTER COLUMN dia_semana DROP NOT NULL;

    CREATE TEMP TABLE horarios_turmas_unificados AS
      SELECT
        MIN(id::text)::uuid AS id,
        MIN(empresa_id::text)::uuid AS empresa_id,
        turma_id,
        MIN(hora_entrada) AS hora_entrada,
        MAX(hora_saida) AS hora_saida,
        bool_or(ativo) AS ativo,
        MIN(created_at) AS created_at,
        MAX(updated_at) AS updated_at
      FROM horarios_turmas
      GROUP BY turma_id;

    DELETE FROM horarios_turmas;

    INSERT INTO horarios_turmas (id, empresa_id, turma_id, dia_semana, hora_entrada, hora_saida, ativo, created_at, updated_at)
      SELECT id, empresa_id, turma_id, NULL, hora_entrada, hora_saida, ativo, created_at, updated_at
      FROM horarios_turmas_unificados;

    ALTER TABLE horarios_turmas
      DROP CONSTRAINT IF EXISTS chk_horarios_turmas_dia_semana,
      DROP CONSTRAINT IF EXISTS chk_horarios_turmas_horario_valido;

    ALTER TABLE horarios_turmas
      ADD CONSTRAINT horarios_turmas_turma_unique UNIQUE (turma_id),
      ADD CONSTRAINT chk_horarios_turmas_horario_valido_v2 CHECK (hora_saida > hora_entrada);
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE horarios_turmas DROP CONSTRAINT IF EXISTS horarios_turmas_turma_unique;
    ALTER TABLE horarios_turmas DROP CONSTRAINT IF EXISTS chk_horarios_turmas_horario_valido_v2;
    ALTER TABLE horarios_turmas ADD CONSTRAINT horarios_turmas_turma_id_dia_semana_unique UNIQUE (turma_id, dia_semana);
  `);
};