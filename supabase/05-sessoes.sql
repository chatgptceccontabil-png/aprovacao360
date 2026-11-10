-- =====================================================================
-- Aprovação 360° — Etapa 7: sessão de estudo pelo cronômetro ou à mão
-- RN01, RN04, RN17, RN19
-- COMO USAR: Supabase → SQL Editor → New query → cole → Run.
-- Pode rodar de novo sem problema.
-- =====================================================================
create or replace function public.a360_registrar_sessao(dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_conc  uuid := nullif(dados->>'concurso_id', '')::uuid;
  v_disc  uuid := nullif(dados->>'disciplina_id', '')::uuid;
  v_ass   uuid := nullif(dados->>'assunto_id', '')::uuid;
  v_data  date := coalesce(nullif(dados->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
  v_tipo  text := coalesce(nullif(dados->>'tipo', ''), 'aula');
  v_min   int := (dados->>'minutos')::int;
  v_orig  text := coalesce(nullif(dados->>'origem', ''), 'cronometro');
  v_id    uuid;
  v_rev   boolean := false;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre de novo.'; end if;
  if v_min is null or v_min < 1 or v_min > 720 then raise exception 'A sessão deve ter de 1 a 720 minutos.'; end if;
  if v_orig not in ('cronometro', 'manual') then raise exception 'Origem inválida.'; end if;
  if v_data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Uma sessão realizada não pode ter data futura.'; end if;
  if not exists (select 1 from a360_disciplinas where id = v_disc and concurso_id = v_conc and excluido_em is null) then
    raise exception 'Disciplina não pertence a este concurso.';
  end if;
  if v_ass is not null and not exists (select 1 from a360_assuntos where id = v_ass and disciplina_id = v_disc and excluido_em is null) then
    raise exception 'Assunto não pertence à disciplina.';
  end if;

  insert into a360_sessoes (concurso_id, disciplina_id, assunto_id, data, tipo, status, minutos, origem)
  values (v_conc, v_disc, v_ass, v_data, v_tipo, 'REALIZADO', v_min, v_orig)
  returning id into v_id;

  if v_ass is not null then
    -- RN01: primeira revisão no dia seguinte ao primeiro estudo
    if v_tipo in ('aula', 'rapida', 'leitura', 'lei_seca')
       and not exists (select 1 from a360_revisoes where assunto_id = v_ass and excluido_em is null) then
      insert into a360_revisoes (assunto_id, data_estudo_original, etapa, data_prevista) values (v_ass, v_data, 1, v_data + 1);
      v_rev := true;
    end if;
    update a360_assuntos set ultima_atividade = greatest(coalesce(ultima_atividade, v_data), v_data) where id = v_ass;
    perform a360_recalcular_status(v_ass);
  end if;

  return jsonb_build_object('sessao_id', v_id, 'primeira_revisao', case when v_rev then v_data + 1 end);
end;
$$;

revoke all on function public.a360_registrar_sessao(jsonb) from public;
grant execute on function public.a360_registrar_sessao(jsonb) to authenticated;

select 'etapa 7 instalada: sessões do cronômetro' as resultado;
