exports.up = async function (knex) {
  // A coluna pode ja ter sido criada manualmente no banco existente.
  await knex.raw('ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS tipo_sanguineo text');

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.alunos'::regclass
          AND conname = 'alunos_tipo_sanguineo_check'
      ) THEN
        ALTER TABLE public.alunos
          ADD CONSTRAINT alunos_tipo_sanguineo_check
          CHECK (
            tipo_sanguineo IS NULL
            OR tipo_sanguineo IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
          );
      END IF;
    END;
    $$;
  `);
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE public.alunos DROP CONSTRAINT IF EXISTS alunos_tipo_sanguineo_check');
  await knex.raw('ALTER TABLE public.alunos DROP COLUMN IF EXISTS tipo_sanguineo');
};
