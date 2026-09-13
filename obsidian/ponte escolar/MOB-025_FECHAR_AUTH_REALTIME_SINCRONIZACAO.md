---
id: 2026-09-13
tipo: task-mobile
tags: [projeto, mobile, autenticacao, realtime, offline-first]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Concluída com testes de ambiente pendentes"
prioridade: P0
relacionada: "[[TASKS_MOBILE_PONTO_SAAS]]"
---

# MOB-025 — Fechar autenticação, realtime e sincronização

## Problema

Após as implementações anteriores, o fluxo de sessão/401 já possui parte da infraestrutura, mas o realtime ainda mantém fallback local próprio e o backlog conserva tasks antigas de sincronização e autenticação. O mobile precisa de uma única origem de rede e de um fluxo consistente para sessão inválida.

## Escopo

- Exportar configuração de origem HTTP/WS a partir de um único módulo.
- Corrigir fallback do WebSocket para produção.
- Manter sincronização manual usando a função pública correta.
- Confirmar que `401` pausa a fila e encerra somente a sessão correspondente.
- Remover duplicação desnecessária de logout nas telas sem quebrar mensagens de erro.
- Atualizar status das tasks substituídas/concluídas no segundo cérebro.

## Arquivos prováveis

- `mobile/src/api.js`
- `mobile/src/realtime.js`
- `mobile/src/context/AuthContext.js`
- `mobile/src/screens/SincronizacaoScreen.js`
- telas com tratamento local de `401`

## Critérios de aceite

- [x] HTTP e WebSocket usam a mesma origem configurada;
- [x] produção não cai no IP local quando a env não está embutida;
- [x] sincronização manual não acessa propriedade inexistente de `api`;
- [x] `401` pausa fila e remove apenas a sessão atual;
- [x] falha de rede mantém sessão offline quando há sessão/cache válido;
- [x] diagnósticos dos módulos passam;
- [x] MOB-005, MOB-006 e MOB-007 ficam documentadas como resolvidas ou substituídas;
- [ ] testes de ambiente/runner e reconexão em dispositivo.

## Validação

- Diagnósticos dos arquivos alterados.
- Teste de URL em development e production.
- Teste de 401 e falha de rede na restauração.
- Teste do botão de sincronização manual.
- Teste de reconexão WebSocket.
