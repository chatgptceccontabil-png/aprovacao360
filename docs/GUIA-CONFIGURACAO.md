# Guia de configuração — Aprovação 360°

Tempo total: **cerca de 25 minutos**, uma única vez. Tudo é feito no navegador e nada precisa ser instalado.

Ordem: **A** Supabase → **B** GitHub Pages → **C** Google (login) → **D** ligar o Google no Supabase → **E** colar as chaves → **F** testar.

> Anote num bloco de notas os 4 itens que vão aparecer pelo caminho: **Project URL**, **chave anon/publishable**, **Client ID** e **Client Secret**.

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
5. **Resultado esperado:** uma tabela com **13 linhas** (`a360_assuntos` … `a360_simulados`), todas com `rls = true`. Os avisos amarelos ("already exists, skipping") são normais.
6. Pegue as chaves: **Project Settings** (engrenagem) → **API** / **API Keys**:
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

## C. Google: liberar o "Entrar com Google" (10 min)

1. Entre em **https://console.cloud.google.com** com o seu Google.
2. No topo, abra o seletor de projetos → **Novo projeto** → nome `aprovacao360` → **Criar** e selecione o projeto.
3. Menu → **APIs e serviços** → **Tela de consentimento OAuth** (ou **Google Auth Platform**) → **Começar**:
   - Nome do app: `Aprovação 360°`; e-mail de suporte: o seu.
   - Público: **Externo**.
   - Contato: o seu e-mail → aceite e **Criar**.
4. Em **Público** (*Audience*), deixe o status **Em teste** e, em **Usuários de teste**, adicione **o seu e-mail Google**.
   💡 Assim, **só você** consegue entrar na plataforma. É uma camada extra de segurança.
5. Abra a aba do **Supabase** (passo D.1 abaixo) só para copiar a **Callback URL**, que tem o formato `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
6. De volta ao Google: **Clientes** (*Clients*) → **Criar cliente**:
   - Tipo: **Aplicativo da Web**; nome: `aprovacao360-web`
   - **Origens JavaScript autorizadas:** `https://chatgptceccontabil-png.github.io` (sem `/aprovacao360` no final)
   - **URIs de redirecionamento autorizados:** cole a **Callback URL** do Supabase
   - **Criar** → copie o **Client ID** e o **Client Secret**.

---

## D. Ligar o Google no Supabase (3 min)

1. Supabase → **Authentication** → **Sign In / Providers** (ou *Providers*) → **Google**:
   - Ative **Enable Sign in with Google**.
   - Cole o **Client ID** e o **Client Secret** do passo C.6.
   - Aqui também aparece a **Callback URL** usada no passo C.5.
   - **Save**.
2. Supabase → **Authentication** → **URL Configuration**:
   - **Site URL:** `https://chatgptceccontabil-png.github.io/aprovacao360/`
   - **Redirect URLs** → **Add URL:** `https://chatgptceccontabil-png.github.io/aprovacao360/`
   - **Save**.

---

## E. Colar as chaves no site (1 min)

**Opção 1 (mais fácil):** me envie na conversa a **Project URL** e a chave **anon/publishable**. Elas são públicas por natureza, porque a proteção vem do login e das regras do banco. Eu atualizo o `js/config.js` e envio ao GitHub.

**Opção 2:** no GitHub, abra `js/config.js` → ícone de lápis (*Edit*) → troque os textos `COLE_AQUI_…` → **Commit changes**.

⚠️ **Nunca** envie a ninguém o **Client Secret** do Google, a chave **service_role** nem a senha do banco. Esses dados ficam só no Google e no Supabase.

---

## F. Testar (2 min)

1. Abra **https://chatgptceccontabil-png.github.io/aprovacao360/** (no computador e no celular).
2. Clique em **Entrar com Google** e autorize.
3. **Esperado:** aparece o cabeçalho azul-marinho com o seu nome e foto, o menu e a mensagem "Tudo pronto para começar".
4. No Supabase → **Table Editor** → `a360_configuracoes`: deve haver **1 linha** com o seu `usuario_id`.

### Se der erro

| Mensagem | Causa provável | Solução |
|---|---|---|
| "Falta conectar o banco de dados" | `config.js` ainda com `COLE_AQUI` | Passo E |
| Google: "redirect_uri_mismatch" | Callback URL diferente no Google | Copie de novo a do Supabase (D.1) para o Google (C.6) |
| Google: "Acesso bloqueado / app em teste" | Seu e-mail não está em Usuários de teste | Passo C.4 |
| Volta para a tela de login depois de autorizar | Redirect URL não cadastrada | Passo D.2 |
| "Não consegui falar com o banco" | Projeto pausado após 7 dias sem uso | Supabase → projeto → **Restore** |
