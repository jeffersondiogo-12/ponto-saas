---
id: 2026-09-13
tipo: task-fullstack
tags: [projeto, mobile, backend, professor, aluno, autorizacao]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Backend concluído; tela mobile pendente"
prioridade: P1
relacionada: "[[TASKS_MOBILE_PONTO_SAAS]]"
---

# MOB-027 — Ficha do aluno para professor

## Problema

O professor abre a ficha compartilhada do aluno, mas o mobile chama rotas protegidas de responsável. Além disso, notas e observações não guardam o usuário autor, impedindo filtrar com segurança o conteúdo lançado pelo professor atual.

## Escopo backend

- Adicionar `criado_por_usuario_id` em `notas_alunos` e `observacoes_alunos`.
- Preencher autoria ao criar nota/observação pelo professor.
- Criar `GET /api/professores/turmas/:turmaId/alunos/:alunoId/ficha?atribuicao_id=...`.
- Autorizar somente professor atribuído à turma/atribuição e empresa/filial corretas.
- Retornar dados pessoais permitidos, foto facial mais recente, frequência facial, presença em sala, notas do professor atual, últimas cinco observações do professor atual e avisos destinados ao contexto escolar.

## Escopo mobile

- Criar serviço `api.fichaAlunoProfessor`.
- Criar tela própria ou modo próprio de ficha para professor.
- Não usar `/api/responsaveis/*` com token de professor.

## Critérios de aceite

- [x] filtro de professor/empresa/filial/atribuição está implementado;
- [x] notas novas recebem `criado_por_usuario_id`;
- [x] observações novas recebem `criado_por_usuario_id`;
- [x] endpoint retorna foto facial mais recente, frequência, presença, notas, observações e avisos;
- [x] serviço mobile `fichaAlunoProfessor` está disponível;
- [x] diagnósticos e sintaxe backend passam;
- [ ] migration aplica em banco vazio e existente;
- [ ] testes de autorização/integridade em banco;
- [ ] tela exclusiva do professor.

## Dependências

- Schema atual de `registros_ponto`, `notas_alunos`, `observacoes_alunos`, `avisos_escola` e `turma_professores`.
- Política de autorização `professor` e `atribuicao_id`.

## Validação

- Testes de autorização por empresa, filial, professor e atribuição.
- Testes de autoria de notas/observações.
- Teste de ficha sem foto, com foto e com múltiplas batidas.
- Teste de limite de cinco observações.
- Teste do endpoint com aluno fora da turma.
