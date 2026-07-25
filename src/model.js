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
  if (!serie) return 'Première fois 💪';
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

export function chartPoints(series, type) {
  const metric = (x) => (type === TYPES.TEMPS ? x.temps : x.reps);
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
