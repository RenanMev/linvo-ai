# Feature Specification: Contexto Operacional do Site Para o Agente

**Feature Branch**: `002-agent-site-context`
**Created**: 2026-06-03
**Status**: Draft
**Input**: "Salvar, por usuario e dominio, um contexto operacional do site/CRM para o agente quando o primeiro cliente confirmado for identificado."

## User Scenarios

### Scenario 1 - Criar contexto no primeiro cliente confirmado (Priority: P1)

Como atendente, quero que o Linvo AI entenda a estrutura do site onde estou atendendo para que o agente saiba onde procurar cliente ativo, lista de contatos, chat aberto e navegacao.

**Acceptance Criteria**:
1. Given identifico um cliente com confirmacao suficiente no dominio `painel.nvoip.com.br`, when o backend finaliza a identificacao, then o sistema salva um contexto operacional unico para meu usuario e dominio.
2. Given a identificacao fica com baixa confianca, when a resposta retorna para a extensao, then nenhum contexto operacional e salvo.
3. Given a geracao de contexto falha, when a identificacao do cliente e valida, then a identificacao continua bem-sucedida e a resposta marca o contexto como indisponivel.

### Scenario 2 - Reutilizar contexto nos fluxos do agente (Priority: P1)

Como agente Linvo AI, quero receber o mapa operacional salvo do dominio para interpretar telas futuras com menos ambiguidade.

**Acceptance Criteria**:
1. Given existe contexto salvo para o dominio atual, when uma nova identificacao de cliente e solicitada, then o prompt inclui o resumo do contexto salvo.
2. Given existe contexto salvo para o dominio atual, when o fluxo de abrir informacoes do cliente roda, then o prompt tambem recebe esse contexto.
3. Given o contexto foi removido, when um fluxo assist roda no dominio, then nenhum contexto antigo e usado.

### Scenario 3 - Mostrar e remover contexto na sidepanel (Priority: P2)

Como atendente, quero ver o resumo do contexto apenas quando eu pedir para conferir, sem ocupar a sidepanel o tempo todo.

**Acceptance Criteria**:
1. Given existe contexto salvo, when a sidepanel mostra a tela principal, then aparece um botao de icone discreto para abrir o resumo.
2. Given clico no icone de contexto, when o painel expande, then vejo resumo, regioes, regras de foco e regras de ignorar.
3. Given removo o contexto, when confirmo a acao, then o resumo desaparece e pode ser recriado em uma proxima identificacao confirmada.

## Requirements

### Functional Requirements

- **FR-001**: O sistema MUST persistir `SiteAgentContext` por `userId + domain`.
- **FR-002**: O contexto MUST conter `summary`, `regions`, `focusRules`, `ignoreRules`, `confidence`, `sourceRequestId`, `createdAt` e `updatedAt`.
- **FR-003**: `regions` MUST aceitar regioes como `main_sidebar`, `contact_list`, `active_chat`, `header` e `action_bar` quando detectadas.
- **FR-004**: O contexto MUST ser criado apenas apos identificacao confirmada automaticamente ou aceita manualmente.
- **FR-005**: O contexto MUST NOT ser criado para identificacoes de baixa confianca.
- **FR-006**: O backend MUST usar DOM/texto e screenshot temporaria quando disponivel para gerar contexto, mas MUST NOT persistir screenshot.
- **FR-007**: O contexto salvo MUST redigir ou mascarar exemplos sensiveis.
- **FR-008**: O backend MUST retornar `siteContextStatus` e `siteContext` em respostas de identificacao.
- **FR-009**: O backend MUST expor `GET /assist/site-context?domain=` para carregar o contexto atual.
- **FR-010**: O backend MUST expor `POST /assist/site-context/delete` para remover o contexto do dominio.
- **FR-011**: Prompts de identificacao e abrir informacoes do cliente MUST receber o contexto salvo quando existir.
- **FR-012**: A sidepanel MUST mostrar o contexto atras de um botao de icone discreto e MUST permitir remover o contexto.

### Non-Functional Requirements

- **NFR-001**: Falha na geracao ou atualizacao de contexto MUST NOT impedir a identificacao de cliente.
- **NFR-002**: Screenshots MUST NOT ser persistidas em banco, logs ou historico de contexto.
- **NFR-003**: O contexto MUST ser isolado por usuario.
- **NFR-004**: O resumo MUST ser em pt-BR.

### Edge Cases

- O dominio ainda nao tem clientes salvos.
- O usuario rejeita uma identificacao pendente.
- O usuario remove o contexto e identifica outro cliente no mesmo dominio.
- A tela contem lista lateral com varios contatos e chat ativo separado.
- A IA retorna contexto fora do contrato ou indisponivel.

## Success Criteria

- **SC-001**: Em fixture estilo Nvoip, o contexto menciona sidebar esquerda, lista interna de contatos, chat ativo, header e regra de foco no atendimento aberto.
- **SC-002**: Baixa confianca nao cria contexto.
- **SC-003**: Remover contexto pela sidepanel faz o backend retornar `siteContext: null`.
- **SC-004**: Prompts de fluxos assist incluem o contexto salvo para o dominio.

## Out of Scope

- Edicao manual do contexto.
- Historico completo de versoes.
- Persistencia de screenshot ou replay visual.
- Hardcode especifico da Nvoip.
