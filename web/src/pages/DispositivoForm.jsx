import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';

const PADRAO = {
  descricao: '',
  filial_id: '',
  situacao: 'ativo',
  modelo: 'Facial AI 5',
  tipo_biometria: 'facial',
  fuso_horario: 'America/Sao_Paulo',
  enviar_comprovante_email: false,
  modo_conexao: 'client',
  ip: '',
  porta: 4370,
  nao_validar_empresa: false,
  numero_serie: '',
  mac_address: '',
  protocolo: 'desconhecido',
  usuario_dispositivo: '',
  senha_dispositivo: '',
  identificador_equipamento: '',
};

export default function DispositivoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dados, setDados] = useState(PADRAO);
  const [ultimoNsr, setUltimoNsr] = useState(null);
  const [conectadoAgora, setConectadoAgora] = useState(null);
  const [statusAcao, setStatusAcao] = useState('');

  useEffect(() => {
    if (!id) return;
    api.buscarDispositivo(id).then((r) => {
      setDados({ ...PADRAO, ...r.dispositivo, senha_dispositivo: '' });
      setUltimoNsr(r.dispositivo.ultimo_nsr);
      setConectadoAgora(r.dispositivo.conectado_agora);
    });
  }, [id]);

  function set(campo, valor) {
    setDados((d) => ({ ...d, [campo]: valor }));
  }

  async function salvar(e) {
    e.preventDefault();
    const payload = { ...dados };
    if (!payload.senha_dispositivo) delete payload.senha_dispositivo;

    try {
      if (id) await api.atualizarDispositivo(id, payload);
      else await api.criarDispositivo(payload);
      navigate('/dispositivos');
    } catch (err) {
      alert(err.message);
    }
  }

  async function testarConexao() {
    setStatusAcao('Testando conexão...');
    try {
      const r = await api.testarConexaoDispositivo(id);
      setStatusAcao(r.ok ? 'Conectado com sucesso.' : `Falha: ${r.erro}`);
    } catch (err) {
      setStatusAcao(`Falha: ${err.message}`);
    }
  }

  async function forcarColeta() {
    setStatusAcao('Coletando...');
    try {
      const r = await api.forcarColeta(id);
      setStatusAcao(r.ok ? `${r.totalNovos} novo(s), ${r.totalNaoResolvidos} sem vínculo.` : `Falha: ${r.erro}`);
    } catch (err) {
      setStatusAcao(`Falha: ${err.message}`);
    }
  }

  async function verUsuariosNoEquipamento() {
    setStatusAcao('Consultando equipamento...');
    try {
      const r = await api.usuariosNoEquipamento(id);
      if (r.ok === false) {
        setStatusAcao(`Falha: ${r.erro}`);
      } else {
        setStatusAcao(
          r.usuarios.length
            ? `${r.usuarios.length} usuário(s) no equipamento: ${r.usuarios.map((u) => u.idNoDispositivo).join(', ')}`
            : 'Nenhum usuário cadastrado no equipamento.'
        );
      }
    } catch (err) {
      setStatusAcao(`Falha: ${err.message}`);
    }
  }

  return (
    <Layout>
      <Link to="/dispositivos" className="link-topo">&larr; Dispositivos</Link>
      <h1 className="titulo-pagina">{id ? dados.descricao : 'Novo dispositivo'}</h1>

      <form onSubmit={salvar}>
        <div className="card">
          <div className="eyebrow">Equipamento</div>
          <div className="card-corpo">
            <div className="grid-form">
              <div className="campo">
                <label>Descrição do equipamento</label>
                <input value={dados.descricao} onChange={(e) => set('descricao', e.target.value)} required />
              </div>
              <div className="campo">
                <label>Situação do cadastro</label>
                <Selecao
                  rotuloAria="Situação do cadastro"
                  valor={dados.situacao}
                  aoMudar={(v) => set('situacao', v)}
                  opcoes={[
                    { valor: 'ativo', rotulo: 'Ativo' },
                    { valor: 'inativo', rotulo: 'Inativo' },
                  ]}
                />
              </div>
              <div className="campo">
                <label>Modelo do equipamento</label>
                <input value={dados.modelo} onChange={(e) => set('modelo', e.target.value)} />
              </div>
              <div className="campo">
                <label>Tipo de biometria</label>
                <Selecao
                  rotuloAria="Tipo de biometria"
                  valor={dados.tipo_biometria}
                  aoMudar={(v) => set('tipo_biometria', v)}
                  opcoes={['facial', 'digital', 'cartao', 'senha', 'misto'].map((t) => ({
                    valor: t, rotulo: t.charAt(0).toUpperCase() + t.slice(1),
                  }))}
                />
              </div>
              <div className="campo">
                <label>Fuso horário</label>
                <input value={dados.fuso_horario} onChange={(e) => set('fuso_horario', e.target.value)} />
              </div>
              <div className="campo campo-checkbox">
                <input
                  type="checkbox"
                  id="comprovante"
                  checked={dados.enviar_comprovante_email}
                  onChange={(e) => set('enviar_comprovante_email', e.target.checked)}
                />
                <label htmlFor="comprovante">Enviar comprovante por e-mail</label>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">Configuração</div>
          <div className="card-corpo">
            <div className="grid-form">
              <div className="campo">
                <label>Modo de conexão do relógio</label>
                <Selecao
                  rotuloAria="Modo de conexão do relógio"
                  valor={dados.modo_conexao}
                  aoMudar={(v) => set('modo_conexao', v)}
                  opcoes={[
                    { valor: 'client', rotulo: 'Client' },
                    { valor: 'server', rotulo: 'Server' },
                  ]}
                />
              </div>
              <div className="campo">
                <label>IP{dados.modo_conexao === 'server' ? ' (opcional)' : ''}</label>
                <input
                  className="mono"
                  value={dados.ip || ''}
                  onChange={(e) => set('ip', e.target.value)}
                  placeholder={dados.modo_conexao === 'server' ? 'preenchido automaticamente ao conectar' : '192.168.0.206'}
                  required={dados.modo_conexao !== 'server'}
                />
                {dados.modo_conexao === 'server' && (
                  <span className="texto-apoio">
                    Em modo Server é o equipamento quem se conecta a este servidor — o IP é detectado sozinho no primeiro registro.
                  </span>
                )}
              </div>
              <div className="campo">
                <label>Porta de acesso</label>
                <input className="mono" type="number" value={dados.porta} onChange={(e) => set('porta', Number(e.target.value))} />
              </div>
              <div className="campo campo-checkbox">
                <input
                  type="checkbox"
                  id="naoValidar"
                  checked={dados.nao_validar_empresa}
                  onChange={(e) => set('nao_validar_empresa', e.target.checked)}
                />
                <label htmlFor="naoValidar">Não validar empresa</label>
              </div>
              <div className="campo">
                <label>Número de série</label>
                <input className="mono" value={dados.numero_serie} onChange={(e) => set('numero_serie', e.target.value)} required />
              </div>
              <div className="campo">
                <label>MAC</label>
                <input className="mono" value={dados.mac_address || ''} onChange={(e) => set('mac_address', e.target.value)} placeholder="00:01:A9:1B:96:8D" />
              </div>
              <div className="campo">
                <label>Protocolo de comunicação</label>
                <Selecao
                  rotuloAria="Protocolo de comunicação"
                  valor={dados.protocolo}
                  aoMudar={(v) =>
                    setDados((d) => ({
                      ...d,
                      protocolo: v,
                      // evo_ws so funciona em modo 'server' (backend rejeita a combinacao
                      // contraria com 400) - troca sozinho pra nao depender do admin lembrar
                      // de mexer nos dois campos. Ao sair de evo_ws, volta pra 'client' se
                      // estava em 'server', ja que nenhum outro protocolo hoje suporta isso.
                      modo_conexao: v === 'evo_ws' ? 'server' : d.modo_conexao === 'server' ? 'client' : d.modo_conexao,
                    }))
                  }
                  opcoes={[
                    { valor: 'desconhecido', rotulo: 'A confirmar' },
                    { valor: 'zk_tcp', rotulo: 'Protocolo ZK (TCP) — não confirmado' },
                    { valor: 'evo_ws', rotulo: 'Evo Facial (WebSocket) — protocolo oficial do fabricante' },
                    { valor: 'http_rest', rotulo: 'HTTP/REST' },
                  ]}
                />
                {dados.protocolo === 'evo_ws' && (
                  <span className="texto-apoio">
                    Modo "Server" (selecionado automaticamente). Em produção, aponte o equipamento para o domínio
                    público deste servidor + <code>/evo</code>, porta 443/HTTPS — não use IP nem a porta
                    EVO_FACIAL_WS_PORT, que só se aplica rodando o backend standalone na sua própria rede.
                  </span>
                )}
              </div>
              {id && (
                <div className="campo">
                  <label>Último NSR sincronizado</label>
                  <span className="chip-dado" style={{ width: 'fit-content' }}>{ultimoNsr}</span>
                </div>
              )}
              {id && dados.protocolo === 'evo_ws' && (
                <div className="campo">
                  <label>Conexão WebSocket</label>
                  <span className={`badge badge-${conectadoAgora ? 'ativo' : 'inativo'}`} style={{ width: 'fit-content' }}>
                    {conectadoAgora ? 'Conectado agora' : 'Não conectado no momento'}
                  </span>
                </div>
              )}
            </div>

            {id && (
              <div className="acoes-form" style={{ justifyContent: 'flex-start', marginTop: 20 }}>
                <button type="button" className="btn btn-secundario" onClick={testarConexao}>Testar conexão</button>
                <button type="button" className="btn btn-secundario" onClick={forcarColeta}>Forçar coleta</button>
                {dados.protocolo === 'evo_ws' && (
                  <button type="button" className="btn btn-secundario" onClick={verUsuariosNoEquipamento}>
                    Usuários no equipamento
                  </button>
                )}
                <span className="texto-apoio">{statusAcao}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">Autenticação</div>
          <div className="card-corpo">
            <div className="grid-form">
              <div className="campo">
                <label>Usuário</label>
                <input value={dados.usuario_dispositivo || ''} onChange={(e) => set('usuario_dispositivo', e.target.value)} />
              </div>
              <div className="campo">
                <label>Senha {id ? '(deixe em branco para manter)' : ''}</label>
                <input type="password" value={dados.senha_dispositivo} onChange={(e) => set('senha_dispositivo', e.target.value)} />
              </div>
              <div className="campo">
                <label>Identificador de equipamento</label>
                <input
                  value={dados.identificador_equipamento || ''}
                  onChange={(e) => set('identificador_equipamento', e.target.value)}
                  placeholder="Escreva o identificador."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="acoes-form">
          <Link to="/dispositivos" className="btn btn-secundario">Cancelar</Link>
          <button type="submit" className="btn btn-primario">Salvar</button>
        </div>
      </form>
    </Layout>
  );
}