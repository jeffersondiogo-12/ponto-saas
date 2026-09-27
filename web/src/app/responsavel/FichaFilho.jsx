import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ehFalhaDeRede, namespaceOffline } from '../../api';
import { useRecarregarAoVivo } from '../../context/RealtimeContext';
import { BarraTopo, Carregando } from '../Ui';
import { prepararRegistros } from '../batidas';
import { formatarData, formatarDataHora, formatarDataSemHora } from '../datas';
import { avisosLidos, ehLido, marcarFichaVista, ROTULOS_ALCANCE } from '../novidades';

/**
 * Ficha do filho: espelho da AlunoDetalheScreen do APK. A aba Avisos mostra so
 * os avisos deste filho, e tocar num aviso abre a tela dele — la a leitura e
 * confirmada ao chegar no fim do texto (#57).
 *
 * A aba vai no endereco (`?aba=avisos`): ao voltar do aviso, a ficha reabre na
 * mesma aba, e nao na primeira.
 */
const ABAS = [
  { chave: 'frequencia', rotulo: 'Escola' },
  { chave: 'sala', rotulo: 'Sala' },
  { chave: 'notas', rotulo: 'Notas' },
  { chave: 'observacoes', rotulo: 'Obs.' },
  { chave: 'avisos', rotulo: 'Avisos' },
];

const EVENTOS = ['ponto.criado', 'presenca.sala', 'nota.criada', 'observacao.criada', 'aviso.lancado', 'aviso.atualizado', 'aviso.removido'];

function iniciais(nome = '') {
  return nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('');
}

const valor = (resultado) => (resultado.status === 'fulfilled' ? resultado.value : null);

export default function FichaFilho() {
  const { alunoId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [busca, setBusca] = useSearchParams();
  const aba = ABAS.some((item) => item.chave === busca.get('aba')) ? busca.get('aba') : 'frequencia';

  const [nome, setNome] = useState(state?.nome || '');
  const [registros, setRegistros] = useState([]);
  const [presencasSala, setPresencasSala] = useState([]);
  const [notas, setNotas] = useState([]);
  const [observacoes, setObservacoes] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');

  const carregar = useCallback(async () => {
    const respostas = await Promise.allSettled([
      api.responsavel.frequenciaDoAluno(alunoId),
      api.responsavel.presencaSalaDoAluno(alunoId),
      api.responsavel.notasDoAluno(alunoId),
      api.responsavel.observacoesDoAluno(alunoId),
      api.responsavel.avisosDoAluno(alunoId),
    ]);
    const [frequencia, sala, notasResposta, observacoesResposta, avisosResposta] = respostas.map(valor);
    if (frequencia) setRegistros(prepararRegistros(frequencia.registros));
    if (frequencia?.aluno?.nome) setNome(frequencia.aluno.nome);
    if (sala) setPresencasSala(sala.registros || []);
    if (notasResposta) setNotas(notasResposta.notas || []);
    if (observacoesResposta) setObservacoes(observacoesResposta.observacoes || []);
    if (avisosResposta) setAvisos(avisosResposta.avisos || []);
    const falhas = respostas.filter((resultado) => resultado.status === 'rejected');
    setErroCarga(!falhas.length ? ''
      : falhas.every((falha) => ehFalhaDeRede(falha.reason)) ? 'Sem conexão com a internet. As informações não foram atualizadas.'
        : 'Algumas informações não puderam ser atualizadas.');
    setCarregando(false);
  }, [alunoId]);

  // Abrir a ficha e o que conta como "visto" para os selos de nota e observacao.
  useEffect(() => {
    window.scrollTo(0, 0);
    marcarFichaVista(namespaceOffline(), alunoId);
    carregar();
  }, [alunoId, carregar]);
  useRecarregarAoVivo(EVENTOS, carregar);

  const lidos = avisosLidos(namespaceOffline());

  return (
    <main className="app-tela-pilha">
      <header className="app-cabecalho-escuro">
        <BarraTopo escuro />
        <div className="app-aluno-cabecalho app-aparecer">
          <span className="app-aluno-avatar" aria-hidden="true">{iniciais(nome)}</span>
          <span className="app-aluno-nomes">
            <span className="app-aluno-rotulo">Acompanhamento</span>
            <h1 className="app-aluno-titulo">{nome}</h1>
          </span>
        </div>
      </header>

      {erroCarga ? <p className="app-erro-carga" role="status">{erroCarga}</p> : null}

      <div className="app-abas" role="tablist" aria-label="Informações do aluno">
        {ABAS.map((item, indice) => (
          <button
            key={item.chave}
            type="button"
            role="tab"
            aria-selected={aba === item.chave}
            className={`app-aba app-pressao app-aparecer${aba === item.chave ? ' ativa' : ''}`}
            style={{ '--app-atraso': `${indice * 55}ms`, '--app-deslocamento': '8px' }}
            onClick={() => setBusca({ aba: item.chave }, { replace: true })}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <div className="app-lista">
        {carregando ? <Carregando /> : aba === 'frequencia' ? (
          <Lista vazia="Nenhum registro ainda." itens={registros} chave={(item, i) => `${item.data_hora}-${i}`}>
            {(item) => (
              <div className="app-linha">
                <span className={`app-ponto app-ponto-${!item.tipoConfirmado ? 'neutro' : item.tipoExibicao === 'Chegada' ? 'verde' : 'azul'}`} aria-hidden="true" />
                <span className="app-linha-texto">
                  <span className="app-linha-tipo">{item.tipoExibicao}</span>
                  {!item.tipoConfirmado ? (
                    <span className="app-linha-sub">Sem classificação nesta cópia salva. Reabra a tela para atualizar.</span>
                  ) : null}
                </span>
                <span className="app-linha-data">{formatarDataHora(item.data_hora)}</span>
              </div>
            )}
          </Lista>
        ) : aba === 'sala' ? (
          <Lista vazia="Nenhuma chamada do professor em sala ainda." itens={presencasSala}>
            {(item) => (
              <div className="app-linha">
                <span className={`app-ponto app-ponto-${item.presente ? 'verde' : 'vermelho'}`} aria-hidden="true" />
                <span className="app-linha-texto">
                  <span className="app-linha-tipo">
                    {item.presente ? 'Presente em sala' : item.falta_justificada ? 'Falta justificada' : 'Ausente em sala'}
                    {' · '}{item.materia || 'Aula legada'} · {item.turma_nome || 'Turma'}
                  </span>
                  {item.justificativa ? <span className="app-linha-sub">{item.justificativa}</span> : null}
                  {item.observacao ? <span className="app-linha-sub">{item.observacao}</span> : null}
                </span>
                <span className="app-linha-data">{formatarDataSemHora(item.data)}</span>
              </div>
            )}
          </Lista>
        ) : aba === 'notas' ? (
          <Lista vazia="Nenhuma nota lançada ainda." itens={notas} atrasoPorItem={55}>
            {(item) => {
              const nota = item.nota != null ? Number(item.nota) : null;
              const bom = nota != null && nota >= 6;
              return (
                <div className="app-registro">
                  <div className="app-nota-topo">
                    <span className="app-registro-titulo">{item.disciplina}</span>
                    <span className={`app-nota-selo ${bom ? 'app-nota-boa' : 'app-nota-alerta'}`}>
                      {nota != null ? nota.toFixed(1) : '—'}
                    </span>
                  </div>
                  <p className="app-nota-etapa">{item.etapa} · {formatarData(item.created_at)}</p>
                  {item.observacao ? <p className="app-registro-texto">{item.observacao}</p> : null}
                </div>
              );
            }}
          </Lista>
        ) : aba === 'observacoes' ? (
          <Lista vazia="Nenhuma observação enviada ainda." itens={observacoes} atrasoPorItem={55}>
            {(item) => (
              <div className="app-registro">
                <span className="app-registro-titulo">{item.titulo}</span>
                <p className="app-registro-texto">{item.texto}</p>
                <p className="app-registro-rodape">
                  {item.autor_nome ? `${item.autor_nome} · ` : ''}{formatarDataHora(item.created_at)}
                </p>
              </div>
            )}
          </Lista>
        ) : (
          <Lista vazia="Nenhum aviso publicado pela escola ainda." itens={avisos} atrasoPorItem={55}>
            {(item) => {
              const lido = ehLido(item, lidos);
              return (
                <button
                  type="button"
                  className="app-registro app-registro-aviso app-pressao"
                  onClick={() => navigate(`/filho/${alunoId}/aviso/${item.id}`, { state: { aviso: item } })}
                >
                  <span className="app-aviso-topo">
                    <span className="app-registro-titulo">{item.titulo}</span>
                    <span className={`app-marca ${lido ? 'app-marca-lido' : 'app-marca-novo'}`}>{lido ? 'Lido' : 'Novo'}</span>
                  </span>
                  {item.alcance ? <span className="app-aviso-alcance">{ROTULOS_ALCANCE[item.alcance] || 'Aviso'}</span> : null}
                  <span className="app-registro-texto app-registro-resumo">{item.mensagem}</span>
                  <span className="app-registro-rodape">{formatarDataHora(item.publicado_em)}</span>
                </button>
              );
            }}
          </Lista>
        )}
      </div>
    </main>
  );
}

/** Lista com entrada escalonada, como as FlatList do APK. */
function Lista({ itens, vazia, chave = (item) => item.id, atrasoPorItem = 45, children }) {
  if (!itens.length) return <p className="app-vazio">{vazia}</p>;
  return itens.map((item, indice) => (
    <div key={chave(item, indice)} className="app-aparecer" style={{ '--app-atraso': `${indice * atrasoPorItem}ms` }}>
      {children(item)}
    </div>
  ));
}
