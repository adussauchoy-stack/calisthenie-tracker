export const SEED_EXOS = [
  // Push
  { id: 'planche', nom: 'Planche', categorieId: 'Push', parentId: null, estFamille: true },
  { id: 'planche_tuck', nom: 'Tuck planche', categorieId: 'Push', parentId: 'planche', estFamille: false, type: 'temps', tempsReposCible: 180 },
  { id: 'planche_adv', nom: 'Advanced tuck', categorieId: 'Push', parentId: 'planche', estFamille: false, type: 'temps', tempsReposCible: 180 },
  { id: 'planche_str', nom: 'Straddle', categorieId: 'Push', parentId: 'planche', estFamille: false, type: 'temps', tempsReposCible: 180 },
  { id: 'planche_full', nom: 'Full planche', categorieId: 'Push', parentId: 'planche', estFamille: false, type: 'temps', tempsReposCible: 240 },
  { id: 'dips', nom: 'Dips', categorieId: 'Push', parentId: null, estFamille: false, type: 'reps+lest', tempsReposCible: 120 },
  { id: 'pompes', nom: 'Pompes', categorieId: 'Push', parentId: null, estFamille: false, type: 'reps', tempsReposCible: 90 },
  // Pull
  { id: 'tractions', nom: 'Tractions', categorieId: 'Pull', parentId: null, estFamille: false, type: 'reps+lest', tempsReposCible: 150 },
  { id: 'front', nom: 'Front lever', categorieId: 'Pull', parentId: null, estFamille: true },
  { id: 'front_tuck', nom: 'Tuck front', categorieId: 'Pull', parentId: 'front', estFamille: false, type: 'temps', tempsReposCible: 180 },
  { id: 'front_str', nom: 'Straddle front', categorieId: 'Pull', parentId: 'front', estFamille: false, type: 'temps', tempsReposCible: 180 },
  // Legs
  { id: 'squats', nom: 'Squats', categorieId: 'Legs', parentId: null, estFamille: false, type: 'reps+lest', tempsReposCible: 120 },
  { id: 'pistol', nom: 'Pistol squat', categorieId: 'Legs', parentId: null, estFamille: false, type: 'reps', tempsReposCible: 120 },
  // Core
  { id: 'lsit', nom: 'L-sit', categorieId: 'Core', parentId: null, estFamille: false, type: 'temps', tempsReposCible: 90 },
  { id: 'hollow', nom: 'Hollow hold', categorieId: 'Core', parentId: null, estFamille: false, type: 'temps', tempsReposCible: 60 },
];
