-- =====================================================================
-- Aprovação 360° — Etapa 3: importação atômica do EDITAL (RN23, RN29)
-- COMO USAR: Supabase → SQL Editor → New query → cole → Run.
-- Pode rodar de novo sem problema.
-- =====================================================================
create or replace function public.a360_importar_edital(dados jsonb)
returns jsonb
language plpgsql
security invoker            -- respeita a segurança por usuário (RLS)
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_conc  uuid := nullif(dados->>'concurso_id', '')::uuid;
  c       jsonb := coalesce(dados->'concurso', '{}'::jsonb);
  d       jsonb;
  a       jsonb;
  v_disc  uuid;
  v_ord   integer;
  v_aord  integer;
  n_disc  integer := 0;
  n_upd   integer := 0;
  n_ass   integer := 0;
  v_novo  boolean := false;
begin
  if v_uid is null then
    raise exception 'Sessão expirada. Entre de novo.';
  end if;

  if v_conc is null then
    insert into a360_concursos (codigo, orgao, cargo, banca, edital_numero, data_prova, status, prioritario)
    values (
      c->>'codigo', c->>'orgao', c->>'cargo',
      nullif(c->>'banca', ''), nullif(c->>'edital_numero', ''),
      nullif(c->>'data_prova', '')::date,
      case when nullif(c->>'data_prova', '') is null then 'previsto' else 'publicado' end,
      not exists (select 1 from a360_concursos where usuario_id = v_uid and prioritario and excluido_em is null)
    )
    returning id into v_conc;
    v_novo := true;
  else
    -- concurso existente: só preenche o que estava vazio; nunca apaga
    update a360_concursos
       set banca         = coalesce(banca, nullif(c->>'banca', '')),
           edital_numero = coalesce(edital_numero, nullif(c->>'edital_numero', '')),
           data_prova    = coalesce(data_prova, nullif(c->>'data_prova', '')::date)
     where id = v_conc and excluido_em is null;
    if not found then
      raise exception 'Concurso não encontrado.';
    end if;
  end if;

  select coalesce(max(ordem), 0) into v_ord
    from a360_disciplinas where concurso_id = v_conc and excluido_em is null;

  for d in select * from jsonb_array_elements(coalesce(dados->'disciplinas', '[]'::jsonb)) loop
    v_disc := nullif(d->>'id', '')::uuid;
    if v_disc is null then
      v_ord := v_ord + 1;
      insert into a360_disciplinas (concurso_id, nome, peso, incidencia, ordem)
      values (v_conc, d->>'nome', (d->>'peso')::smallint, (d->>'incidencia')::smallint, v_ord)
      returning id into v_disc;
      n_disc := n_disc + 1;
    else
      update a360_disciplinas
         set peso = (d->>'peso')::smallint, incidencia = (d->>'incidencia')::smallint
       where id = v_disc and concurso_id = v_conc and excluido_em is null
         and (peso <> (d->>'peso')::smallint or incidencia <> (d->>'incidencia')::smallint);
      if found then n_upd := n_upd + 1; end if;
      if not exists (select 1 from a360_disciplinas where id = v_disc and concurso_id = v_conc and excluido_em is null) then
        raise exception 'Disciplina não pertence a este concurso.';
      end if;
    end if;

    select coalesce(max(ordem), 0) into v_aord
      from a360_assuntos where disciplina_id = v_disc and excluido_em is null;

    for a in select * from jsonb_array_elements(coalesce(d->'assuntos', '[]'::jsonb)) loop
      v_aord := v_aord + 1;
      insert into a360_assuntos (disciplina_id, item_edital, descricao, ordem)
      values (v_disc, nullif(a->>'item', ''), a->>'descricao', v_aord);
      n_ass := n_ass + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'concurso_id', v_conc, 'concurso_novo', v_novo,
    'disciplinas_novas', n_disc, 'disciplinas_atualizadas', n_upd, 'assuntos_novos', n_ass
  );
end;
$$;

revoke all on function public.a360_importar_edital(jsonb) from public;
grant execute on function public.a360_importar_edital(jsonb) to authenticated;

select 'a360_importar_edital instalada' as resultado;
