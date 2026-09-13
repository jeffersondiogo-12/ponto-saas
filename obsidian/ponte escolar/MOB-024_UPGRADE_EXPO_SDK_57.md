---
id: 2026-09-12
tipo: task-mobile
tags: [projeto, mobile, expo, upgrade, dependencias]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Em Implementação"
prioridade: P1
relacionada: "[[TASKS_MOBILE_PONTO_SAAS]]"
---

# MOB-024 — Atualizar Expo SDK 54 para 57

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

- [ ] `expo` está na linha 57.
- [ ] React Native e módulos Expo estão alinhados ao SDK 57.
- [ ] `npx expo-doctor` não reporta incompatibilidades críticas.
- [ ] `npm test` usa o jest-expo compatível e executa quando as dependências estão instaladas.
- [ ] plugin `expo-secure-store` continua configurado.
- [ ] notificações e OTA mantêm configuração válida.
- [ ] build/configuração EAS permanece coerente.
- [ ] mudanças e pendências estão registradas no segundo cérebro.

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
