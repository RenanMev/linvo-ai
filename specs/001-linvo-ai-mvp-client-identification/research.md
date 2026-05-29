# Research: Linvo AI MVP - Identificacao de Cliente

## Decisions

### Monorepo TypeScript

**Decision**: Usar `pnpm` workspace com `apps/extension`, `apps/server` e `packages/shared`.

**Rationale**: O MVP precisa compartilhar contratos entre extensao e backend sem duplicacao. A separacao em tres projetos preserva simplicidade e permite evoluir UI, API e tipos de forma independente.

**Alternatives considered**:
- Repos separados: aumenta setup e friccao para o MVP.
- Extensao e backend no mesmo pacote: dificulta build MV3 e testes de API.
- Monorepo com app web desde o inicio: adiciona superficie fora do foco principal.

### Backend NestJS

**Decision**: Implementar `apps/server` com NestJS, Prisma e Postgres.

**Rationale**: O usuario escolheu NestJS completo. A estrutura de modulos, guards, pipes e testes ajuda a organizar auth, assist, IA e persistencia desde o primeiro corte.

**Alternatives considered**:
- Fastify puro: menor boilerplate, mas menos estrutura para crescer.
- Express: simples, mas menos opinativo para contratos e testes.
- Backend serverless: desnecessario para ambiente local e iteracao inicial.

### Chrome MV3 primeiro

**Decision**: Implementar apenas Chrome Manifest V3 no MVP.

**Rationale**: O produto e uma extensao Chrome e o foco e validar identificacao de cliente. MV3 exige background service worker e sidepanel, que sao as superficies principais do MVP.

**Alternatives considered**:
- Firefox junto: exigiria compatibilidade de APIs e build adicional.
- Web app isolado: nao acessa DOM/screenshot da pagina atendida.

### Selecao assistida antes da IA

**Decision**: O fluxo principal inicia com selecao manual do cliente base.

**Rationale**: CRMs genericos costumam ter listas, conversas, menus e historico na mesma tela. A selecao manual cria um sinal forte de foco e reduz erro de cliente ativo.

**Alternatives considered**:
- Deteccao automatica primeiro: mais magica, mas mais instavel em CRMs genericos.
- Selecionar multiplos clientes: aumenta escopo e complica persistencia.
- Cadastro manual completo: lento para o atendente e fora do MVP.

### Entradas da IA

**Decision**: Enviar texto selecionado, texto ao redor, resumo DOM, URL, titulo e screenshot opcional.

**Rationale**: O texto/DOM cobre dados estruturados; screenshot ajuda quando o CRM depende de layout visual, badges, destaque ativo ou componentes sem texto facil.

**Alternatives considered**:
- DOM sem screenshot: mais privado e barato, mas menos robusto em interfaces visuais.
- Screenshot apenas: perde estrutura textual e aumenta custo.
- HTML bruto completo: payload grande e risco maior de dados sensiveis.

### Chave de IA no servidor

**Decision**: Usar uma chave de IA unica do servidor em `.env`.

**Rationale**: Simplifica onboarding, remove tela de BYOK e centraliza controle operacional do MVP.

**Alternatives considered**:
- BYOK por usuario: adiciona criptografia, UI de settings e suporte.
- Chave no cliente/extensao: inseguro, pois a chave ficaria exposta.

### Auth email/senha

**Decision**: Implementar cadastro/login por email e senha com access token curto e refresh token persistente.

**Rationale**: Da separacao real por usuario sem depender de OAuth ou envio de email. E suficiente para MVP local e primeiros testes reais.

**Alternatives considered**:
- Sem auth: rapido, mas inseguro e impede isolamento por usuario.
- Magic link: exige servico de email.
- Google OAuth: bom no futuro, mas complexo para extensao e backend no primeiro corte.

### Persistencia backend-first

**Decision**: O backend e fonte de verdade para clientes, casos e historico de identificacoes.

**Rationale**: A extensao pode perder estado, trocar de maquina ou recarregar. O backend permite reconhecer clientes ao voltar depois.

**Alternatives considered**:
- Chrome storage apenas: rapido, mas fragil e local demais.
- Sem persistencia: nao atende reconhecimento posterior.

### Identidade canonica com hash

**Decision**: Identificadores sensiveis sao normalizados e salvos como hash; valores exibidos sao mascarados.

**Rationale**: Telefone, email e documento sao bons identificadores, mas nao devem ser persistidos em texto bruto sem necessidade.

**Alternatives considered**:
- Salvar tudo bruto: mais simples, mas pior para privacidade.
- Nao salvar identificadores: dificulta reuso de cliente/caso.

### Confianca minima para persistir

**Decision**: Persistir cliente/caso apenas quando `confidence >= IDENTIFICATION_CONFIDENCE_MIN`, com default `0.72`.

**Rationale**: O MVP precisa evitar criar registros errados. O limite por env permite ajuste sem alterar codigo.

**Alternatives considered**:
- Persistir qualquer resultado: contamina base rapidamente.
- Nunca persistir automaticamente: perde valor principal do MVP.

### Contratos Zod compartilhados

**Decision**: Definir schemas em `packages/shared` e reutilizar na extensao e servidor.

**Rationale**: Reduz divergencia de payload, melhora erros e facilita testes de contrato.

**Alternatives considered**:
- Tipos TypeScript sem runtime validation: nao protege fronteira HTTP.
- Schemas duplicados por pacote: tende a divergir.

## Open Questions

- None. As decisoes de produto relevantes para o MVP foram fixadas pelo plano aprovado.
