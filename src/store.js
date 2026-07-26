export const STORAGE_KEY = 'cali_v1';

export function emptyDB(defaultExos = []) {
  return { version: 1, exos: [...defaultExos], series: [], meta: { seriesDepuisExport: 0 } };
}

export function loadDB(store, defaultExos = []) {
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return emptyDB(defaultExos);
  try {
    const db = JSON.parse(raw);
    if (!db || !Array.isArray(db.series) || !Array.isArray(db.exos)) return emptyDB(defaultExos);
    db.meta = db.meta || { seriesDepuisExport: 0 };
    return db;
  } catch {
    return emptyDB(defaultExos);
  }
}

// Retourne false si l'écriture échoue (quota iOS saturé, stockage indisponible) :
// une série « validée » ne doit jamais se perdre en silence.
export function saveDB(store, db) {
  try { store.setItem(STORAGE_KEY, JSON.stringify(db)); return true; }
  catch { return false; }
}

const defaultId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'id' + Math.random().toString(36).slice(2));

export function addSerie(db, { exoId, reps = 0, lest = 0, temps = 0 }, gen = {}) {
  const now = gen.now || (() => Date.now());
  const id = gen.id || defaultId;
  const serie = { id: id(), exoId, date: now(), reps, lest, temps };
  db.series.push(serie);
  db.meta.seriesDepuisExport = (db.meta.seriesDepuisExport || 0) + 1;
  return serie;
}

export function removeSerie(db, id) {
  db.series = db.series.filter((s) => s.id !== id);
}

export const CATEGORIES = ['Push', 'Pull', 'Legs', 'Core'];

export function childrenOf(db, categorieId, parentId = null) {
  return db.exos.filter((e) => e.categorieId === categorieId && (e.parentId ?? null) === parentId);
}

export function addExo(db, exo, gen = {}) {
  const id = exo.id || (gen.id || defaultId)();
  const full = { parentId: null, estFamille: false, type: 'reps', tempsReposCible: 90, ...exo, id };
  db.exos.push(full);
  return full;
}

export function updateExo(db, id, patch) {
  const exo = db.exos.find((e) => e.id === id);
  Object.assign(exo, patch);
  return exo;
}

export function removeExo(db, id) {
  const toRemove = new Set([id, ...db.exos.filter((e) => e.parentId === id).map((e) => e.id)]);
  db.exos = db.exos.filter((e) => !toRemove.has(e.id));
  db.series = db.series.filter((s) => !toRemove.has(s.exoId));
}

// Change la catégorie d'un nœud en préservant la cohérence de l'arborescence.
// Une famille emmène ses déclinaisons ; un exo dont la famille parente n'est plus
// dans la même catégorie est détaché (remonté au niveau 1).
export function changeCategorie(db, id, categorieId) {
  const exo = db.exos.find((e) => e.id === id);
  if (!exo) return;
  exo.categorieId = categorieId;
  if (exo.estFamille) {
    db.exos.filter((e) => e.parentId === id).forEach((e) => { e.categorieId = categorieId; });
  } else if (exo.parentId) {
    const fam = db.exos.find((e) => e.id === exo.parentId);
    if (!fam || fam.categorieId !== categorieId) exo.parentId = null;
  }
}

export function exportJSON(db) {
  db.meta.seriesDepuisExport = 0;
  return JSON.stringify(db, null, 2);
}

export function importJSON(text) {
  let db;
  try { db = JSON.parse(text); } catch { throw new Error('Sauvegarde invalide'); }
  if (!db || !Array.isArray(db.exos) || !Array.isArray(db.series)) throw new Error('Sauvegarde invalide');
  db.meta = (db.meta && typeof db.meta === 'object' && !Array.isArray(db.meta)) ? db.meta : { seriesDepuisExport: 0 };
  return db;
}

export function besoinRappelExport(db, seuil = 10) {
  return (db.meta.seriesDepuisExport || 0) >= seuil;
}

// Persistance du chrono de repos : iOS peut recharger la PWA mi-repos (changement d'app),
// le repos doit survivre comme les séries. Au-delà de la cible + grace, le repos est périmé.
export const TIMER_KEY = 'cali_timer_v1';

export function saveTimer(store, { start, cible }) {
  store.setItem(TIMER_KEY, JSON.stringify({ start, cible }));
}

export function loadTimer(store, nowMs = Date.now(), graceS = 600) {
  try {
    const t = JSON.parse(store.getItem(TIMER_KEY));
    if (!t || typeof t.start !== 'number' || typeof t.cible !== 'number') return null;
    if ((nowMs - t.start) / 1000 > t.cible + graceS) return null;
    return t;
  } catch { return null; }
}

export function clearTimer(store) {
  store.removeItem(TIMER_KEY);
}
