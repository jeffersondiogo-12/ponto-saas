exports.up = async function (knex) {
  await knex.schema.raw(`
    CREATE TABLE IF NOT EXISTS horarios_alunos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome varchar(120) NOT NULL,
      turno varchar(30) NOT NULL,
      turma varchar(100) NOT NULL,
      dia_semana varchar(20) NOT NULL,
      horario_inicio time NOT NULL,
      horario_fim time NOT NULL,
      tolerancia_minutos integer NOT NULL DEFAULT 0,
      sala varchar(100)
    );
  `);

  await knex.schema.raw(`
    ALTER TABLE dispositivos
      ALTER COLUMN filial_id SET NOT NULL;

    ALTER TABLE filiais
      ADD CONSTRAINT filiais_id_empresa_id_unique UNIQUE (id, empresa_id);

    ALTER TABLE dispositivos
      DROP CONSTRAINT IF EXISTS dispositivos_filial_id_foreign,
      ADD CONSTRAINT dispositivos_filial_empresa_fk
        FOREIGN KEY (filial_id, empresa_id) REFERENCES filiais (id, empresa_id)
        ON DELETE RESTRICT;
  `);

  await knex.schema.raw(`
    ALTER TABLE alunos DROP CONSTRAINT IF EXISTS alunos_id_fkey;
    ALTER TABLE horarios_alunos DROP CONSTRAINT IF EXISTS horarios_alunos_id_fkey;
    ALTER TABLE alunos ADD COLUMN IF NOT EXISTS horario_aluno_id uuid;
    ALTER TABLE alunos
      ADD CONSTRAINT alunos_horario_aluno_fk
      FOREIGN KEY (horario_aluno_id) REFERENCES horarios_alunos (id)
      ON DELETE SET NULL;
    UPDATE alunos a
      SET horario_aluno_id = a.id
      WHERE horario_aluno_id IS NULL
        AND EXISTS (SELECT 1 FROM horarios_alunos h WHERE h.id = a.id);
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE alunos DROP CONSTRAINT IF EXISTS alunos_horario_aluno_fk;
    ALTER TABLE alunos DROP COLUMN IF EXISTS horario_aluno_id;
    ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS dispositivos_filial_empresa_fk;
    ALTER TABLE filiais DROP CONSTRAINT IF EXISTS filiais_id_empresa_id_unique;
  `);
};