# Guia de configuração — Aprovação 360°

Tempo total: **cerca de 25 minutos**, uma única vez. Tudo é feito no navegador e nada precisa ser instalado.

Ordem: **A** Supabase → **B** GitHub Pages → **C** login com e-mail e senha → **E** chaves (já feito) → **F** testar.

> ✅ A **Project URL** e a **chave publishable** já foram colocadas no site.

---

## A. Supabase: o banco de dados (8 min)

1. Entre em **https://supabase.com** → **Start your project** → **Continue with GitHub**, com a conta `chatgptceccontabil-png`.
2. Clique em **New project**:
   - **Name:** `aprovacao360`
   - **Database Password:** clique em *Generate* e **guarde** a senha (não vamos usá-la no dia a dia, mas guarde).
   - **Region:** *South America (São Paulo)*
   - Clique em **Create new project** e aguarde cerca de 2 minutos.
   - Se aparecer aviso de limite de projetos gratuitos (o plano gratuito permite 2), me avise.
3. No menu da esquerda, abra **SQL Editor** → **New query**.
4. Abra o arquivo `supabase/schema.sql` deste repositório (no GitHub, clique no arquivo e depois no botão **Copy raw file**), **cole** no editor e clique em **Run**.
5. Repita os passos 3 e 4, um de cada vez e nesta ordem, com os arquivos:
   - `supabase/02-importar-edital.sql` → resultado: "a360_importar_edital instalada"
   - `supabase/03-checkpoint-revisoes.sql` → resultado: "etapa 4 instalada: importar checkpoint e revisões"
   - `supabase/04-ciclo-simulados.sql` → resultado: "etapa 6 instalada: ciclo e simulados"
6. **Resultado esperado do primeiro script:** uma tabela com **13 linhas** (`a360_assuntos` … `a360_simulados`), todas com `rls = true`. Os avisos amarelos ("already exists, skipping") são normais.
7. Pegue as chaves: **Project Settings** (engrenagem) → **API** / **API Keys**:
   - **Project URL** (algo como `https://abcdxyz.supabase.co`)
   - a chave **anon public** ou **Publishable key** (começa com `eyJ…` ou `sb_publishable_…`)

   ⚠️ **Não** copie a chave `service_role` / `secret`: essa nunca vai para o site.

---

## B. GitHub Pages: colocar o site no ar (2 min)

1. Abra **https://github.com/chatgptceccontabil-png/aprovacao360** → **Settings** → **Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha **main** e a pasta **/ (root)** → **Save**.
4. Em 1 ou 2 minutos aparece o endereço:
   **https://chatgptceccontabil-png.github.io/aprovacao360/**

---

## C. Login com e-mail e senha (3 min)

O login com Google foi trocado por **e-mail e senha**, que não exige nenhuma conta extra.

1. Supabase → **Authentication** → **Sign In / Providers** → **Email**: confirme que está **ativado** (vem ativado por padrão).
2. **Recomendado:** nessa mesma tela, **desligue "Confirm email"** → **Save**.
   Assim, a conta é criada na hora, sem depender de e-mail de confirmação (o envio gratuito do Supabase é limitado).
3. Supabase → **Authentication** → **URL Configuration**:
   - **Site URL:** `https://chatgptceccontabil-png.github.io/aprovacao360/`
   - **Redirect URLs** → **Add URL:** `https://chatgptceccontabil-png.github.io/aprovacao360/`
   - **Save**. É isso que faz o link de "Esqueci a senha" voltar para o site.
4. Abra o site → **Primeiro acesso? Criar minha conta** → seu e-mail e uma senha de 8 caracteres ou mais → **Criar minha conta**.
5. **Depois de criar a sua conta**, feche a porta para outras pessoas:
   Supabase → **Authentication** → **Sign In / Providers** → desligue **"Allow new users to sign up"** → **Save**.
   🔒 A partir daí, **só você** entra na plataforma.

> **Esqueci a senha:** funciona para o e-mail dono da conta do Supabase. Se você usar outro e-mail no site e precisar recuperar a senha, me avise que eu explico como configurar um e-mail próprio (gratuito, pelo Gmail).

> **Login com Google (opcional, futuro):** dá para ativar depois, sem perder nada. Os passos ficam no histórico deste guia.

---

## E. Colar as chaves no site (1 min)

**Opção 1 (mais fácil):** me envie na conversa a **Project URL** e a chave **anon/publishable**. Elas são públicas por natureza, porque a proteção vem do login e das regras do banco. Eu atualizo o `js/config.js` e envio ao GitHub.

**Opção 2:** no GitHub, abra `js/config.js` → ícone de lápis (*Edit*) → troque os textos `COLE_AQUI_…` → **Commit changes**.

⚠️ **Nunca** envie a ninguém o **Client Secret** do Google, a chave **service_role** nem a senha do banco. Esses dados ficam só no Google e no Supabase.

---

## F. Testar (2 min)

1. Abra **https://chatgptceccontabil-png.github.io/aprovacao360/** (no computador e no celular).
2. Crie a conta (C.4) ou entre com e-mail e senha.
3. **Esperado:** aparece o cabeçalho azul-marinho com o seu e-mail, o menu e a mensagem "Tudo pronto para começar".
4. No Supabase → **Table Editor** → `a360_configuracoes`: deve haver **1 linha** com o seu `usuario_id`.

### Se der erro

| Mensagem | Causa provável | Solução |
|---|---|---|
| "Falta conectar o banco de dados" | Página antiga guardada no navegador | Ctrl + Shift + R ou janela anônima |
| "Não consegui carregar a conexão com o banco" | Bloqueador de anúncios ou rede da empresa | Liberar `cdn.jsdelivr.net` ou testar no 4G |
| "Confirme seu e-mail…" | "Confirm email" ainda ligado | Passo C.2, ou clique no link do e-mail |
| "Novos cadastros estão desativados" | Você já desligou o cadastro antes de criar a conta | Religue C.5, crie a conta e desligue de novo |
| Erro sobre `a360_configuracoes` | O script do banco não foi rodado | Parte A, passos 3 a 5 |
| "Não consegui falar com o banco" | Projeto pausado após 7 dias sem uso | Supabase → projeto → **Restore** |
