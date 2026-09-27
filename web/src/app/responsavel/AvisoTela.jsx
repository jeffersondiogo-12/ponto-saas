import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api, namespaceOffline } from '../../api';
import { Aviso, BarraTopo, Carregando } from '../Ui';
import { formatarDataHora } from '../datas';
import { avisosLidos, ehLido, marcarAvisoLido, ROTULOS_ALCANCE } from '../novidades';

/**
 * Um aviso, inteiro. A leitura e confirmada quando o FIM do texto aparece na
 * tela (decisao do Samuel, 2026-09-27):
 * - aviso longo: ao rolar ate o fim;
 * - aviso curto, que ja cabe inteiro: depois de 2 s com o fim a vista, para
 *   nao contar quem abriu e voltou na hora.
 * Rolar ate o fim nao prova leitura — e um sinal mais forte que so abrir.
 * Com leitor de tela funciona igual: ele rola o texto enquanto le.
 *
 * Sem internet, a confirmacao vai para a fila e sobe depois.
 */
const ESPERA_AVISO_CURTO_MS = 2000;

export default function AvisoTela() {
  const { alunoId, avisoId } = useParams();
  const { state } = useLocation();
  const [aviso, setAviso] = useState(state?.aviso || null);
  const [erro, setErro] = useState('');
  const [lido, setLido] = useState(() => (state?.aviso ? ehLido(state.aviso, avisosLidos(namespaceOffline())) : false));
  const fimRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Aberto direto pelo endereco: busca o aviso na lista do filho.
  useEffect(() => {
    if (aviso) return;
    api.responsavel.avisosDoAluno(alunoId)
      .then((resposta) => {
        const achado = (resposta?.avisos || []).find((item) => item.id === avisoId);
        if (!achado) { setErro('Este aviso não está mais disponível.'); return; }
        setAviso(achado);
        setLido(ehLido(achado, avisosLidos(namespaceOffline())));
      })
      .catch((err) => setErro(err.message || 'Não foi possível abrir o aviso.'));
  }, [aviso, alunoId, avisoId]);

  useEffect(() => {
    if (!aviso || lido || !fimRef.current) return undefined;
    let timer = null;

    function confirmar() {
      marcarAvisoLido(namespaceOffline(), aviso.id);
      setLido(true);
      api.responsavel.registrarLeituraAviso(aviso.id).catch(() => {});
    }

    const observador = new IntersectionObserver(([fim]) => {
      clearTimeout(timer);
      if (!fim.isIntersecting) return;
      const cabeInteiro = document.documentElement.scrollHeight <= window.innerHeight + 1;
      if (cabeInteiro) timer = setTimeout(confirmar, ESPERA_AVISO_CURTO_MS);
      else confirmar();
    });
    observador.observe(fimRef.current);
    return () => {
      observador.disconnect();
      clearTimeout(timer);
    };
  }, [aviso, lido]);

  return (
    <>
      <BarraTopo titulo="Aviso" />
      <main className="app-leitura">
        <Aviso tipo="erro" texto={erro} />
        {!aviso && !erro ? <Carregando /> : null}
        {aviso ? (
          <article className="app-aparecer">
            {aviso.alcance ? <p className="app-aviso-alcance">{ROTULOS_ALCANCE[aviso.alcance] || 'Aviso'}</p> : null}
            <h1 className="app-leitura-titulo">{aviso.titulo}</h1>
            <p className="app-leitura-data">{formatarDataHora(aviso.publicado_em)}</p>
            <p className="app-leitura-texto">{aviso.mensagem}</p>
            <div ref={fimRef} className="app-leitura-fim">
              {lido
                ? <span className="app-lido" role="status">✓ Leitura confirmada</span>
                : <span className="app-leitura-dica">A leitura é confirmada quando você chega ao fim do aviso.</span>}
            </div>
          </article>
        ) : null}
      </main>
    </>
  );
}
