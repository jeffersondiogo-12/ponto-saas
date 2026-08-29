import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtime } from '../context/RealtimeContext';

/**
 * Pilha de avisos no canto, alimentada pelos eventos do WebSocket.
 *
 * O backend publica CINCO eventos e alguns vem em rajada: `presenca.sala` sai
 * um por aluno, entao uma chamada de 30 alunos mandaria 30 mensagens. Por isso
 * o aviso e agrupado POR TIPO - chega outro evento do mesmo tipo enquanto o
 * aviso esta na tela, o contador sobe e o relogio reinicia, em vez de empilhar
 * um cartao novo.
 */
const DURACAO = 6000;
const LIMITE = 4;

const AVISOS = {
  'ponto.criado': { titulo: 'Nova batida', tom: 'info', plural: 'novas batidas' },
  'presenca.sala': { titulo: 'Chamada registrada', tom: 'ok', plural: 'presencas registradas' },
  'nota.criada': { titulo: 'Nota lancada', tom: 'ok', plural: 'notas lancadas' },
  'observacao.criada': { titulo: 'Observacao enviada', tom: 'ok', plural: 'observacoes enviadas' },
  'aviso.criado': { titulo: 'Novo aviso da escola', tom: 'atencao', plural: 'novos avisos da escola' },
};

const hora = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/** Detalhe curto por tipo. Os eventos trazem id, nao nome - nao invente nome. */
function detalhe(tipo, dados = {}) {
  if (tipo === 'ponto.criado') return hora(dados.dataHora);
  if (tipo === 'presenca.sala') return dados.materia || '';
  return '';
}

export default function AvisosRealtime() {
  const { assinar } = useRealtime();
  const [avisos, setAvisos] = useState([]);
  const sequencia = useRef(0);

  const dispensar = useCallback((id) => {
    setAvisos((atuais) => atuais.filter((a) => a.id !== id));
  }, []);

  useEffect(() => assinar('*', (mensagem) => {
    const modelo = AVISOS[mensagem.tipo];
    if (!modelo) return; // tipo novo no servidor nao pode virar aviso em branco

    const texto = detalhe(mensagem.tipo, mensagem.dados);
    const expiraEm = Date.now() + DURACAO;

    setAvisos((atuais) => {
      const existente = atuais.find((a) => a.tipo === mensagem.tipo);
      if (existente) {
        return atuais.map((a) => (a.id === existente.id
          ? { ...a, quantidade: a.quantidade + 1, texto: texto || a.texto, expiraEm }
          : a));
      }
      sequencia.current += 1;
      const novo = { id: sequencia.current, tipo: mensagem.tipo, quantidade: 1, texto, expiraEm };
      return [...atuais, novo].slice(-LIMITE);
    });
  }), [assinar]);

  // Uma varredura so, em vez de um timer por aviso: com agrupamento o prazo de
  // cada cartao muda a toda hora, e N timers vivos ficariam dessincronizados.
  useEffect(() => {
    if (avisos.length === 0) return undefined;
    const timer = setInterval(() => {
      const agora = Date.now();
      setAvisos((atuais) => {
        const vivos = atuais.filter((a) => a.expiraEm > agora);
        return vivos.length === atuais.length ? atuais : vivos;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [avisos.length]);

  if (avisos.length === 0) return null;

  return (
    <div className="avisos-pilha nao-imprimir" role="status" aria-live="polite">
      {avisos.map((a) => {
        const modelo = AVISOS[a.tipo];
        return (
          <div key={a.id} className={`aviso-toast aviso-${modelo.tom}`}>
            <div className="aviso-corpo">
              <strong>{a.quantidade > 1 ? `${a.quantidade} ${modelo.plural}` : modelo.titulo}</strong>
              {a.texto && <span className="aviso-detalhe mono">{a.texto}</span>}
            </div>
            <button
              type="button"
              className="aviso-fechar"
              onClick={() => dispensar(a.id)}
              aria-label={`Dispensar aviso: ${modelo.titulo}`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
