---
id: 2026-09-12
tipo: task-mobile
tags: [projeto, mobile, expo, upgrade, dependencias]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Cancelada por decisão do usuário"
prioridade: P1
relacionada: "[[TASKS_MOBILE_PONTO_SAAS]]"
---

# MOB-024 — Atualizar Expo SDK 54 para 57

## Decisão

O projeto permanece no Expo SDK 54. Esta task não deve ser executada novamente sem nova autorização.

## Problema

O mobile está em Expo SDK 54, React Native 0.81 e React 19.1. O projeto precisa avançar para o SDK 57 e alinhar todas as dependências Expo, React Native, Jest Expo e configuração nativa.

## Escopo

- Atualizar `expo` para SDK 57.
- Alinhar React, React Native e pacotes Expo pelo `expo install --fix`.
- Atualizar `jest-expo` para a linha do SDK 57.
- Regenerar o lockfile sem alterar dependências não relacionadas sem justificativa.
- Executar Expo Doctor e testes/diagnósticos.
- Verificar plugins, `expo-secure-store`, notificações, updates e configuração EAS.
- Registrar incompatibilidades e ajustes nativos necessários.

## Arquivos prováveis

- `mobile/package.json`
- `mobile/package-lock.json`
- `mobile/app.json`
- `mobile/eas.json`
- `mobile/android/` quando a regeneração nativa for necessária

## Critérios de aceite

- [x] `expo` está na linha 57.
- [x] React Native e módulos Expo estão alinhados ao SDK 57 no manifesto e lockfile.
- [ ] `npx expo-doctor` não reporta incompatibilidades críticas.
- [ ] `npm test` usa o jest-expo compatível e executa quando as dependências estão instaladas.
- [x] plugin `expo-secure-store` continua configurado.
- [x] notificações e OTA mantêm configuração declarada válida.
- [x] build/configuração EAS permanece coerente no arquivo de configuração.
- [ ] mudanças e pendências estão registradas no segundo cérebro.

## Resultado

- `mobile/package.json` e `mobile/package-lock.json` foram sincronizados novamente com Expo SDK 54.
- O upgrade para SDK 57 foi cancelado em 2026-09-13.

## Dependências

- Node/npm com acesso ao registry.
- Compatibilidade dos pacotes de notificações, updates e secure store com SDK 57.
- Revisão do projeto nativo Android se o Expo Doctor solicitar.

## Validação

- `npx expo install --fix`.
- `npx expo-doctor`.
- `npm test -- --runInBand`.
- Diagnósticos dos arquivos alterados.
- `npx expo config --type public`.

## Estado atual

- `mobile/package.json` e `mobile/package-lock.json` foram alinhados para Expo SDK 57, React 19.2.3, React Native 0.86.3, `jest-expo ~57.0.5` e módulos Expo da linha 57.
- A instalação das dependências e a execução do Doctor/testes foram adiadas nesta sessão; portanto, não há validação de `node_modules`, build nativo ou compatibilidade em dispositivo.
- O SDK 57 exige Node.js `>=22.13.x`; o ambiente informado possui Node 24.16.0, compatível.
- O SDK 57 exige Android API 36 e iOS 16.4+ para builds nativos; a pasta Android deve ser regenerada/verificada antes de publicar uma nova build.
- O `runtimeVersion` permanece `1.0.0`; uma nova build nativa do SDK 57 não deve receber OTA destinada ao runtime antigo sem política de runtime compatível.
