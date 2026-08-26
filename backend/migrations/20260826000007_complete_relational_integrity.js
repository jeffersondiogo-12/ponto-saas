exports.up = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE alunos
      DROP CONSTRAINT IF EXISTS alunos_turma_id_foreign;
    ALTER TABLE alunos
      ADD CONSTRAINT alunos_turma_id_foreign
      FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE RESTRICT;

    ALTER TABLE alunos ADD CONSTRAINT alunos_id_empresa_id_unique UNIQUE (id, empresa_id);
    ALTER TABLE turmas ADD CONSTRAINT turmas_id_empresa_id_unique UNIQUE (id, empresa_id);
    ALTER TABLE funcionarios ADD CONSTRAINT funcionarios_id_empresa_id_unique UNIQUE (id, empresa_id);

    ALTER TABLE alunos
      ADD CONSTRAINT alunos_turma_empresa_fk
      FOREIGN KEY (turma_id, empresa_id) REFERENCES turmas(id, empresa_id);
    ALTER TABLE alunos
      ADD CONSTRAINT alunos_filial_empresa_fk
      FOREIGN KEY (filial_id, empresa_id) REFERENCES filiais(id, empresa_id);
    ALTER TABLE turmas
      ADD CONSTRAINT turmas_filial_empresa_fk
      FOREIGN KEY (filial_id, empresa_id) REFERENCES filiais(id, empresa_id);
    ALTER TABLE funcionarios
      ADD CONSTRAINT funcionarios_filial_empresa_fk
      FOREIGN KEY (filial_id, empresa_id) REFERENCES filiais(id, empresa_id);
  `);

  await knex.schema.raw(`
    ALTER TABLE registros_ponto ADD COLUMN IF NOT EXISTS filial_id uuid;
    UPDATE registros_ponto r
      SET filial_id = COALESCE(
        (SELECT d.filial_id FROM dispositivos d WHERE d.id = r.dispositivo_id),
        (SELECT a.filial_id FROM alunos a WHERE a.id = r.aluno_id),
        (SELECT f.filial_id FROM funcionarios f WHERE f.id = r.funcionario_id)
      )
      WHERE r.filial_id IS NULL;
    ALTER TABLE registros_ponto
      ADD CONSTRAINT registros_ponto_filial_empresa_fk
      FOREIGN KEY (filial_id, empresa_id) REFERENCES filiais(id, empresa_id);
    CREATE INDEX IF NOT EXISTS idx_registros_ponto_empresa_filial_data
      ON registros_ponto (empresa_id, filial_id, data_hora);
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_registros_ponto_empresa_filial_data;
    ALTER TABLE registros_ponto DROP CONSTRAINT IF EXISTS registros_ponto_filial_empresa_fk;
    ALTER TABLE registros_ponto DROP COLUMN IF EXISTS filial_id;
    ALTER TABLE funcionarios DROP CONSTRAINT IF EXISTS funcionarios_filial_empresa_fk;
    ALTER TABLE turmas DROP CONSTRAINT IF EXISTS turmas_filial_empresa_fk;
    ALTER TABLE alunos DROP CONSTRAINT IF EXISTS alunos_filial_empresa_fk;
    ALTER TABLE alunos DROP CONSTRAINT IF EXISTS alunos_turma_empresa_fk;
    ALTER TABLE funcionarios DROP CONSTRAINT IF EXISTS funcionarios_id_empresa_id_unique;
    ALTER TABLE turmas DROP CONSTRAINT IF EXISTS turmas_id_empresa_id_unique;
    ALTER TABLE alunos DROP CONSTRAINT IF EXISTS alunos_id_empresa_id_unique;
    ALTER TABLE alunos DROP CONSTRAINT IF EXISTS alunos_turma_id_foreign;
    ALTER TABLE alunos ADD CONSTRAINT alunos_turma_id_foreign
      FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE SET NULL;
  `);
};