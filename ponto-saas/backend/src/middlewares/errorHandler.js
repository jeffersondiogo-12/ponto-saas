/* eslint-disable no-unused-vars */

/**
 * Erro de aplicacao com status HTTP explicito, para os services lancarem
 * erros de negocio (ex: "CPF ja cadastrado") sem acoplar a camada HTTP.
 */
class AppError extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[erro]', err);
  }

  const mensagem = status >= 500 ? 'Erro interno. Tente novamente.' : err.message;
  return res.status(status).json({ erro: mensagem });
}

module.exports = { errorHandler, AppError };
