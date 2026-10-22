const alunosService = require('./alunos.service');
const faceSyncService = require('../dispositivos/faceSync.service');
const fotoAlunoService = require('./fotoAluno.service');

async function listar(req, res, next) {
  try {
    const { turma_id, ativo } = req.query;
    const alunos = await alunosService.listar(req.empresaId, {
      turmaId: turma_id,
      filialId: req.filialId,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
    res.json({ alunos });
  } catch (err) {
    next(err);
  }
}

async function buscar(req, res, next) {
  try {
    const aluno = await alunosService.buscarPorId(req.empresaId, req.params.id, req.filialId);
    res.json({ aluno });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const resultado = await alunosService.criar(req.empresaId, req.body, req.filialId);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const aluno = await alunosService.atualizar(req.empresaId, req.params.id, req.body, req.filialId);
    res.json({ aluno });
  } catch (err) {
    next(err);
  }
}

async function vincularDispositivo(req, res, next) {
  try {
    const { dispositivo_id, id_no_dispositivo } = req.body;
    const vinculo = await alunosService.vincularDispositivo(req.empresaId, req.params.id, dispositivo_id, id_no_dispositivo, req.filialId);
    res.status(201).json({ vinculo });
  } catch (err) {
    next(err);
  }
}

async function cadastrarFace(req, res, next) {
  try {
    const resultado = await faceSyncService.cadastrarFaceAluno(
      req.empresaId,
      req.params.id,
      {
        dispositivoId: req.body.dispositivo_id,
        fotoBase64: req.body.foto_base64,
      },
      req.filialId
    );
    res.status(resultado.pendente ? 202 : 201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function obterFoto(req, res, next) {
  try {
    const foto = await fotoAlunoService.ler(req.empresaId, req.params.id, req.filialId);
    // Foto de crianca: nada de cache compartilhado nem guardado no disco.
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' }).send(foto);
  } catch (err) {
    next(err);
  }
}

async function salvarFoto(req, res, next) {
  try {
    await fotoAlunoService.salvar(req.empresaId, req.params.id, req.body.foto_base64, {
      usuarioId: req.usuarioId,
      filialId: req.filialId,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function removerFoto(req, res, next) {
  try {
    await fotoAlunoService.remover(req.empresaId, req.params.id, {
      usuarioId: req.usuarioId,
      filialId: req.filialId,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function frequencia(req, res, next) {
  try {
    const { de, ate } = req.query;
    const registros = await alunosService.frequencia(req.empresaId, req.params.id, { de, ate }, req.filialId);
    res.json({ registros });
  } catch (err) {
    next(err);
  }
}

async function excluir(req, res, next) {
  try {
    await alunosService.excluir(req.empresaId, req.params.id, req.filialId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar, buscar, criar, atualizar, excluir, vincularDispositivo, cadastrarFace, frequencia,
  obterFoto, salvarFoto, removerFoto,
};
