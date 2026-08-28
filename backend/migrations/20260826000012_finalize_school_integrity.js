exports.up = async function (knex) {
  await knex.schema.raw(`
    UPDATE registros_ponto r
      SET filial_id = COALESCE(
        (SELECT d.filial_id FROM dispositivos d WHERE d.id = r.dispositivo_id),
        (SELECT a.filial_id FROM alunos a WHERE a.id = r.aluno_id),
        (SELECT f.filial_id FROM funcionarios f WHERE f.id = r.funcionario_id)
      )
      WHERE r.filial_id IS NULL;

    ALTER TABLE registros_ponto
      ADD CONSTRAINT chk_registros_ponto_filial_contexto CHECK (
        filial_id IS NOT NULL
        OR (dispositivo_id IS NULL AND aluno_id IS NULL AND funcionario_id IS NULL)
      );

    ALTER TABLE turma_professores
      DROP CONSTRAINT IF EXISTS turma_professores_turma_id_foreign,
      ADD CONSTRAINT turma_professores_turma_id_foreign
        FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE RESTRICT;

    ALTER TABLE presencas_sala
      DROP CONSTRAINT IF EXISTS presencas_sala_turma_id_foreign,
      ADD CONSTRAINT presencas_sala_turma_id_foreign
        FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE RESTRICT;

    ALTER TABLE notas_alunos
      DROP CONSTRAINT IF EXISTS notas_alunos_aluno_id_foreign,
      ADD CONSTRAINT notas_alunos_aluno_id_foreign
        FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE RESTRICT;

    ALTER TABLE observacoes_alunos
      DROP CONSTRAINT IF EXISTS observacoes_alunos_aluno_id_foreign,
      ADD CONSTRAINT observacoes_alunos_aluno_id_foreign
        FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE RESTRICT;

    ALTER TABLE turma_professores
      ADD CONSTRAINT turma_professores_id_empresa_id_unique UNIQUE (id, empresa_id);
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_id_empresa_id_unique UNIQUE (id, empresa_id);
  `);

  await knex.schema.raw(`
    ALTER TABLE turma_professores
      ADD CONSTRAINT turma_professores_turma_empresa_fk
        FOREIGN KEY (turma_id, empresa_id) REFERENCES turmas(id, empresa_id),
      ADD CONSTRAINT turma_professores_professor_empresa_fk
        FOREIGN KEY (professor_id, empresa_id) REFERENCES usuarios(id, empresa_id);

    ALTER TABLE presencas_sala
      ADD CONSTRAINT presencas_sala_turma_empresa_fk
        FOREIGN KEY (turma_id, empresa_id) REFERENCES turmas(id, empresa_id),
      ADD CONSTRAINT presencas_sala_aluno_empresa_fk
        FOREIGN KEY (aluno_id, empresa_id) REFERENCES alunos(id, empresa_id),
      ADD CONSTRAINT presencas_sala_professor_empresa_fk
        FOREIGN KEY (professor_id, empresa_id) REFERENCES usuarios(id, empresa_id);

    ALTER TABLE avisos_escola
      ADD CONSTRAINT avisos_escola_filial_empresa_fk
        FOREIGN KEY (filial_id, empresa_id) REFERENCES filiais(id, empresa_id);
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE avisos_escola DROP CONSTRAINT IF EXISTS avisos_escola_filial_empresa_fk;
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS presencas_sala_professor_empresa_fk;
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS presencas_sala_aluno_empresa_fk;
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS presencas_sala_turma_empresa_fk;
    ALTER TABLE turma_professores DROP CONSTRAINT IF EXISTS turma_professores_professor_empresa_fk;
    ALTER TABLE turma_professores DROP CONSTRAINT IF EXISTS turma_professores_turma_empresa_fk;
    ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_id_empresa_id_unique;
    ALTER TABLE turma_professores DROP CONSTRAINT IF EXISTS turma_professores_id_empresa_id_unique;
    ALTER TABLE observacoes_alunos DROP CONSTRAINT IF EXISTS observacoes_alunos_aluno_id_foreign;
    ALTER TABLE observacoes_alunos ADD CONSTRAINT observacoes_alunos_aluno_id_foreign
      FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE;
    ALTER TABLE notas_alunos DROP CONSTRAINT IF EXISTS notas_alunos_aluno_id_foreign;
    ALTER TABLE notas_alunos ADD CONSTRAINT notas_alunos_aluno_id_foreign
      FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE;
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS presencas_sala_turma_id_foreign;
    ALTER TABLE presencas_sala ADD CONSTRAINT presencas_sala_turma_id_foreign
      FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE;
    ALTER TABLE turma_professores DROP CONSTRAINT IF EXISTS turma_professores_turma_id_foreign;
    ALTER TABLE turma_professores ADD CONSTRAINT turma_professores_turma_id_foreign
      FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE;
    ALTER TABLE registros_ponto DROP CONSTRAINT IF EXISTS chk_registros_ponto_filial_contexto;
  `);
};