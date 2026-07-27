import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Regras por papel:
// - 'admin'  -> obrigatorio escolher filial (modal bloqueante quando houver >1 filiais)
// - 'staff'  -> gestor: tenta auto-selecionar a filial vinculada ao usuario (usuario.filial_id)
// - 'rh'     -> permanece no ambiente (empresa) e nao precisa escolher filial

export default function SelecionarFilialModal() {
  const { empresaSelecionada, filialSelecionada, selecionarFilial, usuario } = useAuth();
  const [filiais, setFiliais] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const modalRef = useRef(null);
  // efeito principal: carregar filiais e aplicar regras por papel
  useEffect(() => {
    let mounted = true;
    async function carregar() {
      if (!empresaSelecionada || filialSelecionada) return;
      // comportamento para papeis
      const papel = usuario?.papel;
      setMensagem(null);
      if (papel === 'rh') {
        // RH não precisa escolher filial — mantemos aberto=false
        return;
      }
      if (papel === 'staff') {
        // Staff (gestor): se tiver filial vinculada, tentamos auto-selecionar
        if (usuario?.filial_id) {
          try {
            const r = await api.buscarUnidade(usuario.filial_id);
            const f = r.filial || r.unidade || r;
            if (f && String(f.empresa_id) === String(empresaSelecionada.id) && f.tipo === 'escola') {
              selecionarFilial({ id: f.id, nome: f.nome || f.cnpj || 'Filial', tipo: f.tipo || 'escola' });
              return;
            }
            // se nao encontrou filial compatível, deixamos o fluxo cair e buscar filiais da empresa
            setMensagem('Não foi possível localizar sua filial vinculada neste ambiente. Selecione manualmente abaixo.');
          } catch (e) {
            setMensagem('Não foi possível verificar sua filial vinculada. Selecione manualmente abaixo.');
          }
        }
      }
      setCarregando(true);
      try {
        const res = await api.listarUnidades();
        if (!mounted) return;
        const items = res.filiais || res.unidades || [];
        // filtra apenas filiais ativas da empresa selecionada
        const encontrado = items.filter((f) => String(f.empresa_id) === String(empresaSelecionada.id) && f.ativo);
        setFiliais(encontrado);
        if (encontrado.length === 1) {
          // auto-seleciona a única filial ativa
          const f = encontrado[0];
          selecionarFilial({ id: f.id, nome: f.nome || f.cnpj || 'Filial', tipo: f.tipo || 'empresa' });
          setAberto(false);
        } else if (encontrado.length > 1) {
          // Se for admin, forçamos modal bloqueante; se for outro papel, mostramos mas permitimos fechar
          setAberto(true);
        }
      } catch (e) {
        // falha silenciosa — não bloqueia login
      } finally {
        setCarregando(false);
      }
    }
    carregar();
    return () => { mounted = false; };
  }, [empresaSelecionada, filialSelecionada, usuario, selecionarFilial]);
  const papel = usuario?.papel;
  const bloqueante = papel === 'admin';

  function escolher(f) {
    selecionarFilial({ id: f.id, nome: f.nome || f.cnpj || 'Filial', tipo: f.tipo || 'empresa' });
    setAberto(false);
  }

  // control focus trap and body scroll
  useEffect(() => {
    if (!aberto) return;
    const el = modalRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (first) first.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (!bloqueante) setAberto(false);
      }
      if (e.key === 'Tab') {
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [bloqueante, aberto]);

  // não renderiza modal se não estiver aberto
  if (!aberto || carregando) return null;

  return (
    <div className="modal-overlay" role="presentation" onClick={() => { if (!bloqueante) setAberto(false); }}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-selecionar-filial"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <h2 id="titulo-selecionar-filial">Escolha a filial</h2>
        <p>Selecione em qual filial deseja entrar neste ambiente.</p>
        {mensagem && <div className="texto-apoio" style={{ marginBottom: 8 }}>{mensagem}</div>}
        <div className="lista-filiais">
          {filiais.length === 0 && <div className="texto-apoio">Nenhuma filial encontrada para este ambiente.</div>}
          {filiais.map((f) => (
            <div key={f.id} className="item-filial">
              <div>
                <strong>{f.nome || f.cnpj}</strong>
                <div className="texto-apoio">Tipo: {f.tipo || 'empresa'}</div>
              </div>
              <div>
                <button className="btn btn-primario" onClick={() => escolher(f)}>Entrar nesta filial</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          {!bloqueante && <button className="btn" onClick={() => setAberto(false)}>Fechar</button>}
        </div>
      </div>
    </div>
  );
}
