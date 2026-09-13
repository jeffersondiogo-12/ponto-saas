---
id: 2026-09-13
tipo: task-manutencao
tags: [projeto, git, mobile, realtime, merge]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Concluída"
prioridade: P0
---

# MOB-029 — Resolver conflito Git do realtime

## Problema

Após `git pull`, `mobile/src/realtime.js` ficou em conflito entre a origem WebSocket antiga e a nova configuração centralizada em `src/config/rede.js`. O pull também deixou `api.js` usando `BASE_URL` sem declaração.

## Resolução

- Preservada a configuração oficial de rede em `mobile/src/config/rede.js`.
- `realtime.js` passou a usar `criarUrlWebSocket(token)`.
- `api.js` passou a definir `BASE_URL` com `obterOrigemApi()`.
- Marcadores de conflito foram removidos.
- O arquivo conflitante foi marcado como resolvido no Git.

## Validação

- Diagnósticos sem erros em `api.js`, `realtime.js` e `config/rede.js`.
- `git diff --check` sem problemas.
- Nenhum arquivo não mesclado após a resolução.
- Nenhum commit foi criado.
