# Aprovação 360° — Guia de uso (1 página)

**Endereço:** https://chatgptceccontabil-png.github.io/aprovacao360/

> **A ideia em uma frase:** você estuda **conversando com a IA** (Claude ou ChatGPT); a plataforma é a **memória** — guarda o edital, as revisões, os erros e o tempo, e diz o que estudar agora.

---

## 🔁 A rotina de cada sessão (4 passos)

| # | Onde | O que fazer |
|---|---|---|
| 1 | **Hoje** | Clique em **Estudar no Claude** ou **Estudar no ChatGPT**. O *Prompt do Dia* é copiado e a IA abre. |
| 2 | **Na IA** | Cole (**Ctrl + V**) e estude: a IA começa pelas revisões vencidas, passa pelos erros recorrentes e dá a aula do dia. *(Opcional: ligue o **▶ Cronômetro** no topo.)* |
| 3 | **Na IA** | No fim, peça **`/checkpoint`**. Copie o bloco inteiro `=== CHECKPOINT === … === FIM ===`. |
| 4 | **Importar** | Cole o bloco → confira a pré-visualização (✔ ok · ⚠ decidir · ✖ inválida) → **Confirmar**. Pronto: edital, revisões e erros atualizados. |

## 📅 Uma vez por semana (3 min)

1. **Configurações → Exportar Registro Mestre (.md)** → suba o arquivo nos **dois** Projetos (Claude e ChatGPT), substituindo o anterior.
2. **Configurações → Baixar backup (.json)** → guarde no seu computador ou Google Drive. *(O painel avisa quando passar de 7 dias.)*
3. **Ciclo** → confira o feito × meta. Mudou sua disponibilidade? **Nova versão do planejamento** → **Aprovar**.

## 🧭 O que cada tela faz

| Tela | Para quê |
|---|---|
| **Hoje** | O que estudar agora, revisões do dia, acerto por disciplina, recados da IA (propostas e correções). |
| **Importar** | Colar o **CHECKPOINT** (rotina) ou o **EDITAL** (uma vez por concurso, com `/edital` na IA). |
| **Edital** | Edital verticalizado com semáforo: ● Nunca visto · ● Em estudo · ● Revisão · ● Dominado. Botão **Estudar** em cada assunto. |
| **Revisões** | Atrasadas, hoje e próximos dias. Registre o resultado ou reprograme. Regra: **1 → 7 → 30 → 60 dias**. |
| **Erros** | Caderno de erros por motivo. **Treinar estes erros na IA** gera questões novas sobre eles. Exporta para Excel. |
| **Ciclo** | Suas horas por semana divididas pela prioridade (**peso × incidência × (1 − acerto)**). |
| **Simulados** | Registre notas (geral e por disciplina) e veja a evolução no gráfico. |
| **Biblioteca** | Links de lei seca, PDFs e vídeos. Os do assunto entram sozinhos no prompt. |
| **Concursos** | Vários concursos sem misturar dados. ★ = prioritário. |
| **Configurações** | Endereços dos seus Projetos nas IAs, IA padrão, perfil, Registro Mestre, backup, sair. |

## 💬 Comandos mais úteis na IA

`/aula [tema]` · `/rapida [tema]` · `/questoes [tema] [n]` · `/simulado [matérias] [n] [tempo]` · `/lei [norma, artigo]` · `/revisao` · `/erros` · `/edital` · `/checkpoint` · `/conferir` *(pede à outra IA para auditar o que ficou "NÃO VERIFICADA")*

## 📱 Instalar no celular

- **Android (Chrome):** abra o endereço → menu **⋮** → **Instalar app** (ou *Adicionar à tela inicial*).
- **iPhone (Safari):** abra o endereço → botão **Compartilhar** → **Adicionar à Tela de Início**.

## ❓ Se algo der errado

| Situação | Solução |
|---|---|
| Tela velha depois de atualização | **Ctrl + Shift + R** (no celular: feche e reabra o app). |
| "Falta instalar a etapa X no banco" | Rode o arquivo indicado (`supabase/0X-…sql`) no **SQL Editor** do Supabase. |
| "Não consegui falar com o banco" | Ficou 7+ dias sem usar: supabase.com → projeto → **Restore**. |
| A IA gerou o bloco com nomes diferentes do edital | A pré-visualização mostra ⚠ e sugere o mais parecido: **Associar**, **Criar novo** ou **Ignorar**. |
| Colei o mesmo CHECKPOINT duas vezes | Sem problema: a plataforma bloqueia o repetido. |
| Esqueci a senha | Tela de entrada → **Esqueci a senha** (chega no e-mail da conta). |
