const responsaveisService = require('./responsaveis.service');

async function cadastrar(req, res, next) {
  try {
    await responsaveisService.cadastrar(req.body);
    res.status(202).json({
      solicitacao: {
        status: 'recebida',
        mensagem: 'Se os dados forem confirmados, a escola poderá analisar a solicitação.',
      },
    });
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
    const pedido = await responsaveisService.vincularNovoFilho(req.usuario.empresa_id, req.usuario.responsavelId, req.body);
    res.status(201).json({ pedido });
  } catch (err) {
    next(err);
  }
}

async function listarMeusPedidosVinculo(req, res, next) {
  try {
    const pedidos = await responsaveisService.listarMeusPedidosVinculo(req.usuario.empresa_id, req.usuario.responsavelId);
    res.json({ pedidos });
  } catch (err) {
    next(err);
  }
}

async function listarResponsaveisDaEmpresa(req, res, next) {
  try {
    const responsaveis = await responsaveisService.listarResponsaveisDaEmpresa(req.empresaId, req.query.busca); //query de busca para filtrar 
    res.json({ responsaveis });
  } catch (err) {
    next(err);
  }
}

async function atualizarResponsavelDaEmpresa(req, res, next) {
  try {
    const resultado = await responsaveisService.atualizarResponsavelDaEmpresa(
      req.empresaId,
      req.params.responsavelId,
      req.body,
      { usuarioId: req.usuario.usuario_id, ip: req.ip }
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function listarPedidosVinculo(req, res, next) {
  try {
    const pedidos = await responsaveisService.listarPedidosVinculo(req.empresaId, req.filialId);
    res.json({ pedidos });
  } catch (err) {
    next(err);
  }
}

async function listarNotificacoesVinculo(req, res, next) {
  try {
    const notificacoes = await responsaveisService.listarNotificacoesVinculo(req.empresaId, req.filialId);
    res.json({ notificacoes });
  } catch (err) {
    next(err);
  }
}

async function decidirPedidoVinculo(req, res, next) {
  try {
    const resultado = await responsaveisService.decidirPedidoVinculo(
      req.empresaId,
      req.params.pedidoId,
      req.params.decisao,
      {
        filialId: req.filialId,
        usuarioId: req.usuario.usuario_id,
        ip: req.ip,
      }
    );
    res.json({ pedido: resultado });
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

async function registrarPushWeb(req, res, next) {
  try {
    const registro = await responsaveisService.registrarPushWeb(req.usuario.responsavelId, req.body);
    res.status(201).json({ registro });
  } catch (err) {
    next(err);
  }
}

async function removerPushWeb(req, res, next) {
  try {
    await responsaveisService.removerPushWeb(req.usuario.responsavelId, req.body);
    res.status(204).send();
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

async function vincularResponsavelAoAluno(req, res, next) {
  try {
    const resultado = await responsaveisService.vincularResponsavelAoAluno(
      req.empresaId,
      req.params.alunoId,
      req.body.responsavel_id,
      req.body.parentesco,
      {
        filialId: req.filialId,
        usuarioId: req.usuario.usuario_id,
        ip: req.ip,
      }
    );
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function listarResponsaveisDoAluno(req, res, next) {
  try {
    const responsaveis = await responsaveisService.listarResponsaveisDoAluno(
      req.empresaId,
      req.params.alunoId,
      req.filialId
    );
    res.json({ responsaveis });
  } catch (err) {
    next(err);
  }
}

async function atualizarContaResponsavel(req, res, next) {
  try {
    const resultado = await responsaveisService.atualizarContaResponsavel(
      req.empresaId,
      req.params.alunoId,
      req.params.responsavelId,
      req.body,
      {
        filialId: req.filialId,
        usuarioId: req.usuario.usuario_id,
        ip: req.ip,
      }
    );
    res.json(resultado);
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
  registrarPushWeb,
  removerPushWeb,
  vincularAluno,
  vincularResponsavelAoAluno,
  listarResponsaveisDoAluno,
  listarResponsaveisDaEmpresa,
  atualizarResponsavelDaEmpresa,
  atualizarContaResponsavel,
  vincularNovoFilho,
  listarMeusPedidosVinculo,
  listarPedidosVinculo,
  listarNotificacoesVinculo,
  decidirPedidoVinculo,
  excluir,
};
