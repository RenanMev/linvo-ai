# Contract: Extension UI

## Contacts List

- Detecta dominio da aba ativa ao entrar logado.
- Sem dominio valido: mostra estado vazio e nao carrega lista global.
- Com dominio valido: chama `assist/customers.list` com `domain`.
- Lista mostra busca, contador, refresh, nome, estrela e ate 2 dados favoritos resolvidos.
- Clique no contato abre detalhe dentro da sidepanel.
- A lista nao mostra campos editaveis, salvar ou lixeira inline.

## Contact Detail

- Header mostra voltar, nome, estrela e caneta.
- Tabs: `Info` e `IA`.
- Estrela salva imediatamente.
- Caneta ativa modo edicao.
- Modo edicao mostra salvar e cancelar.
- Apagar contato fica apenas no detalhe e exige confirmacao.
- Ao apagar, volta para lista e recarrega contatos do dominio atual.

## AI Tab

- Carrega historico ao abrir detalhe ou aba `IA`.
- Envio desabilita input enquanto uma resposta esta em andamento.
- Resposta aparece incrementalmente durante streaming.
- `complete` substitui o rascunho streaming pela mensagem persistida.
- `error` mostra alerta sem apagar mensagens anteriores.
- Botao limpar conversa pede confirmacao e remove mensagens/resumo.
