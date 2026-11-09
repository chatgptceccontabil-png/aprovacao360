// Teste de telas com banco falso. Rodar: npm i jsdom && node testes/telas.smoke.js
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..') + '/';
const html = fs.readFileSync(R + 'index.html', 'utf8').replace(/<script src="https:[^"]+"><\/script>/, '').replace(/<script src="([^"]+)"><\/script>/g, '');
const dom = new JSDOM(html, { url: 'https://x.github.io/aprovacao360/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window; w.confirm = () => true; w.console = console; const abertos = []; w.open = u => { abertos.push(u); return null; }; w.document.execCommand = () => true;
// ---- banco falso ----
const DB = {}; let seq = 0; const UID = 'u1';
const T = n => (DB[n] = DB[n] || []);
function q(tabela) {
  let rows = null, op = 'select', payload = null, filtros = [], one = false, maybe = false, embed = null;
  const api = {
    select(c) { if (op === 'select') { if (/\(/.test(c || '')) embed = c; } api._ret = true; return api; },
    insert(o) { op = 'insert'; payload = Array.isArray(o) ? o : [o]; return api; },
    update(o) { op = 'update'; payload = o; return api; },
    eq(k, v) { filtros.push(r => r[k] === v); return api; },
    is(k, v) { filtros.push(r => (r[k] ?? null) === v); return api; },
    in(k, vs) { filtros.push(r => vs.includes(r[k])); return api; },
    gte(k, v) { filtros.push(r => (r[k] || '') >= v); return api; },
    order() { return api; }, limit() { return api; },
    single() { one = true; return api; }, maybeSingle() { maybe = true; return api; },
    then(res, rej) {
      try {
        let data;
        if (op === 'insert') { data = payload.map(p => { const r = Object.assign({ id: 'id' + (++seq), usuario_id: UID, excluido_em: null }, p); if (tabela === 'a360_assuntos') r.status = r.status || 'nao_iniciado'; T(tabela).push(r); return r; }); }
        else if (op === 'update') { data = T(tabela).filter(r => filtros.every(f => f(r))); data.forEach(r => Object.assign(r, payload)); }
        else if (tabela === 'a360_v_revisoes') { data = T('a360_revisoes').filter(r=>r.status==='pendente').map(r=>{const a=T('a360_assuntos').find(x=>x.id===r.assunto_id);const d=T('a360_disciplinas').find(x=>x.id===a.disciplina_id);return {...r,assunto:a.descricao,disciplina:d.nome,disciplina_id:d.id,concurso_id:d.concurso_id};}).filter(r => filtros.every(f => f(r))); }
        else if (tabela === 'a360_v_assuntos_stats') { data = T('a360_assuntos').map(a=>{const d=T('a360_disciplinas').find(x=>x.id===a.disciplina_id);const q=T('a360_questoes').filter(x=>x.assunto_id===a.id);const r=T('a360_revisoes').find(x=>x.assunto_id===a.id&&x.status==='pendente');return {assunto_id:a.id,concurso_id:d.concurso_id,feitas:q.reduce((s,x)=>s+x.feitas,0),acertos:q.reduce((s,x)=>s+x.acertos,0),dias:1,proxima_revisao:r?r.data_prevista:null,etapa_revisao:r?r.etapa:null};}).filter(r => filtros.every(f => f(r))); }
        else { data = T(tabela).filter(r => filtros.every(f => f(r)));
          if (embed && tabela === 'a360_disciplinas') data = data.map(d => ({ concurso_id: d.concurso_id, a360_assuntos: T('a360_assuntos').filter(a => a.disciplina_id === d.id) })); }
        data = JSON.parse(JSON.stringify(data));
        if (one) data = data[0] || null; else if (maybe) data = data[0] || null;
        return Promise.resolve({ data, error: null }).then(res, rej);
      } catch (e) { return Promise.resolve({ data: null, error: e }).then(res, rej); }
    }
  };
  return api;
}
function addD(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function regRev(ass, R, data){ const ET=[1,7,30,60]; let p=T('a360_revisoes').find(r=>r.assunto_id===ass&&r.status==='pendente'); let et=1, orig=data;
  if(p){p.status='concluida';p.resultado=R;et=p.etapa;orig=p.data_estudo_original;} let i=ET.indexOf(et); if(R>=85)i=Math.min(i+1,3); else if(R<70)i=Math.max(i-1,0);
  const n=ET[i]; T('a360_revisoes').push({id:'id'+(++seq),assunto_id:ass,etapa:n,data_prevista:addD(data,n),data_estudo_original:orig,status:'pendente',excluido_em:null}); return {etapa:n,data_prevista:addD(data,n)}; }
function rpc(nome, args) {
  if (nome==='a360_registrar_revisao') return Promise.resolve({data:regRev(args.p_assunto,args.p_resultado,args.p_data),error:null});
  if (nome==='a360_importar_checkpoint') { const d=args.dados;
    if (T('a360_checkpoints').some(c=>c.hash===d.hash)) return Promise.resolve({data:null,error:{message:'CHECKPOINT_DUPLICADO 09/11/2026'}});
    T('a360_checkpoints').push({id:'id'+(++seq),hash:d.hash,concurso_id:d.concurso_id,data_referencia:d.data,proxima:d.proxima,propostas:d.propostas,correcoes:d.correcoes,propostas_vistas:false,criado_em:'2026-11-09T10:00:00Z',excluido_em:null}); const map={}; const msgs=[];
    d.novos_assuntos.forEach(n=>{const r={id:'id'+(++seq),disciplina_id:n.disciplina_id,descricao:n.descricao,status:'nao_iniciado',ordem:99,excluido_em:null};T('a360_assuntos').push(r);map[n.chave]=r.id;});
    const A=x=>x.assunto_id||map[x.assunto_chave]||null;
    d.sessoes.forEach(x=>{const a=A(x);T('a360_sessoes').push({...x,assunto_id:a,data:d.data,concurso_id:d.concurso_id,excluido_em:null}); if(a&&x.status==='REALIZADO'&&!T('a360_revisoes').some(r=>r.assunto_id===a)){T('a360_revisoes').push({id:'id'+(++seq),assunto_id:a,etapa:1,data_prevista:addD(d.data,1),data_estudo_original:d.data,status:'pendente',excluido_em:null});msgs.push('1ª revisão');} const as=T('a360_assuntos').find(z=>z.id===a); if(as) as.status='em_estudo';});
    d.questoes.forEach(x=>T('a360_questoes').push({...x,assunto_id:A(x),data:d.data,excluido_em:null}));
    d.erros.forEach(x=>T('a360_erros').push({...x,assunto_id:A(x),data:d.data,revisado:false,excluido_em:null}));
    d.revisoes.forEach(x=>{regRev(A(x),x.resultado,d.data);msgs.push('rev');});
    return Promise.resolve({data:{data:d.data,sessoes:d.sessoes.length,questoes:d.questoes.length,questoes_feitas:d.questoes.reduce((s,x)=>s+x.feitas,0),erros:d.erros.length,revisoes:d.revisoes.length,assuntos_novos:d.novos_assuntos.length,mensagens:msgs},error:null}); }
  const dados = args.dados;
  let cid = dados.concurso_id, novo = false, nd = 0, nu = 0, na = 0;
  if (!cid) { const c = { id: 'id' + (++seq), usuario_id: UID, excluido_em: null, ...dados.concurso, prioritario: !T('a360_concursos').some(x => x.prioritario), status: 'publicado' }; T('a360_concursos').push(c); cid = c.id; novo = true; }
  dados.disciplinas.forEach(d => { let id = d.id;
    if (!id) { const r = { id: 'id' + (++seq), concurso_id: cid, nome: d.nome, peso: d.peso, incidencia: d.incidencia, ordem: nd + 1, excluido_em: null }; T('a360_disciplinas').push(r); id = r.id; nd++; }
    else { const r = T('a360_disciplinas').find(x => x.id === id); if (r.peso !== d.peso || r.incidencia !== d.incidencia) { r.peso = d.peso; r.incidencia = d.incidencia; nu++; } }
    d.assuntos.forEach((a, i) => { T('a360_assuntos').push({ id: 'id' + (++seq), disciplina_id: id, item_edital: a.item, descricao: a.descricao, status: 'nao_iniciado', ordem: i + 1, excluido_em: null }); na++; }); });
  return Promise.resolve({ data: { concurso_id: cid, concurso_novo: novo, disciplinas_novas: nd, disciplinas_atualizadas: nu, assuntos_novos: na }, error: null });
}
w.supabase = { createClient: () => ({ from: q, rpc, auth: {
  onAuthStateChange(cb) { setTimeout(() => cb('SIGNED_IN', { user: { id: UID, email: 'eu@x.com', user_metadata: {} } }), 0); },
  getSession: () => Promise.resolve({ data: { session: { user: { id: UID } } }, error: null }), signOut: () => Promise.resolve({}) } }) };
w.A360_CONFIG = { SUPABASE_URL: 'https://a.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_x' };
['js/util.js','js/parsers.js','js/calc.js','js/ui.js','js/telas-base.js','js/telas-edital.js','js/telas-checkpoint.js','js/telas-hoje.js','js/app.js'].forEach(f => w.eval(fs.readFileSync(R + f, 'utf8')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = s => w.document.querySelector(s), txt = () => w.document.getElementById('conteudo').textContent.replace(/\s+/g, ' ');
const go = async h => { w.location.hash = h; await sleep(60); };
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const btn = t => [...w.document.querySelectorAll('button,a')].find(b => b.textContent.trim().startsWith(t));
(async () => {
  w.document.dispatchEvent(new w.Event('DOMContentLoaded')); await sleep(100);
  console.log('1 app visível:', !$('#app').hidden, '| config criada:', T('a360_configuracoes').length);
  console.log('2 hoje vazio:', /Comece pelo seu concurso/.test(txt()));
  await go('#/importar'); click(btn('EDITAL'));
  const ed = `=== EDITAL ===
CONCURSO | ISS-SP-AFTM-2026 | Prefeitura de São Paulo | Auditor Fiscal | FGV | 01/2026 | 2027-02-21
DISCIPLINA | Direito Tributário | 5 | 5
DISCIPLINA | Português | 3 | 4
ASSUNTO | Direito Tributário | 1 | Competência tributária
ASSUNTO | Direito Tributário | 2 | Lançamento
ASSUNTO | Português | 1 | Crase
=== FIM ===`;
  $('#txt-edital').value = ed; click(btn('Analisar')); await sleep(60);
  console.log('3 prévia:', /Novo concurso: ISS-SP-AFTM-2026/.test(txt()), '|', btn('Confirmar').textContent);
  click(btn('Confirmar')); await sleep(200);
  console.log('4 após importar → rota:', w.location.hash, '| ativo:', T('a360_configuracoes')[0].concurso_ativo_id, '| assuntos:', T('a360_assuntos').length);
  console.log('5 edital:', /Direito Tributário/.test(txt()) && /Crase/.test(txt()), '| cobertura 0%:', /Edital coberto \(RN13\)0%/.test(txt()));
  // reimportar mesmo edital
  await go('#/importar'); click(btn('EDITAL')); $('#txt-edital').value = ed; click(btn('Analisar')); await sleep(60);
  console.log('6 reimport nada novo:', btn('Confirmar').disabled, /já está todo cadastrado/.test(txt()));
  // + um assunto e peso novo
  $('#txt-edital').value = ed.replace('DISCIPLINA | Português | 3 | 4', 'DISCIPLINA | Português | 4 | 4').replace('=== FIM ===', 'ASSUNTO | Português | 2 | Concordância\n=== FIM ==='); click(btn('Analisar')); await sleep(60);
  console.log('7 reimport:', btn('Confirmar').textContent);
  click(btn('Confirmar')); await sleep(200);
  console.log('8 assuntos:', T('a360_assuntos').length, '| peso Port:', T('a360_disciplinas').find(d => d.nome === 'Português').peso);
  // filtro busca
  await go('#/edital'); const b = $('input[type=search]'); b.value = 'crase'; b.dispatchEvent(new w.Event('input')); await sleep(20);
  console.log('9 busca crase:', /Crase/.test(txt()) && !/Competência/.test(txt()));
  // concursos tela
  await go('#/concursos'); console.log('10 concursos:', /ISS-SP-AFTM-2026/.test(txt()), /Ativo/.test(txt()), /Edital coberto: 0%/.test(txt()));
  click(btn('+ Concurso')); await sleep(20);
  const inputs = w.document.querySelectorAll('.painel input'); inputs[0].value = 'ISS RJ'; click(btn('Cadastrar')); await sleep(30);
  console.log('11 validação espaço:', /não pode ter espaços/.test($('.painel').textContent));
  inputs[0].value = 'ISS-RJ-2026'; inputs[1].value = 'Pref RJ'; inputs[2].value = 'Fiscal'; click(btn('Cadastrar')); await sleep(150);
  console.log('12 cadastrado:', T('a360_concursos').length, '| prioritário do novo:', T('a360_concursos')[1].prioritario);
  await go('#/configuracoes'); console.log('13 config:', /Suas IAs/.test(txt()));
  await go('#/hoje'); console.log('14 hoje:', /Edital coberto/.test(txt()), /dias até a prova|Dias até a prova/.test(txt()));
  await go('#/erros'); console.log('15 placeholder:', /etapa 6/.test(txt()));
  // ---- etapa 4 ----
  const cp = `=== CHECKPOINT ===
data: 2026-11-09
concurso: ISS-SP-AFTM-2026
conversa: Aula
ia: ChatGPT
SESSAO | Direito Tributário | Lançamento | aula | REALIZADO | 50
QUESTOES | Direito Tributário | Lancamento | 10 | 7
ERRO | Direito Tributário | Lançamento por homologação | pegadinha | quem antecipa é o sujeito passivo
REVISAO | Português | Crase | 90
QUESTOES | Direito Tributário | Lançamento | 3 | 9
PROPOSTA | aumentar Português para 4 h
PROXIMA | /aula Direito Tributário > Competência tributária
=== FIM ===`;
  await go('#/importar');
  console.log('16 aba padrão checkpoint:', !!$('#txt-checkpoint'));
  $('#txt-checkpoint').value = cp; click(btn('Analisar')); await sleep(80);
  console.log('17 prévia:', /IA: ChatGPT/.test(txt()), /⚠ decidir/.test(txt()), /✖ inválida/.test(txt()), 'confirmar desativado:', btn('Confirmar').disabled);
  click(btn('Criar novo assunto')); await sleep(20);
  console.log('18 após decidir:', btn('Confirmar').disabled, '|', btn('Confirmar').textContent);
  click(btn('Confirmar')); await sleep(150);
  console.log('19 resultado:', /importado/.test(txt()), '| sessões:', T('a360_sessoes').length, '| revisões pendentes:', T('a360_revisoes').filter(r=>r.status==='pendente').length, '| erros:', T('a360_erros').length);
  $('#txt-checkpoint').value = cp; click(btn('Analisar')); await sleep(80);
  console.log('20 duplicado:', /já foi importado/.test(txt()));
  await go('#/revisoes'); await sleep(50);
  console.log('21 revisões:', /Lançamento/.test(txt()), /Crase/.test(txt()), /Mais adiante|Próximos 7 dias/.test(txt()));
  const inp = w.document.querySelector('.inp-pct'); inp.value = '90'; click(btn('Registrar')); await sleep(80);
  console.log('22 registrar:', T('a360_revisoes').some(r=>r.status==='concluida'&&r.resultado===90&&r.etapa===1), T('a360_revisoes').some(r=>r.status==='pendente'&&r.etapa===7));
  await go('#/edital'); await sleep(50);
  console.log('23 edital stats:', /10 q · 70%/.test(txt()), /revisão/.test(txt()));
  // ---- etapa 5 ----
  await go('#/hoje'); await sleep(80);
  console.log('24 hoje:', /Sua próxima sessão/.test(txt()), /Estudar no Claude/.test(txt()), /Estudar no ChatGPT/.test(txt()), /Acerto \(30 dias\)/.test(txt()));
  console.log('25 sequência no topo:', $('#seq').textContent, '| alerta proposta:', /Proposta aguardando/.test(txt()), '| próxima:', /Competência tributária/.test(txt()));
  click(btn('Estudar no Claude')); await sleep(20);
  console.log('26 abriu:', abertos[0], '| aviso:', $('#aviso').textContent);
  click(btn('Estudar no ChatGPT')); await sleep(20); console.log('27 abriu:', abertos[1]);
  click(btn('Ver prompt')); await sleep(20);
  const pa = w.document.querySelector('.prompt-area');
  console.log('28 prompt:', pa && pa.value.split('\n')[0]);
  w.document.querySelector('.painel-fundo').remove();
  click(btn('Marcar como vista')); await sleep(60); console.log('29 proposta vista:', !/Proposta aguardando/.test(txt()));
  await go('#/edital'); await sleep(60); click(btn('Estudar')); await sleep(80);
  const pa2 = w.document.querySelectorAll('.prompt-area'); console.log('30 prompt assunto:', /escolhido por mim/.test(pa2[pa2.length-1].value));
  w.document.querySelectorAll('.painel-fundo').forEach(x=>x.remove());
  await go('#/importar?aba=edital'); console.log('31 rota com parâmetro:', !!$('#txt-edital'));
  process.exit(0);
})().catch(e => { console.error('FALHOU', e); process.exit(1); });
