import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import FotoAluno from '../components/FotoAluno';
import AcessoResponsavel from '../components/AcessoResponsavel';
import { ResponsavelVinculado } from '../components/FichaAluno';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { TIPOS_SANGUINEOS, cpfValido, mascaraCpf, soDigitos } from '../utils/dominio';

/**
 * `ativo` nao aparece no formulario, mas mora aqui de proposito: o `atualizar`
 * do backend grava TODOS os campos, e o que nao for reenviado e apagado em
 * silencio. `ativo` ausente e pior ainda - o backend assume `true`, entao
 * editar um aluno inativo o reativaria sozinho.
 *
 * O horario do aluno e o da turma (`horarios_turma`); nao existe horario
 * individual - `horario_aluno_id` saiu do backend em 2026-10-19 (`3a4fea2`).
 */
const VAZIO = {
  nome: '', cpf: '', data_nascimento: '', matricula: '',
  filial_id: '', turma_id: '', nome_responsavel: '', contato_responsavel: '',
  tipo_sanguineo: '',
  // Dados guardados pela tela "Acesso do responsável", so no cadastro.
  acesso: null,
  ativo: true,
};

export default function AlunoForm() {
  const { filialSelecionada, empresaSelecionada, usuario } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const editando = Boolean(id);

  const [dados, setDados] = useState(VAZIO);
  // O registro como veio do servidor: a foto usa o id, a escola, a matricula
  // SALVA e o `ativo` dele - e o que a rota do equipamento confere.
  const [alunoAtual, setAlunoAtual] = useState(null);
  const [escolas, setEscolas] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [acessoAberto, setAcessoAberto] = useState(false);

  const set =(campo, valor) => setDados((d) => ({ ...d, [campo]: valor }));
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
        setAlunoAtual(aluno);
        setDados({
          nome: aluno.nome || '',
          cpf: mascaraCpf(aluno.cpf || ''),
          data_nascimento: aluno.data_nascimento ? String(aluno.data_nascimento).slice(0, 10) : '',
          matricula: aluno.matricula || '',
          filial_id: aluno.filial_id || '',
          turma_id: aluno.turma_id || '',
          nome_responsavel: aluno.nome_responsavel || '',
          contato_responsavel: aluno.contato_responsavel || '',
          tipo_sanguineo: aluno.tipo_sanguineo || '',
          acesso: null,
          ativo: aluno.ativo !== undefined ? aluno.ativo : true,
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
    if (!cpfValido(dados.cpf)) {
      setErro('CPF inválido. Confira os números digitados.');
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
        ativo: dados.ativo,
      };
      // So vai quando muda: ausente, o backend mantem o que esta gravado, e
      // null apaga ("Não informado"). Diferente dos outros campos de cima.
      if (dados.tipo_sanguineo !== (alunoAtual?.tipo_sanguineo || '')) {
        payload.tipo_sanguineo = dados.tipo_sanguineo || null;
      }
      // Acesso guardado na tela "Acesso do responsável": vai junto com o aluno.
      // Na edicao, a propria tela salva na hora; aqui so o cadastro.
      if (!editando && dados.acesso) {
        payload.nome_responsavel = payload.nome_responsavel || dados.acesso.nome;
        payload.contato_responsavel = payload.contato_responsavel || dados.acesso.telefone || dados.acesso.email;
        payload.responsavel = dados.acesso;
      }

      if (editando) {
        await api.atualizarAluno(id, payload);
      } else {
        const resposta = await api.criarAluno(payload);
        if (resposta.responsavel && !resposta.responsavel.conta_criada) {
          window.alert('Este responsavel ja possuia uma conta. O aluno foi vinculado, mas a senha existente foi mantida.');
        }
      }
      navigate('/alunos');
    } catch (err) {
      setErro(err.message || (editando ? 'Erro ao atualizar aluno.' : 'Erro ao criar aluno.'));
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

      {/* Fora do <form>: a foto tem rota e botao proprios. */}
      {editando && alunoAtual && <FotoAluno aluno={alunoAtual} />}

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
                    ? 'Precisa ser única dentro do ambiente.'
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

              <div className="campo">
                <label htmlFor="al-sangue">Tipo sanguíneo</label>
                <Selecao
                  id="al-sangue"
                  rotuloAria="Tipo sanguíneo"
                  valor={dados.tipo_sanguineo}
                  aoMudar={(v) => set('tipo_sanguineo', v)}
                  vazio="Não informado"
                  opcoes={[
                    { valor: '', rotulo: 'Não informado' },
                    ...TIPOS_SANGUINEOS.map((t) => ({ valor: t, rotulo: t })),
                  ]}
                />
                <span className="ajuda">Opcional. Para apagar, escolha “Não informado”.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">Responsável</div>
          <div className="card-corpo">
            <p className="texto-apoio" style={{ marginTop: 0 }}>
              Nome e contato ficam no cadastro do aluno e aparecem na ficha. E-mail e senha
              do aplicativo ficam em “Acesso do responsável”.
            </p>

            <div className="grid-form">
              <div className="campo">
                <label htmlFor="al-resp">Nome do responsável</label>
                <input
                  id="al-resp"
                  value={dados.nome_responsavel}
                  onChange={(e) => set('nome_responsavel', e.target.value)}
                  maxLength={150}
                />
              </div>
              <div className="campo">
                <label htmlFor="al-contato">Contato</label>
                <input
                  id="al-contato"
                  value={dados.contato_responsavel}
                  onChange={(e) => set('contato_responsavel', e.target.value)}
                  placeholder="telefone ou e-mail"
                  maxLength={100}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setAcessoAberto(true)}
                disabled={editando && !alunoAtual}
              >
                Acesso do responsável
              </button>
              {editando ? (
                alunoAtual && 'responsaveis_vinculados' in alunoAtual && (
                  <ResponsavelVinculado quantidade={alunoAtual.responsaveis_vinculados} />
                )
              ) : dados.acesso ? (
                <>
                  <span>Acesso para <strong>{dados.acesso.email}</strong>, criado ao cadastrar.</span>
                  <button type="button" className="btn btn-secundario" onClick={() => set('acesso', null)}>
                    Remover acesso
                  </button>
                </>
              ) : (
                <span className="texto-apoio">Sem acesso ao aplicativo.</span>
              )}
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

      {acessoAberto && (
        <AcessoResponsavel
          aluno={editando ? alunoAtual : null}
          inicial={dados.acesso
            ? { ...dados.acesso, confirmacao: dados.acesso.senha }
            : {
                nome: dados.nome_responsavel,
                telefone: dados.contato_responsavel.includes('@') ? '' : dados.contato_responsavel,
              }}
          aoGuardar={(acesso) => set('acesso', acesso)}
          aoAlunoSalvo={(aluno) => setAlunoAtual((atual) => ({ ...atual, ...aluno }))}
          aoFechar={() => setAcessoAberto(false)}
        />
      )}
    </Layout>
  );
}
