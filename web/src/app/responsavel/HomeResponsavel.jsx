import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ehFalhaDeRede, namespaceOffline } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useRecarregarAoVivo } from '../../context/RealtimeContext';
import { Aviso, BarraNavegacao, BotaoGrande, CabecalhoHome, Carregando, FaixaEstado, Ficha } from '../Ui';
import Icone from '../Icone';
import { useFilaOffline } from '../useFilaOffline';
import { prepararRegistros } from '../batidas';
import { dataHoje, formatarDataHora, rotuloDoDia, saudacaoDoDia } from '../datas';
import { avisosLidos, ehLido, fichaVistaEm, marcarFichaVista, resumoDoFilho, rotuloDaPassagem } from '../novidades';
import { ativarNotificacoes, permissaoAtual, renovarInscricao, suportaPush } from '../notificacoesPush';

/**
 * Home do responsavel: espelho da ResponsavelHomeScreen do APK, ja com as
 * mudancas das tarefas #55 e #56 — os tres numeros so leitura e da mesma cor,
 * sem o cartao "Ultimo aviso" (aviso agora so dentro da ficha de cada filho),
 * sem o "+ Adicionar" ao lado de "Seus filhos" (so o botao da barra), e cada
 * filho com a ultima passagem e o que chegou de novo.
 *
 * Tudo aqui vem da API. O que o backend nao informa nao aparece.
 */

// Eventos que mudam algum card. O RealtimeContext espera 1,5 s e junta rajadas.
const EVENTOS = ['ponto.criado', 'nota.criada', 'observacao.criada', 'aviso.lancado', 'aviso.atualizado', 'aviso.removido'];

/**
 * Inicio da janela da "ultima passagem": 7 dias, contando hoje. Vai ao
 * meio-dia de Brasilia porque o backend le a data como instante — meia-noite
 * UTC cairia no dia anterior.
 */
function seteDiasAtras() {
  const [ano, mes, dia] = dataHoje().split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, dia - 6)).toISOString().slice(0, 10);
  return `${inicio}T12:00:00-03:00`;
}

function iniciais(nome = '') {
  return nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('');
}

const lista = (resultado, campo) => (resultado.status === 'fulfilled' ? resultado.value?.[campo] || [] : []);

export default function HomeResponsavel({ onSair }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const pendentes = useFilaOffline().length;

  const [filhos, setFilhos] = useState([]);
  const [porFilho, setPorFilho] = useState({});
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const resposta = await api.responsavel.listarAlunos();
      const alunos = resposta?.alunos || [];
      setFilhos(alunos);
      setErro('');

      const de = seteDiasAtras();
      const dados = await Promise.all(alunos.map(async (aluno) => {
        const [frequencia, avisos, notas, observacoes] = await Promise.allSettled([
          api.responsavel.frequenciaDoAluno(aluno.id, { de }),
          api.responsavel.avisosDoAluno(aluno.id),
          api.responsavel.notasDoAluno(aluno.id),
          api.responsavel.observacoesDoAluno(aluno.id),
        ]);
        return [aluno.id, {
          registros: prepararRegistros(lista(frequencia, 'registros')),
          avisos: lista(avisos, 'avisos'),
          notas: lista(notas, 'notas'),
          observacoes: lista(observacoes, 'observacoes'),
        }];
      }));

      // Marco zero do "novo": a primeira vez que a Home carrega neste aparelho.
      const namespace = namespaceOffline();
      alunos.forEach((aluno) => {
        if (fichaVistaEm(namespace, aluno.id) == null) marcarFichaVista(namespace, aluno.id);
      });
      setPorFilho(Object.fromEntries(dados));
    } catch (err) {
      setErro(ehFalhaDeRede(err)
        ? 'Sem conexão com a internet. Conecte-se e toque em Tentar de novo.'
        : err?.message || 'Não foi possível carregar seus filhos agora. Tente de novo.');
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useRecarregarAoVivo(EVENTOS, carregar);

  // Sem "puxar para atualizar" no navegador: recarrega quando o app volta a aparecer.
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [carregar]);

  const namespace = namespaceOffline();
  const lidos = avisosLidos(namespace);
  // Um aviso da escola chega a todos os filhos dela: conta uma vez so.
  const naoLidos = new Set(
    Object.values(porFilho).flatMap(({ avisos }) => avisos.filter((aviso) => !ehLido(aviso, lidos)).map((aviso) => aviso.id)),
  ).size;
  const primeiroNome = usuario?.nome?.trim().split(/\s+/)[0];

  return (
    <>
      <main className="app-tela">
        <CabecalhoHome
          papel="RESPONSÁVEL"
          titulo={`${saudacaoDoDia()}, ${primeiroNome || 'família'}`}
          subtitulo={rotuloDoDia(dataHoje())}
          nome={usuario?.nome}
          onSair={onSair}
        />

        <FaixaEstado pendentes={pendentes} onSincronizar={() => navigate('/sincronizar')} />
        <Aviso tipo="erro" texto={filhos.length > 0 ? erro : ''} />
        <CartaoNotificacoes />

        <div className="app-fichas">
          <Ficha rotulo="Filhos" valor={carregado ? filhos.length : '–'} atraso={130} />
          <Ficha rotulo="Avisos" valor={carregado ? naoLidos : '–'} atraso={200} />
          <Ficha rotulo="Pendências" valor={pendentes} atraso={270} />
        </div>

        {/* Sem o "+ Adicionar" ao lado do titulo: adicionar filho fica so no botao
            central da barra (Samuel, 2026-09-27). */}
        <h2 className="app-secao app-aparecer" style={{ '--app-atraso': '170ms' }}>Seus filhos</h2>

        {!carregado ? (
          <Carregando />
        ) : erro && filhos.length === 0 ? (
          <div className="app-estado">
            <p className="app-estado-titulo">Não deu para carregar</p>
            <p className="app-estado-texto">{erro}</p>
            <div className="app-estado-acao"><BotaoGrande texto="Tentar de novo" onClick={carregar} /></div>
          </div>
        ) : filhos.length === 0 ? (
          <div className="app-estado">
            <p className="app-estado-titulo">Nenhum filho vinculado ainda</p>
            <p className="app-estado-texto">Adicione seu filho com a matrícula informada pela escola.</p>
            <div className="app-estado-acao">
              <BotaoGrande texto="Adicionar filho" onClick={() => navigate('/adicionar-filho')} />
            </div>
          </div>
        ) : (
          filhos.map((filho, indice) => (
            <CartaoFilho
              key={filho.id}
              filho={filho}
              resumo={resumoDoFilho({ ...porFilho[filho.id], lidos, vistaEm: fichaVistaEm(namespace, filho.id) })}
              atraso={210 + indice * 70}
              onAbrir={() => navigate(`/filho/${filho.id}`, { state: { nome: filho.nome } })}
            />
          ))
        )}
      </main>

      <BarraNavegacao
        itens={[
          { chave: 'filhos', rotulo: 'Filhos', icone: 'people', ativo: true },
          { chave: 'sincronizar', rotulo: 'Sincronizar', icone: 'sync', onClick: () => navigate('/sincronizar') },
        ]}
        central={{ rotulo: 'Adicionar', icone: 'add', onClick: () => navigate('/adicionar-filho') }}
      />
    </>
  );
}

function CartaoFilho({ filho, resumo, atraso, onAbrir }) {
  const { ultima, avisosPendentes, notaNova, observacaoNova } = resumo;
  const tomPonto = ultima?.tipoExibicao === 'Chegada' ? 'verde' : ultima?.tipoExibicao === 'Saída' ? 'azul' : 'neutro';
  return (
    <button type="button" className="app-filho app-pressao app-aparecer" style={{ '--app-atraso': `${atraso}ms` }} onClick={onAbrir}>
      <span className="app-filho-avatar" aria-hidden="true">{iniciais(filho.nome)}</span>
      <span className="app-filho-texto">
        <span className="app-filho-nome">{filho.nome}</span>
        <span className="app-filho-detalhe">
          {[filho.turma_nome || 'Sem turma', filho.filial_nome].filter(Boolean).join(' · ')}
        </span>
        <span className="app-filho-passagem">
          <span className={`app-ponto app-ponto-${tomPonto}`} aria-hidden="true" />
          {ultima
            ? `${rotuloDaPassagem(ultima)} · ${formatarDataHora(ultima.data_hora)}`
            : 'Nenhuma passagem nos últimos 7 dias'}
        </span>
        {avisosPendentes || notaNova || observacaoNova ? (
          <span className="app-filho-selos">
            {avisosPendentes ? (
              <span className="app-selo app-selo-aviso">
                {avisosPendentes === 1 ? '1 aviso pendente' : `${avisosPendentes} avisos pendentes`}
              </span>
            ) : null}
            {notaNova ? <span className="app-selo app-selo-novo">Nova nota</span> : null}
            {observacaoNova ? <span className="app-selo app-selo-novo">Nova observação</span> : null}
          </span>
        ) : null}
      </span>
      <span className="app-filho-seta" aria-hidden="true"><Icone nome="chevron-forward" tamanho={16} /></span>
    </button>
  );
}

/**
 * Pedido de notificacao (#66). No iPhone a permissao so pode ser pedida a
 * partir de um toque, e so com o PWA instalado — por isso um cartao, e nao um
 * pedido automatico como o do APK. Ja permitido: renova a inscricao em
 * silencio a cada abertura.
 */
function CartaoNotificacoes() {
  const [permissao, setPermissao] = useState(permissaoAtual);
  const [ativando, setAtivando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => { renovarInscricao(); }, []);

  async function ativar() {
    setAtivando(true);
    try {
      const final = await ativarNotificacoes();
      setPermissao(final);
      setResultado(final === 'granted'
        ? { tipo: 'ok', texto: 'Notificações ativadas. Elas chegam mesmo com o app fechado.' }
        : { tipo: 'erro', texto: 'As notificações ficaram bloqueadas. Para receber, libere nos Ajustes do aparelho.' });
    } catch (err) {
      setResultado({ tipo: 'erro', texto: err?.message || 'Não foi possível ativar as notificações agora. Tente de novo.' });
    } finally {
      setAtivando(false);
    }
  }

  if (resultado) return <Aviso tipo={resultado.tipo} texto={resultado.texto} />;
  if (!suportaPush() || permissao !== 'default') return null;
  return (
    <div className="app-cartao app-notificacoes app-aparecer" style={{ '--app-atraso': '100ms' }}>
      <p className="app-texto"><strong>Receba as notificações da escola</strong></p>
      <p className="app-texto-apoio">Chegada, saída, falta em sala e avisos, mesmo com o app fechado.</p>
      <BotaoGrande texto={ativando ? 'Ativando...' : 'Ativar notificações'} onClick={ativar} desabilitado={ativando} />
    </div>
  );
}
