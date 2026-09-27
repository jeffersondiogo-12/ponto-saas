import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Login da cara do app: espelho de mobile/src/screens/LoginScreen.js — mesmo
 * texto, mesmos campos, mesmas regras e as mesmas animacoes (orbes, entrada e
 * pulso da logo, tremida do erro).
 *
 * A unica diferenca e o terceiro perfil, **Gestao**: o APK nao tem login de
 * administracao, e o PWA atende admin, gestor e super_admin. Professor e
 * Gestao usam o mesmo login da equipe; para onde a pessoa vai depois quem
 * decide e o papel da conta, nao a aba escolhida.
 */
const PERFIS = [
  { chave: 'responsavel', rotulo: 'Responsável', subtitulo: 'Acompanhe a chegada e a saída do seu filho' },
  { chave: 'professor', rotulo: 'Professor', subtitulo: 'Chamada, notas e observações da sua turma' },
  { chave: 'gestao', rotulo: 'Gestão', subtitulo: 'Turmas, alunos e avisos da escola' },
];

export default function LoginApp() {
  const [papel, setPapel] = useState('responsavel');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [unidade, setUnidade] = useState('');
  const [erro, setErro] = useState(null);
  // Muda a cada erro para a caixa tremer de novo, mesmo com o mesmo texto.
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [manterLogin, setManterLogin] = useState(true);
  const { login, loginResponsavel, sessaoEncerrada } = useAuth();

  const senhaRef = useRef(null);
  const unidadeRef = useRef(null);

  const daEquipe = papel !== 'responsavel';
  const perfil = PERFIS.find((item) => item.chave === papel);

  async function entrar(evento) {
    evento?.preventDefault();
    if (carregando) return;
    setErro(null);
    setCarregando(true);
    try {
      if (daEquipe) {
        await login(email, senha, unidade, manterLogin);
      } else {
        await loginResponsavel(email, senha, manterLogin);
      }
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar.');
      setTentativa((n) => n + 1);
    } finally {
      setCarregando(false);
    }
  }

  // Enter no e-mail vai para a senha; na senha, para o ambiente (equipe) ou
  // entra (responsavel) — a mesma ordem do teclado do APK.
  function aoTeclar(evento, proximo) {
    if (evento.key !== 'Enter' || !proximo) return;
    evento.preventDefault();
    proximo.current?.focus();
  }

  return (
    <div className="app-login">
      <div className="app-login-orbes" aria-hidden="true">
        <span className="app-login-orbe app-login-orbe-azul" />
        <span className="app-login-orbe app-login-orbe-verde" />
      </div>

      <main className="app-login-conteudo">
        <header className="app-login-cabecalho app-aparecer" style={{ '--app-deslocamento': '20px' }}>
          <div className="app-login-logo-wrap">
            <img src="/ponte-escolar.png" alt="Ponte Escolar" className="app-login-logo" />
          </div>
          <p className="app-login-selo">
            <span className="app-login-selo-ponto" aria-hidden="true" />
            Escola conectada
          </p>
          <h1 className="app-login-marca">
            Ponte<span className="app-login-marca-ponto">·</span>Escolar
          </h1>
          <p className="app-login-subtitulo">{perfil.subtitulo}</p>
        </header>

        <form className="app-login-cartao app-aparecer" style={{ '--app-atraso': '120ms' }} onSubmit={entrar} noValidate>
          <div className="app-login-seletor" role="radiogroup" aria-label="Entrar como">
            {PERFIS.map((item) => (
              <button
                key={item.chave}
                type="button"
                role="radio"
                aria-checked={papel === item.chave}
                className={`app-login-opcao app-pressao${papel === item.chave ? ` ativa-${item.chave}` : ''}`}
                onClick={() => setPapel(item.chave)}
              >
                {item.rotulo}
              </button>
            ))}
          </div>

          {!erro && sessaoEncerrada ? <p className="app-login-info" role="status">{sessaoEncerrada}</p> : null}
          {erro ? (
            <p key={tentativa} className="app-login-erro" role="alert">{erro}</p>
          ) : null}

          <label className="app-login-rotulo" htmlFor="app-email">E-mail</label>
          <input
            id="app-email"
            className="app-login-input"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="voce@escola.com"
            enterKeyHint="next"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => aoTeclar(e, senhaRef)}
          />

          <label className="app-login-rotulo" htmlFor="app-senha">Senha</label>
          <input
            ref={senhaRef}
            id="app-senha"
            className="app-login-input"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="••••••••"
            enterKeyHint={daEquipe ? 'next' : 'done'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={daEquipe ? (e) => aoTeclar(e, unidadeRef) : undefined}
          />

          {daEquipe ? (
            <div className="app-aparecer" style={{ '--app-deslocamento': '10px' }}>
              <label className="app-login-rotulo" htmlFor="app-unidade">Ambiente (empresa)</label>
              <input
                ref={unidadeRef}
                id="app-unidade"
                className="app-login-input"
                type="text"
                autoCapitalize="none"
                placeholder="Nome ou CNPJ da empresa"
                enterKeyHint="done"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
              />
              <p className="app-login-ajuda">A empresa onde você trabalha. As escolas e filiais ficam dentro dela.</p>
            </div>
          ) : null}

          <label className="app-login-manter">
            <span className="app-login-manter-texto">
              <span className="app-login-manter-titulo">Manter login salvo</span>
              <span className="app-login-manter-ajuda">Reabrir o app sem digitar a senha</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="app-login-chave"
              checked={manterLogin}
              onChange={(e) => setManterLogin(e.target.checked)}
            />
          </label>

          <button type="submit" className={`app-login-botao app-pressao botao-${papel}`} disabled={carregando}>
            {carregando ? <span className="app-login-carregando" aria-label="Entrando" /> : 'Entrar'}
          </button>
        </form>

        <p className="app-login-rodape app-aparecer" style={{ '--app-atraso': '240ms' }}>
          Dados protegidos · acesso liberado pela escola
        </p>
      </main>
    </div>
  );
}
