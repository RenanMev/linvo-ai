# Feature Specification: Detalhe de Contato com IA

**Feature Branch**: `003-contact-detail-ai-chat`
**Created**: 2026-06-03
**Status**: Draft
**Input**: "Tela de listagem deve apenas listar contatos; clique abre tela dedicada do contato com edicao, favoritos e bate-papo com IA sobre o cliente."

## User Scenarios

### Scenario 1 - Listar contatos do dominio atual (Priority: P1)

Como atendente, quero ver uma lista enxuta dos contatos do site atual para encontrar rapidamente o cliente certo sem editar dados dentro da listagem.

**Acceptance Criteria**:
1. Given a sidepanel consegue ler a aba ativa, when o dominio atual tem contatos salvos, then a lista mostra apenas contatos daquele dominio.
2. Given um contato esta marcado com estrela, when a lista e carregada, then ele aparece antes dos contatos sem estrela.
3. Given digito na busca, when ha contatos carregados, then a lista filtra localmente por nome, favoritos e identificadores.
4. Given nao ha dominio ativo valido, when a tela abre, then a lista mostra um estado vazio pedindo para abrir um site/CRM.

### Scenario 2 - Abrir e editar detalhe do contato (Priority: P1)

Como atendente, quero abrir uma tela dedicada do contato para revisar e editar informacoes sem misturar isso com a listagem.

**Acceptance Criteria**:
1. Given clico em um contato, when o detalhe abre, then vejo nome, estrela, botao voltar, caneta de edicao e abas `Info` e `IA`.
2. Given clico na estrela, when a atualizacao termina, then o contato fica marcado/desmarcado e a lista reflete a nova ordenacao.
3. Given clico na caneta, when altero dados e salvo, then nome, identificadores, caso, notas e favoritos sao persistidos.
4. Given cancelo a edicao, when volto ao modo leitura, then alteracoes locais nao salvas sao descartadas.
5. Given apago um contato pelo detalhe, when confirmo, then o contato e removido e a UI volta para a lista.

### Scenario 3 - Escolher dados favoritos (Priority: P1)

Como atendente, quero escolher ate dois dados importantes do contato para que a lista e o detalhe destaquem o que importa em cada cliente.

**Acceptance Criteria**:
1. Given entro em modo edicao, when escolho campos favoritos, then posso selecionar ate 2 entre protocolo, telefone, email, documento, status do caso, assunto do caso, dominio e ultimo contato.
2. Given um campo favorito escolhido esta vazio, when a lista renderiza, then a UI usa fallback visual para completar ate 2 dados disponiveis.
3. Given um favorito usa dado de caso, when o cliente possui varios casos, then o caso mais recente e usado.

### Scenario 4 - Conversar com IA sobre o cliente (Priority: P1)

Como atendente, quero perguntar para a IA sobre o cliente aberto para recuperar contexto, preferencias e proximos passos sem alterar o cadastro automaticamente.

**Acceptance Criteria**:
1. Given abro a aba `IA`, when envio uma pergunta, then a resposta aparece por streaming.
2. Given a IA responde, when a resposta finaliza, then pergunta e resposta sao salvas no historico do cliente.
3. Given ha resumo duravel e mensagens recentes, when uma nova pergunta e enviada, then o backend inclui dados do contato, contexto do site, resumo e as ultimas 12 mensagens no prompt.
4. Given a conversa alcanca 10 mensagens completas desde o ultimo resumo, when uma resposta completa termina, then o resumo duravel e atualizado.
5. Given o usuario limpa a conversa, when confirma a acao, then mensagens e resumo do cliente sao apagados sem remover o cadastro.

## Requirements

### Functional Requirements

- **FR-001**: A sidepanel MUST detectar o dominio da aba ativa e carregar contatos usando esse dominio.
- **FR-002**: A lista MUST mostrar apenas nome, estrela e ate 2 dados favoritos resolvidos.
- **FR-003**: A lista MUST ordenar por `isStarred desc` e `lastSeenAt desc`.
- **FR-004**: A lista MUST oferecer busca client-side por nome, favoritos resolvidos, identificadores, dominio e caso recente.
- **FR-005**: O sistema MUST abrir uma tela dedicada de contato dentro da sidepanel ao clicar em um contato.
- **FR-006**: O detalhe MUST expor modo leitura e modo edicao com salvar/cancelar.
- **FR-007**: O backend MUST persistir `isStarred` e `favoriteFields` por contato.
- **FR-008**: `favoriteFields` MUST aceitar no maximo 2 campos validos e remover duplicatas.
- **FR-009**: O backend MUST expor detalhe por `GET /assist/customers/:customerId`.
- **FR-010**: O chat MUST ser isolado por usuario e contato.
- **FR-011**: O chat MUST persistir as ultimas 50 mensagens brutas e um resumo duravel por contato.
- **FR-012**: O backend MUST enviar streaming para a UI usando eventos SSE normalizados `start`, `delta`, `complete` e `error`.
- **FR-013**: A IA do chat MUST responder apenas; ela MUST NOT alterar cadastro no v1.
- **FR-014**: O usuario MUST poder limpar mensagens e resumo de IA de um contato.

### Non-Functional Requirements

- **NFR-001**: Falhas de chat MUST NOT impedir listagem, detalhe ou edicao do contato.
- **NFR-002**: Conversas MUST ser isoladas por usuario e removidas quando o contato for apagado.
- **NFR-003**: A sidepanel MUST manter texto dentro dos controles em viewport estreita.
- **NFR-004**: O chat MUST usar configuracao `AI_CHAT_*` com fallback para `AI_*`.

### Edge Cases

- Aba ativa sem URL HTTP/HTTPS valida.
- Dominio atual sem contatos salvos.
- Contato apagado enquanto detalhe ou chat esta aberto.
- Campo favorito duplicado ou fora da lista permitida.
- Streaming cai depois de resposta parcial.
- Provider de IA retorna chunk invalido ou finaliza sem conteudo.
- `AI_CHAT_*` incompleto e fallback geral ausente.

## Success Criteria

- **SC-001**: Em um dominio com contatos mistos, a lista mostra somente contatos daquele dominio.
- **SC-002**: Marcar estrela reordena a lista sem editar outros dados.
- **SC-003**: Editar e salvar um contato atualiza listagem, detalhe e banco.
- **SC-004**: O chat mostra deltas em tempo real e persiste o turno completo.
- **SC-005**: Limpar conversa faz o proximo carregamento do chat retornar historico vazio e resumo nulo.

## Out of Scope

- Criacao manual de contato.
- IA executando alteracoes no cadastro.
- Captura de texto da pagina atual a cada pergunta.
- Streaming por `chrome.runtime.sendMessage`.
- Historico ilimitado de mensagens.
