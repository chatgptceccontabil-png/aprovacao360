-- =====================================================================
-- Aprovação 360° — Etapa 6: planejamento (ciclo) e simulados
-- RN06, RN10, RN16, RN29
-- COMO USAR: Supabase → SQL Editor → New query → cole → Run.
-- Pode rodar de novo sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- RN10: aprova uma nova versão do planejamento (a anterior vai para o
-- histórico) e grava as horas de cada disciplina no ciclo (RN06)
-- dados = { concurso_id, horas_semana, meta_questoes_semana, observacoes,
--           distribuicao: [{ disciplina_id, horas }] }
-- ---------------------------------------------------------------------
create or replace function public.a360_aprovar_planejamento(dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_conc   uuid := nullif(dados->>'concurso_id', '')::uuid;
  v_horas  numeric := (dados->>'horas_semana')::numeric;
  v_meta   int := coalesce(nullif(dados->>'meta_questoes_semana', '')::int, 0);
  v_versao int;
  v_id     uuid;
  x        jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre de novo.'; end if;
  if not exists (select 1 from a360_concursos where id = v_conc and excluido_em is null) then
    raise exception 'Concurso não encontrado.';
  end if;
  if v_horas is null or v_horas <= 0 or v_horas > 100 then
    raise exception 'Horas por semana deve ser maior que zero e no máximo 100.';
  end if;
  if v_meta < 0 then raise exception 'A meta de questões não pode ser negativa.'; end if;

  select coalesce(max(versao), 0) + 1 into v_versao from a360_planejamentos where concurso_id = v_conc;
  update a360_planejamentos set vigente = false where concurso_id = v_conc and vigente;
  insert into a360_planejamentos (concurso_id, versao, data_aprovacao, horas_semana, meta_questoes_semana, vigente, observacoes)
  values (v_conc, v_versao, (now() at time zone 'America/Sao_Paulo')::date, v_horas, v_meta, true, nullif(dados->>'observacoes', ''))
  returning id into v_id;

  for x in select * from jsonb_array_elements(coalesce(dados->'distribuicao', '[]'::jsonb)) loop
    update a360_disciplinas set horas_ciclo = (x->>'horas')::numeric
     where id = (x->>'disciplina_id')::uuid and concurso_id = v_conc and excluido_em is null;
    if not found then raise exception 'Disciplina do ciclo não pertence a este concurso.'; end if;
  end loop;

  return jsonb_build_object('planejamento_id', v_id, 'versao', v_versao);
end;
$$;

-- ---------------------------------------------------------------------
-- RN16: grava um simulado com o detalhe por disciplina numa transação
-- dados = { id (opcional, para editar), concurso_id, data, nome, origem, total_questoes,
--           acertos, tempo_minutos, observacoes, disciplinas: [{ disciplina_id, questoes, acertos }] }
-- ---------------------------------------------------------------------
create or replace function public.a360_salvar_simulado(dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id    uuid := nullif(dados->>'id', '')::uuid;
  v_conc  uuid := nullif(dados->>'concurso_id', '')::uuid;
  v_total int := (dados->>'total_questoes')::int;
  v_acert int := (dados->>'acertos')::int;
  v_soma  int;
  x       jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre de novo.'; end if;
  if not exists (select 1 from a360_concursos where id = v_conc and excluido_em is null) then
    raise exception 'Concurso não encontrado.';
  end if;
  if v_total is null or v_total < 1 then raise exception 'O total de questões deve ser pelo menos 1.'; end if;
  if v_acert is null or v_acert < 0 or v_acert > v_total then raise exception 'Acertos não podem ser maiores que o total.'; end if;
  select coalesce(sum((e->>'questoes')::int), 0) into v_soma from jsonb_array_elements(coalesce(dados->'disciplinas', '[]'::jsonb)) e;
  if v_soma > v_total then
    raise exception 'A soma das disciplinas (%) passa do total (%).', v_soma, v_total;
  end if;

  if v_id is null then
    insert into a360_simulados (concurso_id, data, nome, origem, total_questoes, acertos, tempo_minutos, observacoes)
    values (v_conc, (dados->>'data')::date, dados->>'nome', coalesce(nullif(dados->>'origem', ''), 'outro'), v_total, v_acert,
            nullif(dados->>'tempo_minutos', '')::int, nullif(dados->>'observacoes', ''))
    returning id into v_id;
  else
    update a360_simulados set data = (dados->>'data')::date, nome = dados->>'nome', origem = coalesce(nullif(dados->>'origem', ''), 'outro'),
           total_questoes = v_total, acertos = v_acert, tempo_minutos = nullif(dados->>'tempo_minutos', '')::int, observacoes = nullif(dados->>'observacoes', '')
     where id = v_id and concurso_id = v_conc and excluido_em is null;
    if not found then raise exception 'Simulado não encontrado.'; end if;
    update a360_simulado_disciplinas set excluido_em = now() where simulado_id = v_id and excluido_em is null;
  end if;

  for x in select * from jsonb_array_elements(coalesce(dados->'disciplinas', '[]'::jsonb)) loop
    if not exists (select 1 from a360_disciplinas where id = (x->>'disciplina_id')::uuid and concurso_id = v_conc and excluido_em is null) then
      raise exception 'Disciplina do simulado não pertence a este concurso.';
    end if;
    insert into a360_simulado_disciplinas (simulado_id, disciplina_id, questoes, acertos)
    values (v_id, (x->>'disciplina_id')::uuid, (x->>'questoes')::int, (x->>'acertos')::int);
  end loop;

  return jsonb_build_object('simulado_id', v_id, 'percentual', round(v_acert * 100.0 / v_total, 1));
end;
$$;

revoke all on function public.a360_aprovar_planejamento(jsonb) from public;
revoke all on function public.a360_salvar_simulado(jsonb) from public;
grant execute on function public.a360_aprovar_planejamento(jsonb) to authenticated;
grant execute on function public.a360_salvar_simulado(jsonb) to authenticated;

select 'etapa 6 instalada: ciclo e simulados' as resultado;
