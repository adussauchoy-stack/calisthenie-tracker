// calisthenie/src/app.js
import { TYPES, lastSerie, formatLast, formatSerie, computeRecords, chartPoints, svgPath } from './model.js';
import { loadDB, saveDB, addSerie, CATEGORIES, childrenOf, addExo, updateExo, removeExo, changeCategorie,
         exportJSON, importJSON, besoinRappelExport } from './store.js';
import { SEED_EXOS } from './seed.js';

const store = window.localStorage;
let db = loadDB(store, SEED_EXOS);
if (db.exos.length === 0) { db.exos = [...SEED_EXOS]; saveDB(store, db); }

let view = { level: 'cat' };
let tempSets = [];

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const exoById = (id) => db.exos.find((e) => e.id === id);
const typeLabel = (t) => (t === TYPES.TEMPS ? '⏱ maintien' : t === TYPES.REPS_LEST ? '🏋 reps + lest' : '🔁 reps');

function bigBtn(txt, tag, cls, onclick) {
  const b = el('button', 'btn ' + cls);
  const tagEl = el('span', 'tag'); tagEl.textContent = tag;
  const txtEl = el('span'); txtEl.textContent = txt;
  b.appendChild(tagEl); b.appendChild(txtEl);
  b.onclick = onclick;
  return b;
}

function render() {
  const screen = $('screen'), back = $('back'), crumb = $('crumb'), title = $('title');
  screen.innerHTML = '';
  back.style.display = view.level === 'cat' ? 'none' : 'flex';
  $('banner').hidden = !besoinRappelExport(db);
  $('banner').textContent = '🔔 Pense à exporter ta sauvegarde (Réglages).';

  if (view.level === 'cat') {
    crumb.textContent = 'Séance'; title.textContent = 'Choisis une catégorie';
    const grid = el('div', 'grid');
    CATEGORIES.forEach((c) => grid.appendChild(bigBtn(c, 'Catégorie', 'cat', () => { view = { level: 'node', catId: c }; render(); })));
    screen.appendChild(grid); return;
  }
  if (view.level === 'node') {
    crumb.textContent = view.catId; title.textContent = view.catId;
    const grid = el('div', 'grid');
    childrenOf(db, view.catId).forEach((n) => {
      if (n.estFamille) grid.appendChild(bigBtn(n.nom, 'Famille ›', 'fam', () => { view = { level: 'list', catId: view.catId, familleId: n.id }; render(); }));
      else grid.appendChild(bigBtn(n.nom, typeLabel(n.type), 'exo', () => openEntry(n.id)));
    });
    screen.appendChild(grid); return;
  }
  if (view.level === 'list') {
    const fam = exoById(view.familleId);
    crumb.textContent = `${view.catId} › ${fam.nom}`; title.textContent = fam.nom;
    const grid = el('div', 'grid');
    childrenOf(db, view.catId, view.familleId).forEach((n) => grid.appendChild(bigBtn(n.nom, typeLabel(n.type), 'exo', () => openEntry(n.id))));
    screen.appendChild(grid); return;
  }
  if (view.level === 'entry') return renderEntry();
  if (view.level === 'progress') return renderProgress();
  if (view.level === 'settings') return renderSettings();
}

function goBack() {
  if (view.level === 'progress' && view.exoId) { view = { level: 'progress' }; return render(); }
  if (view.level === 'node' || view.level === 'progress' || view.level === 'settings') view = { level: 'cat' };
  else if (view.level === 'list') view = { level: 'node', catId: view.catId };
  else if (view.level === 'entry') {
    const n = exoById(view.exoId);
    view = n.parentId ? { level: 'list', catId: n.categorieId, familleId: n.parentId } : { level: 'node', catId: n.categorieId };
  }
  render();
}

function openEntry(exoId) { view = { level: 'entry', exoId }; tempSets = []; render(); }

function numField(id, label, ph) {
  const f = el('div', 'field');
  f.innerHTML = `<label for="f_${id}">${label}</label><input id="f_${id}" type="number" inputmode="numeric" placeholder="${ph}">`;
  return f;
}

function renderEntry() {
  const n = exoById(view.exoId);
  $('crumb').textContent = 'Saisie'; $('title').textContent = n.nom;
  const screen = $('screen');
  const last = el('div', 'last'); last.innerHTML = formatLast(lastSerie(db.series, n.id), n.type); screen.appendChild(last);
  const fields = el('div', 'fields');
  if (n.type === TYPES.TEMPS) fields.appendChild(numField('temps', 'Temps (s)', '20'));
  else { fields.appendChild(numField('reps', 'Répétitions', '8')); if (n.type === TYPES.REPS_LEST) fields.appendChild(numField('lest', 'Lest (kg)', '0')); }
  screen.appendChild(fields);
  const row = el('div', 'row');
  const add = el('button', 'action primary'); add.textContent = '+ Série'; add.onclick = () => onAddSet(n);
  const done = el('button', 'action ghost'); done.textContent = 'Terminé'; done.onclick = () => { stopTimer(); goBack(); };
  row.appendChild(add); row.appendChild(done); screen.appendChild(row);
  const sets = el('div', 'sets'); sets.id = 'sets'; screen.appendChild(sets);
  renderSets(n);
}

function onAddSet(n) {
  const g = (id) => { const e = $('f_' + id); return e ? (parseInt(e.value, 10) || 0) : 0; };
  const serie = addSerie(db, { exoId: n.id, reps: g('reps'), lest: g('lest'), temps: g('temps') });
  saveDB(store, db);
  tempSets.unshift(serie);
  renderSets(n);
  startTimer(n.tempsReposCible);
  if (navigator.vibrate) navigator.vibrate(20);
  $('banner').hidden = !besoinRappelExport(db);
}

function renderSets(n) {
  const box = $('sets'); if (!box) return; box.innerHTML = '';
  tempSets.forEach((s, i) => {
    const line = el('div', 'set-line');
    line.innerHTML = `<span class="n">Série ${tempSets.length - i}</span><span>${formatSerie(s, n.type)}</span>`;
    box.appendChild(line);
  });
}

let timerInt = null;
function startTimer(cible) {
  const box = $('timer'), val = $('timerval'), lbl = $('timerlabel');
  const start = Date.now(); box.hidden = false; clearInterval(timerInt); let buzzed = false;
  const tick = () => {
    const s = Math.floor((Date.now() - start) / 1000);
    val.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (s >= cible) { box.className = 'ok'; lbl.textContent = `Repos atteint ✓ (cible ${cible}s)`; if (!buzzed) { buzzed = true; if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } }
    else { box.className = 'wait'; lbl.textContent = `Repos… cible ${cible}s`; }
  };
  tick(); timerInt = setInterval(tick, 250);
}
function stopTimer() { clearInterval(timerInt); $('timer').hidden = true; }

$('back').onclick = goBack;
$('timerstop').onclick = stopTimer;
$('nav-progress').onclick = () => { view = { level: 'progress' }; render(); };
$('nav-settings').onclick = () => { view = { level: 'settings' }; render(); };

function renderSettings() {
  const screen = $('screen'); screen.innerHTML = '';
  $('crumb').textContent = 'Réglages'; $('title').textContent = 'Réglages';

  // Export / Import
  const io = el('div', 'row');
  const exportBtn = el('button', 'action primary'); exportBtn.textContent = '⬇︎ Exporter';
  exportBtn.onclick = () => {
    const text = exportJSON(db); saveDB(store, db);
    const blob = new Blob([text], { type: 'application/json' });
    const a = el('a'); a.href = URL.createObjectURL(blob);
    a.download = `calisthenie-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href); render();
  };
  const importLabel = el('label', 'action ghost'); importLabel.textContent = '⬆︎ Importer';
  importLabel.style.textAlign = 'center';
  const fileInput = el('input'); fileInput.type = 'file'; fileInput.accept = 'application/json'; fileInput.hidden = true;
  fileInput.onchange = async () => {
    const file = fileInput.files[0]; if (!file) return;
    try { db = importJSON(await file.text()); saveDB(store, db); render(); }
    catch (e) { alert('Import impossible : ' + e.message); }
  };
  importLabel.appendChild(fileInput);
  io.appendChild(exportBtn); io.appendChild(importLabel); screen.appendChild(io);

  // Ajout : exercice ou famille — le nouvel élément est amené à l'écran, prêt à renommer
  function ajouter(exo) {
    const cree = addExo(db, exo); saveDB(store, db); render();
    const row = document.querySelector(`.exo-row[data-id="${cree.id}"]`);
    if (row) {
      row.scrollIntoView({ block: 'center' });
      const nom = row.querySelector('input.nom');
      if (nom) { nom.focus(); nom.select(); }
    }
  }
  const addRow = el('div', 'row'); addRow.style.margin = '12px 0';
  const addExoBtn = el('button', 'action ghost'); addExoBtn.textContent = '＋ Exercice';
  addExoBtn.onclick = () => ajouter({ nom: 'Nouvel exercice', categorieId: CATEGORIES[0], parentId: null, estFamille: false, type: 'reps', tempsReposCible: 90 });
  const addFamBtn = el('button', 'action ghost'); addFamBtn.textContent = '＋ Famille';
  addFamBtn.onclick = () => ajouter({ nom: 'Nouvelle famille', categorieId: CATEGORIES[0], parentId: null, estFamille: true });
  addRow.appendChild(addExoBtn); addRow.appendChild(addFamBtn); screen.appendChild(addRow);

  // Liste éditable
  db.exos.forEach((n) => {
    const rowEl = el('div', 'exo-row set-line' + (n.estFamille ? ' fam' : '')); rowEl.dataset.id = n.id; rowEl.style.flexDirection = 'column'; rowEl.style.gap = '8px'; rowEl.style.alignItems = 'stretch';
    const head = el('div', 'exo-head');
    const badge = el('span', 'badge ' + (n.estFamille ? 'fam' : 'exo')); badge.textContent = n.estFamille ? '📁 Famille' : 'Exercice';
    const titleEl = el('div', 'exo-title'); titleEl.textContent = n.nom;
    head.appendChild(badge); head.appendChild(titleEl); rowEl.appendChild(head);
    const nameIn = el('input'); nameIn.className = 'nom'; nameIn.value = n.nom; nameIn.style.cssText = 'background:var(--card2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:8px;';
    nameIn.onchange = () => { updateExo(db, n.id, { nom: nameIn.value }); saveDB(store, db); titleEl.textContent = nameIn.value; };
    rowEl.appendChild(labelWrap('Nom', nameIn));

    const catSel = selectFrom(CATEGORIES, n.categorieId);
    catSel.onchange = () => { changeCategorie(db, n.id, catSel.value); saveDB(store, db); render(); };
    rowEl.appendChild(labelWrap('Catégorie', catSel));

    if (!n.estFamille) {
      const familles = db.exos.filter((e) => e.estFamille && e.categorieId === n.categorieId);
      const parentSel = selectFromPairs([{ value: '', label: '— (niveau 1)' }, ...familles.map((f) => ({ value: f.id, label: f.nom }))], n.parentId || '');
      parentSel.className = 'parent';
      parentSel.onchange = () => { updateExo(db, n.id, { parentId: parentSel.value || null }); saveDB(store, db); render(); };
      rowEl.appendChild(labelWrap('Famille parente', parentSel));

      const typeSel = selectFrom([TYPES.REPS, TYPES.REPS_LEST, TYPES.TEMPS], n.type); typeSel.onchange = () => { updateExo(db, n.id, { type: typeSel.value }); saveDB(store, db); };
      rowEl.appendChild(labelWrap('Type', typeSel));
      const repos = el('input'); repos.className = 'repos'; repos.type = 'number'; repos.value = n.tempsReposCible; repos.style.cssText = nameIn.style.cssText;
      repos.onchange = () => { updateExo(db, n.id, { tempsReposCible: parseInt(repos.value, 10) || 0 }); saveDB(store, db); };
      rowEl.appendChild(labelWrap('Repos cible (s)', repos));
    }
    const del = el('button', 'action ghost'); del.textContent = '🗑 Supprimer';
    del.onclick = () => { if (confirm(`Supprimer "${n.nom}" et ses données ?`)) { removeExo(db, n.id); saveDB(store, db); render(); } };
    rowEl.appendChild(del);
    screen.appendChild(rowEl);
  });

  function labelWrap(text, control) { const w = el('div', 'field'); const l = el('label'); l.textContent = text; w.appendChild(l); w.appendChild(control); return w; }
  function selectFrom(options, current) {
    const s = el('select'); s.style.cssText = 'background:var(--card2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:8px;';
    options.forEach((o) => { const opt = el('option'); opt.value = o; opt.textContent = o; if (o === current) opt.selected = true; s.appendChild(opt); });
    return s;
  }
  function selectFromPairs(pairs, current) {
    const s = el('select'); s.style.cssText = 'background:var(--card2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:8px;';
    pairs.forEach((p) => { const opt = el('option'); opt.value = p.value; opt.textContent = p.label; if (p.value === current) opt.selected = true; s.appendChild(opt); });
    return s;
  }
}

function renderProgress() {
  const screen = $('screen'); screen.innerHTML = '';
  if (view.exoId) {
    const n = exoById(view.exoId);
    $('crumb').textContent = `Progression › ${n.nom}`; $('title').textContent = n.nom;
    const series = db.series.filter((s) => s.exoId === n.id);
    const rec = computeRecords(series, n.type);
    const records = el('div', 'records');
    const card = (v, l) => { const c = el('div', 'record'); c.innerHTML = `<div class="v">${v}</div><div class="l">${l}</div>`; return c; };
    if (n.type === TYPES.TEMPS) records.appendChild(card(rec.temps ? rec.temps + 's' : '—', 'Record maintien'));
    else { records.appendChild(card(rec.reps ?? '—', 'Max reps')); if (n.type === TYPES.REPS_LEST) records.appendChild(card(rec.lest ? rec.lest + 'kg' : '—', 'Max lest')); }
    screen.appendChild(records);
    const pts = chartPoints(series, n.type);
    const W = 528, H = 180; const { d, dots } = svgPath(pts, W, H);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'chart'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = (d ? `<path d="${d}"></path>` : '') + dots.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"></circle>`).join('');
    screen.appendChild(svg);
    if (pts.length === 0) { const p = el('div', 'last'); p.textContent = 'Aucune donnée encore.'; screen.appendChild(p); }
    return;
  }
  $('crumb').textContent = 'Progression'; $('title').textContent = 'Progression';
  const grid = el('div', 'grid');
  db.exos.filter((e) => !e.estFamille).forEach((n) => grid.appendChild(bigBtn(n.nom, typeLabel(n.type), 'exo', () => { view = { level: 'progress', exoId: n.id }; render(); })));
  screen.appendChild(grid);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

render();
export { }; // module
