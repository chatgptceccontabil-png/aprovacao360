-- =====================================================================
-- Aprovação 360° — Etapa 4: importação do CHECKPOINT e motor de revisões
-- RN01 a RN04, RN21, RN29, RN32
-- COMO USAR: Supabase → SQL Editor → New query → cole → Run.
-- Pode rodar de novo sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- RN04: recalcula o status de um assunto a partir dos dados registrados
-- ---------------------------------------------------------------------
create or replace function public.a360_recalcular_status(p_assunto uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_f int; v_a int; v_d int; v_rev boolean; v_ativ boolean; v_st text;
begin
  select coalesce(sum(feitas), 0), coalesce(sum(acertos), 0), count(distinct data)
    into v_f, v_a, v_d
    from a360_questoes where assunto_id = p_assunto and excluido_em is null;
  v_rev := exists (select 1 from a360_revisoes where assunto_id = p_assunto and status = 'concluida' and resultado >= 70 and excluido_em is null);
  v_ativ := v_f > 0
    or exists (select 1 from a360_sessoes where assunto_id = p_assunto and status = 'REALIZADO' and excluido_em is null)
    or exists (select 1 from a360_revisoes where assunto_id = p_assunto and status = 'concluida' and excluido_em is null);
  v_st := case
    when v_f >= 20 and v_a::numeric / v_f >= 0.8 and v_d >= 2 then 'dominado'
    when v_rev then 'revisao'
    when v_ativ then 'em_estudo'
    else 'nao_iniciado' end;
  update a360_assuntos set status = v_st where id = p_assunto and status is distinct from v_st;
  return v_st;
end;
$$;

-- ---------------------------------------------------------------------
-- RN02 / RN03: registra o resultado de uma revisão e agenda a próxima
-- Sequência 1 → 7 → 30 → 60 dias. ≥85% avança; 70–84% repete; <70% volta.
-- ---------------------------------------------------------------------
create or replace function public.a360_registrar_revisao(p_assunto uuid, p_resultado integer, p_data date default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_data   date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  r        record;
  v_etapa  smallint;
  v_orig   date;
  v_idx    int;
  v_nova   smallint;
  etapas   smallint[] := array[1, 7, 30, 60];
begin
  if p_resultado is null or p_resultado < 0 or p_resultado > 100 then
    raise exception 'O resultado da revisão deve ser de 0 a 100.';
  end if;
  if not exists (select 1 from a360_assuntos where id = p_assunto and excluido_em is null) then
    raise exception 'Assunto não encontrado.';
  end if;

  select * into r from a360_revisoes
   where assunto_id = p_assunto and status = 'pendente' and excluido_em is null limit 1;
  if found then
    update a360_revisoes set status = 'concluida', resultado = p_resultado, data_realizada = v_data where id = r.id;
    v_etapa := r.etapa; v_orig := r.data_estudo_original;
  else
    -- RN03: sem revisão pendente, registra uma concluída na etapa 1
    insert into a360_revisoes (assunto_id, data_estudo_original, etapa, data_prevista, status, resultado, data_realizada)
    values (p_assunto, v_data, 1, v_data, 'concluida', p_resultado, v_data);
    v_etapa := 1; v_orig := v_data;
  end if;

  v_idx := coalesce(array_position(etapas, v_etapa), 1);
  if p_resultado >= 85 then v_idx := least(v_idx + 1, 4);
  elsif p_resultado < 70 then v_idx := greatest(v_idx - 1, 1);
  end if;
  v_nova := etapas[v_idx];

  insert into a360_revisoes (assunto_id, data_estudo_original, etapa, data_prevista)
  values (p_assunto, v_orig, v_nova, v_data + v_nova);

  update a360_assuntos set ultima_atividade = greatest(coalesce(ultima_atividade, v_data), v_data) where id = p_assunto;
  perform a360_recalcular_status(p_assunto);
  return jsonb_build_object('etapa', v_nova, 'data_prevista', v_data + v_nova);
end;
$$;

-- ---------------------------------------------------------------------
-- RN20–RN22, RN29, RN32: importa um CHECKPOINT inteiro numa transação
-- ---------------------------------------------------------------------
create or replace function public.a360_importar_checkpoint(dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_conc  uuid := nullif(dados->>'concurso_id', '')::uuid;
  v_data  date := coalesce(nullif(dados->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
  v_ia    text := nullif(dados->>'ia', '');
  v_cp    uuid;
  v_map   jsonb := '{}'::jsonb;
  v_itens jsonb;
  x       jsonb;
  v_disc  uuid;
  v_ass   uuid;
  v_ord   int;
  v_tocados uuid[] := '{}';
  v_msgs  text[] := '{}';
  v_rev   jsonb;
  v_ant   timestamptz;
  n_s int := 0; n_q int := 0; n_qf int := 0; n_e int := 0; n_r int := 0; n_novos int := 0; n_rev1 int := 0;
begin
  if v_uid is null then raise exception 'Sessão expirada. Entre de novo.'; end if;
  if v_ia is not null and v_ia not in ('claude', 'chatgpt', 'outra') then v_ia := 'outra'; end if;
  if not exists (select 1 from a360_concursos where id = v_conc and excluido_em is null) then
    raise exception 'Concurso não encontrado.';
  end if;

  -- RN21: o mesmo checkpoint não entra duas vezes
  select criado_em into v_ant from a360_checkpoints where hash = dados->>'hash' and excluido_em is null limit 1;
  if found then
    raise exception 'CHECKPOINT_DUPLICADO %', to_char(v_ant at time zone 'America/Sao_Paulo', 'DD/MM/YYYY');
  end if;

  insert into a360_checkpoints (concurso_id, data_referencia, conversa, ia, texto_original, hash, resumo, proxima, propostas, correcoes)
  values (v_conc, v_data, nullif(dados->>'conversa', ''), v_ia, dados->>'texto_original', dados->>'hash',
          coalesce(dados->'resumo', '{}'::jsonb), nullif(dados->>'proxima', ''), nullif(dados->>'propostas', ''), nullif(dados->>'correcoes', ''))
  returning id into v_cp;

  -- assuntos novos decididos na pré-visualização
  for x in select * from jsonb_array_elements(coalesce(dados->'novos_assuntos', '[]'::jsonb)) loop
    v_disc := (x->>'disciplina_id')::uuid;
    if not exists (select 1 from a360_disciplinas where id = v_disc and concurso_id = v_conc and excluido_em is null) then
      raise exception 'Disciplina não pertence a este concurso.';
    end if;
    select coalesce(max(ordem), 0) + 1 into v_ord from a360_assuntos where disciplina_id = v_disc and excluido_em is null;
    insert into a360_assuntos (disciplina_id, descricao, ordem) values (v_disc, x->>'descricao', v_ord) returning id into v_ass;
    v_map := v_map || jsonb_build_object(x->>'chave', v_ass);
    n_novos := n_novos + 1;
  end loop;

  -- valida e resolve disciplina/assunto de cada item (sem tabela temporária)
  select coalesce(jsonb_agg(v || jsonb_build_object('_g', g, '_o', o,
           '_disc', nullif(v->>'disciplina_id', ''),
           '_ass', coalesce(nullif(v->>'assunto_id', ''), v_map->>(v->>'assunto_chave'))) order by g, o), '[]'::jsonb)
    into v_itens
    from (
      select 'sessoes' g, ordinality o, value v from jsonb_array_elements(coalesce(dados->'sessoes', '[]'::jsonb)) with ordinality
      union all select 'questoes', ordinality, value from jsonb_array_elements(coalesce(dados->'questoes', '[]'::jsonb)) with ordinality
      union all select 'erros', ordinality, value from jsonb_array_elements(coalesce(dados->'erros', '[]'::jsonb)) with ordinality
      union all select 'revisoes', ordinality, value from jsonb_array_elements(coalesce(dados->'revisoes', '[]'::jsonb)) with ordinality
      union all select 'dificuldades', ordinality, value from jsonb_array_elements(coalesce(dados->'dificuldades', '[]'::jsonb)) with ordinality
      union all select 'ultimos', ordinality, value from jsonb_array_elements(coalesce(dados->'ultimos', '[]'::jsonb)) with ordinality
    ) s;

  for x in select * from jsonb_array_elements(v_itens) loop
    v_disc := nullif(x->>'_disc', '')::uuid;
    v_ass := nullif(x->>'_ass', '')::uuid;
    if v_disc is null or not exists (select 1 from a360_disciplinas where id = v_disc and concurso_id = v_conc and excluido_em is null) then
      raise exception 'Há linha com disciplina que não pertence a este concurso.';
    end if;
    if v_ass is null and x->>'_g' <> 'sessoes' then
      raise exception 'Questões, erros, revisões, dificuldades e último ponto precisam de assunto.';
    end if;
    if v_ass is not null and not exists (select 1 from a360_assuntos where id = v_ass and disciplina_id = v_disc and excluido_em is null) then
      raise exception 'Há linha com assunto que não pertence à disciplina informada.';
    end if;
  end loop;

  -- sessões (+ RN01: primeira revisão no dia seguinte ao primeiro estudo)
  for x in select value from jsonb_array_elements(v_itens) where value->>'_g' = 'sessoes' loop
    v_disc := (x->>'_disc')::uuid; v_ass := nullif(x->>'_ass', '')::uuid;
    insert into a360_sessoes (concurso_id, disciplina_id, assunto_id, data, tipo, status, minutos, origem, ia, checkpoint_id)
    values (v_conc, v_disc, v_ass, v_data, x->>'tipo', x->>'status', coalesce((x->>'minutos')::int, 0), 'checkpoint', v_ia, v_cp);
    n_s := n_s + 1;
    if v_ass is not null and x->>'status' = 'REALIZADO' then
      v_tocados := array_append(v_tocados, v_ass);
      if x->>'tipo' in ('aula', 'rapida', 'leitura', 'lei_seca')
         and not exists (select 1 from a360_revisoes where assunto_id = v_ass and excluido_em is null) then
        insert into a360_revisoes (assunto_id, data_estudo_original, etapa, data_prevista) values (v_ass, v_data, 1, v_data + 1);
        n_rev1 := n_rev1 + 1;
        v_msgs := array_append(v_msgs, (select descricao from a360_assuntos where id = v_ass) || ': 1ª revisão em ' || to_char(v_data + 1, 'DD/MM'));
      end if;
    end if;
  end loop;

  for x in select value from jsonb_array_elements(v_itens) where value->>'_g' = 'questoes' loop
    v_disc := (x->>'_disc')::uuid; v_ass := (x->>'_ass')::uuid;
    insert into a360_questoes (assunto_id, disciplina_id, data, feitas, acertos, origem, checkpoint_id)
    values (v_ass, v_disc, v_data, (x->>'feitas')::int, (x->>'acertos')::int, 'checkpoint', v_cp);
    n_q := n_q + 1; n_qf := n_qf + (x->>'feitas')::int;
    v_tocados := array_append(v_tocados, v_ass);
  end loop;

  for x in select value from jsonb_array_elements(v_itens) where value->>'_g' = 'erros' loop
    v_disc := (x->>'_disc')::uuid; v_ass := (x->>'_ass')::uuid;
    insert into a360_erros (assunto_id, disciplina_id, data, motivo, descricao, checkpoint_id)
    values (v_ass, v_disc, v_data, x->>'motivo', left(x->>'descricao', 500), v_cp);
    n_e := n_e + 1;
  end loop;

  for x in select value from jsonb_array_elements(v_itens) where value->>'_g' = 'dificuldades' loop
    v_ass := (x->>'_ass')::uuid;
    update a360_assuntos
       set dificuldades = coalesce(dificuldades || E'\n', '') || to_char(v_data, 'DD/MM') || ': ' || (x->>'texto')
     where id = v_ass;
  end loop;

  for x in select value from jsonb_array_elements(v_itens) where value->>'_g' = 'ultimos' loop
    v_ass := (x->>'_ass')::uuid;
    update a360_assuntos set ultimo_ponto = x->>'texto' where id = v_ass;
  end loop;

  -- atividade e status (RN04) dos assuntos estudados
  update a360_assuntos set ultima_atividade = greatest(coalesce(ultima_atividade, v_data), v_data)
   where id = any (v_tocados);
  perform a360_recalcular_status(t) from (select distinct unnest(v_tocados) t) s;

  -- revisões (RN02/RN03) por último, para valerem sobre o estado já atualizado
  for x in select value from jsonb_array_elements(v_itens) where value->>'_g' = 'revisoes' loop
    v_ass := (x->>'_ass')::uuid;
    v_rev := a360_registrar_revisao(v_ass, (x->>'resultado')::int, v_data);
    n_r := n_r + 1;
    v_msgs := array_append(v_msgs, (select descricao from a360_assuntos where id = v_ass) || ': próxima revisão em ' || to_char((v_rev->>'data_prevista')::date, 'DD/MM') || ' (etapa ' || (v_rev->>'etapa') || ' dias)');
  end loop;

  return jsonb_build_object(
    'checkpoint_id', v_cp, 'data', v_data, 'sessoes', n_s, 'questoes', n_q, 'questoes_feitas', n_qf,
    'erros', n_e, 'revisoes', n_r, 'primeiras_revisoes', n_rev1, 'assuntos_novos', n_novos, 'mensagens', to_jsonb(v_msgs));
end;
$$;

-- ---------------------------------------------------------------------
-- Visões usadas pelas telas (respeitam a segurança por usuário)
-- ---------------------------------------------------------------------
create or replace view public.a360_v_revisoes with (security_invoker = true) as
select r.id, r.assunto_id, r.etapa, r.data_prevista, r.data_estudo_original,
       a.descricao as assunto, a.item_edital, d.id as disciplina_id, d.nome as disciplina, d.concurso_id
  from a360_revisoes r
  join a360_assuntos a on a.id = r.assunto_id and a.excluido_em is null
  join a360_disciplinas d on d.id = a.disciplina_id and d.excluido_em is null
 where r.status = 'pendente' and r.excluido_em is null;

create or replace view public.a360_v_assuntos_stats with (security_invoker = true) as
select a.id as assunto_id, d.id as disciplina_id, d.concurso_id,
       coalesce(q.feitas, 0)::int as feitas, coalesce(q.acertos, 0)::int as acertos, coalesce(q.dias, 0)::int as dias,
       r.data_prevista as proxima_revisao, r.etapa as etapa_revisao
  from a360_assuntos a
  join a360_disciplinas d on d.id = a.disciplina_id and d.excluido_em is null
  left join (select assunto_id, sum(feitas) feitas, sum(acertos) acertos, count(distinct data) dias
               from a360_questoes where excluido_em is null group by assunto_id) q on q.assunto_id = a.id
  left join a360_revisoes r on r.assunto_id = a.id and r.status = 'pendente' and r.excluido_em is null
 where a.excluido_em is null;

grant select on public.a360_v_revisoes, public.a360_v_assuntos_stats to authenticated;
revoke all on function public.a360_recalcular_status(uuid) from public;
revoke all on function public.a360_registrar_revisao(uuid, integer, date) from public;
revoke all on function public.a360_importar_checkpoint(jsonb) from public;
grant execute on function public.a360_recalcular_status(uuid) to authenticated;
grant execute on function public.a360_registrar_revisao(uuid, integer, date) to authenticated;
grant execute on function public.a360_importar_checkpoint(jsonb) to authenticated;

select 'etapa 4 instalada: importar checkpoint e revisões' as resultado;
