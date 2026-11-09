// Teste de telas com banco falso. Rodar: npm i jsdom && node testes/telas.smoke.js
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..') + '/';
const html = fs.readFileSync(R + 'index.html', 'utf8').replace(/<script src="https:[^"]+"><\/script>/, '').replace(/<script src="([^"]+)"><\/script>/g, '');
const dom = new JSDOM(html, { url: 'https://x.github.io/aprovacao360/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window; w.confirm = () => true; w.console = console;
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
    order() { return api; }, limit() { return api; },
    single() { one = true; return api; }, maybeSingle() { maybe = true; return api; },
    then(res, rej) {
      try {
        let data;
        if (op === 'insert') { data = payload.map(p => { const r = Object.assign({ id: 'id' + (++seq), usuario_id: UID, excluido_em: null }, p); if (tabela === 'a360_assuntos') r.status = r.status || 'nao_iniciado'; T(tabela).push(r); return r; }); }
        else if (op === 'update') { data = T(tabela).filter(r => filtros.every(f => f(r))); data.forEach(r => Object.assign(r, payload)); }
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
function rpc(nome, { dados }) {
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
['js/util.js','js/parsers.js','js/ui.js','js/telas-base.js','js/telas-edital.js','js/app.js'].forEach(f => w.eval(fs.readFileSync(R + f, 'utf8')));
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
  await go('#/revisoes'); console.log('15 placeholder:', /etapa 4/.test(txt()));
  process.exit(0);
})().catch(e => { console.error('FALHOU', e); process.exit(1); });
