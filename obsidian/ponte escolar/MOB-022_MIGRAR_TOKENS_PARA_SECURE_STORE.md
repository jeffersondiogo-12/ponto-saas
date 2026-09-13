---
id: 2026-09-12
tipo: task-mobile
tags: [projeto, mobile, autenticacao, seguranca]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Concluída com testes de dispositivo pendentes"
prioridade: P0
relacionada: "[[TASKS_MOBILE_PONTO_SAAS]]"
---

# MOB-022 — Migrar tokens para Secure Store

## Problema

Os tokens de responsável e professor são persistidos em `AsyncStorage`, que não oferece o armazenamento seguro nativo do sistema operacional.

## Escopo

- Adicionar `expo-secure-store` compatível com Expo SDK 54.
- Persistir tokens dos perfis responsável e professor no Secure Store.
- Manter sessão não sensível e preferência no AsyncStorage.
- Migrar tokens antigos do AsyncStorage uma única vez.
- Remover a cópia antiga somente depois de gravar e validar o token seguro.
- Preservar tokens apenas em memória quando “Manter login salvo” estiver desmarcado.
- Limpar o Secure Store no logout.

## Arquivos prováveis

- `mobile/package.json`
- `mobile/package-lock.json`
- `mobile/src/api.js`
- `mobile/src/context/AuthContext.js`

## Critérios de aceite

- [x] token persistido é lido/escrito pelo Secure Store;
- [x] token legado é migrado uma única vez e removido após sucesso;
- [x] login sem persistência não grava token no armazenamento seguro;
- [x] logout remove o token seguro do perfil atual;
- [x] responsável e professor usam chaves seguras separadas;
- [x] falha no Secure Store não é tratada como login persistido com sucesso;
- [x] nenhum token aparece em logs ou mensagens;
- [x] diagnósticos dos módulos alterados passam;
- [ ] build/teste em dispositivo físico e testes automatizados.

## Dependências

- Expo SDK 54.
- Política existente de “Manter login salvo”.
- MOB-005 continua pendente para centralização completa de `401`.

## Validação

- Diagnóstico de `api.js` e `AuthContext.js`.
- Teste de migração com token legado.
- Teste de login persistido e não persistido.
- Teste de restauração após reinício.
- Teste de logout para os dois perfis.
- Build Expo/Android quando o ambiente nativo estiver disponível.

## Resultado

- A MOB-004 original foi substituída por esta task nova para respeitar a política de versionamento do backlog.
- A implementação não altera a política de notificações; o conteúdo visível permanece documentado na MOB-015 cancelada.
