import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { api, ehFalhaDeRede, urlDaFotoDoRegistro } from '../../api';
import { BarraTopo, Carregando } from '../Ui';
import { useVoltar } from '../useVoltar';
import { prepararRegistros } from '../batidas';
import { formatarData, formatarDataHora, formatarDataSemHora } from '../datas';

/**
 * Ficha do aluno para o professor: espelho da FichaAlunoProfessorScreen do
 * APK. O professor ve so os alunos das turmas que leciona, e so as notas e
 * observacoes que ele mesmo lancou — o backend resolve pela atribuicao.
 * Nao fica guardada no aparelho: tem contato do responsavel.
 */
const ABAS = [
  { chave: 'frequencia', rotulo: 'Escola' },
  { chave: 'sala', rotulo: 'Sala' },
  { chave: 'notas', rotulo: 'Notas' },
  { chave: 'observacoes', rotulo: 'Obs.' },
  { chave: 'avisos', rotulo: 'Avisos' },
];

function iniciais(nome = '') {
  return nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('');
}

function alcanceDoAviso(aviso) {
  if (aviso.turma_id) return 'Aviso da turma';
  if (aviso.filial_id) return 'Aviso da escola';
  return 'Aviso da rede';
}

/** Uma linha "rotulo: valor" dos dados do aluno. Valor ausente nao aparece. */
function Dado({ rotulo, valor }) {
  if (!valor) return null;
  return <p className="app-dado"><span className="app-dado-rotulo">{rotulo}</span><span className="app-dado-valor">{valor}</span></p>;
}

function Lista({ itens, vazia, chave = (item) => String(item.id), children, rodape }) {
  if (!itens.length) return <p className="app-vazio">{vazia}</p>;
  return (
    <>
      {itens.map((item, indice) => (
        <div key={chave(item, indice)} className="app-aparecer" style={{ '--app-atraso': `${indice * 45}ms` }}>{children(item)}</div>
      ))}
      {rodape}
    </>
  );
}

export default function FichaAlunoProfessor() {
  const { turmaId, alunoId } = useParams();
  const [busca] = useSearchParams();
  const atribuicaoId = busca.get('atribuicao');
  const { state } = useLocation();
  const voltar = useVoltar();
  const [aba, setAba] = useState('frequencia');
  const [ficha, setFicha] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dadosAbertos, setDadosAbertos] = useState(false);
  const [foto, setFoto] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setFicha(await api.professor.fichaAlunoProfessor(turmaId, alunoId, atribuicaoId));
    } catch (falha) {
      setFicha(null);
      if (ehFalhaDeRede(falha)) setErro('Sem conexão com a escola. A ficha do professor não fica salva no aparelho.');
      else if (falha?.status === 403) setErro('Você não leciona para este aluno, então a ficha dele não pode ser aberta.');
      else setErro(falha?.message || 'Não deu para abrir a ficha. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  }, [turmaId, alunoId, atribuicaoId]);

  useEffect(() => {
    window.scrollTo(0, 0);
    carregar();
  }, [carregar]);

  // A foto da batida sai por rota autenticada: vem como blob e e liberada ao sair.
  const fotoRecente = ficha?.foto_facial_recente;
  const idFoto = fotoRecente ? ficha.frequencia?.find((registro) => registro.foto_url === fotoRecente.foto_url)?.id : null;
  useEffect(() => {
    if (!idFoto) return undefined;
    let ativo = true;
    let endereco = null;
    urlDaFotoDoRegistro(idFoto).then((url) => {
      endereco = url;
      if (ativo) setFoto(url);
      else if (url) URL.revokeObjectURL(url);
    });
    return () => {
      ativo = false;
      if (endereco) URL.revokeObjectURL(endereco);
      setFoto(null);
    };
  }, [idFoto]);

  if (carregando) return <main className="app-tela-pilha"><BarraTopo /><Carregando /></main>;

  if (erro) {
    return (
      <main className="app-tela-pilha">
        <BarraTopo />
        <div className="app-estado app-estado-ficha app-aparecer">
          <p className="app-estado-titulo">Não deu para abrir a ficha</p>
          <p className="app-estado-texto">{erro}</p>
          <div className="app-estado-acao">
            <button type="button" className="app-login-botao botao-responsavel app-pressao" onClick={carregar}>Tentar de novo</button>
          </div>
          <button type="button" className="app-link-voltar" onClick={voltar}>Voltar para a chamada</button>
        </div>
      </main>
    );
  }

  const aluno = ficha?.aluno;
  const nome = aluno?.nome || state?.nome || 'Aluno';
  const registros = prepararRegistros(ficha?.frequencia);
  const semDados = !aluno?.nome_responsavel && !aluno?.contato_responsavel && !aluno?.data_nascimento;

  return (
    <main className="app-tela-pilha">
      <header className="app-cabecalho-escuro app-cabecalho-ficha-prof">
        <BarraTopo escuro />
        <div className="app-aluno-cabecalho app-aparecer">
          {foto
            ? <img src={foto} alt={`Última foto de ${nome}`} className="app-prof-foto" onError={() => setFoto(null)} />
            : <span className="app-prof-avatar" aria-hidden="true">{iniciais(nome)}</span>}
          <span className="app-aluno-nomes">
            <span className="app-aluno-rotulo">Ficha do aluno</span>
            <h1 className="app-aluno-titulo">{nome}</h1>
            {aluno?.matricula ? <span className="app-prof-subtitulo">Mat. {aluno.matricula}</span> : null}
            <span className="app-prof-subtitulo">{[aluno?.turma_nome, ficha?.atribuicao?.materia].filter(Boolean).join(' · ')}</span>
          </span>
        </div>

        <button type="button" className="app-expandir" aria-expanded={dadosAbertos} onClick={() => setDadosAbertos((aberto) => !aberto)}>
          <span>{dadosAbertos ? 'Esconder dados do aluno' : 'Ver dados do aluno'}</span>
          <span aria-hidden="true">{dadosAbertos ? '⌃' : '⌄'}</span>
        </button>
        {dadosAbertos ? (
          <div className="app-dados app-aparecer" style={{ '--app-deslocamento': '8px' }}>
            <Dado rotulo="Filial" valor={aluno?.filial_nome} />
            <Dado rotulo="Nascimento" valor={aluno?.data_nascimento ? formatarDataSemHora(aluno.data_nascimento) : null} />
            <Dado rotulo="Responsável" valor={aluno?.nome_responsavel} />
            <Dado rotulo="Contato" valor={aluno?.contato_responsavel} />
            <Dado rotulo="Última foto" valor={fotoRecente?.data_hora ? formatarDataHora(fotoRecente.data_hora) : null} />
            {semDados ? <p className="app-dado-vazio">A escola não preencheu estes dados.</p> : null}
          </div>
        ) : null}
      </header>

      <div className="app-abas" role="tablist" aria-label="Informações do aluno">
        {ABAS.map((item, indice) => (
          <button
            key={item.chave}
            type="button"
            role="tab"
            aria-selected={aba === item.chave}
            className={`app-aba app-pressao app-aparecer${aba === item.chave ? ' ativa' : ''}`}
            style={{ '--app-atraso': `${indice * 55}ms`, '--app-deslocamento': '8px' }}
            onClick={() => setAba(item.chave)}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <div className="app-lista">
        {aba === 'frequencia' ? (
          <Lista itens={registros} vazia="Nenhuma batida registrada ainda." chave={(item, i) => `${item.data_hora}-${i}`}>
            {(item) => (
              <div className="app-linha">
                <span className={`app-ponto app-ponto-${!item.tipoConfirmado ? 'neutro' : item.tipoExibicao === 'Chegada' ? 'verde' : 'azul'}`} aria-hidden="true" />
                <span className="app-linha-texto">
                  <span className="app-linha-tipo">{item.tipoExibicao}</span>
                  {!item.tipoConfirmado ? <span className="app-linha-sub">Sem classificação nesta cópia salva. Reabra a tela para atualizar.</span> : null}
                </span>
                <span className="app-linha-data">{formatarDataHora(item.data_hora)}</span>
              </div>
            )}
          </Lista>
        ) : aba === 'sala' ? (
          <Lista itens={ficha?.presencas_sala || []} vazia="Nenhuma chamada sua para este aluno ainda.">
            {(item) => (
              <div className="app-linha">
                <span className={`app-ponto app-ponto-${item.presente ? 'verde' : 'vermelho'}`} aria-hidden="true" />
                <span className="app-linha-texto">
                  <span className="app-linha-tipo">
                    {item.presente ? 'Presente em sala' : item.falta_justificada ? 'Falta justificada' : 'Ausente em sala'}
                    {item.materia ? ` · ${item.materia}` : ''}
                  </span>
                  {item.justificativa ? <span className="app-linha-sub">{item.justificativa}</span> : null}
                  {item.observacao ? <span className="app-linha-sub">{item.observacao}</span> : null}
                </span>
                <span className="app-linha-data">{formatarDataSemHora(item.data)}</span>
              </div>
            )}
          </Lista>
        ) : aba === 'notas' ? (
          <Lista itens={ficha?.notas || []} vazia="Você ainda não lançou notas para este aluno.">
            {(item) => (
              <div className="app-prof-cartao">
                <div className="app-nota-topo">
                  <span className="app-prof-cartao-titulo">{item.disciplina || 'Disciplina'}</span>
                  <span className="app-prof-nota">{item.nota}</span>
                </div>
                <p className="app-prof-cartao-rodape">
                  {[item.bimestre ? `${item.bimestre}º bimestre` : item.etapa, item.tipo_avaliacao, item.atividade].filter(Boolean).join(' · ')}
                </p>
                {item.observacao ? <p className="app-prof-cartao-texto">{item.observacao}</p> : null}
                <p className="app-prof-cartao-data">{formatarData(item.created_at)}</p>
              </div>
            )}
          </Lista>
        ) : aba === 'observacoes' ? (
          <Lista
            itens={ficha?.observacoes || []}
            vazia="Você ainda não registrou observações para este aluno."
            rodape={(ficha?.observacoes || []).length >= 5 ? <p className="app-rodape-lista">Mostrando as suas cinco observações mais recentes.</p> : null}
          >
            {(item) => (
              <div className="app-prof-cartao">
                <span className="app-prof-cartao-titulo">{item.titulo || 'Observação'}</span>
                {item.texto ? <p className="app-prof-cartao-texto">{item.texto}</p> : null}
                <p className="app-prof-cartao-data">{formatarDataHora(item.created_at)}</p>
              </div>
            )}
          </Lista>
        ) : (
          <Lista itens={ficha?.avisos || []} vazia="Nenhum aviso publicado.">
            {(item) => (
              <div className="app-prof-cartao">
                <span className="app-prof-cartao-rotulo">{alcanceDoAviso(item)}</span>
                <span className="app-prof-cartao-titulo">{item.titulo}</span>
                {item.mensagem ? <p className="app-prof-cartao-texto">{item.mensagem}</p> : null}
                <p className="app-prof-cartao-data">{formatarDataHora(item.publicado_em)}</p>
              </div>
            )}
          </Lista>
        )}
      </div>
    </main>
  );
}
