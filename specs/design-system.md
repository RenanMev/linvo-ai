# Linvo AI Design System

Fonte visual atual: `apps/extension/src/sidepanel/design-system-preview.html`.

Este documento e a referencia textual do design system do Linvo AI. Ele deve ser usado por humanos e por modelos/agents ao criar, revisar ou alterar qualquer superficie do projeto: sidepanel, auth, overlays/content UI, componentes da extensao e telas futuras.

## Identidade Visual

O Linvo AI usa uma interface dark minimal, operacional e precisa. A base neutra e zinc; a cor do sistema e rose `#e11d48`. O visual deve parecer uma ferramenta de atendimento com IA: denso o suficiente para uso repetido, limpo o suficiente para leitura rapida, e com destaque visual apenas onde existe estado ativo ou acao principal.

Principios obrigatorios:

- Dark UI como padrao.
- Zinc como escala neutra para fundo, superficies, cards, inputs e texto.
- `#e11d48` como cor principal do sistema, usada em CTAs, foco, estado ativo, brand badges, progresso principal e highlights.
- Bordas suaves, sombras discretas e glow rose apenas para reforcar foco ou hierarquia.
- Componentes compactos, com radius moderado e tipografia pequena/legivel.
- Nada de reinventar paleta, gradientes ou estilo sem pedido explicito.

## Tokens

### Brand Rose

```css
--brand-50:  #fff1f2;
--brand-100: #ffe4e6;
--brand-200: #fecdd3;
--brand-300: #fda4af;
--brand-400: #fb7185;
--brand-500: #e11d48;
--brand-600: #be123c;
--brand-700: #9f1239;
--brand-glow: rgba(225, 29, 72, 0.22);
--brand-glow-strong: rgba(225, 29, 72, 0.45);
```

Uso:

- `--brand-500` e a cor do sistema.
- `--brand-600` e hover/pressed de acao primaria.
- `--brand-400` e texto de destaque, autores IA e detalhes brand.
- `--brand-300` e badges/chips ativos em fundo translucido.
- `--brand-glow` e `--brand-glow-strong` devem ser usados com moderacao em foco, hero e elementos ativos.

### Zinc Neutrals

```css
--neutral-0:   #ffffff;
--neutral-50:  #fafafa;
--neutral-100: #f4f4f5;
--neutral-200: #e4e4e7;
--neutral-300: #d4d4d8;
--neutral-400: #a1a1aa;
--neutral-500: #71717a;
--neutral-600: #52525b;
--neutral-700: #3f3f46;
--neutral-750: #34343a;
--neutral-800: #27272a;
--neutral-850: #1f1f23;
--neutral-900: #18181b;
--neutral-950: #09090b;
```

Uso:

- `--neutral-950` para canvas/base.
- `--neutral-900` para superficies principais.
- `--neutral-850` para superficies elevadas.
- `--neutral-800` para cards e inputs.
- `--neutral-750` para hover.
- `--neutral-400` e `--neutral-500` para texto secundario e muted.

### Semantic Tokens

```css
--bg-base:        var(--neutral-950);
--bg-surface:     var(--neutral-900);
--bg-elevated:    var(--neutral-850);
--bg-card:        var(--neutral-800);
--bg-input:       var(--neutral-800);
--bg-hover:       var(--neutral-750);

--border-subtle:  rgba(255,255,255,0.06);
--border-default: rgba(255,255,255,0.10);
--border-strong:  rgba(255,255,255,0.18);
--border-brand:   rgba(225,29,72,0.50);

--text-primary:   #f4f4f5;
--text-secondary: #a1a1aa;
--text-muted:     #71717a;
--text-brand:     var(--brand-400);
--text-on-brand:  #ffffff;

--status-success: #34d399;
--status-warning: #fbbf24;
--status-error:   #f87171;
--status-info:    var(--brand-400);
```

### Radius, Spacing, Type And Shadows

```css
--radius-xs:  4px;
--radius-sm:  6px;
--radius-md:  10px;
--radius-lg:  14px;
--radius-xl:  20px;
--radius-2xl: 28px;
--radius-full: 9999px;

--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

--text-xs:   11px;
--text-sm:   13px;
--text-base: 14px;
--text-md:   15px;
--text-lg:   17px;
--text-xl:   20px;
--text-2xl:  24px;
--text-3xl:  30px;
--text-4xl:  38px;

--shadow-xs:  0 1px 2px rgba(0,0,0,0.4);
--shadow-sm:  0 2px 6px rgba(0,0,0,0.5);
--shadow-md:  0 4px 16px rgba(0,0,0,0.6);
--shadow-lg:  0 8px 32px rgba(0,0,0,0.7);
--shadow-brand: 0 0 0 1px var(--border-brand), 0 0 20px var(--brand-glow);
--shadow-brand-strong: 0 0 0 1px var(--border-brand), 0 0 32px var(--brand-glow-strong);
```

Tipografia:

- Sans: `Merriweather`, fallback `Georgia`, serif.
- Mono: `Geist Mono`, fallback monospace.
- Interface padrao em `13px` ou `14px`.
- Headings internos devem ser compactos; use display grande apenas em hero/spec previews.

## Componentes Base

### Buttons

- Primary: `--brand-500`, texto branco, borda `--brand-600`, hover `--brand-600`.
- Secondary: `--bg-card`, texto primario, borda default.
- Ghost: transparente, texto secundario, hover com `--bg-hover`.
- Destructive: fundo vermelho translucido, texto `--status-error`.
- Icon buttons devem manter dimensoes fixas e radius `--radius-md`.

### Badges And Chips

- Badge/chip ativo usa fundo rose translucido, borda rose e texto `--brand-300`.
- Estados sem prioridade usam `--bg-card`, `--text-secondary` e `--border-default`.
- Badges de sucesso/warning/error usam os status tokens, nao a cor brand.

### Inputs And Selects

- Fundo `--bg-input`, borda `--border-default`, texto `--text-primary`.
- Placeholder em `--text-muted`.
- Focus obrigatorio com `--brand-500` e `0 0 0 3px var(--brand-glow)`.
- Campos de erro usam `--status-error` e glow vermelho translucido.

### Cards And Surfaces

- Card padrao: `--bg-card`, borda `--border-subtle`, radius `--radius-lg`, padding `--space-5`.
- Card elevated: `--bg-elevated` e `--shadow-md`.
- Card brand: `--border-brand` e `--shadow-brand`.
- Evitar cards claros em telas do produto.

### Avatars, Messages And Chat Shell

- Avatar brand usa `--brand-500`.
- Avatar muted usa `--bg-hover` com texto secundario.
- Mensagens usam separadores sutis e texto secundario para corpo.
- Mensagens/autor da IA usam `--brand-400`.
- Chat input usa `--bg-input`, borda default e foco rose.

### Alerts, Progress And Toggles

- Alert info usa rose translucido e texto `--brand-300`.
- Success, warning e error usam os status tokens dedicados.
- Progress principal usa `--brand-500`; progress success usa `--status-success`.
- Toggle ativo usa `--brand-500`; inativo usa zinc hover/muted.

### App Shell

- Shell principal: `--bg-surface`.
- Sidebar: `--bg-base`, borda sutil a direita.
- Topbar: borda sutil abaixo, texto primario para titulo.
- Nav item ativo: rose translucido e texto `--brand-300`.
- Footer/user row: hover zinc, nunca destaque forte sem interacao.

## Instrucoes Para Modelos/Agents

Use esta secao como prompt operacional quando outro modelo ou agent for alterar UI no projeto.

```text
Voce esta trabalhando no Linvo AI. Siga o design system em specs/design-system.md.

Regras obrigatorias:
1. Use zinc como base neutra. Nao crie outra escala de cinza.
2. Use #e11d48 / --brand-500 como cor principal do sistema.
3. Antes de criar qualquer cor nova, procure um token existente.
4. Mantenha dark UI como padrao.
5. Use superficies em --bg-base, --bg-surface, --bg-elevated, --bg-card e --bg-input.
6. Use rose somente para acao principal, foco, estado ativo, marca e IA.
7. Use success/warning/error apenas para semantica real de status.
8. Preserve radius, spacing, sombra e tipografia compacta do sistema.
9. Ao criar nova tela, comece pelos padroes existentes da extensao e adapte, sem trocar a direcao visual.
10. Nao introduza azul, roxo, teal, gradientes novos, cards claros ou paletas alternativas sem pedido explicito.
```

Checklist antes de finalizar uma mudanca visual:

- A tela usa zinc como base?
- A acao principal usa `#e11d48`?
- Estados ativos/focus usam rose de forma consistente?
- Textos primario, secundario e muted usam os tokens corretos?
- Cards e inputs estao escuros, compactos e com bordas suaves?
- O resultado parece parte do mesmo produto que `design-system-preview.html`?

## Public APIs And Compatibility

Este design system nao altera APIs publicas, contratos, schemas, comportamento de runtime ou banco de dados. Mudancas derivadas deste documento devem ser visuais e estruturais de UI, preservando fluxos existentes salvo quando uma spec de produto pedir o contrario.

## Acceptance Criteria

- `specs/design-system.md` existe e aponta para `apps/extension/src/sidepanel/design-system-preview.html`.
- O documento declara `#e11d48` como cor central do sistema.
- O documento declara zinc como base neutra.
- Tokens principais do HTML atual estao documentados.
- Ha instrucoes claras para modelos/agents seguirem o design system sem interpretar a tela manualmente.
