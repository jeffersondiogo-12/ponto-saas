---
id: 2026-09-12
tipo: task-mobile
tags: [projeto, mobile, testes, offline-first, seguranca]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Em Implementação"
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

- [ ] testes de cache isolam dois namespaces;
- [ ] cache expirado não é retornado;
- [ ] cache legado é removido sem migração silenciosa;
- [ ] filas de responsável e professor são independentes;
- [ ] listener recebe apenas eventos do próprio namespace;
- [ ] operações concorrentes preservam a ordem;
- [ ] fila legada não é atribuída a uma conta;
- [ ] comando `npm test` passa no mobile;
- [ ] MOB-002 e MOB-021 podem ser marcadas sem pendências de teste.

## Dependências

- MOB-002 e MOB-021 implementadas.
- Node/npm disponíveis no ambiente de desenvolvimento.

## Validação

- `npm test -- --runInBand` dentro de `mobile`.
- Diagnóstico dos arquivos de teste e configuração.
