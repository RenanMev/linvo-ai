# Feature Specification: Linvo AI MVP - Identificacao de Cliente

**Feature Branch**: `001-linvo-ai-mvp-client-identification`
**Created**: 2026-05-21
**Status**: Draft
**Input**: "Recriar o projeto do zero em uma nova pasta chamada linvo ai, com boa base de pastas para extensao, server e background, focando o MVP na identificacao do cliente que estou atendendo."

## User Scenarios

### Scenario 1 - Entrar no Linvo AI pela extensao (Priority: P1)

Como atendente, quero entrar na extensao com email e senha para que meus clientes/casos fiquem vinculados ao meu usuario.

**Acceptance Criteria**:
1. Given a extensao esta instalada e a sidepanel esta aberta, when informo email e senha validos, then a sidepanel autentica o usuario e mostra a tela operacional.
2. Given a sessao anterior ainda esta valida, when abro a sidepanel novamente, then o Linvo AI restaura a sessao sem pedir login.
3. Given a sessao expirou, when tento identificar um cliente, then a extensao bloqueia a acao e mostra que preciso entrar novamente.

### Scenario 2 - Selecionar o cliente base em um CRM generico (Priority: P1)

Como atendente, quero clicar em "Identificar cliente" e apontar a conversa, card ou cabecalho do cliente que estou atendendo para reduzir confusao em telas com muitos contatos.

**Acceptance Criteria**:
1. Given estou em uma pagina com varios contatos visiveis, when clico em "Identificar cliente", then a pagina entra em modo de selecao assistida com overlay temporario.
2. Given o modo de selecao esta ativo, when passo o mouse sobre uma area da pagina, then o elemento sob o ponteiro recebe destaque visual.
3. Given seleciono uma area com texto util, when confirmo o clique, then a extensao captura a selecao e envia uma requisicao de identificacao.
4. Given o modo de selecao esta ativo, when pressiono `Escape`, then a selecao e cancelada e nenhuma requisicao e enviada.

### Scenario 3 - Identificar cliente/caso com IA (Priority: P1)

Como atendente, quero que a IA identifique nome, protocolo, assunto, historico visivel e proxima acao segura do atendimento ativo.

**Acceptance Criteria**:
1. Given selecionei o cliente base, when a requisicao chega ao backend, then a IA recebe texto selecionado, contexto ao redor, resumo DOM, URL, titulo da pagina e screenshot opcional.
2. Given o nome ou protocolo nao esta verificavel, when a IA responde, then o campo ausente fica vazio ou o resultado inclui aviso de incerteza.
3. Given a tela contem lista lateral e conversa ativa, when a selecao aponta para a conversa ativa, then somente esse cliente deve ser marcado como ativo.

### Scenario 4 - Persistir e reutilizar cliente/caso (Priority: P1)

Como atendente, quero que o Linvo AI reconheca clientes e casos ja vistos quando eu voltar ao atendimento.

**Acceptance Criteria**:
1. Given um cliente/caso foi identificado com confianca suficiente, when a resposta e confirmada pelo backend, then o cliente/caso e salvo no banco.
2. Given identifico novamente o mesmo cliente/caso no mesmo dominio, when o backend resolve a identidade canonica, then ele reutiliza o registro existente.
3. Given outro usuario identifica o mesmo cliente, when os dados sao salvos, then os registros ficam isolados por usuario.

### Scenario 5 - Mostrar resultado operacional na sidepanel (Priority: P1)

Como atendente, quero ver rapidamente quem e o cliente atual e quais dados foram encontrados.

**Acceptance Criteria**:
1. Given a identificacao concluiu com sucesso, when a sidepanel recebe o resultado, then ela mostra cliente ativo, caso/protocolo, assunto, confianca, evidencias e avisos.
2. Given clientes/casos ja foram salvos para o dominio atual, when abro a sidepanel nesse dominio, then ela lista os atendimentos recentes.
3. Given a identificacao falha por rede, auth ou IA, when a resposta de erro chega, then a pagina mostra toast curto e a sidepanel preserva o estado anterior.

### Scenario 6 - Evitar persistencia insegura (Priority: P1)

Como dono da operacao, quero que o MVP nao salve dados sensiveis de forma desnecessaria.

**Acceptance Criteria**:
1. Given a requisicao inclui screenshot, when o backend processa a identificacao, then a screenshot nao e persistida.
2. Given telefone, email ou documento aparecem como identificador, when o backend salva identidade, then usa hash canonico e exibe valor mascarado.
3. Given a confianca fica abaixo do limite minimo, when o backend responde, then nenhum cliente/caso definitivo e criado.

## Requirements

### Functional Requirements

- **FR-001**: O sistema MUST criar a nova base na pasta `linvo ai`, sem mover nem sobrescrever o projeto antigo.
- **FR-002**: O workspace MUST ser um monorepo TypeScript com `apps/extension`, `apps/server` e `packages/shared`.
- **FR-003**: A extensao MUST usar Chrome Manifest V3 com `background` service worker, `content script` e `sidepanel`.
- **FR-004**: A sidepanel MUST permitir cadastro, login, restauracao de sessao e logout.
- **FR-005**: O backend MUST emitir access token curto e refresh token persistente para login email/senha.
- **FR-006**: O refresh token MUST ser salvo no backend somente como hash.
- **FR-007**: O content script MUST renderizar uma acao "Identificar cliente" acessivel a partir da pagina.
- **FR-008**: A acao "Identificar cliente" MUST iniciar o modo de selecao assistida antes de enviar payload para a IA.
- **FR-009**: O modo de selecao assistida MUST destacar o elemento sob o ponteiro e aceitar clique em conversa, card, linha, cabecalho ou container textual.
- **FR-010**: O modo de selecao assistida MUST cancelar com `Escape`, perda de contexto da extensao ou clique em elemento da propria extensao.
- **FR-011**: A extensao MUST rejeitar selecoes vazias, genericas ou com menos de texto minimo util antes de chamar o backend.
- **FR-012**: A captura MUST incluir `url`, `pageTitle`, `selectedText`, `surroundingText`, `domSummary`, `manualSelection`, `capturedAt` e screenshot quando permissao/runtime permitir.
- **FR-013**: A captura MUST limitar tamanho de texto e imagem antes de envio.
- **FR-014**: O background MUST anexar access token valido e chamar o backend em nome da sidepanel/content script.
- **FR-015**: O backend MUST expor `POST /assist/client-identification`.
- **FR-016**: O backend MUST validar request/response com contratos compartilhados em Zod.
- **FR-017**: O backend MUST usar chave de IA do servidor configurada por variavel de ambiente.
- **FR-018**: O prompt de IA MUST priorizar a selecao manual sobre listas laterais, navegacao e contatos de fundo.
- **FR-019**: A IA MUST retornar JSON parseavel com cliente ativo, caso, confianca, evidencias e avisos.
- **FR-020**: O backend MUST tratar resposta invalida da IA como erro estruturado.
- **FR-021**: O backend MUST persistir cliente/caso somente quando a confianca final for maior ou igual ao limite configurado.
- **FR-022**: O backend MUST reutilizar cliente/caso por `userId`, `domain` e chave canonica de identidade/caso.
- **FR-023**: O backend MUST expor `GET /assist/customers?domain=` para listar clientes/casos recentes do dominio atual.
- **FR-024**: A sidepanel MUST mostrar resultado atual, avisos, evidencias e lista recente do dominio.
- **FR-025**: A pagina MUST mostrar toast para estados `selecionando`, `identificando`, `identificado`, `cancelado` e `erro`.

### Non-Functional Requirements

- **NFR-001**: O MVP MUST manter no maximo tres projetos principais: extension, server e shared.
- **NFR-002**: Screenshots MUST NOT ser persistidas em banco, logs ou historico de identificacao.
- **NFR-003**: Logs MUST registrar `requestId`, usuario e status, mas nao texto bruto sensivel nem screenshot.
- **NFR-004**: Email, telefone e documento MUST ser mascarados na exibicao quando usados como identificadores.
- **NFR-005**: Senhas MUST ser armazenadas somente como hash forte.
- **NFR-006**: O overlay da extensao MUST nao modificar DOM do CRM fora do container controlado pelo Linvo AI.
- **NFR-007**: O modo de selecao MUST ser cancelavel por teclado e nao prender permanentemente foco/click da pagina.
- **NFR-008**: As respostas de erro da API MUST usar formato estruturado e mensagens em pt-BR.
- **NFR-009**: O fluxo de identificacao MUST concluir em ate 15 segundos em condicoes normais de rede/IA.
- **NFR-010**: Testes de contrato, backend e e2e MUST existir antes do fechamento do MVP.

### Edge Cases

- A tela mostra varios contatos e nenhum elemento visualmente ativo.
- O atendente seleciona uma linha de lista lateral, nao a conversa aberta.
- O elemento selecionado contem mais de um cliente.
- O elemento selecionado contem somente botoes, icones ou labels genericos.
- O CRM usa shadow DOM, iframe ou layout virtualizado.
- A permissao de screenshot falha ou a aba nao permite captura.
- O access token expira durante a identificacao.
- O refresh token foi revogado em outro dispositivo.
- A IA retorna JSON invalido, campos inventados ou confianca baixa.
- O mesmo cliente aparece com telefone formatado de formas diferentes.
- Dois clientes diferentes compartilham o mesmo nome, mas protocolos diferentes.
- O backend esta fora do ar e a sidepanel possui estado anterior em cache.

## Success Criteria

- **SC-001**: Em pagina fake com dois contatos, selecionar "Cliente A" identifica e salva apenas "Cliente A".
- **SC-002**: Repetir a identificacao do mesmo cliente/caso no mesmo dominio reutiliza os registros existentes.
- **SC-003**: Identificacao com confianca baixa retorna aviso e nao cria `Customer` nem `CustomerCase`.
- **SC-004**: Login, refresh, identificacao e listagem de clientes recentes passam em testes automatizados.
- **SC-005**: Nenhum teste ou log persiste screenshot recebida no payload.
- **SC-006**: Sidepanel e toast mostram estados claros para sucesso, cancelamento, auth expirada e falha de IA.

## Out of Scope

- Dashboard web separado.
- Firefox ou Safari.
- OAuth/Google login.
- Magic link por email.
- BYOK por usuario.
- Chat de atendimento.
- Automacao de resposta ao cliente.
- Edicao manual completa de cadastro.
- Sincronizacao com CRM externo.
- Persistencia de screenshot ou replay visual da pagina.

## Review Checklist

- [x] No `[NEEDS CLARIFICATION]` markers remain.
- [x] Requirements are testable and unambiguous.
- [x] Success criteria are measurable.
- [x] Implementation details appear only where they are intentional constraints.
- [x] No speculative features are included.
