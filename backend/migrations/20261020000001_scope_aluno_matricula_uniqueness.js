exports.up = async function (knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.alunos'::regclass
          AND conname = 'alunos_matricula_unique'
      ) THEN
        ALTER TABLE public.alunos DROP CONSTRAINT alunos_matricula_unique;
      ELSE
        DROP INDEX IF EXISTS public.alunos_matricula_unique;
      END IF;
    END;
    $$;
  `);
};

exports.down = async function (knex) {
  const duplicada = await knex.raw(`
    SELECT 1
    FROM public.alunos
    WHERE matricula IS NOT NULL
    GROUP BY matricula
    HAVING COUNT(*) > 1
    LIMIT 1
  `);
  if (duplicada.rows.length) {
    throw new Error('Nao e possivel restaurar unicidade global: ha matriculas repetidas entre empresas.');
  }

  await knex.raw('ALTER TABLE public.alunos ADD CONSTRAINT alunos_matricula_unique UNIQUE (matricula)');
};