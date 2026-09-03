const responsaveisService = require('./responsaveis.service');

async function cadastrar(req, res, next) {
  try {
    const responsavel = await responsaveisService.cadastrar(req.body);
    res.status(201).json({ responsavel: { id: responsavel.id, nome: responsavel.nome, email: responsavel.email } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, senha } = req.body;
    const { token, responsavel } = await responsaveisService.login(email, senha);
    res.json({ token, responsavel });
  } catch (err) {
    next(err);
  }
}

async function listarAlunos(req, res, next) {
  try {
    const alunos = await responsaveisService.listarAlunosVinculados(req.usuario.empresa_id, req.usuario.alunoIds);
    res.json({ alunos });
  } catch (err) {
    next(err);
  }
}

async function frequenciaDoAluno(req, res, next) {
  try {
    const { de, ate } = req.query;
    const resultado = await responsaveisService.frequenciaDoAluno(req.usuario.empresa_id, req.usuario.alunoIds, req.params.alunoId, {
      de,
      ate,
    });
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function notasDoAluno(req, res, next) {
  try {
    const notas = await responsaveisService.notasDoAluno(req.usuario.alunoIds, req.params.alunoId);
    res.json({ notas });
  } catch (err) {
    next(err);
  }
}

async function observacoesDoAluno(req, res, next) {
  try {
    const observacoes = await responsaveisService.observacoesDoAluno(req.usuario.alunoIds, req.params.alunoId);
    res.json({ observacoes });
  } catch (err) {
    next(err);
  }
}

async function vincularNovoFilho(req, res, next) {
  try {
    const vinculo = await responsaveisService.vincularNovoFilho(req.usuario.empresa_id, req.usuario.responsavelId, req.body);
    res.status(201).json({ vinculo });
  } catch (err) {
    next(err);
  }
}

async function presencaSalaDoAluno(req, res, next) {
  try {
    const registros = await responsaveisService.presencaSalaDoAluno(
      req.usuario.empresa_id,
      req.usuario.alunoIds,
      req.params.alunoId
    );
    res.json({ registros });
  } catch (err) {
    next(err);
  }
}

async function avisosDoAluno(req, res, next) {
  try {
    const avisos = await responsaveisService.avisosDoAluno(req.usuario.alunoIds, req.params.alunoId);
    res.json({ avisos });
  } catch (err) {
    next(err);
  }
}

async function registrarLeituraAviso(req, res, next) {
  try {
    const leitura = await responsaveisService.registrarLeituraAviso(
      req.usuario.empresa_id,
      req.params.avisoId,
      req.usuario.responsavelId,
      req.usuario.alunoIds
    );
    res.status(201).json({ leitura });
  } catch (err) {
    next(err);
  }
}

async function registrarPushToken(req, res, next) {
  try {
    const { token, plataforma } = req.body;
    const registro = await responsaveisService.registrarPushToken(req.usuario.responsavelId, token, plataforma);
    res.status(201).json({ registro });
  } catch (err) {
    next(err);
  }
}

async function vincularAluno(req, res, next) {
  try {
    const { responsavel_id, matricula_aluno, parentesco } = req.body;
    const vinculo = await responsaveisService.vincularAluno(req.empresaId, responsavel_id, matricula_aluno, parentesco);
    res.status(201).json({ vinculo });
  } catch (err) {
    next(err);
  }
}

async function excluir(req, res, next) {
  try {
    await responsaveisService.excluir(req.empresaId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  cadastrar,
  login,
  listarAlunos,
  frequenciaDoAluno,
  notasDoAluno,
  observacoesDoAluno,
  presencaSalaDoAluno,
  avisosDoAluno,
  registrarLeituraAviso,
  registrarPushToken,
  vincularAluno,
  vincularNovoFilho,
  excluir,
};
