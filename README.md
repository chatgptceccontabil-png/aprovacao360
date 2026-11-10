# Aprovação 360°

Plataforma pessoal de estudos para concursos em que **a IA (Claude ou ChatGPT) é a interface principal**: você estuda conversando com a IA, cola o CHECKPOINT no fim da sessão e a plataforma atualiza o edital verticalizado, as revisões espaçadas (1 → 7 → 30 → 60 dias), o caderno de erros e o ciclo de estudos.

- **Endereço:** https://chatgptceccontabil-png.github.io/aprovacao360/
- **Custo:** R$ 0 (GitHub Pages + Supabase gratuito)
- **Como usar (1 página):** [`docs/GUIA-DE-USO.md`](docs/GUIA-DE-USO.md)
- **Configuração inicial:** [`docs/GUIA-CONFIGURACAO.md`](docs/GUIA-CONFIGURACAO.md)

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | Página única da aplicação |
| `estilo.css` | Padrão visual |
| `js/config.js` | Endereço e chave pública do Supabase (preencher) |
| `js/app.js` | Lógica da aplicação |
| `supabase/schema.sql` | Script do banco (rodar no SQL Editor do Supabase) |
| `supabase/02-importar-edital.sql` | Função de importação do EDITAL (rodar depois do schema) |
| `supabase/03-checkpoint-revisoes.sql` | Importação do CHECKPOINT e motor de revisões (rodar depois do 02) |
| `supabase/04-ciclo-simulados.sql` | Planejamento do ciclo e simulados (rodar depois do 03) |
| `supabase/05-sessoes.sql` | Sessões do cronômetro (rodar depois do 04) |
| `testes/` | Testes automáticos (`node testes/edital.test.js`, `node testes/checkpoint.test.js`, `node testes/calc.test.js`, `node testes/registro.test.js`) |
| `manifest.json`, `icones/` | App para instalar no celular |
| `docs/` | Guias, projeto, prompts das IAs e verificação final |

## Andamento da construção

- [x] **Etapa 1:** banco de dados (13 tabelas, segurança por usuário) + login com e-mail e senha + navegação
- [x] Etapa 2: concursos e configurações
- [x] Etapa 3: importar EDITAL + edital verticalizado (rodar `supabase/02-importar-edital.sql`)
- [x] Etapa 4: importar CHECKPOINT + motor de revisões (rodar `supabase/03-checkpoint-revisoes.sql`)
- [x] Etapa 5: painel Hoje + Prompt do Dia (Claude e ChatGPT)
- [x] Etapa 6: erros, ciclo e simulados (rodar `supabase/04-ciclo-simulados.sql`)
- [x] Etapa 7: cronômetro e biblioteca (rodar `supabase/05-sessoes.sql`)
- [x] Etapa 8: Registro Mestre, backup e exportações
- [x] Etapa 9: app no celular (PWA) e testes finais — ver [`docs/VERIFICACAO-FINAL.md`](docs/VERIFICACAO-FINAL.md)
