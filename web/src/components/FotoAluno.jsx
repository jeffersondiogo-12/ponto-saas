import { useCallback, useEffect, useRef, useState } from 'react';
import { api, urlDaFotoDoAluno } from '../api';
import { iniciais } from '../utils/dominio';
import { ACEITA, paraBase64, prepararFoto } from '../utils/fotoAluno';

/**
 * Foto do aluno, so na tela de EDITAR (nao no cadastro novo, nem na ficha do
 * card). A foto fica guardada no sistema, cifrada, e e a mesma que a tela de
 * Dispositivos manda ao equipamento facial ("Enviar e receber dados").
 * Decisao do Jefferson e do Samuel em 2026-10-21, revendo o R3 do produto.
 */
export default function FotoAluno({ aluno }) {
  const [fotoUrl, setFotoUrl] = useState(undefined); // undefined = carregando; null = sem foto
  const [previa, setPrevia] = useState(null); // { blob, url }
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  // A foto mostrada e um endereco local (blob): troca-lo libera o anterior.
  const fotoAtual = useRef(null);
  const trocarFoto = useCallback((nova) => {
    if (fotoAtual.current) URL.revokeObjectURL(fotoAtual.current);
    fotoAtual.current = nova;
    setFotoUrl(nova);
  }, []);
  useEffect(() => () => { if (fotoAtual.current) URL.revokeObjectURL(fotoAtual.current); }, []);

  useEffect(() => {
    let ativo = true;
    urlDaFotoDoAluno(aluno.id).then((url) => {
      if (ativo) trocarFoto(url);
      else if (url) URL.revokeObjectURL(url);
    });
    return () => { ativo = false; };
  }, [aluno.id, trocarFoto]);

  // Libera o endereco local da previa quando ela troca ou a tela fecha.
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa.url); }, [previa]);

  async function aoEscolher(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // deixa escolher o mesmo arquivo de novo
    if (!arquivo) return;
    setErro(null);
    setAviso(null);
    setConfirmandoRemocao(false);
    setOcupado(true);
    try {
      const blob = await prepararFoto(arquivo);
      setPrevia({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setPrevia(null);
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    setErro(null);
    setOcupado(true);
    try {
      await api.salvarFotoAluno(aluno.id, await paraBase64(previa.blob));
      trocarFoto(URL.createObjectURL(previa.blob));
      setPrevia(null);
      setAviso('Foto salva. Para mandar ao equipamento, use "Enviar e receber dados" em Dispositivos.');
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar a foto.');
    } finally {
      setOcupado(false);
    }
  }

  // Dois cliques, sem window.confirm, como no resto do sistema.
  async function remover() {
    if (!confirmandoRemocao) {
      setConfirmandoRemocao(true);
      return;
    }
    setConfirmandoRemocao(false);
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await api.removerFotoAluno(aluno.id);
      trocarFoto(null);
      setAviso('Foto removida do sistema. Se ela já foi enviada a um equipamento, continua lá até ser removida nele.');
    } catch (err) {
      setErro(err.message || 'Não foi possível remover a foto.');
    } finally {
      setOcupado(false);
    }
  }

  const mostrada = previa?.url || fotoUrl;

  return (
    <div className="card">
      <div className="eyebrow">Foto do aluno</div>
      <div className="card-corpo foto-aluno">
        <span className="aluno-foto foto-aluno-moldura">
          {mostrada
            ? <img src={mostrada} alt={previa ? 'Prévia da nova foto' : `Foto de ${aluno.nome}`} />
            : <span className="aluno-iniciais" aria-hidden="true">{iniciais(aluno.nome)}</span>}
        </span>

        <div className="foto-aluno-acoes">
          {erro && <div className="erro">{erro}</div>}
          {aviso && <div className="sucesso">{aviso}</div>}
          <p className="texto-apoio" style={{ marginTop: 0 }}>
            A foto fica guardada no sistema, protegida, e é a que vai para o equipamento facial.
            PNG, JPG ou JPEG, até 20 MB — HEIC não é aceito. Antes de enviar, ela é reduzida e os
            dados de localização do celular são apagados.
          </p>
          {fotoUrl === undefined && <p className="texto-apoio">Carregando a foto...</p>}
          {previa && <p className="texto-apoio">Prévia — a foto só é guardada ao salvar.</p>}

          <div className="acoes-form" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            {/* O <label> e o botao: o input de arquivo nativo nao aceita estilo. */}
            <label className={`btn btn-secundario ${ocupado ? 'desabilitado' : ''}`}>
              {ocupado && !previa ? 'Lendo...' : fotoUrl ? 'Trocar foto' : 'Escolher foto'}
              <input
                type="file"
                accept={ACEITA}
                onChange={aoEscolher}
                disabled={ocupado}
                className="foto-aluno-entrada"
              />
            </label>
            {previa && (
              <>
                <button type="button" className="btn btn-primario" onClick={salvar} disabled={ocupado}>
                  {ocupado ? 'Salvando...' : 'Salvar foto'}
                </button>
                <button type="button" className="btn btn-secundario" onClick={() => setPrevia(null)} disabled={ocupado}>
                  Descartar
                </button>
              </>
            )}
            {!previa && fotoUrl && (
              <button type="button" className="btn btn-perigo" onClick={remover} disabled={ocupado}>
                {confirmandoRemocao ? 'Confirmar remoção' : 'Remover foto'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
