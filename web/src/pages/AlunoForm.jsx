import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

/** Formata 000.000.000-00 enquanto a pessoa digita. */
function mascaraCpf(v) {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

const VAZIO = {
  nome: '', cpf: '', data_nascimento: '', matricula: '',
  filial_id: '', turma_id: '', nome_responsavel: '', contato_responsavel: '',
};

export default function AlunoForm() {
  const { filialSelecionada, empresaSelecionada, usuario } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const editando = Boolean(id);

  const [dados, setDados] = useState(VAZIO);
  const [escolas, setEscolas] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const set = (campo, valor) => setDados((d) => ({ ...d, [campo]: valor }));
  const escolheFilial = usuario?.papel === 'admin' || usuario?.papel === 'super_admin';

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [unid, turm, alunoResposta] = await Promise.allSettled([
        api.listarUnidades(),
        api.listarTurmas(),
        id ? api.buscarAluno(id) : Promise.resolve(null),
      ]);
      if (!ativo) return;

      if (unid.status === 'fulfilled') {
        const lista = (unid.value.filiais || []).filter(
          (f) => f.tipo === 'escola' && f.ativo
            && (!empresaSelecionada || String(f.empresa_id) === String(empresaSelecionada.id)),
        );
        setEscolas(lista);
        // Quem não escolhe filial herda a que já está selecionada no topo.
        if (!escolheFilial && filialSelecionada?.tipo === 'escola') {
          setDados((d) => ({ ...d, filial_id: filialSelecionada.id }));
        }
      }
      if (turm.status === 'fulfilled') setTurmas(turm.value.turmas || []);
      if (alunoResposta.status === 'fulfilled' && alunoResposta.value?.aluno) {
        const aluno = alunoResposta.value.aluno;
        setDados({
          nome: aluno.nome || '',
          cpf: mascaraCpf(aluno.cpf || ''),
          data_nascimento: aluno.data_nascimento ? String(aluno.data_nascimento).slice(0, 10) : '',
          matricula: aluno.matricula || '',
          filial_id: aluno.filial_id || '',
          turma_id: aluno.turma_id || '',
          nome_responsavel: aluno.nome_responsavel || '',
          contato_responsavel: aluno.contato_responsavel || '',
        });
      }
    })();
    return () => { ativo = false; };
  }, [empresaSelecionada, filialSelecionada, escolheFilial, id]);

  const turmasDaEscola = turmas.filter((t) => !dados.filial_id || t.filial_id === dados.filial_id);

  async function aoEnviar(e) {
    e.preventDefault();
    setErro(null);

    // <Selecao> e um <button>: campos obrigatorios são conferidos aqui.
    if (!dados.filial_id) {
      setErro('Selecione a escola do aluno.');
      return;
    }
    if (soDigitos(dados.cpf).length !== 11) {
      setErro('Informe um CPF com 11 dígitos.');
      return;
    }
    if (!dados.data_nascimento) {
      setErro('Informe a data de nascimento.');
      return;
    }

    const matricula = dados.matricula.trim();

    setCarregando(true);
    try {
      const payload = {
        nome: dados.nome.trim(),
        cpf: soDigitos(dados.cpf),
        data_nascimento: dados.data_nascimento,
        // null, nunca undefined: com undefined o Knex do backend estoura
        // "Undefined binding(s)" e a resposta vira 500.
        matricula: matricula || null,
        filial_id: dados.filial_id,
        turma_id: dados.turma_id || null,
        nome_responsavel: dados.nome_responsavel.trim() || null,
        contato_responsavel: dados.contato_responsavel.trim() || null,
      };
      if (editando) await api.atualizarAluno(id, payload);
      else await api.criarAluno(payload);
      navigate('/alunos');
    } catch (err) {
      /**
       * O backend confere matrícula duplicada com `where({ matricula })`, o que
       * em SQL vira `matricula is null` quando ela vem vazia — então o segundo
       * aluno sem matrícula "colide" com o primeiro e recebe este 409. Sem esta
       * tradução a mensagem acusa duplicidade de algo que a pessoa nem digitou.
       */
      const duplicidadeFalsa = !matricula && /matr[íi]cula/i.test(err.message || '');
      setErro(duplicidadeFalsa
        ? 'O cadastro sem matrícula só aceita um aluno por enquanto (limitação do servidor). Informe uma matrícula para seguir.'
        : (err.message || 'Erro ao criar aluno.'));
      setCarregando(false);
    }
  }

  return (
    <Layout>
      <Link to="/alunos" className="link-topo">&larr; Alunos</Link>
      <h1 className="titulo-pagina">{editando ? 'Editar aluno' : 'Cadastrar aluno'}</h1>
      <p className="subtitulo-pagina">
        Nome, escola, nascimento e CPF são obrigatórios. A matrícula pode ficar para depois.
      </p>

      {erro && <div className="erro">{erro}</div>}

      {!escolas.length && (
        <div className="aviso">
          Nenhuma unidade do tipo <strong>escola</strong> disponível. Alunos só existem
          nesse tipo de unidade — cadastre uma em <Link to="/unidades">Unidades</Link>.
        </div>
      )}

      <form onSubmit={aoEnviar}>
        <div className="card">
          <div className="eyebrow">Dados do aluno</div>
          <div className="card-corpo">
            <div className="grid-form">
              <div className="campo">
                <label htmlFor="al-nome">Nome completo <span className="obrigatorio">*</span></label>
                <input id="al-nome" value={dados.nome} onChange={(e) => set('nome', e.target.value)} required />
              </div>

              <div className="campo">
                <label htmlFor="al-cpf">CPF <span className="obrigatorio">*</span></label>
                <input
                  id="al-cpf"
                  className="mono"
                  value={dados.cpf}
                  onChange={(e) => set('cpf', mascaraCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  required
                />
              </div>

              <div className="campo">
                <label htmlFor="al-nasc">Data de nascimento <span className="obrigatorio">*</span></label>
                <input
                  id="al-nasc"
                  type="date"
                  className="mono"
                  value={dados.data_nascimento}
                  onChange={(e) => set('data_nascimento', e.target.value)}
                  required
                />
              </div>

              <div className="campo">
                <label htmlFor="al-escola">Escola <span className="obrigatorio">*</span></label>
                <Selecao
                  id="al-escola"
                  rotuloAria="Escola"
                  valor={dados.filial_id}
                  aoMudar={(v) => { set('filial_id', v); set('turma_id', ''); }}
                  vazio="Selecione a escola"
                  desabilitado={!escolheFilial || !escolas.length}
                  opcoes={escolas.map((f) => ({ valor: f.id, rotulo: f.nome }))}
                />
                {!escolheFilial && (
                  <span className="ajuda">Herda a unidade selecionada no topo da tela.</span>
                )}
              </div>

              <div className="campo">
                <label htmlFor="al-matricula">Matrícula</label>
                <input
                  id="al-matricula"
                  className="mono"
                  value={dados.matricula}
                  onChange={(e) => set('matricula', e.target.value)}
                  placeholder="opcional"
                />
                <span className="ajuda">
                  {dados.matricula.trim()
                    ? 'Precisa ser única dentro da empresa.'
                    : 'Pode ficar em branco — o aluno aparece em “Precisa de atenção” até ser preenchida.'}
                </span>
              </div>

              <div className="campo">
                <label htmlFor="al-turma">Turma</label>
                <Selecao
                  id="al-turma"
                  rotuloAria="Turma"
                  valor={dados.turma_id}
                  aoMudar={(v) => set('turma_id', v)}
                  vazio="Sem turma por enquanto"
                  desabilitado={!turmasDaEscola.length}
                  opcoes={[
                    { valor: '', rotulo: 'Sem turma por enquanto' },
                    ...turmasDaEscola.map((t) => ({ valor: t.id, rotulo: t.nome })),
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">Responsável</div>
          <div className="card-corpo">
            <p className="texto-apoio" style={{ marginTop: 0 }}>
              Opcional aqui — o responsável também pode se vincular pelo app.
            </p>
            <div className="grid-form">
              <div className="campo">
                <label htmlFor="al-resp">Nome do responsável</label>
                <input id="al-resp" value={dados.nome_responsavel} onChange={(e) => set('nome_responsavel', e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="al-contato">Contato</label>
                <input
                  id="al-contato"
                  value={dados.contato_responsavel}
                  onChange={(e) => set('contato_responsavel', e.target.value)}
                  placeholder="telefone ou e-mail"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="acoes-form">
          <Link to="/alunos" className="btn btn-secundario">Cancelar</Link>
          <button type="submit" className="btn btn-primario" disabled={carregando || !escolas.length}>
            {carregando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar aluno'}
          </button>
        </div>
      </form>
    </Layout>
  );
}
