import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { MESES, baixarCsv, exportarPdf, limitesDoMes, minutosParaHoras } from '../utils/exportar';

/** Plural de verdade: "1 turma", "8 turmas" — nada de "turma(s)". */
const plural = (n, singular, pluralForma) => `${n} ${n === 1 ? singular : pluralForma}`;

/**
 * Barras horizontais em HTML/CSS, nao SVG. Em SVG o texto escala junto com o
 * container, entao o mesmo componente saia com fonte pequena numa coluna
 * estreita e enorme em largura cheia. Aqui a barra e uma div com largura em %
 * e a fonte fica fixa — legivel em qualquer largura.
 *
 * O trilho atras da barra da a escala: sem ele, uma barra sozinha nao diz se o
 * valor e alto ou baixo.
 */
function GraficoBarras({ dados, cor = 'azul' }) {
  if (!dados.length) return <p className="vazio">Sem dados no período selecionado.</p>;

  const maximo = Math.max(...dados.map((d) => d.valor), 1);

  return (
    <div className="grafico">
      {dados.map((d) => (
        <div className="grafico-linha" key={d.rotulo}>
          <span className="grafico-rotulo" title={d.rotulo}>{d.rotulo}</span>
          <span className="grafico-trilho">
            <span
              className={`grafico-barra ${cor}`}
              style={{ width: `${d.valor > 0 ? Math.max((d.valor / maximo) * 100, 1.5) : 0}%` }}
            />
          </span>
          <span className="grafico-valor mono">{d.valor}</span>
        </div>
      ))}
    </div>
  );
}

/** Botao unico de exportacao: abre um menu para escolher o formato. */
function MenuExportar({ aoExportar }) {
  const [aberto, setAberto] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const clique = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setAberto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', clique);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', clique);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  function escolher(formato) {
    setAberto(false);
    aoExportar(formato);
  }

  return (
    <div className="menu-wrap" ref={wrap}>
      <button
        type="button"
        className="btn btn-secundario"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        Exportar
        <span aria-hidden="true" style={{ fontSize: 10, marginLeft: 1 }}>▾</span>
      </button>
      {aberto && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={() => escolher('csv')}>
            Planilha (.csv)
            <span className="desc">Abre no Excel ou Google Planilhas</span>
          </button>
          <button type="button" role="menuitem" onClick={() => escolher('pdf')}>
            Documento (.pdf)
            <span className="desc">Abre a impressão — escolha “Salvar como PDF”</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [unidadeId, setUnidadeId] = useState('');

  const [dispositivos, setDispositivos] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [naoResolvidos, setNaoResolvidos] = useState([]);
  const [totalFuncionarios, setTotalFuncionarios] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [indisponiveis, setIndisponiveis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoResumo, setCarregandoResumo] = useState(false);

  /* allSettled, nao all: uma rota com falha nao pode derrubar o painel todo. */
  useEffect(() => {
    let ativo = true;
    (async () => {
      const r = await Promise.allSettled([
        api.listarDispositivos(),
        api.listarFuncionarios(),
        api.listarRegistrosNaoResolvidos(),
        api.listarAlunos(),
        api.listarTurmas(),
        api.listarUnidades(),
      ]);
      if (!ativo) return;

      const falhas = [];
      const [disp, func, naoRes, alun, turm, unid] = r;

      if (disp.status === 'fulfilled') setDispositivos(disp.value.dispositivos || []); else falhas.push('dispositivos');
      if (func.status === 'fulfilled') setTotalFuncionarios((func.value.funcionarios || []).length); else falhas.push('funcionários');
      if (naoRes.status === 'fulfilled') setNaoResolvidos(naoRes.value.registros || []); else falhas.push('batidas sem vínculo');
      if (alun.status === 'fulfilled') setAlunos(alun.value.alunos || []); else falhas.push('alunos');
      if (turm.status === 'fulfilled') setTurmas(turm.value.turmas || []); else falhas.push('turmas');
      if (unid.status === 'fulfilled') setUnidades(unid.value.filiais || []); else falhas.push('unidades');

      setIndisponiveis(falhas);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregandoResumo(true);
      const { de, ate } = limitesDoMes(ano, mes);
      try {
        const res = await api.resumoPeriodo(de, ate);
        if (ativo) setResumo(res.resumo || []);
      } catch {
        if (ativo) setResumo(null); // null = indisponivel; [] = vazio
      } finally {
        if (ativo) setCarregandoResumo(false);
      }
    })();
    return () => { ativo = false; };
  }, [mes, ano]);

  // O filtro de unidade so se aplica a quem tem filial_id — dispositivos e
  // batidas nao sao escopados por unidade nesta API.
  const alunosFiltrados = useMemo(
    () => (unidadeId ? alunos.filter((a) => a.filial_id === unidadeId) : alunos),
    [alunos, unidadeId],
  );
  const turmasFiltradas = useMemo(
    () => (unidadeId ? turmas.filter((t) => t.filial_id === unidadeId) : turmas),
    [turmas, unidadeId],
  );

  const unidadeNome = unidades.find((u) => u.id === unidadeId)?.nome;
  const periodo = `${MESES[mes]} de ${ano}`;

  const alunosPorTurma = useMemo(() => {
    const mapa = new Map(turmasFiltradas.map((t) => [t.id, { rotulo: t.nome, valor: 0 }]));
    let semTurma = 0;
    alunosFiltrados.forEach((a) => {
      if (a.turma_id && mapa.has(a.turma_id)) mapa.get(a.turma_id).valor += 1;
      else semTurma += 1;
    });
    const lista = [...mapa.values()].sort((a, b) => b.valor - a.valor);
    if (semTurma) lista.push({ rotulo: 'Sem turma', valor: semTurma });
    return lista;
  }, [alunosFiltrados, turmasFiltradas]);

  const pendencias = useMemo(() => {
    const comAluno = new Set(alunosFiltrados.map((a) => a.turma_id).filter(Boolean));
    return [
      { chave: 'turma', texto: 'Alunos sem turma vinculada', total: alunosFiltrados.filter((a) => !a.turma_id).length, link: '/alunos' },
      { chave: 'nasc', texto: 'Alunos sem data de nascimento', total: alunosFiltrados.filter((a) => !a.data_nascimento).length, link: '/alunos' },
      // A matricula deixou de ser obrigatoria no cadastro, entao este item e o
      // unico lembrete de que ela ainda falta. Nao remova.
      { chave: 'matricula', texto: 'Alunos sem matrícula — regularizar', total: alunosFiltrados.filter((a) => !a.matricula).length, link: '/alunos' },
      { chave: 'vazia', texto: 'Turmas ativas sem nenhum aluno', total: turmasFiltradas.filter((t) => t.ativo && !comAluno.has(t.id)).length, link: '/turmas' },
      { chave: 'batidas', texto: 'Batidas sem funcionário ou aluno vinculado', total: naoResolvidos.length, link: '/relatorios' },
    ].filter((p) => p.total > 0);
  }, [alunosFiltrados, turmasFiltradas, naoResolvidos]);

  const faltasDoMes = useMemo(() => {
    if (!resumo) return [];
    return resumo
      .map((r) => ({ rotulo: r.nome, valor: Number(r.faltas) || 0 }))
      .filter((r) => r.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [resumo]);

  function exportar(formato) {
    if (formato === 'pdf') { exportarPdf(); return; }

    const linhas = [
      ['Visão geral'],
      ['Período', periodo],
      ['Unidade', unidadeNome || 'Todas'],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      [],
      ['Indicador', 'Valor'],
      ['Funcionários ativos', totalFuncionarios ?? 'indisponível'],
      ['Alunos', alunosFiltrados.length],
      ['Turmas', turmasFiltradas.length],
      ['Dispositivos', dispositivos.length],
      ['Batidas sem vínculo', naoResolvidos.length],
      [],
      ['Precisa de atenção'],
      ['Descrição', 'Total'],
      ...(pendencias.length ? pendencias.map((p) => [p.texto, p.total]) : [['Nada pendente', 0]]),
      [],
      ['Alunos por turma'],
      ['Turma', 'Alunos'],
      ...alunosPorTurma.map((t) => [t.rotulo, t.valor]),
    ];

    if (resumo?.length) {
      linhas.push(
        [],
        [`Resumo por funcionário — ${periodo}`],
        ['Funcionário', 'Matrícula', 'Horas trabalhadas', 'Saldo', 'Extras', 'Faltas', 'Atraso'],
        ...resumo.map((r) => [
          r.nome, r.matricula,
          minutosParaHoras(r.horas_trabalhadas_minutos),
          minutosParaHoras(r.saldo_minutos),
          minutosParaHoras(r.extras_minutos),
          r.faltas,
          minutosParaHoras(r.atraso_minutos),
        ]),
      );
    }

    baixarCsv(`visao-geral-${ano}-${String(mes + 1).padStart(2, '0')}.csv`, linhas);
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  const anos = [];
  for (let a = hoje.getFullYear() + 1; a >= hoje.getFullYear() - 4; a -= 1) anos.push(a);

  return (
    <Layout>
      <h1 className="titulo-pagina">Visão geral</h1>
      <p className="subtitulo-pagina">{periodo}{unidadeNome ? ` · ${unidadeNome}` : ' · todas as unidades'}</p>

      <div className="filtros nao-imprimir">
        <div className="campo">
          <label htmlFor="f-unidade">Unidade</label>
          <Selecao
            id="f-unidade"
            rotuloAria="Unidade"
            valor={unidadeId}
            aoMudar={setUnidadeId}
            opcoes={[
              { valor: '', rotulo: 'Todas as unidades' },
              ...unidades.map((u) => ({ valor: u.id, rotulo: u.nome })),
            ]}
          />
        </div>
        <div className="campo">
          <label htmlFor="f-mes">Mês</label>
          <Selecao
            id="f-mes"
            rotuloAria="Mês"
            valor={mes}
            aoMudar={(v) => setMes(Number(v))}
            opcoes={MESES.map((m, i) => ({ valor: i, rotulo: m }))}
          />
        </div>
        <div className="campo">
          <label htmlFor="f-ano">Ano</label>
          <Selecao
            id="f-ano"
            rotuloAria="Ano"
            valor={ano}
            aoMudar={(v) => setAno(Number(v))}
            opcoes={anos.map((a) => ({ valor: a, rotulo: String(a) }))}
          />
        </div>
        <div className="espaco" />
        <MenuExportar aoExportar={exportar} />
      </div>

      {indisponiveis.length > 0 && (
        <div className="erro nao-imprimir">
          Não foi possível carregar: {indisponiveis.join(', ')}. O restante segue atualizado.
        </div>
      )}

      <section className="secao">
        <div className="numeros">
          <div className={`numero ${totalFuncionarios === null ? 'indisponivel' : ''}`}>
            <div className="valor">{totalFuncionarios === null ? 'indisponível' : totalFuncionarios}</div>
            <div className="label">Funcionários ativos</div>
          </div>
          <div className="numero">
            <div className="valor">{alunosFiltrados.length}</div>
            <div className="label">Alunos</div>
          </div>
          <div className="numero">
            <div className="valor">{turmasFiltradas.length}</div>
            <div className="label">Turmas</div>
          </div>
          <div className="numero">
            <div className="valor">{dispositivos.length}</div>
            <div className="label">Dispositivos</div>
          </div>
          <div className={`numero ${naoResolvidos.length ? 'destaque' : 'ok'}`}>
            <div className="valor">{naoResolvidos.length}</div>
            <div className="label">Batidas sem vínculo</div>
          </div>
        </div>
      </section>

      <div className="colunas">
        <section className="secao">
          <h2>
            Precisa de atenção
            {pendencias.length > 0 && <span className="nota">{plural(pendencias.length, 'item', 'itens')}</span>}
          </h2>
          {pendencias.length === 0 ? (
            <div className="tudo-certo">Nenhuma pendência de turmas ou alunos.</div>
          ) : (
            <div className="atencao">
              {pendencias.map((p) => (
                <div key={p.chave} className="atencao-linha">
                  <span className="atencao-contagem">{p.total}</span>
                  <span className="atencao-texto">{p.texto}</span>
                  <Link to={p.link} className="btn btn-secundario btn-pequeno nao-imprimir">Resolver</Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="secao">
          <h2>
            Alunos por turma
            <span className="nota">
              {plural(turmasFiltradas.length, 'turma', 'turmas')} · {plural(alunosFiltrados.length, 'aluno', 'alunos')}
            </span>
          </h2>
          <div className="painel"><div className="painel-corpo">
            {/* Verde = dado positivo (efetivo); ambar fica reservado ao grafico
                de faltas. O azul e a cor da estrutura, nao dos dados. */}
            <GraficoBarras dados={alunosPorTurma} cor="verde" />
          </div></div>
        </section>
      </div>

      <section className="secao">
        <h2>
          Faltas em {MESES[mes].toLowerCase()}
          {faltasDoMes.length > 0 && <span className="nota">10 maiores</span>}
        </h2>
        <div className="painel"><div className="painel-corpo">
          {carregandoResumo && <p className="vazio">Carregando o período...</p>}
          {!carregandoResumo && resumo === null && (
            <p className="vazio">Não foi possível carregar as faltas deste mês.</p>
          )}
          {!carregandoResumo && resumo !== null && (
            <>
              <GraficoBarras dados={faltasDoMes} cor="ambar" />
              {faltasDoMes.length > 0 && (
                <div className="legenda">
                  <span><i style={{ background: 'var(--ambar)' }} /> Faltas registradas no mês</span>
                </div>
              )}
            </>
          )}
        </div></div>
      </section>

      <section className="secao nao-imprimir">
        <h2>
          Relatórios
          <Link to="/relatorios" className="nota" style={{ color: 'var(--azul)' }}>ver todos →</Link>
        </h2>
        <div className="atalhos">
          {[
            { para: '/relatorios', titulo: 'Presença de aluno', desc: 'Batidas de entrada e saída por aluno e período.' },
            { para: '/relatorios', titulo: 'Resumo de ponto', desc: 'Horas, saldo, extras, faltas e atrasos por funcionário.' },
            { para: '/relatorios', titulo: 'Cadastros', desc: 'Alunos, turmas, funcionários e dispositivos, com filtros.' },
            { para: '/relatorios', titulo: 'Auditoria', desc: 'Quem alterou o quê e quando, no período escolhido.' },
          ].map((a) => (
            <Link key={a.titulo} to={a.para} className="atalho">
              <span className="atalho-titulo">{a.titulo}</span>
              <span className="atalho-desc">{a.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="secao">
        <h2>
          Dispositivos
          <span className="nota">{plural(dispositivos.length, 'cadastrado', 'cadastrados')}</span>
        </h2>
        <div className="painel">
          <table className="tabela">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>IP : Porta</th>
                <th>Último NSR</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {dispositivos.map((d) => (
                <tr key={d.id}>
                  <td><Link to={`/dispositivos/${d.id}/editar`}>{d.descricao}</Link></td>
                  <td className="mono">{d.ip}:{d.porta}</td>
                  <td><span className="chip-dado">{d.ultimo_nsr}</span></td>
                  <td>
                    <span className={`badge badge-${d.situacao}`}>
                      {d.situacao === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
              {dispositivos.length === 0 && (
                <tr><td colSpan={4}><div className="vazio">Nenhum dispositivo cadastrado.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}
