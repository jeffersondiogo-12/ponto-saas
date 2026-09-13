---
id: 2026-09-12
tipo: task-mobile
tags: [projeto, mobile, testes, offline-first, seguranca]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Preparada; execução bloqueada por dependência ausente"
prioridade: P0
relacionada: "[[TASKS_MOBILE_PONTO_SAAS]]"
---

# MOB-023 — Testes de isolamento do cache e da fila

## Problema

As MOB-002 e MOB-021 foram implementadas, mas os critérios de isolamento entre contas, TTL, fila legada e concorrência ainda não possuem cobertura automatizada.

## Escopo

- Configurar runner de testes no mobile.
- Testar cache por namespace, TTL, limpeza e remoção de legado.
- Testar fila por namespace, listeners, ordem de operações e fila legada bloqueada.
- Testar que perfis diferentes não compartilham dados.
- Registrar comando reproduzível no `package.json`.

## Arquivos prováveis

- `mobile/package.json`
- `mobile/jest.config.js`
- `mobile/__tests__/storage.test.js`
- `mobile/__tests__/filaOffline.test.js`
- `mobile/__tests__/__mocks__/@react-native-async-storage/async-storage.js`

## Critérios de aceite

- [x] testes de cache isolam dois namespaces;
- [x] cache expirado não é retornado;
- [x] cache legado é removido sem migração silenciosa;
- [x] filas de responsável e professor são independentes;
- [x] listener recebe apenas eventos do próprio namespace;
- [x] operações concorrentes preservam a ordem;
- [x] fila legada não é atribuída a uma conta;
- [ ] comando `npm test` passa no mobile;
- [ ] MOB-002 e MOB-021 podem ser marcadas sem pendências de teste.

## Dependências

- MOB-002 e MOB-021 implementadas.
- Node/npm disponíveis no ambiente de desenvolvimento.

## Validação

- `npm test -- --runInBand` dentro de `mobile`.
- Diagnóstico dos arquivos de teste e configuração.

## Bloqueio atual

- `jest-expo ~54.0.12` está declarado em `package.json` e `package-lock.json`, mas não foi encontrado em `mobile/node_modules`.
- `npm test` iniciou o script, porém não produziu resultado do runner.
- Não marcar MOB-002/MOB-021 como totalmente concluídas até executar a suíte em ambiente com dependências instaladas.
