/**
 * Leitura do estado de conexao de um dispositivo.
 *
 * O backend expoe tres campos e eles precisam ser lidos juntos:
 *   conectado_agora      - WebSocket vivo OU comunicou nos ultimos 60s
 *   ultima_conexao_ws_em - carimbo do ultimo `reg`, por WS ou por HTTP
 *   ultima_coleta_status - 'conectado_via_http' | 'conectado_via_websocket'
 *
 * Mostrar so `conectado_agora` engana: equipamento em HTTP nao mantem conexao
 * aberta, entao fica "Offline" entre um envio e outro mesmo funcionando. Por
 * isso a tela sempre acompanha o status com a ULTIMA COMUNICACAO — e e ela,
 * nao o badge, que diz se o relogio esta vivo.
 */

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function tempoRelativo(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;

  const dif = Date.now() - t;
  if (dif < 0) return 'agora';
  if (dif < MINUTO) return 'agora';
  if (dif < HORA) return `há ${Math.floor(dif / MINUTO)} min`;
  if (dif < DIA) return `há ${Math.floor(dif / HORA)} h`;
  const dias = Math.floor(dif / DIA);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

export function dataHoraCompleta(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

const VIA = {
  conectado_via_http: 'HTTP',
  conectado_via_websocket: 'WebSocket',
};

/**
 * Traduz os campos crus num estado exibivel.
 * Retorna { rotulo, classe, detalhe, titulo } — `classe` e o sufixo do badge.
 */
export function estadoConexao(d) {
  if (!d) return { rotulo: '—', classe: 'inativo', detalhe: null, titulo: '' };

  const quando = d.ultima_conexao_ws_em || d.ultima_coleta_em || null;
  const relativo = tempoRelativo(quando);
  const via = VIA[d.ultima_coleta_status] || null;

  // null = protocolo onde "estar conectado" nem faz sentido (o servidor e quem
  // liga no equipamento). Nao dizer "Offline" nesse caso e proposital.
  if (d.conectado_agora === null || d.conectado_agora === undefined) {
    return {
      rotulo: 'Sob demanda',
      classe: 'info',
      detalhe: relativo ? `última coleta ${relativo}` : 'nunca coletado',
      titulo: 'Neste protocolo o servidor conecta no equipamento quando precisa.',
    };
  }

  if (d.conectado_agora) {
    return {
      rotulo: 'Conectado',
      classe: 'ativo',
      detalhe: via ? `via ${via}${relativo ? ` · ${relativo}` : ''}` : relativo,
      titulo: dataHoraCompleta(quando),
    };
  }

  if (!quando) {
    return {
      rotulo: 'Nunca comunicou',
      classe: 'inativo',
      detalhe: 'nenhum registro recebido',
      titulo: 'O equipamento ainda não enviou nenhum "reg" para este servidor.',
    };
  }

  return {
    rotulo: 'Sem comunicação',
    classe: 'inativo',
    detalhe: `última ${relativo}${via ? ` · via ${via}` : ''}`,
    titulo: dataHoraCompleta(quando),
  };
}
