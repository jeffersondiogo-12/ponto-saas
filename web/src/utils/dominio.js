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

/**
 * Espelha TIPO_BATIDA_POR_CODIGO de ponto.service.js. O banco guarda o valor
 * cru ('saida_intervalo'), que nao serve para ler em tela.
 */
export const TIPOS_BATIDA = [
  { valor: 'entrada', rotulo: 'Entrada' },
  { valor: 'saida', rotulo: 'Saída' },
  { valor: 'entrada_intervalo', rotulo: 'Volta do intervalo' },
  { valor: 'saida_intervalo', rotulo: 'Saída para intervalo' },
  { valor: 'indefinido', rotulo: 'Não identificado' },
];

export const rotuloTipoBatida = (v) => TIPOS_BATIDA.find((t) => t.valor === v)?.rotulo || v || '—';
