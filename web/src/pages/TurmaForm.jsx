import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { TURNOS } from '../utils/dominio';

const PADRAO = { nome: '', turno: 'manha', ano_letivo: new Date().getFullYear(), filial_id: '' };

export default function TurmaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);

  const [dados, setDados] = useState(PADRAO);
  const [escolas, setEscolas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const set = (campo, valor) => setDados((d) => ({ ...d, [campo]: valor }));

  const carregar = useCallback(async () => {
    const [unid, turma] = await Promise.allSettled([
      api.listarUnidades(),
      editando ? api.buscarTurma(id) : Promise.resolve(null),
    ]);

    if (unid.status === 'fulfilled') {
      setEscolas((unid.value.filiais || []).filter((f) => f.tipo === 'escola' && f.ativo));
    } else {
      setErro('Não foi possível carregar as unidades.');
    }

    if (editando) {
      if (turma.status === 'fulfilled' && turma.value?.turma) {
        const t = turma.value.turma;
        setDados({ nome: t.nome, turno: t.turno, ano_letivo: t.ano_letivo, filial_id: t.filial_id });
      } else {
        setErro('Turma não encontrada.');
      }
    }
    setCarregando(false);
  }, [id, editando]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e) {
    e.preventDefault();
    setErro(null);

    // <Selecao> e um <button>: nao entra na validacao nativa do formulario.
    if (!dados.filial_id) {
      setErro('Selecione a unidade (escola) da turma.');
      return;
    }

    setSalvando(true);
    try {
      const payload = { ...dados, ano_letivo: Number(dados.ano_letivo) };
      if (editando) {
        await api.atualizarTurma(id, payload);
        navigate(`/turmas/${id}`);
      } else {
        const r = await api.criarTurma(payload);
        // Leva direto para a gestao da turma criada: o passo seguinte natural
        // e colocar alunos e professores nela.
        navigate(r?.turma?.id ? `/turmas/${r.turma.id}` : '/turmas');
      }
    } catch (err) {
      setErro(err.message || 'Erro ao salvar a turma.');
      setSalvando(false);
    }
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  return (
    <Layout>
      <Link to={editando ? `/turmas/${id}` : '/turmas'} className="link-topo">
        &larr; {editando ? 'Voltar para a turma' : 'Turmas'}
      </Link>
      <h1 className="titulo-pagina">{editando ? 'Editar turma' : 'Nova turma'}</h1>
      <p className="subtitulo-pagina">
        {editando
          ? 'Alterações valem para a turma inteira — alunos e professores continuam vinculados.'
          : 'Depois de salvar você já cai na tela de gestão, para incluir alunos e professores.'}
      </p>

      {erro && <div className="erro">{erro}</div>}

      {!escolas.length && !editando && (
        <div className="aviso">
          Nenhuma unidade do tipo <strong>escola</strong> cadastrada. Turmas só existem
          nesse tipo de unidade — cadastre uma em <Link to="/unidades">Unidades</Link>.
        </div>
      )}

      <form onSubmit={salvar}>
        <div className="card">
          <div className="eyebrow">Dados da turma</div>
          <div className="card-corpo">
            <div className="grid-form">
              <div className="campo">
                <label htmlFor="tf-nome">Nome <span className="obrigatorio">*</span></label>
                <input
                  id="tf-nome"
                  value={dados.nome}
                  onChange={(e) => set('nome', e.target.value)}
                  placeholder="ex: 5º ano A"
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="tf-filial">Unidade (escola) <span className="obrigatorio">*</span></label>
                <Selecao
                  id="tf-filial"
                  rotuloAria="Unidade (escola)"
                  valor={dados.filial_id}
                  aoMudar={(v) => set('filial_id', v)}
                  vazio="Selecione a escola"
                  desabilitado={!escolas.length}
                  opcoes={escolas.map((f) => ({ valor: f.id, rotulo: f.nome }))}
                />
              </div>
              <div className="campo">
                <label htmlFor="tf-turno">Turno <span className="obrigatorio">*</span></label>
                <Selecao
                  id="tf-turno"
                  rotuloAria="Turno"
                  valor={dados.turno}
                  aoMudar={(v) => set('turno', v)}
                  opcoes={TURNOS}
                />
              </div>
              <div className="campo">
                <label htmlFor="tf-ano">Ano letivo <span className="obrigatorio">*</span></label>
                <input
                  id="tf-ano"
                  type="number"
                  min="2000"
                  max="2100"
                  value={dados.ano_letivo}
                  onChange={(e) => set('ano_letivo', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="acoes-form">
              <Link to={editando ? `/turmas/${id}` : '/turmas'} className="btn btn-secundario">Cancelar</Link>
              <button type="submit" className="btn btn-primario" disabled={salvando}>
                {salvando ? 'Salvando...' : (editando ? 'Salvar alterações' : 'Criar turma')}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
}
