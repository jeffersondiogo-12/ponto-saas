import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import Selecao from "../components/Selecao";
import { api } from "../api";
import { dataHoraCompleta, estadoConexao } from "../utils/conexao";
import { useAuth } from "../context/AuthContext";

const PADRAO = {
  descricao: "",
  filial_id: "",
  situacao: "ativo",
  modelo: "Facial AI 5",
  tipo_biometria: "facial",
  fuso_horario: "America/Sao_Paulo",
  enviar_comprovante_email: false,
  modo_conexao: "client",
  ip: "",
  porta: 4370,
  nao_validar_empresa: false,
  numero_serie: "",
  mac_address: "",
  protocolo: "desconhecido",
  usuario_dispositivo: "",
  senha_dispositivo: "",
  identificador_equipamento: "",
};

export default function DispositivoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { empresaSelecionada, filialSelecionada } = useAuth();
  const [dados, setDados] = useState(PADRAO);
  const [filiais, setFiliais] = useState([]);
  const [ultimoNsr, setUltimoNsr] = useState(null);
  const [conexaoBruta, setConexaoBruta] = useState(null);
  const [statusAcao, setStatusAcao] = useState("");
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);
  const [usuariosEquipamento, setUsuariosEquipamento] = useState(null);
  const [pessoasDisponiveis, setPessoasDisponiveis] = useState([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState("");
  const [fotoFacial, setFotoFacial] = useState(null);

  useEffect(() => {
    api
      .listarUnidades()
      .then((r) => {
        const disponiveis = (r.filiais || []).filter(
          (filial) =>
            filial.ativo &&
            (!empresaSelecionada ||
              String(filial.empresa_id) === String(empresaSelecionada.id)),
        );
        setFiliais(disponiveis);
        if (
          !id &&
          filialSelecionada &&
          disponiveis.some((filial) => filial.id === filialSelecionada.id)
        ) {
          setDados((atual) => ({ ...atual, filial_id: filialSelecionada.id }));
        }
      })
      .catch(() => setFiliais([]));
  }, [empresaSelecionada, filialSelecionada, id]);

  useEffect(() => {
    if (!id) return;
    api.buscarDispositivo(id).then((r) => {
      setDados({ ...PADRAO, ...r.dispositivo, senha_dispositivo: "" });
      setUltimoNsr(r.dispositivo.ultimo_nsr);
      setConexaoBruta(r.dispositivo);
    });
  }, [id]);

  const conexao = estadoConexao(conexaoBruta);
  const ultimaComunicacao =
    conexaoBruta?.ultima_conexao_ws_em ||
    conexaoBruta?.ultima_coleta_em ||
    null;

  function set(campo, valor) {
    setDados((d) => ({ ...d, [campo]: valor }));
  }

  async function salvar(e) {
    e.preventDefault();
    if (!dados.filial_id) {
      alert("Selecione a filial do dispositivo.");
      return;
    }
    const payload = { ...dados };
    payload.ip = payload.ip?.trim() || null;
    if (!payload.senha_dispositivo) delete payload.senha_dispositivo;

    try {
      if (id) await api.atualizarDispositivo(id, payload);
      else await api.criarDispositivo(payload);
      navigate("/dispositivos");
    } catch (err) {
      alert(err.message);
    }
  }

  async function testarConexao() {
    setAcaoEmAndamento(true);
    setStatusAcao("Testando conexão...");
    try {
      const r = await api.testarConexaoDispositivo(id);
      setStatusAcao(
        r.ok
          ? r.aviso || "Conectado com sucesso."
          : `Falha: ${r.erro}`,
      );
    } catch (err) {
      setStatusAcao(`Falha: ${err.message}`);
    } finally {
      setAcaoEmAndamento(false);
    }
  }

  async function forcarColeta() {
    setAcaoEmAndamento(true);
    setStatusAcao("Coletando...");
    try {
      const r = await api.forcarColeta(id);
      setStatusAcao(
        r.ok
          ? `${r.totalNovos} novo(s), ${r.totalNaoResolvidos} sem vínculo.`
          : `Falha: ${r.erro}`,
      );
    } catch (err) {
      setStatusAcao(`Falha: ${err.message}`);
    } finally {
      setAcaoEmAndamento(false);
    }
  }

  async function verUsuariosNoEquipamento() {
    setAcaoEmAndamento(true);
    setStatusAcao("Consultando equipamento...");
    try {
      const r = await api.usuariosNoEquipamento(id);
      if (r.ok === false) {
        setStatusAcao(`Falha: ${r.erro}`);
      } else {
        setUsuariosEquipamento(r.usuarios || []);
        const vinculados = (r.usuarios || []).filter((u) => u.sincronizacao?.estado === "vinculado").length;
        const conflitos = (r.usuarios || []).filter((u) => u.sincronizacao?.estado === "conflito").length;
        const semCorrespondencia = (r.usuarios || []).filter(
          (u) => u.sincronizacao?.estado === "sem_correspondencia",
        ).length;
        setStatusAcao(
          r.usuarios?.length
            ? `${r.usuarios.length} usuário(s) recebido(s): ${vinculados} vinculado(s), ${conflitos} conflito(s), ${semCorrespondencia} sem correspondência.`
            : "Nenhum usuário cadastrado no equipamento.",
        );
      }
    } catch (err) {
      setStatusAcao(`Falha: ${err.message}`);
    } finally {
      setAcaoEmAndamento(false);
    }
  }

  async function carregarPessoas() {
    if (!dados.filial_id) {
      setStatusAcao("Selecione e salve a filial do equipamento antes de carregar pessoas.");
      return;
    }
    setAcaoEmAndamento(true);
    setStatusAcao("Carregando pessoas da unidade...");
    try {
      const [funcionariosResposta, alunosResposta] = await Promise.all([
        api.listarFuncionarios(),
        api.listarAlunos({ ativo: true }),
      ]);
      const funcionarios = (funcionariosResposta.funcionarios || [])
        .filter((pessoa) => pessoa.ativo && pessoa.filial_id === dados.filial_id)
        .map((pessoa) => ({ ...pessoa, tipo: "funcionario" }));
      const alunos = (alunosResposta.alunos || [])
        .filter((pessoa) => pessoa.ativo && pessoa.filial_id === dados.filial_id)
        .map((pessoa) => ({ ...pessoa, tipo: "aluno" }));
      const pessoas = [...alunos, ...funcionarios].sort((a, b) => a.nome.localeCompare(b.nome));
      setPessoasDisponiveis(pessoas);
      setPessoaSelecionada("");
      setStatusAcao(
        pessoas.length
          ? `${pessoas.length} pessoa(s) ativa(s) carregada(s) para envio.`
          : "Nenhum aluno ou funcionário ativo encontrado nesta unidade.",
      );
    } catch (err) {
      setStatusAcao(`Falha ao carregar pessoas: ${err.message}`);
    } finally {
      setAcaoEmAndamento(false);
    }
  }

  function selecionarFoto(e) {
    const arquivo = e.target.files?.[0] || null;
    setFotoFacial(null);
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      setStatusAcao("Selecione um arquivo de imagem.");
      e.target.value = "";
      return;
    }
    if (arquivo.size > 4 * 1024 * 1024) {
      setStatusAcao("A foto deve ter no máximo 4 MB.");
      e.target.value = "";
      return;
    }
    setFotoFacial(arquivo);
    setStatusAcao("");
  }

  async function enviarFace() {
    const [tipo, pessoaId] = pessoaSelecionada.split(":");
    const pessoa = pessoasDisponiveis.find(
      (item) => item.tipo === tipo && item.id === pessoaId,
    );
    const matricula = String(pessoa?.matricula || "").trim();
    if (!pessoa || !fotoFacial) {
      setStatusAcao("Selecione uma pessoa e uma foto facial.");
      return;
    }
    if (!/^[1-9]\d*$/.test(matricula) || !Number.isSafeInteger(Number(matricula))) {
      setStatusAcao("A matrícula precisa ser um número positivo, sem zeros à esquerda, para corresponder ao ID do equipamento.");
      return;
    }

    setAcaoEmAndamento(true);
    setStatusAcao("Enviando face ao equipamento...");
    try {
      const fotoBase64 = await new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(new Error("Não foi possível ler a foto selecionada."));
        leitor.readAsDataURL(fotoFacial);
      });
      if (tipo === "aluno") {
        const resultado = await api.cadastrarFaceAluno(pessoa.id, {
          dispositivo_id: id,
          foto_base64: fotoBase64,
        });
        setStatusAcao(
          resultado.pendente
            ? `Face guardada com segurança e pendente de envio. ${resultado.erro || "Será enviada quando o equipamento se conectar."}`
            : `Face de ${pessoa.nome} enviada e confirmada pelo equipamento.`,
        );
      } else {
        const resultado = await api.cadastrarFaceDispositivo(id, {
          tipo,
          pessoa_id: pessoa.id,
          id_no_dispositivo: matricula,
          nome: pessoa.nome,
          foto_base64: fotoBase64,
        });
        if (resultado.ok === false) throw new Error(resultado.erro || "O equipamento recusou o cadastro.");
        setStatusAcao(`Face de ${pessoa.nome} enviada e confirmada pelo equipamento.`);
      }
      setFotoFacial(null);
      const inputFoto = document.getElementById("foto-facial-dispositivo");
      if (inputFoto) inputFoto.value = "";
    } catch (err) {
      setStatusAcao(`Falha ao enviar face: ${err.message}`);
    } finally {
      setAcaoEmAndamento(false);
    }
  }

  return (
    <Layout>
      <Link to="/dispositivos" className="link-topo">
        &larr; Dispositivos
      </Link>
      <h1 className="titulo-pagina">
        {id ? dados.descricao : "Novo dispositivo"}
      </h1>

      <form onSubmit={salvar}>
        <div className="card">
          <div className="eyebrow">Equipamento</div>
          <div className="card-corpo">
            <div className="grid-form">
              <div className="campo">
                <label>Filial do equipamento</label>
                <Selecao
                  rotuloAria="Filial do equipamento"
                  valor={dados.filial_id}
                  aoMudar={(v) => set("filial_id", v)}
                  opcoes={filiais.map((filial) => ({
                    valor: filial.id,
                    rotulo: filial.nome,
                  }))}
                />
              </div>
              <div className="campo">
                <label>Descrição do equipamento</label>
                <input
                  value={dados.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                  required
                />
              </div>
              <div className="campo">
                <label>Situação do cadastro</label>
                <Selecao
                  rotuloAria="Situação do cadastro"
                  valor={dados.situacao}
                  aoMudar={(v) => set("situacao", v)}
                  opcoes={[
                    { valor: "ativo", rotulo: "Ativo" },
                    { valor: "inativo", rotulo: "Inativo" },
                  ]}
                />
              </div>
              <div className="campo">
                <label>Modelo do equipamento</label>
                <input
                  value={dados.modelo}
                  onChange={(e) => set("modelo", e.target.value)}
                />
              </div>
              <div className="campo">
                <label>Tipo de biometria</label>
                <Selecao
                  rotuloAria="Tipo de biometria"
                  valor={dados.tipo_biometria}
                  aoMudar={(v) => set("tipo_biometria", v)}
                  opcoes={["facial", "digital", "cartao", "senha", "misto"].map(
                    (t) => ({
                      valor: t,
                      rotulo: t.charAt(0).toUpperCase() + t.slice(1),
                    }),
                  )}
                />
              </div>
              <div className="campo">
                <label>Fuso horário</label>
                <input
                  value={dados.fuso_horario}
                  onChange={(e) => set("fuso_horario", e.target.value)}
                />
              </div>
              <div className="campo campo-checkbox">
                <input
                  type="checkbox"
                  id="comprovante"
                  checked={dados.enviar_comprovante_email}
                  onChange={(e) =>
                    set("enviar_comprovante_email", e.target.checked)
                  }
                />
                <label htmlFor="comprovante">
                  Enviar comprovante por e-mail
                </label>
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
                  aoMudar={(v) => set("modo_conexao", v)}
                  opcoes={[
                    { valor: "client", rotulo: "Client" },
                    { valor: "server", rotulo: "Server" },
                  ]}
                />
              </div>
              <div className="campo">
                <label>
                  IP{dados.modo_conexao === "server" ? " (opcional)" : ""}
                </label>
                <input
                  className="mono"
                  value={dados.ip || ""}
                  onChange={(e) => set("ip", e.target.value)}
                  placeholder={
                    dados.modo_conexao === "server"
                      ? "preenchido automaticamente ao conectar"
                      : "192.168.0.206"
                  }
                  required={dados.modo_conexao !== "server"}
                />
                {dados.modo_conexao === "server" && (
                  <span className="texto-apoio">
                    Em modo Server é o equipamento quem se conecta a este
                    servidor — o IP é detectado sozinho no primeiro registro.
                  </span>
                )}
              </div>
              <div className="campo">
                <label>Porta de acesso</label>
                <input
                  className="mono"
                  type="number"
                  value={dados.porta}
                  onChange={(e) => set("porta", Number(e.target.value))}
                />
              </div>
              <div className="campo campo-checkbox">
                <input
                  type="checkbox"
                  id="naoValidar"
                  checked={dados.nao_validar_empresa}
                  onChange={(e) => set("nao_validar_empresa", e.target.checked)}
                />
                <label htmlFor="naoValidar">Não validar empresa</label>
              </div>
              <div className="campo">
                <label>Número de série</label>
                <input
                  className="mono"
                  value={dados.numero_serie}
                  onChange={(e) => set("numero_serie", e.target.value)}
                  required
                />
              </div>
              <div className="campo">
                <label>MAC</label>
                <input
                  className="mono"
                  value={dados.mac_address || ""}
                  onChange={(e) => set("mac_address", e.target.value)}
                  placeholder="00:01:A9:1B:96:8D"
                />
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
                      modo_conexao:
                        v === "evo_ws"
                          ? "server"
                          : d.modo_conexao === "server"
                            ? "client"
                            : d.modo_conexao,
                    }))
                  }
                  opcoes={[
                    { valor: "desconhecido", rotulo: "A confirmar" },
                    {
                      valor: "zk_tcp",
                      rotulo: "Protocolo ZK (TCP) — não confirmado",
                    },
                    {
                      valor: "evo_ws",
                      rotulo:
                        "Evo Facial (WebSocket) — protocolo oficial do fabricante",
                    },
                    { valor: "http_rest", rotulo: "HTTP/REST" },
                  ]}
                />
                {dados.protocolo === "evo_ws" && (
                  <span className="texto-apoio">
                    Modo "Server" (selecionado automaticamente). Em produção,
                    aponte o equipamento para o domínio público deste servidor +{" "}
                    <code>/evo</code>, porta 443/HTTPS — não use IP nem a porta
                    EVO_FACIAL_WS_PORT, que só se aplica rodando o backend
                    standalone na sua própria rede.
                  </span>
                )}
              </div>
              {id && (
                <div className="campo">
                  <label>Último NSR sincronizado</label>
                  <span className="chip-dado" style={{ width: "fit-content" }}>
                    {ultimoNsr}
                  </span>
                </div>
              )}
              {/* Nao restrito a evo_ws: em http_rest o equipamento tambem se
                  registra, e era justamente ali que o estado nunca aparecia. */}
              {id && (
                <div className="campo">
                  <label>Comunicação</label>
                  <span className="estado-conexao" title={conexao.titulo}>
                    <span
                      className={`badge badge-${conexao.classe}`}
                      style={{ width: "fit-content" }}
                    >
                      {conexao.rotulo}
                    </span>
                    {conexao.detalhe && (
                      <span className="estado-detalhe">{conexao.detalhe}</span>
                    )}
                  </span>
                  <span className="ajuda">
                    Última comunicação: {dataHoraCompleta(ultimaComunicacao)}.{" "}
                    {dados.protocolo === "evo_ws"
                      ? "Comunicação HTTP confirma que o equipamento está vivo e pode enviar batidas; receber usuários, coletar sob demanda e enviar faces exigem uma sessão WebSocket/WSS ativa."
                      : "Em HTTP o equipamento não mantém conexão aberta; o horário mostra a última comunicação recebida."}
                  </span>
                </div>
              )}
            </div>

            {id && (
              <div
                className="acoes-form"
                style={{ justifyContent: "flex-start", marginTop: 20 }}
              >
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={testarConexao}
                  disabled={acaoEmAndamento}
                >
                  Testar conexão
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={forcarColeta}
                  disabled={acaoEmAndamento}
                >
                  Receber marcações
                </button>
                {dados.protocolo === "evo_ws" && (
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={verUsuariosNoEquipamento}
                    disabled={acaoEmAndamento}
                  >
                    Receber usuários
                  </button>
                )}
                <span className="texto-apoio">{statusAcao}</span>
              </div>
            )}
          </div>
        </div>

        {id && dados.protocolo === "evo_ws" && (
          <div className="card">
            <div className="eyebrow">Enviar dados para o equipamento</div>
            <div className="card-corpo">
              <p className="texto-apoio">
                Envie a foto facial de um aluno ou funcionário ativo desta unidade.
                A matrícula será usada como ID no relógio. O envio remoto exige
                WebSocket/WSS ativo; faces de alunos ficam na fila cifrada até o
                equipamento abrir esse canal.
              </p>
              <div className="grid-form">
                <div className="campo">
                  <label>Pessoa</label>
                  <select
                    value={pessoaSelecionada}
                    onChange={(e) => setPessoaSelecionada(e.target.value)}
                    disabled={!pessoasDisponiveis.length || acaoEmAndamento}
                  >
                    <option value="">Selecione uma pessoa</option>
                    {pessoasDisponiveis.map((pessoa) => (
                      <option
                        key={`${pessoa.tipo}:${pessoa.id}`}
                        value={`${pessoa.tipo}:${pessoa.id}`}
                      >
                        {pessoa.nome} — {pessoa.tipo === "aluno" ? "Aluno" : "Funcionário"} · matrícula {pessoa.matricula || "ausente"}
                      </option>
                    ))}
                  </select>
                  <span className="texto-apoio">
                    {pessoasDisponiveis.length
                      ? `${pessoasDisponiveis.length} pessoa(s) carregada(s).`
                      : "Carregue as pessoas ativas da unidade antes de enviar."}
                  </span>
                </div>
                <div className="campo">
                  <label htmlFor="foto-facial-dispositivo">Foto facial (máximo 4 MB)</label>
                  <input
                    id="foto-facial-dispositivo"
                    type="file"
                    accept="image/*"
                    onChange={selecionarFoto}
                    disabled={acaoEmAndamento}
                  />
                  {fotoFacial && <span className="texto-apoio">{fotoFacial.name}</span>}
                </div>
              </div>
              <div className="acoes-form" style={{ justifyContent: "flex-start" }}>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={carregarPessoas}
                  disabled={acaoEmAndamento}
                >
                  Carregar pessoas da unidade
                </button>
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={enviarFace}
                  disabled={acaoEmAndamento || !pessoaSelecionada || !fotoFacial}
                >
                  Enviar face
                </button>
              </div>
            </div>
          </div>
        )}

        {usuariosEquipamento && (
          <div className="card">
            <div className="eyebrow">Dados recebidos do equipamento</div>
            <div className="card-corpo">
              {usuariosEquipamento.length ? (
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>ID / matrícula</th>
                      <th>Nome correspondente</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosEquipamento.map((usuario) => (
                      <tr key={usuario.idNoDispositivo}>
                        <td className="mono">{usuario.idNoDispositivo}</td>
                        <td>{usuario.sincronizacao?.nome || usuario.nome || "—"}</td>
                        <td>
                          {usuario.sincronizacao?.estado === "vinculado"
                            ? "Vinculado ao cadastro do site"
                            : usuario.sincronizacao?.estado === "conflito"
                              ? `Conflito: ${usuario.sincronizacao.motivo}`
                              : usuario.sincronizacao?.estado === "sem_correspondencia"
                                ? "Sem aluno/funcionário com esta matrícula"
                                : "Recebido"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="texto-apoio">O equipamento não retornou usuários cadastrados.</p>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <div className="eyebrow">Autenticação</div>
          <div className="card-corpo">
            <div className="grid-form">
              <div className="campo">
                <label>Usuário</label>
                <input
                  value={dados.usuario_dispositivo || ""}
                  onChange={(e) => set("usuario_dispositivo", e.target.value)}
                />
              </div>
              <div className="campo">
                <label>Senha {id ? "(deixe em branco para manter)" : ""}</label>
                <input
                  type="password"
                  value={dados.senha_dispositivo}
                  onChange={(e) => set("senha_dispositivo", e.target.value)}
                />
              </div>
              <div className="campo">
                <label>Identificador de equipamento</label>
                <input
                  value={dados.identificador_equipamento || ""}
                  onChange={(e) =>
                    set("identificador_equipamento", e.target.value)
                  }
                  placeholder="Escreva o identificador."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="acoes-form">
          <Link to="/dispositivos" className="btn btn-secundario">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primario">
            Salvar
          </button>
        </div>
      </form>
    </Layout>
  );
}
