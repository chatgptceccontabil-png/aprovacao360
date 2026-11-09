# Aprovação 360°

Plataforma pessoal de estudos para concursos em que **a IA (Claude ou ChatGPT) é a interface principal**: você estuda conversando com a IA, cola o CHECKPOINT no fim da sessão e a plataforma atualiza o edital verticalizado, as revisões espaçadas (1 → 7 → 30 → 60 dias), o caderno de erros e o ciclo de estudos.

- **Endereço:** https://chatgptceccontabil-png.github.io/aprovacao360/
- **Custo:** R$ 0 (GitHub Pages + Supabase gratuito)
- **Configuração inicial:** [`docs/GUIA-CONFIGURACAO.md`](docs/GUIA-CONFIGURACAO.md)

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | Página única da aplicação |
| `estilo.css` | Padrão visual |
| `js/config.js` | Endereço e chave pública do Supabase (preencher) |
| `js/app.js` | Lógica da aplicação |
| `supabase/schema.sql` | Script do banco (rodar no SQL Editor do Supabase) |
| `docs/` | Guias |

## Andamento da construção

- [x] **Etapa 1:** banco de dados (13 tabelas, segurança por usuário) + login com e-mail e senha + navegação
- [ ] Etapa 2: concursos e configurações
- [ ] Etapa 3: importar EDITAL + edital verticalizado
- [ ] Etapa 4: importar CHECKPOINT + motor de revisões
- [ ] Etapa 5: painel Hoje + Prompt do Dia (Claude e ChatGPT)
- [ ] Etapa 6: erros, ciclo e simulados
- [ ] Etapa 7: cronômetro e biblioteca
- [ ] Etapa 8: Registro Mestre, backup e exportações
- [ ] Etapa 9: app no celular (PWA) e testes finais
