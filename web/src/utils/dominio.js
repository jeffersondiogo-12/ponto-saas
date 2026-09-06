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

/**
 * Status de aviso. Vem PRONTO do backend (`avisos.service.status`) — aqui so
 * traduzimos para a tela. Nao recalcule a partir de `publicado_em`/`enviado_em`:
 * a regra tem que morar num lugar so, senao web e app divergem.
 *
 * `tom` seleciona a cor pelo territorio do sistema: ambar para o que ainda vai
 * acontecer (pendencia), verde para o que ja saiu (dado efetivo), cinza para o
 * que esta fora do ar. Vermelho nao entra: aviso desativado nao e falha.
 */
export const STATUS_AVISO = {
  aguardando_data: { rotulo: 'Aguardando data', tom: 'atencao' },
  lancado: { rotulo: 'Lançado', tom: 'ok' },
  desativado: { rotulo: 'Desativado', tom: 'neutro' },
};

export const rotuloStatusAviso = (v) => STATUS_AVISO[v]?.rotulo || v || '—';
export const tomStatusAviso = (v) => STATUS_AVISO[v]?.tom || 'neutro';
