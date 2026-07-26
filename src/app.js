// calisthenie/src/app.js
import { TYPES, lastSerie, formatSerie, computeRecords, chartPoints, svgPath, seriesDuJour, estRecord, dayKey } from './model.js';
import { loadDB, saveDB, addSerie, removeSerie, CATEGORIES, childrenOf, addExo, updateExo, removeExo, changeCategorie,
         exportJSON, importJSON, besoinRappelExport, saveTimer, loadTimer, clearTimer } from './store.js';
import { SEED_EXOS } from './seed.js';

const store = window.localStorage;
let db = loadDB(store, SEED_EXOS);
if (db.exos.length === 0) { db.exos = [...SEED_EXOS]; saveDB(store, db); }

let view = { level: 'cat' };
let messageImport = null;
let reglageOuvert = null; // fiche dépliée dans les Réglages (accordéon : une seule à la fois)

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const exoById = (id) => db.exos.find((e) => e.id === id);
const typeLabel = (t) => (t === TYPES.TEMPS ? 'maintien' : t === TYPES.REPS_LEST ? 'reps + lest' : 'reps');

// Suppression en deux taps (pas de confirm() natif : bloqué en PWA installée sur iPhone).
// 1er tap : le bouton s'arme et demande confirmation ; 2e tap : suppression ; sans 2e tap il se désarme.
function delButton(onConfirm, label = 'Supprimer', armedLabel, ariaLabel) {
  const b = el('button', 'action ghost del');
  b.textContent = label;
  if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
  let armed = false, t = null;
  b.onclick = () => {
    if (!armed) {
      armed = true;
      const arme = (typeof armedLabel === 'function' ? armedLabel() : armedLabel) || 'Confirmer ?';
      b.textContent = arme; b.classList.add('arme');
      if (ariaLabel) b.setAttribute('aria-label', arme);
      $('sr-annonce').textContent = arme;
      t = setTimeout(() => {
        armed = false; b.textContent = label; b.classList.remove('arme');
        if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
      }, 4000);
    } else { clearTimeout(t); onConfirm(); }
  };
  return b;
}

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
  // La barre d'actions du dock n'existe que pendant la saisie (renderEntry la remplit).
  const bar = $('actionbar'); bar.hidden = true; bar.innerHTML = '';
  back.style.display = view.level === 'cat' ? 'none' : 'flex';
  $('banner').hidden = !besoinRappelExport(db);
  $('banner').textContent = 'Pense à exporter ta sauvegarde (Réglages).';

  if (view.level === 'cat') {
    // La fiche du jour est datée, comme toute fiche de préparation.
    const d = new Date();
    const dateJour = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    crumb.textContent = `Séance — ${dateJour}`;
    title.textContent = 'Choisis une catégorie';
    const grid = el('div', 'grid');
    CATEGORIES.forEach((c) => grid.appendChild(bigBtn(c, 'Catégorie', 'cat', () => { view = { level: 'node', catId: c }; render(); })));
    screen.appendChild(grid);
    // Le bilan tamponné du jour : la fiche se signe au fil de la séance.
    const jour = db.series.filter((s) => dayKey(s.date) === dayKey(Date.now()));
    if (jour.length) {
      const nbPR = jour.filter((s) => {
        const exo = exoById(s.exoId);
        return exo && estRecord(db.series.filter((x) => x.exoId === s.exoId && x.date < s.date), s, exo.type);
      }).length;
      const bilan = el('div', 'set-line bilan');
      bilan.innerHTML = `<span class="n">Séance du ${dateJour}</span><span>${jour.length} série${jour.length > 1 ? 's' : ''}${nbPR ? ` · ${nbPR} PR` : ''}</span>`;
      if (nbPR) { const pr = el('span', 'pr-stamp'); pr.textContent = 'PR'; pr.setAttribute('aria-label', 'Record battu aujourd\'hui'); bilan.appendChild(pr); }
      screen.appendChild(bilan);
    }
    return;
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

function openEntry(exoId) { view = { level: 'entry', exoId }; render(); }

function numField(id, label, ph, decimal = false) {
  const f = el('div', 'field');
  // decimal : le lest accepte les demi-kilos — clavier iOS avec virgule, pas de spinner entier.
  const attrs = decimal ? 'inputmode="decimal" step="0.5"' : 'inputmode="numeric"';
  f.innerHTML = `<label for="f_${id}">${label}</label><input id="f_${id}" type="number" ${attrs} placeholder="${ph}">`;
  return f;
}

function majLast(n) {
  const box = document.querySelector('.last'); if (!box) return;
  const derniere = lastSerie(db.series, n.id);
  box.innerHTML = derniere ? `Dernière fois : <b>${formatSerie(derniere, n.type)}</b>` : 'Première fois';
}

function renderEntry() {
  const n = exoById(view.exoId);
  // Le fil d'Ariane garde le chemin réel (Push › Planche), pas un « Saisie » générique.
  $('crumb').textContent = n.parentId ? `${n.categorieId} › ${exoById(n.parentId).nom}` : n.categorieId;
  $('title').textContent = n.nom;
  const screen = $('screen');
  const last = el('div', 'last'); screen.appendChild(last); majLast(n);
  const fields = el('div', 'fields');
  if (n.type === TYPES.TEMPS) fields.appendChild(numField('temps', 'Temps (s)', '20'));
  else { fields.appendChild(numField('reps', 'Répétitions', '8')); if (n.type === TYPES.REPS_LEST) fields.appendChild(numField('lest', 'Lest (kg)', '0', true)); }
  screen.appendChild(fields);
  // Les actions vivent dans le dock, en zone du pouce — le geste répété 20 fois par séance
  // ne doit pas habiter le tiers haut de l'écran.
  const row = el('div', 'row');
  const add = el('button', 'action primary'); add.textContent = '+ Série'; add.onclick = () => onAddSet(n);
  // « Terminé » quitte la saisie sans tuer le chrono : le repos couvre aussi le passage à l'exo suivant.
  // Le chrono ne s'arrête que par son bouton ✕ ou au lancement de la série suivante.
  const done = el('button', 'action ghost'); done.textContent = 'Terminé'; done.onclick = () => goBack();
  row.appendChild(add); row.appendChild(done);
  const bar = $('actionbar'); bar.appendChild(row); bar.hidden = false;
  const sets = el('div', 'sets'); sets.id = 'sets'; screen.appendChild(sets);
  // « + Série » reste désactivé tant que la valeur principale est vide ou nulle :
  // un tap à vide créerait une série à 0 qui polluerait l'export nourrissant le coaching.
  const updateAdd = () => { add.disabled = !(valeurPrincipale(n) > 0); };
  fields.querySelectorAll('input').forEach((inp) => { inp.oninput = updateAdd; });
  updateAdd();
  renderSets(n);
}

function valeurPrincipale(n) {
  const e = $('f_' + (n.type === TYPES.TEMPS ? 'temps' : 'reps'));
  return e ? parseInt(e.value, 10) : NaN;
}

function onAddSet(n) {
  if (!(valeurPrincipale(n) > 0)) return;
  const g = (id) => { const e = $('f_' + id); return e ? (parseInt(e.value, 10) || 0) : 0; };
  // Le lest accepte les demi-kilos et refuse le négatif : la source de vérité ne se tronque pas.
  const lest = (() => { const e = $('f_lest'); return e ? Math.max(0, parseFloat(e.value) || 0) : 0; })();
  const serie = addSerie(db, { exoId: n.id, reps: g('reps'), lest, temps: g('temps') });
  saveDB(store, db);
  renderSets(n, serie.id);
  majLast(n);
  startTimer(n.tempsReposCible);
  if (navigator.vibrate) navigator.vibrate(20);
  $('banner').hidden = !besoinRappelExport(db);
}

function renderSets(n, neuveId = null) {
  const box = $('sets'); if (!box) return; box.innerHTML = '';
  // Relu depuis la base à chaque rendu : si iOS recharge la PWA mi-séance,
  // les séries du jour réapparaissent au lieu d'une liste vide trompeuse.
  const sets = seriesDuJour(db.series, n.id, Date.now());
  const toutes = db.series.filter((s) => s.exoId === n.id);
  sets.forEach((s, i) => {
    const line = el('div', 'set-line' + (s.id === neuveId ? ' neuve' : ''));
    line.innerHTML = `<span class="n">Série ${sets.length - i}</span><span>${formatSerie(s, n.type)}</span>`;
    // Le tampon PR : recalculé contre l'historique antérieur à la série, il survit aux re-rendus.
    if (estRecord(toutes.filter((x) => x.date < s.date), s, n.type)) {
      const pr = el('span', 'pr-stamp'); pr.textContent = 'PR'; pr.setAttribute('aria-label', 'Record battu');
      line.appendChild(pr);
    }
    line.appendChild(delButton(() => {
      removeSerie(db, s.id); saveDB(store, db);
      renderSets(n);
    }, '✕', undefined, `Supprimer la série ${sets.length - i} (${formatSerie(s, n.type)})`));
    box.appendChild(line);
  });
}

let timerInt = null;
function startTimer(cible, startMs = Date.now()) {
  const box = $('timer'), val = $('timerval'), lbl = $('timerlabel');
  box.hidden = false; clearInterval(timerInt); let buzzed = false;
  saveTimer(store, { start: startMs, cible }); // le repos survit à un rechargement de la PWA
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  // Compte à rebours : la seule question mi-séance est « combien il me reste ? ».
  // Une fois la cible atteinte, le dépassement s'affiche en « +m:ss ».
  const tick = () => {
    const ecoule = Math.floor((Date.now() - startMs) / 1000);
    const restant = cible - ecoule;
    // Au-delà de 10 min de dépassement, le repos est périmé : la règle s'éteint seule.
    if (restant < -600) return stopTimer();
    // La règle graduée se remplit vers la cible (scaleX : composité, pas de layout).
    box.style.setProperty('--avancee', String(Math.min(1, ecoule / cible)));
    if (restant > 0) { box.className = 'wait'; val.textContent = fmt(restant); lbl.innerHTML = `Repos… cible <span class="mono">${cible}s</span>`; }
    else {
      box.className = 'ok'; val.textContent = `+${fmt(-restant)}`; lbl.innerHTML = `Repos atteint ✓ (cible <span class="mono">${cible}s</span>)`;
      if (!buzzed) {
        buzzed = true;
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        $('sr-annonce').textContent = 'Repos atteint';
      }
    }
  };
  tick(); timerInt = setInterval(tick, 250);
}
function stopTimer() {
  clearInterval(timerInt); $('timer').hidden = true;
  clearTimer(store); $('sr-annonce').textContent = '';
}

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

  // Statut d'import in-app : pas d'alert() ni de confirm() natifs, bloqués en PWA installée sur iPhone.
  const ioStatus = el('div', 'notice'); ioStatus.id = 'io-status'; ioStatus.hidden = true;
  ioStatus.setAttribute('role', 'status'); ioStatus.setAttribute('aria-live', 'polite');
  const pluriel = (nb, mot) => `${nb} ${mot}${nb > 1 ? 's' : ''}`;

  // Importer remplace toute la base : on montre l'ampleur de l'échange et on attend un choix explicite.
  function confirmerImport(incoming, file) {
    ioStatus.hidden = false; ioStatus.innerHTML = '';
    const txt = el('div');
    const dd = new Date(file.lastModified);
    const quand = `${String(dd.getDate()).padStart(2, '0')}/${String(dd.getMonth() + 1).padStart(2, '0')}/${dd.getFullYear()}`;
    txt.textContent = `Remplacer les données actuelles (${pluriel(db.series.length, 'série')}, ${pluriel(db.exos.length, 'exo')}) par « ${file.name} » : ${pluriel(incoming.series.length, 'série')}, ${pluriel(incoming.exos.length, 'exo')} (fichier du ${quand}) ?`;
    const choix = el('div', 'row');
    const ok = el('button', 'action primary'); ok.textContent = 'Remplacer';
    ok.onclick = () => {
      db = incoming; saveDB(store, db);
      messageImport = `Sauvegarde importée ✓ — ${pluriel(db.series.length, 'série')}, ${pluriel(db.exos.length, 'exo')}.`;
      render();
    };
    const cancel = el('button', 'action ghost'); cancel.textContent = 'Annuler';
    cancel.onclick = () => { ioStatus.hidden = true; ioStatus.innerHTML = ''; };
    choix.appendChild(ok); choix.appendChild(cancel);
    ioStatus.appendChild(txt); ioStatus.appendChild(choix);
  }

  fileInput.onchange = async () => {
    const file = fileInput.files[0]; if (!file) return;
    const text = await file.text();
    fileInput.value = '';
    try { confirmerImport(importJSON(text), file); }
    catch (e) {
      ioStatus.hidden = false;
      ioStatus.textContent = `Import impossible : ${e.message}. Vérifie que le fichier vient bien de « ⬇︎ Exporter ».`;
    }
  };
  importLabel.appendChild(fileInput);
  io.appendChild(exportBtn); io.appendChild(importLabel); screen.appendChild(io);
  screen.appendChild(ioStatus);
  if (messageImport) { ioStatus.hidden = false; ioStatus.textContent = messageImport; messageImport = null; }

  // Ajout : exercice ou famille — le nouvel élément est amené à l'écran, prêt à renommer
  function ajouter(exo) {
    const cree = addExo(db, exo); reglageOuvert = cree.id; saveDB(store, db); render();
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

  // Le classeur : fiches groupées par catégorie, repliées — une seule dépliée à la fois.
  const resume = (n) => {
    if (n.estFamille) { const nb = db.exos.filter((e) => e.parentId === n.id).length; return `${nb} décl.`; }
    return `${typeLabel(n.type)} · ${n.tempsReposCible}s`;
  };

  function fiche(n, estDecl) {
    const ouverte = reglageOuvert === n.id;
    const rowEl = el('div', 'exo-row' + (n.estFamille ? ' fam' : '') + (estDecl ? ' decl' : '') + (ouverte ? ' ouvert' : ''));
    rowEl.dataset.id = n.id;

    const tog = el('button', 'exo-toggle');
    tog.setAttribute('aria-expanded', String(ouverte));
    tog.setAttribute('aria-label', n.nom);
    if (n.estFamille) { const badge = el('span', 'badge fam'); badge.textContent = 'Famille'; tog.appendChild(badge); }
    const titleEl = el('span', 'exo-title'); titleEl.textContent = n.nom; tog.appendChild(titleEl);
    const m = el('span', 'exo-resume'); m.textContent = resume(n); tog.appendChild(m);
    const chev = el('span', 'chev'); chev.textContent = '›'; chev.setAttribute('aria-hidden', 'true'); tog.appendChild(chev);
    tog.onclick = () => { reglageOuvert = ouverte ? null : n.id; render(); };
    rowEl.appendChild(tog);

    if (!ouverte) return rowEl;

    const edit = el('div', 'exo-edit');
    const nameIn = el('input'); nameIn.className = 'nom'; nameIn.value = n.nom; nameIn.style.cssText = 'background:var(--card2);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:8px;';
    nameIn.onchange = () => { updateExo(db, n.id, { nom: nameIn.value }); saveDB(store, db); titleEl.textContent = nameIn.value; };
    edit.appendChild(labelWrap('Nom', nameIn, `reg_${n.id}_nom`));

    const catSel = selectFrom(CATEGORIES, n.categorieId);
    catSel.onchange = () => { changeCategorie(db, n.id, catSel.value); saveDB(store, db); render(); };
    edit.appendChild(labelWrap('Catégorie', catSel, `reg_${n.id}_cat`));

    if (!n.estFamille) {
      const familles = db.exos.filter((e) => e.estFamille && e.categorieId === n.categorieId);
      const parentSel = selectFromPairs([{ value: '', label: '— (niveau 1)' }, ...familles.map((f) => ({ value: f.id, label: f.nom }))], n.parentId || '');
      parentSel.className = 'parent';
      parentSel.onchange = () => { updateExo(db, n.id, { parentId: parentSel.value || null }); saveDB(store, db); render(); };
      edit.appendChild(labelWrap('Famille parente', parentSel, `reg_${n.id}_parent`));

      const typeSel = selectFromPairs(
        [TYPES.REPS, TYPES.REPS_LEST, TYPES.TEMPS].map((t) => ({ value: t, label: typeLabel(t) })), n.type
      );
      typeSel.onchange = () => { updateExo(db, n.id, { type: typeSel.value }); saveDB(store, db); render(); };
      edit.appendChild(labelWrap('Type', typeSel, `reg_${n.id}_type`));
      const repos = el('input'); repos.className = 'repos'; repos.type = 'number'; repos.value = n.tempsReposCible; repos.style.cssText = nameIn.style.cssText;
      repos.onchange = () => { updateExo(db, n.id, { tempsReposCible: parseInt(repos.value, 10) || 0 }); saveDB(store, db); };
      edit.appendChild(labelWrap('Repos cible (s)', repos, `reg_${n.id}_repos`));
    }
    // Supprimer une famille emporte ses déclinaisons ET tout leur historique :
    // le libellé de confirmation chiffre ce qui va disparaître (calculé au moment de l'armement).
    edit.appendChild(delButton(
      () => { removeExo(db, n.id); saveDB(store, db); render(); },
      'Supprimer',
      () => {
        const ids = new Set([n.id, ...db.exos.filter((e) => e.parentId === n.id).map((e) => e.id)]);
        const nbSeries = db.series.filter((s) => ids.has(s.exoId)).length;
        const nbDecl = ids.size - 1;
        if (!nbSeries && !nbDecl) return 'Confirmer ?';
        const morceaux = [];
        if (nbDecl) morceaux.push(`${nbDecl} déclinaison${nbDecl > 1 ? 's' : ''}`);
        if (nbSeries) morceaux.push(`${nbSeries} série${nbSeries > 1 ? 's' : ''}`);
        return `Effacer aussi ${morceaux.join(' et ')} ?`;
      },
      `Supprimer ${n.nom}`
    ));
    rowEl.appendChild(edit);
    return rowEl;
  }

  CATEGORIES.forEach((cat) => {
    const racines = childrenOf(db, cat);
    if (racines.length === 0) return;
    const h = el('h2', 'reg-section'); h.textContent = cat; screen.appendChild(h);
    racines.forEach((n) => {
      screen.appendChild(fiche(n, false));
      if (n.estFamille) childrenOf(db, cat, n.id).forEach((d) => screen.appendChild(fiche(d, true)));
    });
  });

  function labelWrap(text, control, id) {
    const w = el('div', 'field'); const l = el('label'); l.textContent = text;
    if (id) { control.id = id; l.htmlFor = id; }
    w.appendChild(l); w.appendChild(control); return w;
  }
  function selectFrom(options, current) {
    const s = el('select'); s.style.cssText = 'background:var(--card2);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:8px;';
    options.forEach((o) => { const opt = el('option'); opt.value = o; opt.textContent = o; if (o === current) opt.selected = true; s.appendChild(opt); });
    return s;
  }
  function selectFromPairs(pairs, current) {
    const s = el('select'); s.style.cssText = 'background:var(--card2);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:8px;';
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
    // Le record est par définition le PR : il porte son tampon là où l'on vient le contempler.
    const card = (v, l) => {
      const c = el('div', 'record'); c.innerHTML = `<div class="v">${v}</div><div class="l">${l}</div>`;
      if (v !== '—') { const pr = el('span', 'pr-stamp'); pr.textContent = 'PR'; pr.setAttribute('aria-hidden', 'true'); c.appendChild(pr); }
      return c;
    };
    if (n.type === TYPES.TEMPS) records.appendChild(card(rec.temps ? rec.temps + 's' : '—', 'Record maintien'));
    else { records.appendChild(card(rec.reps ?? '—', 'Max reps')); if (n.type === TYPES.REPS_LEST) records.appendChild(card(rec.lest ? rec.lest + 'kg' : '—', 'Max lest')); }
    screen.appendChild(records);
    const pts = chartPoints(series, n.type);
    const W = 528, H = 180; const { d, dots } = svgPath(pts, W, H);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'chart'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Courbe de progression — ${n.nom}`);
    // Les chiffres de marge du papier millimétré : min et max en voix machine.
    const unite = n.type === TYPES.TEMPS ? 's' : '';
    const marges = pts.length ? (() => {
      const vals = pts.map((p) => p.value);
      const maxV = Math.max(...vals), minV = Math.min(...vals);
      // viewBox 528 sur ~390px d'écran : 16 unités ≈ 12px réels, le minimum lisible à bout de bras.
      const t = (v, y) => `<text x="6" y="${y}" fill="var(--muted)" font-family="Courier Prime,ui-monospace,Menlo,monospace" font-size="16">${v}${unite}</text>`;
      return t(maxV, 20) + (maxV !== minV ? t(minV, H - 6) : '');
    })() : '';
    svg.innerHTML = marges + (d ? `<path d="${d}"></path>` : '') + dots.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"></circle>`).join('');
    screen.appendChild(svg);
    if (pts.length === 0) { const p = el('div', 'last'); p.textContent = 'Aucune donnée encore.'; screen.appendChild(p); }
    // Dernières séries, avec suppression (corrige une saisie ratée après coup)
    [...series].sort((a, b) => b.date - a.date).slice(0, 10).forEach((s) => {
      const dt = new Date(s.date);
      const quand = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const line = el('div', 'set-line serie-line');
      line.innerHTML = `<span class="n">${quand}</span><span>${formatSerie(s, n.type)}</span>`;
      line.appendChild(delButton(() => { removeSerie(db, s.id); saveDB(store, db); render(); }, '✕', undefined,
        `Supprimer la série du ${quand} (${formatSerie(s, n.type)})`));
      screen.appendChild(line);
    });
    return;
  }
  $('crumb').textContent = 'Progression'; $('title').textContent = 'Progression';
  // Même classement que les Réglages : sections par catégorie, et l'encre dit où sont les données.
  CATEGORIES.forEach((cat) => {
    const exos = db.exos.filter((e) => !e.estFamille && e.categorieId === cat);
    if (!exos.length) return;
    const h = el('h2', 'reg-section'); h.textContent = cat; screen.appendChild(h);
    const grid = el('div', 'grid');
    exos.forEach((n) => {
      const nbSeances = new Set(db.series.filter((s) => s.exoId === n.id).map((s) => dayKey(s.date))).size;
      const tag = nbSeances ? `${nbSeances} séance${nbSeances > 1 ? 's' : ''}` : 'aucune donnée';
      grid.appendChild(bigBtn(n.nom, tag, 'exo' + (nbSeances ? '' : ' vide'), () => { view = { level: 'progress', exoId: n.id }; render(); }));
    });
    screen.appendChild(grid);
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

render();
// Un repos interrompu par un rechargement de la PWA reprend là où il en était.
const reposEnCours = loadTimer(store);
if (reposEnCours) startTimer(reposEnCours.cible, reposEnCours.start);
export { }; // module
