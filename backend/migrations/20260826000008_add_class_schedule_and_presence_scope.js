exports.up = async function (knex) {
  await knex.schema.createTable('horarios_turmas', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('empresa_id').notNullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('turma_id').notNullable().references('id').inTable('turmas').onDelete('CASCADE');
    table.integer('dia_semana').notNullable();
    table.time('hora_entrada').notNullable();
    table.time('hora_saida').notNullable();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.unique(['turma_id', 'dia_semana']);
    table.index(['empresa_id', 'turma_id', 'dia_semana']);
  });

  await knex.schema.raw(`
    ALTER TABLE horarios_turmas
      ADD CONSTRAINT chk_horarios_turmas_dia_semana CHECK (dia_semana BETWEEN 0 AND 6),
      ADD CONSTRAINT chk_horarios_turmas_horario_valido CHECK (hora_saida > hora_entrada);
    ALTER TABLE horarios_turmas
      ADD CONSTRAINT horarios_turmas_turma_empresa_fk
      FOREIGN KEY (turma_id, empresa_id) REFERENCES turmas(id, empresa_id);
  `);

  await knex.schema.raw(`
    ALTER TABLE presencas_sala
      ADD COLUMN IF NOT EXISTS materia varchar(100),
      ADD COLUMN IF NOT EXISTS atribuicao_id uuid;
    UPDATE presencas_sala p
      SET materia = tp.materia, atribuicao_id = tp.id
      FROM turma_professores tp
      WHERE tp.turma_id = p.turma_id
        AND tp.professor_id = p.professor_id
        AND p.materia IS NULL;
    ALTER TABLE presencas_sala
      DROP CONSTRAINT IF EXISTS presencas_sala_turma_id_aluno_id_professor_id_data_unique;
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
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS presencas_sala_atribuicao_unique;
    ALTER TABLE presencas_sala DROP CONSTRAINT IF EXISTS presencas_sala_atribuicao_fk;
    ALTER TABLE presencas_sala DROP COLUMN IF EXISTS atribuicao_id;
    ALTER TABLE presencas_sala DROP COLUMN IF EXISTS materia;
    ALTER TABLE horarios_turmas DROP CONSTRAINT IF EXISTS horarios_turmas_turma_empresa_fk;
  `);
  await knex.schema.dropTableIfExists('horarios_turmas');
};