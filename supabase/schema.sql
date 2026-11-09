-- =====================================================================
-- Aprovação 360° — Script do banco de dados (Supabase / PostgreSQL)
-- Etapa 1 do projeto (seção 6 e RN30/RN31)
--
-- COMO USAR: Supabase → seu projeto → SQL Editor → New query →
-- cole este arquivo inteiro → Run. Pode rodar de novo sem problema
-- (o script é idempotente: cria só o que ainda não existe).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Função de apoio: atualiza "atualizado_em" a cada alteração
-- ---------------------------------------------------------------------
create or replace function public.a360_set_atualizado()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Concursos
-- ---------------------------------------------------------------------
create table if not exists public.a360_concursos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  codigo          text not null check (char_length(codigo) between 1 and 40 and codigo !~ '\s'),
  orgao           text not null,
  cargo           text not null,
  banca           text,
  edital_numero   text,
  data_publicacao date,
  data_prova      date,
  status          text not null default 'previsto' check (status in ('previsto','publicado','encerrado')),
  retificacoes    text,
  link_edital     text check (link_edital is null or link_edital ~* '^https?://'),
  prioritario     boolean not null default false,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  excluido_em     timestamptz,
  constraint a360_concursos_datas check (data_prova is null or data_publicacao is null or data_prova >= data_publicacao)
);
create unique index if not exists a360_concursos_codigo_uq
  on public.a360_concursos (usuario_id, codigo) where excluido_em is null;
-- RN09: só um concurso prioritário por usuário
create unique index if not exists a360_concursos_prioritario_uq
  on public.a360_concursos (usuario_id) where prioritario and excluido_em is null;

-- ---------------------------------------------------------------------
-- 2. Disciplinas
-- ---------------------------------------------------------------------
create table if not exists public.a360_disciplinas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  concurso_id   uuid not null references public.a360_concursos(id) on delete cascade,
  nome          text not null,
  peso          smallint not null default 3 check (peso between 1 and 5),
  incidencia    smallint not null default 3 check (incidencia between 1 and 5),
  horas_ciclo   numeric(5,1) check (horas_ciclo is null or horas_ciclo >= 0),
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create index if not exists a360_disciplinas_concurso_ix on public.a360_disciplinas (concurso_id);

-- ---------------------------------------------------------------------
-- 3. Assuntos (edital verticalizado)
-- ---------------------------------------------------------------------
create table if not exists public.a360_assuntos (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  disciplina_id    uuid not null references public.a360_disciplinas(id) on delete cascade,
  item_edital      text check (item_edital is null or char_length(item_edital) <= 20),
  descricao        text not null,
  status           text not null default 'nao_iniciado' check (status in ('nao_iniciado','em_estudo','revisao','dominado')),
  ultima_atividade date,
  ultimo_ponto     text,
  dificuldades     text,
  ordem            integer not null default 0,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  excluido_em      timestamptz
);
create index if not exists a360_assuntos_disciplina_ix on public.a360_assuntos (disciplina_id);

-- ---------------------------------------------------------------------
-- 4. Planejamentos (versões)
-- ---------------------------------------------------------------------
create table if not exists public.a360_planejamentos (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  concurso_id          uuid not null references public.a360_concursos(id) on delete cascade,
  versao               integer not null check (versao >= 1),
  data_aprovacao       date not null default current_date,
  horas_semana         numeric(5,1) not null check (horas_semana > 0 and horas_semana <= 100),
  meta_questoes_semana integer not null default 0 check (meta_questoes_semana >= 0),
  vigente              boolean not null default true,
  observacoes          text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  excluido_em          timestamptz
);
create unique index if not exists a360_planejamentos_versao_uq
  on public.a360_planejamentos (concurso_id, versao);
-- RN10: só uma versão vigente por concurso
create unique index if not exists a360_planejamentos_vigente_uq
  on public.a360_planejamentos (concurso_id) where vigente and excluido_em is null;

-- ---------------------------------------------------------------------
-- 5. Checkpoints importados
-- ---------------------------------------------------------------------
create table if not exists public.a360_checkpoints (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  concurso_id      uuid not null references public.a360_concursos(id) on delete cascade,
  data_referencia  date not null,
  conversa         text,
  ia               text check (ia is null or ia in ('claude','chatgpt','outra')),
  texto_original   text not null,
  hash             text not null,
  resumo           jsonb not null default '{}'::jsonb,
  proxima          text,
  propostas        text,
  correcoes        text,
  propostas_vistas boolean not null default false,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  excluido_em      timestamptz
);
-- RN21: o mesmo checkpoint não entra duas vezes
create unique index if not exists a360_checkpoints_hash_uq
  on public.a360_checkpoints (usuario_id, hash);
create index if not exists a360_checkpoints_concurso_ix on public.a360_checkpoints (concurso_id, data_referencia);

-- ---------------------------------------------------------------------
-- 6. Sessões de estudo
-- ---------------------------------------------------------------------
create table if not exists public.a360_sessoes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  concurso_id   uuid not null references public.a360_concursos(id) on delete cascade,
  disciplina_id uuid not null references public.a360_disciplinas(id) on delete cascade,
  assunto_id    uuid references public.a360_assuntos(id) on delete cascade,
  data          date not null,
  tipo          text not null check (tipo in ('aula','rapida','questoes','revisao','simulado','lei_seca','leitura')),
  status        text not null check (status in ('PLANEJADO','REALIZADO','PENDENTE','CANCELADO','REPROGRAMADO')),
  minutos       integer not null default 0 check (minutos between 0 and 720),
  origem        text not null check (origem in ('checkpoint','cronometro','manual')),
  ia            text check (ia is null or ia in ('claude','chatgpt','outra')),
  checkpoint_id uuid references public.a360_checkpoints(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create index if not exists a360_sessoes_concurso_data_ix on public.a360_sessoes (concurso_id, data);
create index if not exists a360_sessoes_assunto_ix on public.a360_sessoes (assunto_id);

-- ---------------------------------------------------------------------
-- 7. Lotes de questões
-- ---------------------------------------------------------------------
create table if not exists public.a360_questoes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assunto_id    uuid not null references public.a360_assuntos(id) on delete cascade,
  disciplina_id uuid not null references public.a360_disciplinas(id) on delete cascade,
  data          date not null,
  feitas        integer not null check (feitas >= 1),
  acertos       integer not null check (acertos >= 0),
  origem        text not null check (origem in ('checkpoint','manual')),
  checkpoint_id uuid references public.a360_checkpoints(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz,
  constraint a360_questoes_acertos check (acertos <= feitas)
);
create index if not exists a360_questoes_assunto_ix on public.a360_questoes (assunto_id, data);
create index if not exists a360_questoes_disciplina_ix on public.a360_questoes (disciplina_id);

-- ---------------------------------------------------------------------
-- 8. Caderno de erros
-- ---------------------------------------------------------------------
create table if not exists public.a360_erros (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assunto_id    uuid not null references public.a360_assuntos(id) on delete cascade,
  disciplina_id uuid not null references public.a360_disciplinas(id) on delete cascade,
  data          date not null,
  motivo        text not null check (motivo in ('conceito','letra_da_lei','pegadinha','interpretacao','calculo','atencao','chute')),
  descricao     text not null check (char_length(descricao) <= 500),
  revisado      boolean not null default false,
  data_revisado date,
  checkpoint_id uuid references public.a360_checkpoints(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create index if not exists a360_erros_assunto_ix on public.a360_erros (assunto_id, data);
create index if not exists a360_erros_disciplina_ix on public.a360_erros (disciplina_id);

-- ---------------------------------------------------------------------
-- 9. Revisões espaçadas (1 → 7 → 30 → 60)
-- ---------------------------------------------------------------------
create table if not exists public.a360_revisoes (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assunto_id           uuid not null references public.a360_assuntos(id) on delete cascade,
  data_estudo_original date not null,
  etapa                smallint not null check (etapa in (1,7,30,60)),
  data_prevista        date not null,
  status               text not null default 'pendente' check (status in ('pendente','concluida')),
  resultado            smallint check (resultado is null or resultado between 0 and 100),
  data_realizada       date,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  excluido_em          timestamptz
);
-- RN02: no máximo uma revisão pendente por assunto
create unique index if not exists a360_revisoes_pendente_uq
  on public.a360_revisoes (assunto_id) where status = 'pendente' and excluido_em is null;
create index if not exists a360_revisoes_prevista_ix on public.a360_revisoes (usuario_id, data_prevista) where status = 'pendente';

-- ---------------------------------------------------------------------
-- 10. Simulados
-- ---------------------------------------------------------------------
create table if not exists public.a360_simulados (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  concurso_id    uuid not null references public.a360_concursos(id) on delete cascade,
  data           date not null,
  nome           text not null,
  origem         text not null check (origem in ('claude','chatgpt','cursinho','prova_anterior','outro')),
  total_questoes integer not null check (total_questoes >= 1),
  acertos        integer not null check (acertos >= 0),
  tempo_minutos  integer check (tempo_minutos is null or tempo_minutos >= 0),
  observacoes    text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  excluido_em    timestamptz,
  constraint a360_simulados_acertos check (acertos <= total_questoes)
);
create index if not exists a360_simulados_concurso_ix on public.a360_simulados (concurso_id, data);

create table if not exists public.a360_simulado_disciplinas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  simulado_id   uuid not null references public.a360_simulados(id) on delete cascade,
  disciplina_id uuid not null references public.a360_disciplinas(id) on delete cascade,
  questoes      integer not null check (questoes >= 1),
  acertos       integer not null check (acertos >= 0),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz,
  constraint a360_simdisc_acertos check (acertos <= questoes)
);
create index if not exists a360_simdisc_simulado_ix on public.a360_simulado_disciplinas (simulado_id);

-- ---------------------------------------------------------------------
-- 11. Biblioteca de links
-- ---------------------------------------------------------------------
create table if not exists public.a360_links (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  concurso_id   uuid not null references public.a360_concursos(id) on delete cascade,
  disciplina_id uuid references public.a360_disciplinas(id) on delete set null,
  assunto_id    uuid references public.a360_assuntos(id) on delete set null,
  titulo        text not null,
  url           text not null check (url ~* '^https?://'),
  tipo          text not null default 'outro' check (tipo in ('lei','pdf','video','questoes','jurisprudencia','outro')),
  favorito      boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create index if not exists a360_links_concurso_ix on public.a360_links (concurso_id);

-- ---------------------------------------------------------------------
-- 12. Configurações (uma linha por usuário)
-- ---------------------------------------------------------------------
create table if not exists public.a360_configuracoes (
  id                        uuid primary key default gen_random_uuid(),
  usuario_id                uuid not null default auth.uid() unique references auth.users(id) on delete cascade,
  concurso_ativo_id         uuid references public.a360_concursos(id) on delete set null,
  url_projeto_claude        text check (url_projeto_claude is null or url_projeto_claude ~* '^https?://'),
  url_projeto_chatgpt       text check (url_projeto_chatgpt is null or url_projeto_chatgpt ~* '^https?://'),
  ia_padrao                 text not null default 'claude' check (ia_padrao in ('claude','chatgpt')),
  minimo_minutos_streak     integer not null default 15 check (minimo_minutos_streak between 1 and 240),
  perfil_md                 text,
  ultimo_backup             timestamptz,
  ultimo_registro_exportado timestamptz,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now(),
  excluido_em               timestamptz
);

-- ---------------------------------------------------------------------
-- Gatilhos de atualizado_em + RLS (RN30) em todas as tabelas
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tabelas text[] := array[
    'a360_concursos','a360_disciplinas','a360_assuntos','a360_planejamentos',
    'a360_checkpoints','a360_sessoes','a360_questoes','a360_erros','a360_revisoes',
    'a360_simulados','a360_simulado_disciplinas','a360_links','a360_configuracoes'
  ];
begin
  foreach t in array tabelas loop
    -- gatilho
    execute format('drop trigger if exists %I on public.%I', t || '_atualizado', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.a360_set_atualizado()', t || '_atualizado', t);
    -- índice por usuário
    execute format('create index if not exists %I on public.%I (usuario_id)', t || '_usuario_ix', t);
    -- segurança por linha: cada usuário só enxerga e altera o que é seu
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_dono', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid())',
      t || '_dono', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Conferência: deve listar 13 tabelas, todas com rls = true
-- ---------------------------------------------------------------------
select c.relname as tabela, c.relrowsecurity as rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'a360\_%' and c.relkind = 'r'
order by 1;
