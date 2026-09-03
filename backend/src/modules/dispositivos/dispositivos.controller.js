const dispositivosService = require('./dispositivos.service');
const pontoService = require('../ponto/ponto.service');

async function listar(req, res, next) {
  try {
    const dispositivos = await dispositivosService.listar(req.empresaId, req.filialId);
    res.json({ dispositivos });
  } catch (err) {
    next(err);
  }
}

async function buscar(req, res, next) {
  try {
    const dispositivo = await dispositivosService.buscarPorId(req.empresaId, req.params.id);
    res.json({ dispositivo: dispositivosService.sanitizar(dispositivo) });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const dispositivo = await dispositivosService.criar(req.empresaId, req.body);
    res.status(201).json({ dispositivo });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const dispositivo = await dispositivosService.atualizar(req.empresaId, req.params.id, req.body);
    res.json({ dispositivo });
  } catch (err) {
    next(err);
  }
}

async function testarConexao(req, res, next) {
  try {
    const resultado = await dispositivosService.testarConexao(req.empresaId, req.params.id);
    res.json(resultado);
  } catch (err) {
    // Falha de conexao com hardware e esperada durante validacao do protocolo -
    // devolvemos 200 com ok:false em vez de 500, para o frontend mostrar o motivo
    // sem tratar isso como bug do sistema.
    res.status(200).json({ ok: false, erro: err.message });
  }
}

async function forcarColeta(req, res, next) {
  try {
    const { dispositivo, registros } = await dispositivosService.forcarColeta(req.empresaId, req.params.id);
    const resumo = await pontoService.ingerirRegistros(req.empresaId, dispositivo, registros);
    res.json({ ok: true, ...resumo });
  } catch (err) {
    res.status(200).json({ ok: false, erro: err.message });
  }
}

async function usuariosNoEquipamento(req, res, next) {
  try {
    const usuarios = await dispositivosService.listarUsuariosNoEquipamento(req.empresaId, req.params.id);
    res.json({ usuarios });
  } catch (err) {
    // Mesmo padrao de testarConexao/forcarColeta: equipamento offline ou
    // protocolo sem suporte a isso e um resultado esperado, nao um bug.
    res.status(200).json({ ok: false, erro: err.message });
  }
}

async function cadastrarFace(req, res, next) {
  try {
    const { tipo, pessoa_id, id_no_dispositivo, nome, foto_base64 } = req.body;
    const resultado = await dispositivosService.cadastrarFace(req.empresaId, req.params.id, {
      tipo,
      pessoaId: pessoa_id,
      idNoDispositivo: id_no_dispositivo,
      nome,
      fotoBase64: foto_base64,
    });
    res.status(201).json({ ok: true, ...resultado });
  } catch (err) {
    res.status(200).json({ ok: false, erro: err.message });
  }
}

async function removerFace(req, res, next) {
  try {
    const { tipo, pessoa_id } = req.body;
    await dispositivosService.removerFace(req.empresaId, req.params.id, { tipo, pessoaId: pessoa_id });
    res.json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false, erro: err.message });
  }
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  testarConexao,
  forcarColeta,
  usuariosNoEquipamento,
  cadastrarFace,
  removerFace,
};
