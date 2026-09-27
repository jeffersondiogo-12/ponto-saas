import { useState } from 'react';
import { api } from '../../api';
import { BarraTopo } from '../Ui';
import { useVoltar } from '../useVoltar';

/**
 * Vincular mais um filho: espelho da AdicionarFilhoScreen do APK — mesmos
 * campos, mesma conferencia de CPF, mesma fila offline.
 */
function cpfValido(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.length !== 11 || /^([0-9])\1+$/.test(digitos)) return false;
  let soma = 0;
  for (let indice = 0; indice < 9; indice += 1) soma += Number(digitos[indice]) * (10 - indice);
  let primeiro = (soma * 10) % 11;
  if (primeiro === 10) primeiro = 0;
  if (primeiro !== Number(digitos[9])) return false;
  soma = 0;
  for (let indice = 0; indice < 10; indice += 1) soma += Number(digitos[indice]) * (11 - indice);
  let segundo = (soma * 10) % 11;
  if (segundo === 10) segundo = 0;
  return segundo === Number(digitos[10]);
}

function Campo({ id, rotulo, ...props }) {
  return (
    <div className="app-campo">
      <label className="app-login-rotulo" htmlFor={id}>{rotulo}</label>
      <input id={id} className="app-campo-input" {...props} />
    </div>
  );
}

export default function AdicionarFilho() {
  const voltar = useVoltar();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [matricula, setMatricula] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function adicionar(evento) {
    evento.preventDefault();
    setErro(null);
    if (nome.trim().length < 2) { setErro('Informe o nome completo do aluno.'); return; }
    if (!matricula.trim()) { setErro('Informe a matrícula do aluno.'); return; }
    if (!cpfValido(cpf)) { setErro('Informe um CPF válido.'); return; }
    setCarregando(true);
    try {
      const resultado = await api.responsavel.vincularFilho({
        nome_completo: nome.trim(),
        cpf: cpf.replace(/\D/g, ''),
        matricula_aluno: matricula.trim(),
        parentesco: parentesco.trim() || null,
      });
      if (resultado._fila) {
        window.alert('Salvo no aparelho\n\nSem conexão agora — assim que a internet voltar, o vínculo é confirmado automaticamente.');
      }
      voltar();
    } catch (err) {
      setErro(err.message || 'Não foi possível adicionar este aluno.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <BarraTopo titulo="Adicionar filho" />
      <main className="app-formulario">
        <div className="app-aparecer">
          <p className="app-selo-vinculo"><span className="app-selo-vinculo-ponto" aria-hidden="true" />Vínculo com a escola</p>
          <h1 className="app-formulario-titulo">Confirme os dados do aluno</h1>
          <p className="app-formulario-explicacao">
            Use exatamente os dados cadastrados pela escola. Eles serão conferidos antes de liberar o acesso.
          </p>
        </div>

        {erro ? <p className="app-erro-caixa app-aparecer" style={{ '--app-deslocamento': '8px' }} role="alert">{erro}</p> : null}

        <form className="app-cartao app-aparecer" style={{ '--app-atraso': '100ms' }} onSubmit={adicionar} noValidate>
          <Campo id="filho-nome" rotulo="Nome completo" placeholder="Nome do aluno" autoComplete="off"
            value={nome} onChange={(e) => setNome(e.target.value)} />
          <Campo id="filho-cpf" rotulo="CPF" placeholder="000.000.000-00" inputMode="numeric" autoComplete="off"
            value={cpf} onChange={(e) => setCpf(e.target.value)} />
          <Campo id="filho-matricula" rotulo="Matrícula" placeholder="Número da matrícula" autoComplete="off"
            value={matricula} onChange={(e) => setMatricula(e.target.value)} />
          <Campo id="filho-parentesco" rotulo="Parentesco (opcional)" placeholder="Mãe, pai, responsável..." autoComplete="off"
            value={parentesco} onChange={(e) => setParentesco(e.target.value)} />
          <button type="submit" className="app-login-botao botao-responsavel app-pressao app-formulario-botao" disabled={carregando}>
            {carregando ? <span className="app-login-carregando" aria-label="Enviando" /> : 'Adicionar filho'}
          </button>
        </form>

        <p className="app-formulario-rodape app-aparecer" style={{ '--app-atraso': '200ms' }}>
          Os dados são conferidos pela secretaria da escola.
        </p>
      </main>
    </>
  );
}
