const bcrypt = require('bcrypt');

exports.seed = async function (knex) {
  await knex('afd_exports').del();
  await knex('banco_horas_lancamentos').del();
  await knex('apontamentos_diarios').del();
  await knex('registros_ponto').del();
  await knex('funcionario_dispositivos').del();
  await knex('dispositivos').del();
  await knex('funcionarios').del();
  await knex('horarios_trabalho').del();
  await knex('departamentos').del();
  await knex('filiais').del();
  await knex('usuarios').del();
  await knex('empresas').del();

  const [empresa] = await knex('empresas')
    .insert({
      razao_social: 'WELD INOX SOLDAS E ABRASIVOS LTDA',
      nome_fantasia: 'Weld Inox',
      cnpj: '12.345.678/0001-90',
      email: 'contato@weldinox.example.com',
      plano: 'basico',
    })
    .returning('*');

  const senha_hash = await bcrypt.hash('admin123', 12);
  await knex('usuarios').insert({
    empresa_id: empresa.id,
    nome: 'Administrador',
    email: 'admin@weldinox.example.com',
    senha_hash,
    papel: 'admin',
  });

  const [horario] = await knex('horarios_trabalho')
    .insert({
      empresa_id: empresa.id,
      nome: 'Comercial 8h',
      tipo: 'fixo_semanal',
      tolerancia_minutos: 10,
      carga_horaria_semanal_minutos: 2640,
      banco_horas_tipo_acordo: 'individual_escrito',
      banco_horas_prazo_compensacao_dias: 180,
      config_semana: {
        1: { entrada: '08:00', saida: '18:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
        2: { entrada: '08:00', saida: '18:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
        3: { entrada: '08:00', saida: '18:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
        4: { entrada: '08:00', saida: '18:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
        5: { entrada: '08:00', saida: '17:00', intervalos: [{ inicio: '12:00', fim: '13:00' }] },
      },
    })
    .returning('*');

  await knex('funcionarios').insert({
    empresa_id: empresa.id,
    horario_trabalho_id: horario.id,
    matricula: '0001',
    nome: 'Funcionário Exemplo',
    cpf: '000.000.000-00',
    cargo: 'Soldador',
    data_admissao: '2024-01-15',
  });

  // O mesmo equipamento mostrado no print original, ja cadastrado.
  await knex('dispositivos').insert({
    empresa_id: empresa.id,
    descricao: 'facial',
    modelo: 'Facial AI 5',
    tipo_biometria: 'facial',
    situacao: 'ativo',
    fuso_horario: 'America/Sao_Paulo',
    enviar_comprovante_email: false,
    modo_conexao: 'client',
    ip: '192.168.0.206',
    porta: 7788,
    nao_validar_empresa: false,
    numero_serie: 'AYTE16052577',
    mac_address: '00:01:A9:1B:96:8D',
    ultimo_nsr: 20260717,
    usuario_dispositivo: 'admin',
    // Senha de exemplo cifrada em runtime exigiria a chave do .env; em dev,
    // deixe null aqui e cadastre a senha pela tela apos configurar o .env.
    senha_dispositivo_cifrada: null,
    identificador_equipamento: null,
    protocolo: 'desconhecido',
  });

  // eslint-disable-next-line no-console
  console.log('Seed aplicado. Login: admin@weldinox.example.com / admin123');
};
