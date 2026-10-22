import { useEffect, useRef, useState } from 'react';
import { urlDaFotoDoAluno } from '../api';
import { iniciais } from '../utils/dominio';

/**
 * Moldura 3x4 do aluno: as iniciais e, se `temFoto`, a foto guardada por cima.
 * A foto so e baixada quando a moldura chega perto da tela - numa lista de
 * centenas de alunos, nada de baixar todas de uma vez. `children` entra por
 * cima da foto (o resumo do card no hover).
 */
export default function FotoDoAluno({ alunoId, nome, temFoto, className = '', children }) {
  const moldura = useRef(null);
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!temFoto || !moldura.current) return undefined;
    let ativo = true;
    let criada = null;
    const observador = new IntersectionObserver(async ([entrada]) => {
      if (!entrada.isIntersecting) return;
      observador.disconnect();
      criada = await urlDaFotoDoAluno(alunoId);
      if (ativo) setUrl(criada);
    }, { rootMargin: '200px' });
    observador.observe(moldura.current);
    return () => {
      ativo = false;
      observador.disconnect();
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [alunoId, temFoto]);

  return (
    <span ref={moldura} className={`aluno-foto ${className}`}>
      <span className="aluno-iniciais" aria-hidden="true">{iniciais(nome)}</span>
      {temFoto && url && <img src={url} alt="" />}
      {children}
    </span>
  );
}
