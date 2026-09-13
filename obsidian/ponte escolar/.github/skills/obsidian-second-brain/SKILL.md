---
name: obsidian-second-brain
description: "Use when the user asks to consult, connect, summarize, organize, update, or create notes in the Obsidian vault as a second brain. Read only targeted Markdown files, preserve Obsidian links, and minimize context usage."
---

# Obsidian Second Brain

Use this skill to work with the Obsidian vault as a searchable, low-token knowledge base.

## Operating Rules

1. Treat the current workspace root as the vault root.
2. Do not scan or load the entire vault unless the user explicitly requests a full inventory.
3. Start with the smallest useful context:
   - the note currently open;
   - a named note supplied by the user;
   - a small index/MOC note, if one exists;
   - filenames and frontmatter only when discovery is needed.
4. Read the full content of a note only when it is directly relevant to the request.
5. If the requested knowledge is not identifiable from the current note, ask the user to name a note or provide a targeted file reference such as `#file:Nome da Nota.md`.
6. Never invent a note, link target, tag, folder, fact, or relationship. Mark unknown information as `Não encontrado no vault`.
7. Preserve existing note content, frontmatter, headings, tags, links, and language unless the user explicitly requests a rewrite.
8. Prefer Obsidian wikilinks such as `[[Nome da Nota]]`; use a heading anchor only when the target heading is known, for example `[[Nome da Nota#Decisão]]`.
9. Keep answers concise. Return only the requested result, decisions, links, and unresolved questions.
10. Never expose secrets, credentials, personal data, or full unrelated notes in the response.
11. Record every substantive update in the vault, not only when the user explicitly asks for a note.
12. For short updates, append a dated entry to `REGISTRO DE ATUALIZACOES PONTO SAAS.md`; for substantial topics, create or update a dedicated note and link it from the register.
13. After recording an update, report the changed note path and the topic recorded.
14. Every code change in the mobile project must have a new `MOB-xxx` task before implementation; never reuse or reopen a completed task.
15. A new code task must include problem, scope, likely files, acceptance criteria, dependencies, and validation.

## Token-Efficient Workflow

### Discovery

- If the user names a note, open only that note.
- If the user names a topic without a note, search filenames first, then search exact topic terms in Markdown files.
- If an index/MOC exists, read its headings and links before opening linked notes.
- Do not recursively read every linked note. Follow links one hop at a time and only when needed.

### Synthesis

When combining notes:

- cite the source with an Obsidian link;
- separate facts, decisions, assumptions, and open questions;
- deduplicate repeated content;
- prefer a compact table or bullets over reproducing source text;
- preserve the user's terminology and existing note names.

### Note Creation

Before creating a note:

- check whether a note with the same or similar name already exists;
- propose the target path when the folder is ambiguous;
- use concise YAML frontmatter only when the vault already uses frontmatter or the user asks for it;
- add links to relevant existing notes, never placeholder links without a reason;
- do not create a new MOC or folder unless requested or clearly required.

### Note Updates

Before editing an existing note:

- read the relevant section and its nearby headings;
- make the smallest focused change;
- preserve unrelated user changes;
- do not replace the entire note for a local update;
- report the note path and the section changed.

### Mandatory Update Register

Every substantive response that changes project knowledge must leave a compact record in the vault:

- date;
- type: analysis, decision, task, implementation, validation, or pending item;
- concise summary;
- affected area or files when known;
- links to related notes;
- unresolved assumptions, if any.

For mobile code changes, also require a new task ID in `TASKS_MOBILE_PONTO_SAAS.md`. Link related tasks instead of modifying the identity of a completed task.

Do not copy the entire conversation into the register. Store the durable knowledge only.

## Response Formats

For a short answer:

- **Resposta:** one concise paragraph or up to five bullets.
- **Fontes:** `[[Nota 1]]`, `[[Nota 2]]`.
- **Não encontrado:** only if relevant.

For a synthesis:

```markdown
## Síntese
- Fato: ... [[Nota A]]
- Decisão: ... [[Nota B]]
- Relação: ... [[Nota A]] e [[Nota B]]

## Lacunas
- Não encontrado no vault: ...
```

For a new or updated note, return:

- path of the note;
- one-line purpose;
- links created or preserved;
- unresolved assumptions.

## Vault-Specific Context

The current vault is named `ponte escolar`. Existing notes include:

- `Bem-vindo.md`
- `crie um link.md`
- `RELATORIO_TECNICO_ARQUITETURA_PONTO_SAAS.md`

The vault currently does not establish `00_Inbox`, `10_Projetos`, `20_Areas`, `30_Recursos`, or `40_Arquivo`. Do not assume those folders exist. If the user adopts them later, use them only after verifying their presence.
