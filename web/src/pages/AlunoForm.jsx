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

/**
 * `ativo` e `horario_aluno_id` nao aparecem no formulario, mas moram aqui de
 * proposito: o `atualizar` do backend grava TODOS os campos, e o que nao for
 * reenviado e apagado em silencio. `ativo` ausente e pior ainda - o backend
 * assume `true`, entao editar um aluno inativo o reativaria sozinho.
 */
const VAZIO = {
  nome: '', cpf: '', data_nascimento: '', matricula: '',
  filial_id: '', turma_id: '', nome_responsavel: '', contato_responsavel: '',
  criar_acesso_responsavel: true,
  responsavel_email: '', responsavel_parentesco: '',
  responsavel_senha: '', responsavel_confirmacao_senha: '',
  ativo: true, horario_aluno_id: null,
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
          criar_acesso_responsavel: false,
          responsavel_email: '',
          responsavel_parentesco: '',
          responsavel_senha: '',
          responsavel_confirmacao_senha: '',
          ativo: aluno.ativo !== undefined ? aluno.ativo : true,
          horario_aluno_id: aluno.horario_aluno_id || null,
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

    if (!editando && dados.criar_acesso_responsavel) {
      const emailResponsavel = dados.responsavel_email.trim();
      if (!dados.nome_responsavel.trim()) {
        setErro('Informe o nome do responsavel.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailResponsavel)) {
        setErro('Informe um email valido para o responsavel.');
        return;
      }
      if (dados.responsavel_senha.length < 8) {
        setErro('A senha do responsavel deve ter no minimo 8 caracteres.');
        return;
      }
      if (dados.responsavel_senha !== dados.responsavel_confirmacao_senha) {
        setErro('A senha e a confirmacao do responsavel nao conferem.');
        return;
      }
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
        horario_aluno_id: dados.horario_aluno_id,
        ativo: dados.ativo,
      };
      if (!editando && dados.criar_acesso_responsavel) {
        payload.nome_responsavel = dados.nome_responsavel.trim();
        payload.contato_responsavel = dados.contato_responsavel.trim()
          || dados.responsavel_email.trim().toLowerCase();
        payload.responsavel = {
          nome: dados.nome_responsavel.trim(),
          email: dados.responsavel_email.trim().toLowerCase(),
          telefone: dados.contato_responsavel.trim() || null,
          parentesco: dados.responsavel_parentesco.trim() || null,
          senha: dados.responsavel_senha,
        };
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
              {editando
                ? 'A edicao do aluno nao altera as credenciais de acesso do responsavel.'
                : 'Cadastre as credenciais que o responsavel usara para entrar no aplicativo.'}
            </p>

            {!editando && (
              <label className="campo" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={dados.criar_acesso_responsavel}
                  onChange={(e) => set('criar_acesso_responsavel', e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Criar acesso ao aplicativo
              </label>
            )}

            <div className="grid-form">
              <div className="campo">
                <label htmlFor="al-resp">
                  Nome do responsável
                  {!editando && dados.criar_acesso_responsavel && <span className="obrigatorio"> *</span>}
                </label>
                <input
                  id="al-resp"
                  value={dados.nome_responsavel}
                  onChange={(e) => set('nome_responsavel', e.target.value)}
                  required={!editando && dados.criar_acesso_responsavel}
                  maxLength={150}
                />
              </div>
              <div className="campo">
                <label htmlFor="al-contato">
                  {!editando && dados.criar_acesso_responsavel ? 'Telefone' : 'Contato'}
                </label>
                <input
                  id="al-contato"
                  value={dados.contato_responsavel}
                  onChange={(e) => set('contato_responsavel', e.target.value)}
                  placeholder={!editando && dados.criar_acesso_responsavel ? '(81) 99999-9999' : 'telefone ou e-mail'}
                  maxLength={!editando && dados.criar_acesso_responsavel ? 20 : 100}
                />
              </div>

              {!editando && dados.criar_acesso_responsavel && (
                <>
                  <div className="campo">
                    <label htmlFor="al-resp-email">E-mail de acesso <span className="obrigatorio">*</span></label>
                    <input
                      id="al-resp-email"
                      type="email"
                      value={dados.responsavel_email}
                      onChange={(e) => set('responsavel_email', e.target.value)}
                      placeholder="responsavel@email.com"
                      autoComplete="email"
                      maxLength={150}
                      required
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="al-resp-parentesco">Parentesco</label>
                    <input
                      id="al-resp-parentesco"
                      value={dados.responsavel_parentesco}
                      onChange={(e) => set('responsavel_parentesco', e.target.value)}
                      placeholder="pai, mae, avo, tutor..."
                      maxLength={40}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="al-resp-senha">Senha <span className="obrigatorio">*</span></label>
                    <input
                      id="al-resp-senha"
                      type="password"
                      value={dados.responsavel_senha}
                      onChange={(e) => set('responsavel_senha', e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <span className="ajuda">Use pelo menos 8 caracteres.</span>
                  </div>
                  <div className="campo">
                    <label htmlFor="al-resp-confirmar">Confirmar senha <span className="obrigatorio">*</span></label>
                    <input
                      id="al-resp-confirmar"
                      type="password"
                      value={dados.responsavel_confirmacao_senha}
                      onChange={(e) => set('responsavel_confirmacao_senha', e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>
                </>
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
    </Layout>
  );
}
