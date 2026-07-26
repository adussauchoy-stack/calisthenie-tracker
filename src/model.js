export const TYPES = { REPS: 'reps', REPS_LEST: 'reps+lest', TEMPS: 'temps' };

export function lastSerie(series, exoId) {
  const forExo = series.filter((x) => x.exoId === exoId);
  if (forExo.length === 0) return null;
  return forExo.reduce((a, b) => (b.date > a.date ? b : a));
}

export function formatSerie(serie, type) {
  if (type === TYPES.TEMPS) return `${serie.temps}s`;
  const lest = type === TYPES.REPS_LEST && serie.lest ? ` +${serie.lest}kg` : '';
  return `${serie.reps} reps${lest}`;
}

export function formatLast(serie, type) {
  if (!serie) return 'Première fois';
  return `Dernière fois : ${formatSerie(serie, type)}`;
}

export function computeRecords(series, type) {
  const max = (sel) => (series.length ? Math.max(...series.map(sel)) : 0);
  return {
    reps: type === TYPES.TEMPS ? null : max((x) => x.reps) || null,
    lest: type === TYPES.REPS_LEST ? max((x) => x.lest) || null : null,
    temps: type === TYPES.TEMPS ? max((x) => x.temps) || null : null,
  };
}

// Vrai si la série bat une meilleure marque antérieure de l'exo (une marque doit exister :
// la toute première série d'un exo n'est pas un record).
// Pour reps+lest : un record de lest se bat en soulevant plus lourd ; un record de reps
// ne se compare qu'aux séries faites à charge égale ou moindre — 10 reps à vide ne battent
// pas 9 reps à +2,5 kg, et une première série dans une classe de charge n'est pas un record.
export function estRecord(seriesAvant, serie, type) {
  if (seriesAvant.length === 0) return false;
  const rec = computeRecords(seriesAvant, type);
  if (type === TYPES.TEMPS) return serie.temps > (rec.temps || 0);
  if (type === TYPES.REPS_LEST) {
    if (serie.lest > (rec.lest || 0)) return true;
    const comparables = seriesAvant.filter((s) => s.lest <= serie.lest);
    return comparables.length > 0 && serie.reps > Math.max(...comparables.map((s) => s.reps));
  }
  return serie.reps > (rec.reps || 0);
}

export function dayKey(dateMs) {
  const d = new Date(dateMs);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Séries déjà loguées aujourd'hui pour un exo (la plus récente d'abord).
// Sert à restaurer la liste de la session si iOS recharge la PWA mi-séance.
export function seriesDuJour(series, exoId, nowMs) {
  return series
    .filter((s) => s.exoId === exoId && dayKey(s.date) === dayKey(nowMs))
    .sort((a, b) => b.date - a.date);
}

// quoi = 'lest' pour tracer le lest max par jour (second trait du papier millimétré).
export function chartPoints(series, type, quoi) {
  const metric = quoi === 'lest' ? (x) => x.lest : (x) => (type === TYPES.TEMPS ? x.temps : x.reps);
  const byDay = new Map();
  for (const x of series) {
    const k = dayKey(x.date);
    const cur = byDay.get(k);
    if (!cur || metric(x) > cur.value) {
      byDay.set(k, { date: x.date, value: metric(x) });
    }
  }
  return [...byDay.values()].sort((a, b) => a.date - b.date);
}

export function svgPath(points, width, height, pad = 8) {
  if (points.length === 0) return { d: '', dots: [] };
  const values = points.map((p) => p.value);
  const minV = Math.min(...values), maxV = Math.max(...values);
  const spanV = maxV - minV || 1;
  const innerW = width - 2 * pad, innerH = height - 2 * pad;
  const x = (i) => (points.length === 1 ? width / 2 : pad + (innerW * i) / (points.length - 1));
  const y = (v) => pad + innerH * (1 - (v - minV) / spanV);
  const dots = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
  const d = dots.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
  return { d, dots };
}
