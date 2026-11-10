# Verificação final — critérios de aceite (projeto, seção 11)

Data: 09/11/2026. Ambiente de teste: PostgreSQL 16 local (mesmas funções e regras de segurança do Supabase), navegador simulado (jsdom, 59 verificações em `testes/telas.smoke.js`), Google Chrome real em 360 px e 1280 px (todas as telas, sem rolagem horizontal e sem erros no console) e testes unitários (`testes/*.test.js`).

> **Não verificado aqui:** o Supabase de produção (o ambiente de construção não acessa a internet do Supabase). Os scripts são os mesmos testados localmente; o primeiro uso real confirma.

| # | Critério | Resultado | Como foi verificado |
|---|---|---|---|
| 1 | Entrar e continuar logado no dia seguinte | ✅ (com ajuste) | Login trocado de Google para **e-mail e senha** a pedido do usuário; sessão persistente do Supabase (`persistSession`). Testado pelo usuário em produção. |
| 2 | Outro usuário não vê nenhum dado | ✅ | RLS em todas as tabelas; teste SQL com dois usuários (0 linhas visíveis; inserção em nome de outro bloqueada; importação em concurso alheio recusada). |
| 3 | EDITAL de exemplo cria concurso, disciplinas e assuntos em ordem | ✅ | `testes/edital.test.js` + função SQL + tela. |
| 4 | Reimportar EDITAL só acrescenta | ✅ | Teste SQL (peso atualizado, 1 assunto novo, nada apagado) + tela ("já está todo cadastrado"). |
| 5 | SESSAO de aula cria revisão para o dia seguinte e assunto "Em estudo" | ✅ | Teste SQL (`1ª revisão em 10/11`). |
| 6 | Mesmo CHECKPOINT de novo é bloqueado | ✅ | Hash SHA-256 + índice único; teste SQL e tela. |
| 7 | Linha com acertos > feitas aparece ✖ e as demais entram | ✅ | `testes/checkpoint.test.js` + tela ("6 de 7 linhas"). |
| 8 | Assunto sem acento é reconhecido | ✅ | Teste unitário. |
| 9 | Assunto inexistente pede decisão; Confirmar bloqueado até decidir | ✅ | Tela. A sugestão só aparece se for parecida de verdade (homologação ≠ ofício). |
| 10 | Revisão 90% na etapa 7 → 30 dias; 65% → etapa 1 | ✅ | Teste SQL (`17/12` e `18/11` equivalentes; 78% repete a etapa 7). |
| 11 | Dominado só com 2 datas diferentes | ✅ | Teste SQL (22 q, 90,9%, 2 dias → dominado). |
| 12 | Ciclo 10/6/4 com 20 h e nada gravado antes de Aprovar | ✅ | `testes/calc.test.js` + tela (prévia → Aprovar → versão 1). |
| 13 | "Estudar" copia o prompt que começa com "PROMPT DO DIA — Aprovação 360°" e abre a IA | ✅ | Tela (abre `claude.ai/new` ou o Projeto configurado; idem ChatGPT). |
| 14 | Cronômetro sobrevive a recarregar a página | ✅ | Estado no `localStorage`; Chrome real (recarregado com 25:00 em andamento). |
| 15 | Sequência de dias | ✅ | Teste unitário (hoje sem atividade não zera). |
| 16 | Registro Mestre com seções 1 a 10 | ✅ | `testes/registro.test.js`. |
| 17 | Backup → excluir → restaurar traz de volta | ✅ | Tela (verificação 58). |
| 18 | 360 px sem rolagem horizontal | ✅ | Chrome real, 10 telas. |
| 19 | Trocar o concurso ativo muda todas as telas | ✅ | Todas as consultas filtram pelo concurso ativo (RN11). |
| 20 | Claude e ChatGPT somam no mesmo assunto; histórico mostra a IA | ✅ | Campo `ia` no checkpoint e nas sessões; Registro Mestre mostra "CHECKPOINT (ChatGPT)". |
| 21 | "Estudar no ChatGPT" abre a URL configurada | ✅ | Tela. |

## Segurança

- Textos vindos da IA ou do usuário nunca viram HTML (criação de elementos com `textContent`).
- Links da Biblioteca só aceitam `http://` ou `https://` (validado na tela e no banco).
- Só a chave **publishable** fica no site; RLS protege cada linha; cadastro de novos usuários deve ficar **desligado** no Supabase.

## Diferenças em relação ao projeto original

| Projeto | Implementado | Motivo |
|---|---|---|
| Login com Google | Login com e-mail e senha | Pedido do usuário (sem configurar o Google Cloud). |
| Lembretes por e-mail/push | Avisos no painel | Previsto para V2. |
| Gráficos com Chart.js | Gráficos próprios (CSS e SVG) | Menos dependências; mesmo resultado. |
| PWA | Manifesto + ícones, sem *service worker* | Evita versões presas em cache; instalação funciona no Android e no iPhone. |
