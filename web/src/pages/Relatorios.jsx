import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { useRecarregarAoVivo } from '../context/RealtimeContext';
import { baixarCsv, exportarPdf, limitesDoMes, minutosParaHoras } from '../utils/exportar';

const data = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const dataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
const sim = (v) => (v ? 'Sim' : 'Não');

/**
 * Catalogo de relatorios. Cada entrada declara: quais filtros mostrar, como
 * buscar os dados e quais colunas exibir. Acrescentar relatorio novo e
 * acrescentar um objeto aqui — a tela nao muda.
 *
 * `filtros` usa as chaves conhecidas pelo formulario: periodo, unidade, turma,
 * funcionario, situacao, acao, entidade.
 */
const RELATORIOS = [
  {
    id: 'alunos',
    rotulo: 'Alunos cadastrados',
    grupo: 'Cadastros',
    descricao: 'Lista de alunos com turma, unidade e dados de cadastro.',
    filtros: ['unidade', 'turma', 'situacao'],
    async buscar(f) {
      const r = await api.listarAlunos(f.turma ? { turma_id: f.turma } : {});
      let linhas = r.alunos || [];
      if (f.unidade) linhas = linhas.filter((a) => a.filial_id === f.unidade);
      if (f.situacao === 'ativos') linhas = linhas.filter((a) => a.ativo);
      if (f.situacao === 'inativos') linhas = linhas.filter((a) => !a.ativo);
      return linhas;
    },
    colunas: [
      { titulo: 'Nome', valor: (a) => a.nome },
      { titulo: 'Matrícula', valor: (a) => a.matricula, mono: true },
      { titulo: 'CPF', valor: (a) => a.cpf || '—', mono: true },
      { titulo: 'Nascimento', valor: (a) => data(a.data_nascimento), mono: true },
      { titulo: 'Turma', valor: (a) => a.turma_nome || 'sem turma' },
      { titulo: 'Unidade', valor: (a) => a.filial_nome },
      { titulo: 'Situação', valor: (a) => (a.ativo ? 'Ativo' : 'Inativo') },
    ],
  },
  {
    id: 'presenca-aluno',
    aoVivo: true, // depende de batida/presenca: vale reexecutar sozinho
    rotulo: 'Presença de aluno',
    grupo: 'Presença',
    descricao: 'Batidas registradas de um aluno no período — entrada e saída da escola.',
    filtros: ['aluno', 'periodo'],
    exigeAluno: true,
    async buscar(f) {
      const r = await api.frequenciaAluno(f.aluno, f.de, f.ate);
      return r.registros || [];
    },
    colunas: [
      { titulo: 'Data e hora', valor: (r) => dataHora(r.marcado_em || r.data_hora), mono: true },
      { titulo: 'Dispositivo', valor: (r) => r.dispositivo_descricao || '—' },
      { titulo: 'Origem', valor: (r) => r.origem || '—' },
      { titulo: 'NSR', valor: (r) => r.nsr ?? '—', mono: true },
    ],
  },
  {
    id: 'turmas',
    rotulo: 'Turmas',
    grupo: 'Cadastros',
    descricao: 'Turmas com unidade, turno, ano letivo e total de alunos.',
    filtros: ['unidade', 'situacao'],
    async buscar(f, ctx) {
      let linhas = ctx.turmas;
      if (f.unidade) linhas = linhas.filter((t) => t.filial_id === f.unidade);
      if (f.situacao === 'ativos') linhas = linhas.filter((t) => t.ativo);
      if (f.situacao === 'inativos') linhas = linhas.filter((t) => !t.ativo);
      return linhas.map((t) => ({
        ...t,
        total_alunos: ctx.alunos.filter((a) => a.turma_id === t.id).length,
      }));
    },
    colunas: [
      { titulo: 'Turma', valor: (t) => t.nome },
      { titulo: 'Unidade', valor: (t) => t.filial_nome },
      { titulo: 'Turno', valor: (t) => t.turno },
      { titulo: 'Ano letivo', valor: (t) => t.ano_letivo, mono: true },
      { titulo: 'Alunos', valor: (t) => t.total_alunos, mono: true },
      { titulo: 'Situação', valor: (t) => (t.ativo ? 'Ativa' : 'Inativa') },
    ],
  },
  {
    id: 'resumo-ponto',
    aoVivo: true, // depende de batida/presenca: vale reexecutar sozinho
    rotulo: 'Resumo de ponto por funcionário',
    grupo: 'Funcionários',
    descricao: 'Horas trabalhadas, saldo, extras, faltas e atrasos no período.',
    filtros: ['periodo'],
    async buscar(f) {
      const r = await api.resumoPeriodo(f.de, f.ate);
      return r.resumo || [];
    },
    colunas: [
      { titulo: 'Funcionário', valor: (r) => r.nome },
      { titulo: 'Matrícula', valor: (r) => r.matricula, mono: true },
      { titulo: 'Horas trabalhadas', valor: (r) => minutosParaHoras(r.horas_trabalhadas_minutos), mono: true },
      { titulo: 'Saldo', valor: (r) => minutosParaHoras(r.saldo_minutos), mono: true },
      { titulo: 'Extras', valor: (r) => minutosParaHoras(r.extras_minutos), mono: true },
      { titulo: 'Faltas', valor: (r) => r.faltas, mono: true },
      { titulo: 'Atraso', valor: (r) => minutosParaHoras(r.atraso_minutos), mono: true },
    ],
  },
  {
    id: 'espelho-ponto',
    aoVivo: true, // depende de batida/presenca: vale reexecutar sozinho
    rotulo: 'Espelho de ponto',
    grupo: 'Funcionários',
    descricao: 'Apontamentos diários de um funcionário — o relatório de conferência do RH.',
    filtros: ['funcionario', 'periodo'],
    exigeFuncionario: true,
    async buscar(f) {
      const r = await api.espelhoPonto(f.funcionario, f.de, f.ate);
      return r.apontamentos || [];
    },
    colunas: [
      { titulo: 'Data', valor: (a) => data(a.data), mono: true },
      { titulo: 'Trabalhadas', valor: (a) => minutosParaHoras(a.horas_trabalhadas_minutos), mono: true },
      { titulo: 'Previstas', valor: (a) => minutosParaHoras(a.horas_previstas_minutos), mono: true },
      { titulo: 'Saldo', valor: (a) => minutosParaHoras(a.saldo_minutos), mono: true },
      { titulo: 'Atraso', valor: (a) => minutosParaHoras(a.atraso_minutos), mono: true },
      { titulo: 'Falta', valor: (a) => sim(a.falta) },
    ],
  },
  {
    id: 'funcionarios',
    rotulo: 'Funcionários cadastrados',
    grupo: 'Funcionários',
    descricao: 'Lista de funcionários com cargo, departamento e situação.',
    filtros: ['situacao'],
    async buscar(f) {
      const r = await api.listarFuncionarios();
      let linhas = r.funcionarios || [];
      if (f.situacao === 'ativos') linhas = linhas.filter((x) => x.ativo);
      if (f.situacao === 'inativos') linhas = linhas.filter((x) => !x.ativo);
      return linhas;
    },
    colunas: [
      { titulo: 'Nome', valor: (x) => x.nome },
      { titulo: 'Matrícula', valor: (x) => x.matricula, mono: true },
      { titulo: 'CPF', valor: (x) => x.cpf, mono: true },
      { titulo: 'Cargo', valor: (x) => x.cargo || '—' },
      { titulo: 'Departamento', valor: (x) => x.departamento_nome || '—' },
      { titulo: 'Admissão', valor: (x) => data(x.data_admissao), mono: true },
      { titulo: 'Situação', valor: (x) => (x.ativo ? 'Ativo' : 'Inativo') },
    ],
  },
  {
    id: 'sem-vinculo',
    aoVivo: true, // depende de batida/presenca: vale reexecutar sozinho
    rotulo: 'Batidas sem vínculo',
    grupo: 'Ponto',
    descricao: 'Registros capturados pelos relógios que não casaram com nenhum funcionário ou aluno.',
    filtros: [],
    async buscar() {
      const r = await api.listarRegistrosNaoResolvidos();
      return r.registros || [];
    },
    colunas: [
      { titulo: 'Data e hora', valor: (r) => dataHora(r.marcado_em || r.data_hora), mono: true },
      { titulo: 'Dispositivo', valor: (r) => r.dispositivo_descricao || '—' },
      { titulo: 'ID no equipamento', valor: (r) => r.id_no_dispositivo || '—', mono: true },
      { titulo: 'NSR', valor: (r) => r.nsr ?? '—', mono: true },
    ],
  },
  {
    id: 'dispositivos',
    rotulo: 'Dispositivos',
    grupo: 'Cadastros',
    descricao: 'Relógios cadastrados, com protocolo, endereço e último NSR coletado.',
    filtros: [],
    async buscar() {
      const r = await api.listarDispositivos();
      return r.dispositivos || [];
    },
    colunas: [
      { titulo: 'Descrição', valor: (d) => d.descricao },
      { titulo: 'IP : Porta', valor: (d) => `${d.ip || '—'}:${d.porta}`, mono: true },
      { titulo: 'Protocolo', valor: (d) => d.protocolo },
      { titulo: 'Modo', valor: (d) => d.modo_conexao },
      { titulo: 'Último NSR', valor: (d) => d.ultimo_nsr ?? '—', mono: true },
      { titulo: 'Situação', valor: (d) => d.situacao },
    ],
  },
  {
    id: 'auditoria',
    rotulo: 'Auditoria',
    grupo: 'Sistema',
    descricao: 'Quem alterou o quê e quando. Somente leitura — o log é imutável.',
    filtros: ['periodo', 'acao', 'entidade'],
    async buscar(f) {
      const r = await api.listarAuditoria({
        de: f.de, ate: f.ate, acao: f.acao, entidade: f.entidade, limite: 200,
      });
      return r.logs || r.registros || r.dados || [];
    },
    colunas: [
      { titulo: 'Quando', valor: (l) => dataHora(l.criado_em), mono: true },
      { titulo: 'Usuário', valor: (l) => l.usuario_nome || l.usuario_id || '—' },
      { titulo: 'Ação', valor: (l) => l.acao },
      { titulo: 'Entidade', valor: (l) => l.entidade },
      { titulo: 'Registro', valor: (l) => l.entidade_id || '—', mono: true },
      { titulo: 'Origem', valor: (l) => l.ip_origem || '—', mono: true },
    ],
  },
];

const SITUACOES = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'ativos', rotulo: 'Somente ativos' },
  { valor: 'inativos', rotulo: 'Somente inativos' },
];

export default function Relatorios() {
  const hoje = new Date();
  const mesAtual = limitesDoMes(hoje.getFullYear(), hoje.getMonth());

  const [tipoId, setTipoId] = useState(RELATORIOS[0].id);
  const [filtros, setFiltros] = useState({
    de: mesAtual.de, ate: mesAtual.ate, unidade: '', turma: '', aluno: '',
    funcionario: '', situacao: '', acao: '', entidade: '',
  });

  const [ctx, setCtx] = useState({ unidades: [], turmas: [], alunos: [], funcionarios: [] });
  const [linhas, setLinhas] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);
  const [carregandoCtx, setCarregandoCtx] = useState(true);

  const tipo = useMemo(() => RELATORIOS.find((r) => r.id === tipoId), [tipoId]);
  const usa = (f) => tipo.filtros.includes(f);
  const set = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));

  // Carrega uma vez as listas que alimentam os seletores de filtro.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const r = await Promise.allSettled([
        api.listarUnidades(), api.listarTurmas(), api.listarAlunos(), api.listarFuncionarios(),
      ]);
      if (!ativo) return;
      const [u, t, a, f] = r;
      setCtx({
        unidades: u.status === 'fulfilled' ? (u.value.filiais || []) : [],
        turmas: t.status === 'fulfilled' ? (t.value.turmas || []) : [],
        alunos: a.status === 'fulfilled' ? (a.value.alunos || []) : [],
        funcionarios: f.status === 'fulfilled' ? (f.value.funcionarios || []) : [],
      });
      setCarregandoCtx(false);
    })();
    return () => { ativo = false; };
  }, []);

  // Trocar de relatório invalida o resultado anterior: exibir a tabela de um
  // relatório sob o título de outro seria pior do que não exibir nada.
  useEffect(() => { setLinhas(null); setErro(null); }, [tipoId]);

  const turmasDaUnidade = useMemo(
    () => (filtros.unidade ? ctx.turmas.filter((t) => t.filial_id === filtros.unidade) : ctx.turmas),
    [ctx.turmas, filtros.unidade],
  );

  const gerar = useCallback(async () => {
    setErro(null);
    if (tipo.exigeAluno && !filtros.aluno) { setErro('Selecione o aluno.'); return; }
    if (tipo.exigeFuncionario && !filtros.funcionario) { setErro('Selecione o funcionário.'); return; }

    setGerando(true);
    try {
      setLinhas(await tipo.buscar(filtros, ctx));
    } catch (err) {
      setErro(err.message || 'Não foi possível gerar o relatório.');
      setLinhas(null);
    } finally {
      setGerando(false);
    }
  }, [tipo, filtros, ctx]);

  /**
   * Reexecuta sozinho o relatorio que ja esta na tela, quando ele depende de
   * batida ou presenca. Sem `setGerando`: a tabela troca no lugar, sem apagar
   * e reaparecer na frente de quem esta lendo. Falha e engolida de proposito -
   * manter o resultado anterior e melhor do que esvaziar a tela sozinho.
   */
  const regerarAoVivo = useCallback(async () => {
    if (!tipo.aoVivo || !linhas) return;
    try {
      setLinhas(await tipo.buscar(filtros, ctx));
    } catch {
      // silencio: o que ja esta na tela continua valendo
    }
  }, [tipo, linhas, filtros, ctx]);

  useRecarregarAoVivo(['ponto.criado', 'presenca.sala'], regerarAoVivo);

  function exportarCsv() {
    if (!linhas) return;
    const cabecalho = tipo.colunas.map((c) => c.titulo);
    const corpo = linhas.map((l) => tipo.colunas.map((c) => c.valor(l)));
    baixarCsv(`${tipo.id}-${new Date().toISOString().slice(0, 10)}.csv`, [
      [tipo.rotulo],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      ...(usa('periodo') ? [['Período', `${data(filtros.de)} a ${data(filtros.ate)}`]] : []),
      [],
      cabecalho,
      ...corpo,
    ]);
  }

  if (carregandoCtx) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  const grupos = [...new Set(RELATORIOS.map((r) => r.grupo))];

  return (
    <Layout>
      <h1 className="titulo-pagina">Relatórios</h1>
      <p className="subtitulo-pagina">Escolha o relatório, ajuste os filtros e gere.</p>

      <div className="filtros nao-imprimir" style={{ alignItems: 'flex-start' }}>
        <div className="campo" style={{ minWidth: 260 }}>
          <label htmlFor="r-tipo">Relatório</label>
          <Selecao
            id="r-tipo"
            rotuloAria="Tipo de relatório"
            valor={tipoId}
            aoMudar={setTipoId}
            opcoes={grupos.flatMap((g) =>
              RELATORIOS.filter((r) => r.grupo === g).map((r) => ({ valor: r.id, rotulo: `${g} · ${r.rotulo}` })))}
          />
          <span className="ajuda">{tipo.descricao}</span>
        </div>

        {usa('periodo') && (
          <>
            <div className="campo">
              <label htmlFor="r-de">De</label>
              <input id="r-de" type="date" value={filtros.de} onChange={(e) => set('de', e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="r-ate">Até</label>
              <input id="r-ate" type="date" value={filtros.ate} onChange={(e) => set('ate', e.target.value)} />
            </div>
          </>
        )}

        {usa('unidade') && (
          <div className="campo">
            <label htmlFor="r-unidade">Unidade</label>
            <Selecao
              id="r-unidade" rotuloAria="Unidade" valor={filtros.unidade}
              aoMudar={(v) => { set('unidade', v); set('turma', ''); }}
              opcoes={[{ valor: '', rotulo: 'Todas' }, ...ctx.unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))]}
            />
          </div>
        )}

        {usa('turma') && (
          <div className="campo">
            <label htmlFor="r-turma">Turma</label>
            <Selecao
              id="r-turma" rotuloAria="Turma" valor={filtros.turma} aoMudar={(v) => set('turma', v)}
              opcoes={[{ valor: '', rotulo: 'Todas' }, ...turmasDaUnidade.map((t) => ({ valor: t.id, rotulo: t.nome }))]}
            />
          </div>
        )}

        {usa('aluno') && (
          <div className="campo" style={{ minWidth: 220 }}>
            <label htmlFor="r-aluno">Aluno <span className="obrigatorio">*</span></label>
            <Selecao
              id="r-aluno" rotuloAria="Aluno" valor={filtros.aluno} aoMudar={(v) => set('aluno', v)}
              vazio="Selecione o aluno"
              opcoes={ctx.alunos.map((a) => ({ valor: a.id, rotulo: `${a.nome} · ${a.matricula}` }))}
            />
          </div>
        )}

        {usa('funcionario') && (
          <div className="campo" style={{ minWidth: 220 }}>
            <label htmlFor="r-func">Funcionário <span className="obrigatorio">*</span></label>
            <Selecao
              id="r-func" rotuloAria="Funcionário" valor={filtros.funcionario} aoMudar={(v) => set('funcionario', v)}
              vazio="Selecione o funcionário"
              opcoes={ctx.funcionarios.map((f) => ({ valor: f.id, rotulo: `${f.nome} · ${f.matricula}` }))}
            />
          </div>
        )}

        {usa('situacao') && (
          <div className="campo">
            <label htmlFor="r-situacao">Situação</label>
            <Selecao id="r-situacao" rotuloAria="Situação" valor={filtros.situacao} aoMudar={(v) => set('situacao', v)} opcoes={SITUACOES} />
          </div>
        )}

        {usa('acao') && (
          <div className="campo">
            <label htmlFor="r-acao">Ação</label>
            <input id="r-acao" value={filtros.acao} onChange={(e) => set('acao', e.target.value)} placeholder="ex: criar" />
          </div>
        )}

        {usa('entidade') && (
          <div className="campo">
            <label htmlFor="r-entidade">Entidade</label>
            <input id="r-entidade" value={filtros.entidade} onChange={(e) => set('entidade', e.target.value)} placeholder="ex: aluno" />
          </div>
        )}

        <div className="espaco" />
        <button type="button" className="btn btn-primario" onClick={gerar} disabled={gerando}>
          {gerando ? 'Gerando...' : 'Gerar relatório'}
        </button>
      </div>

      {erro && <div className="erro">{erro}</div>}

      <section className="secao">
        <h2>
          {tipo.rotulo}
          {linhas && (
            <span className="nota">
              {linhas.length === 1 ? '1 registro' : `${linhas.length} registros`}
              {usa('periodo') && ` · ${data(filtros.de)} a ${data(filtros.ate)}`}
            </span>
          )}
        </h2>

        {linhas === null ? (
          <div className="painel"><div className="painel-corpo">
            <p className="vazio">Ajuste os filtros e clique em “Gerar relatório”.</p>
          </div></div>
        ) : (
          <>
            <div className="barra-acoes nao-imprimir" style={{ marginBottom: 12 }}>
              <span className="texto-apoio">
                {linhas.length ? 'Confira os dados antes de exportar.' : 'Nenhum registro para estes filtros.'}
              </span>
              <div className="grupo">
                <button type="button" className="btn btn-secundario" onClick={exportarCsv} disabled={!linhas.length}>
                  Exportar .csv
                </button>
                <button type="button" className="btn btn-secundario" onClick={exportarPdf} disabled={!linhas.length}>
                  Exportar .pdf
                </button>
              </div>
            </div>

            <div className="painel" style={{ overflowX: 'auto' }}>
              <table className="tabela">
                <thead>
                  <tr>{tipo.colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}</tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={l.id || i}>
                      {tipo.colunas.map((c) => (
                        <td key={c.titulo} className={c.mono ? 'mono' : undefined}>{c.valor(l)}</td>
                      ))}
                    </tr>
                  ))}
                  {linhas.length === 0 && (
                    <tr><td colSpan={tipo.colunas.length}><div className="vazio">Nenhum registro encontrado.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </Layout>
  );
}
