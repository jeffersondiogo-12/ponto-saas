/**
 * Constantes de dominio compartilhadas entre telas.
 *
 * Ficam aqui, e nao junto do componente que as usa, porque exportar constante
 * do mesmo arquivo de um componente quebra o Fast Refresh do Vite.
 */

/** Espelha o enum turma_turno do banco. */
export const TURNOS = [
  { valor: 'manha', rotulo: 'Manhã' },
  { valor: 'tarde', rotulo: 'Tarde' },
  { valor: 'integral', rotulo: 'Integral' },
  { valor: 'noite', rotulo: 'Noite' },
];

export const rotuloTurno = (v) => TURNOS.find((t) => t.valor === v)?.rotulo || v;

/** Espelha o enum usuario_papel do banco. */
export const PAPEIS = [
  { valor: 'super_admin', rotulo: 'Super admin' },
  { valor: 'admin', rotulo: 'Admin' },
  { valor: 'rh', rotulo: 'RH' },
  { valor: 'gestor', rotulo: 'Gestor' },
  { valor: 'professor', rotulo: 'Professor' },
];

export const rotuloPapel = (v) => PAPEIS.find((p) => p.valor === v)?.rotulo || v;
