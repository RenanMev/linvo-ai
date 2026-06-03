# Quickstart: Detalhe de Contato com IA

## Prerequisites

- Postgres local rodando.
- `.env` com `DATABASE_URL`, segredos de auth e `AI_API_KEY` ou `AI_CHAT_API_KEY`.
- Extension build carregada no Chrome.

## Validation Scenarios

1. Rode migracoes e gere Prisma Client.
2. Identifique ao menos dois clientes no mesmo dominio e um cliente em outro dominio.
3. Abra a sidepanel em um dominio com clientes.
4. Confirme que a lista mostra apenas contatos daquele dominio.
5. Marque estrela em um contato pelo detalhe e volte para a lista.
6. Confirme que o contato estrelado aparece primeiro.
7. Edite nome, identificadores, notas e favoritos; salve.
8. Confirme que a lista mostra os favoritos resolvidos.
9. Abra a aba `IA`, envie uma pergunta e observe streaming.
10. Reabra o contato e confirme que mensagens permanecem.
11. Limpe conversa e confirme historico vazio.

## Expected Results

- A lista nunca mostra formulario de edicao.
- Contatos de outro dominio nao aparecem.
- Favoritos sao limitados a 2 campos.
- Chat nao altera cadastro.
- Falha de IA aparece como erro isolado da aba `IA`.
