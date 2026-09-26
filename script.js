const store = {
  mem: {},
  get(k, d){ try{ const v = localStorage.getItem('mph:' + k); return v !== null ? JSON.parse(v) : d; } catch(e){ return (k in this.mem) ? this.mem[k] : d; } },
  set(k, v){ try{ localStorage.setItem('mph:' + k, JSON.stringify(v)); } catch(e){ this.mem[k] = v; } }
};

const S = {
  cat: 'dejeuners', search: '', sort: 'pertinence', onlyFav: false, highProt: false, cooking: null,
  plan: store.get('plan', []),
  ratings: store.get('ratings', {}),
  favs: store.get('favs', []),
  deleted: store.get('deleted', []),
  goals: Object.assign({cal: 2300, prot: 170, carb: 235, fat: 65}, store.get('goals', {})),
  history: store.get('history', {})
};
const SLOTS = ['Déjeuner', 'Dîner', 'Souper', 'Shaker', 'Smoothie'];
const SLOT_LABELS = {'Déjeuner': '🌅 Déjeuner', 'Dîner': '☀️ Dîner', 'Souper': '🌙 Souper', 'Shaker': '🥤 Shaker', 'Smoothie': '🫐 Smoothie'};
const DEFAULT_SLOT = {dejeuners: 'Déjeuner', diners: 'Dîner', soupers: 'Souper', shakes: 'Shaker', smoothies: 'Smoothie'};

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gid = () => 'm' + Math.random().toString(36).slice(2, 9);
const dkey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const deaccent = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function parseMacros(str){
  const grab = re => { const m = String(str).match(re); return m ? parseInt(m[1], 10) : 0; };
  return {
    kcal: grab(/(\d+)\s*kcal/i),
    prot: grab(/(\d+)\s*g?\s*Prot/i),
    carb: grab(/(\d+)\s*g?\s*Gluc/i),
    fat:  grab(/(\d+)\s*g?\s*Lip/i)
  };
}
function findRecipe(nom){
  for(const c in DATA_STORE){
    const i = DATA_STORE[c].findIndex(r => r.nom === nom);
    if(i > -1) return {cat: c, idx: i, r: DATA_STORE[c][i]};
  }
  return null;
}
function recipesIn(cat){
  return (DATA_STORE[cat] || []).map((r, i) => ({cat, idx: i, r, m: parseMacros(r.macros)}))
    .filter(x => !S.deleted.includes(x.r.nom));
}
function plannedRecipes(){
  return S.plan.map(p => {
    const f = findRecipe(p.nom);
    return f ? {cat: f.cat, idx: f.idx, r: f.r, slot: p.slot, id: p.id, portions: Math.max(1, parseInt(p.portions, 10) || 1)} : null;
  }).filter(Boolean);
}
function totals(){
  const t = {kcal: 0, prot: 0, carb: 0, fat: 0};
  plannedRecipes().forEach(x => {
    const m = parseMacros(x.r.macros), p = x.portions || 1;
    t.kcal += m.kcal * p; t.prot += m.prot * p; t.carb += m.carb * p; t.fat += m.fat * p;
  });
  return t;
}
function toast(msg, type = 'info'){
  const wrap = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = msg;
  wrap.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 3200);
}

function updateCounts(){
  let total = 0;
  for(const c in DATA_STORE){
    const n = recipesIn(c).length;
    const el = document.getElementById('count-' + c);
    if(el) el.textContent = n;
    total += n;
  }
  document.getElementById('brandCount').textContent = total + ' Recettes';
  if(typeof tInt === 'undefined' || !tInt) document.title = 'Meal Prep Hub • ' + total + ' Recettes • ~' + S.goals.cal + ' kcal';
}
function switchCategory(cat){
  S.cat = cat;
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  renderCards();
}
function setSort(v){ S.sort = v; renderCards(); }
function toggleFilter(key, btn){ S[key] = !S[key]; btn.classList.toggle('active', S[key]); renderCards(); }
function clearFilters(){
  S.search = ''; S.onlyFav = false; S.highProt = false;
  document.getElementById('searchInput').value = '';
  document.getElementById('chipFav').classList.remove('active');
  document.getElementById('chipProt').classList.remove('active');
  renderCards();
}
function filterCards(){ S.search = document.getElementById('searchInput').value; renderCards(); }

function currentList(){
  let list = recipesIn(S.cat);
  const q = S.search.trim().toLowerCase();
  if(q) list = list.filter(x =>
    x.r.nom.toLowerCase().includes(q) ||
    x.r.type.toLowerCase().includes(q) ||
    x.r.ingredients.some(i => i.toLowerCase().includes(q)));
  if(S.onlyFav)  list = list.filter(x => S.favs.includes(x.r.nom));
  if(S.highProt) list = list.filter(x => x.m.prot >= 40);
  if(S.sort === 'prot')    list = list.slice().sort((a, b) => b.m.prot - a.m.prot);
  if(S.sort === 'calDesc') list = list.slice().sort((a, b) => b.m.kcal - a.m.kcal);
  if(S.sort === 'calAsc')  list = list.slice().sort((a, b) => a.m.kcal - b.m.kcal);
  if(S.sort === 'note')    list = list.slice().sort((a, b) => (S.ratings[b.r.nom] || '').length - (S.ratings[a.r.nom] || '').length);
  if(S.sort === 'az')      list = list.slice().sort((a, b) => a.r.nom.localeCompare(b.r.nom, 'fr'));
  return list;
}
function hl(text){
  const q = S.search.trim();
  const t = esc(text);
  if(!q) return t;
  const safe = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try{ return t.replace(new RegExp('(' + safe + ')', 'ig'), '<mark>$1</mark>'); }
  catch(e){ return t; }
}
function renderCards(){
  const list = currentList();
  const wrap = document.getElementById('cardsContainer');
  const empty = document.getElementById('emptyState');
  document.getElementById('resultCount').textContent = list.length + (list.length > 1 ? ' recettes affichées' : ' recette affichée');
  if(!list.length){
    wrap.innerHTML = '';
    empty.style.display = 'block';
    const catEmpty = !DATA_STORE[S.cat] || DATA_STORE[S.cat].length === 0;
    document.getElementById('emptyMsg').innerHTML = catEmpty
      ? 'Cette catégorie est vide pour le moment.<br>Colle tes recettes dans <strong>DATA_STORE.' + S.cat + '</strong> (dans le script en bas du fichier) —<br>elles apparaîtront automatiquement ici : compteurs, recherche, épicerie, plan.'
      : 'Essaie un autre mot-clé, ou désactive les filtres actifs.';
    document.getElementById('emptyResetBtn').style.display = catEmpty ? 'none' : 'inline-block';
    return;
  }
  empty.style.display = 'none';
  wrap.innerHTML = list.map(cardHTML).join('');
}
function cardHTML(x){
  const inPlan = S.plan.some(p => p.nom === x.r.nom);
  const isFav = S.favs.includes(x.r.nom);
  const rating = S.ratings[x.r.nom] || '';
  const prev = x.r.ingredients.slice(0, 4);
  const more = x.r.ingredients.length - 4;
  const stars = ['', '★', '★★', '★★★', '★★★★', '★★★★★'];
  return '<div class="recipe-card">'
    + '<div class="card-head">'
    +   '<div class="card-top-bar"><span class="badge-type">' + esc(x.r.type) + '</span>'
    +     '<div class="card-chips">'
    +       '<button class="icon-btn fav' + (isFav ? ' on' : '') + '" title="Favori" onclick="toggleFav(\'' + x.cat + '\',' + x.idx + ')">' + (isFav ? '♥' : '♡') + '</button>'
    +       '<button class="icon-btn del" title="Masquer la recette" onclick="deleteRecipe(\'' + x.cat + '\',' + x.idx + ',this)">🗑</button>'
    +     '</div></div>'
    +   '<h3 class="card-title">' + hl(x.r.nom) + '</h3>'
    +   '<div class="card-macro-strip">' + esc(x.r.macros) + '</div>'
    + '</div>'
    + '<div class="preview-box"><div class="preview-title">Aperçu ingrédients</div><ul class="preview-list">'
    +   prev.map(i => '<li>' + esc(i) + '</li>').join('')
    +   (more > 0 ? '<li class="more-li">+ ' + more + ' autres…</li>' : '')
    + '</ul></div>'
    + '<div class="rating-row"><span class="rating-label">Note :</span>'
    +   '<select class="rating-select" onchange="setRating(\'' + x.cat + '\',' + x.idx + ',this.value)">'
    +     stars.map(s => '<option value="' + s + '"' + (s === rating ? ' selected' : '') + '>' + (s === '' ? '—' : s) + '</option>').join('')
    +   '</select></div>'
    + '<div class="card-actions">'
    +   '<button class="btn-card btn-cook" onclick="openCook(\'' + x.cat + '\',' + x.idx + ')">🍳 Cuire pas-à-pas</button>'
    +   '<button class="btn-card btn-add' + (inPlan ? ' in-plan' : '') + '" onclick="togglePlan(\'' + x.cat + '\',' + x.idx + ')">' + (inPlan ? '✓ Dans le plan' : '➕ Ajouter au plan') + '</button>'
    + '</div></div>';
}

function toggleFav(cat, idx){
  const r = DATA_STORE[cat][idx];
  const i = S.favs.indexOf(r.nom);
  if(i > -1) S.favs.splice(i, 1); else S.favs.push(r.nom);
  store.set('favs', S.favs);
  renderCards();
}
function setRating(cat, idx, val){
  const r = DATA_STORE[cat][idx];
  if(val) S.ratings[r.nom] = val; else delete S.ratings[r.nom];
  store.set('ratings', S.ratings);
  if(S.sort === 'note') renderCards();
}
function deleteRecipe(cat, idx, btn){
  if(!btn.dataset.armed){
    btn.dataset.armed = '1'; btn.classList.add('armed'); btn.title = 'Clique encore pour confirmer';
    setTimeout(() => { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.title = 'Masquer la recette'; }, 2600);
    return;
  }
  const r = DATA_STORE[cat][idx];
  if(!S.deleted.includes(r.nom)) S.deleted.push(r.nom);
  store.set('deleted', S.deleted);
  updateCounts(); renderCards();
  toast('🗑 Recette masquée : <strong>' + esc(r.nom) + '</strong><br><small>Restaurable via « ↺ Restaurer » en haut.</small>', 'warn');
}
function restoreDeletedRecipes(){
  const n = S.deleted.length;
  if(!n){ toast('Aucune recette masquée pour le moment 🙂'); return; }
  S.deleted = []; store.set('deleted', S.deleted);
  updateCounts(); renderCards();
  toast('↺ ' + n + ' recette' + (n > 1 ? 's' : '') + ' restaurée' + (n > 1 ? 's' : '') + ' !', 'success');
}
function togglePlan(cat, idx){
  const r = DATA_STORE[cat][idx];
  const i = S.plan.findIndex(p => p.nom === r.nom);
  if(i > -1){
    S.plan.splice(i, 1);
    toast('➖ Retiré du plan : ' + esc(r.nom), 'warn');
  } else {
    const slot = DEFAULT_SLOT[cat] || 'Déjeuner';
    S.plan.push({id: gid(), nom: r.nom, slot: slot, portions: 1});
    toast('➕ Ajouté au plan — ' + SLOT_LABELS[slot] + ' : ' + esc(r.nom), 'success');
  }
  store.set('plan', S.plan);
  renderDashboard(); renderCards();
}
function resetDayPlan(){
  if(!S.plan.length){ toast('Le plan est déjà vide 🙂'); return; }
  S.plan = []; store.set('plan', S.plan);
  renderDashboard(); renderCards();
  toast('↺ Journée réinitialisée');
}

function setMacro(id, val, goal, unit){
  document.getElementById('val' + id).textContent = val;
  document.getElementById('goal' + id).textContent = goal + ' ' + unit;
  const bar = document.getElementById('bar' + id);
  bar.style.width = (goal ? Math.min(100, val / goal * 100) : 0) + '%';
  bar.classList.toggle('over', goal > 0 && val > goal * 1.02);
  const rem = document.getElementById('rem' + id);
  if(goal && val > goal){ rem.textContent = 'Dépassé de ' + (val - goal) + ' ' + unit; rem.classList.add('over'); }
  else if(goal){ rem.textContent = 'Reste ' + (goal - val) + ' ' + unit; rem.classList.remove('over'); }
}
function renderDashboard(){
  const t = totals(), g = S.goals;
  setMacro('Cal', t.kcal, g.cal, 'kcal');
  setMacro('Prot', t.prot, g.prot, 'g');
  setMacro('Carb', t.carb, g.carb, 'g');
  setMacro('Fat', t.fat, g.fat, 'g');
  document.getElementById('planBadge').textContent = S.plan.length;
  document.getElementById('goalCalBrand').textContent = '~' + g.cal;
  S.history[dkey()] = t;
  store.set('history', S.history);
  renderWeek();
}
function renderWeek(){
  const el = document.getElementById('weekChart');
  let html = '';
  for(let i = 6; i >= 0; i--){
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dkey(d);
    const h = (S.history[k] || {}).kcal || 0;
    const pct = S.goals.cal ? Math.min(100, h / S.goals.cal * 100) : 0;
    const over = h > S.goals.cal * 1.05;
    html += '<div class="wk-day" title="' + k + ' : ' + h + ' kcal">'
      + '<div class="wk-bar' + (over ? ' over' : '') + (k === dkey() ? ' today' : '') + '" style="height:' + Math.max(4, Math.round(pct * 0.62)) + 'px"></div>'
      + '<span>' + d.toLocaleDateString('fr-CA', {weekday: 'short'}) + '</span>'
      + '<i>' + h + '</i></div>';
  }
  el.innerHTML = html;
}

function openModal(id){ document.getElementById(id).classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeModal(id){ document.getElementById(id).classList.remove('show'); document.body.style.overflow = ''; }
function closeAllModals(){ document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); document.body.style.overflow = ''; }

let cookCtx = null;
function currentPortions(){
  const v = parseInt((document.getElementById('portionInput') || {}).value, 10);
  return (isNaN(v) || v < 1) ? 1 : v;
}
function openCook(cat, idx, portions){
  const r = DATA_STORE[cat][idx];
  cookCtx = {cat: idx >= 0 ? cat : cat, idx: idx};
  const pInput = document.getElementById('portionInput');
  if(pInput) pInput.value = portions || 1;
  document.getElementById('mTitle').textContent = r.nom;
  renderCook(portions || 1);
  document.getElementById('mSteps').innerHTML = r.instructions
    .map(s => '<label class="check-row"><input type="checkbox"><span>' + esc(s) + '</span></label>').join('');
  updateStepProg();
  openModal('cookModal');
}
function renderCook(p){
  if(!cookCtx) return;
  const r = DATA_STORE[cookCtx.cat][cookCtx.idx];
  const m = parseMacros(r.macros);
  if(p > 1){
    document.getElementById('mMacros').textContent = 'Pour ' + p + ' portions : ~' + (m.kcal * p) + ' kcal | ' + (m.prot * p) + 'g Protéines | ' + (m.carb * p) + 'g Glucides | ' + (m.fat * p) + 'g Lipides • ' + r.type;
  } else {
    document.getElementById('mMacros').textContent = r.macros + ' • ' + r.type;
  }
  document.getElementById('mIngredients').innerHTML = r.ingredients
    .map(i => '<label class="check-row"><input type="checkbox"><span>' + esc(scaleIngText(i, p)) + '</span></label>').join('');
}
function updatePortions(){ if(cookCtx) renderCook(currentPortions()); }
function updateStepProg(){
  const boxes = [...document.querySelectorAll('#mSteps input[type=checkbox]')];
  const done = boxes.filter(b => b.checked).length;
  document.getElementById('stepProg').textContent = done + '/' + boxes.length + ' étapes';
  if(boxes.length && done === boxes.length) toast('🎉 Toutes les étapes cochées — bon appétit !', 'success');
}
function scaleIngText(raw, p){
  if(p === 1) return raw;
  return splitIngredients(raw).map(part => {
    const ing = parseIng(part);
    if(ing.qty === null) return part;
    return fmtQty(ing.qty * p) + (ing.unit ? ' ' + unitDisp(ing.unit, ing.qty * p) + ' ' : ' ') + ing.rest;
  }).join(' + ');
}
function recipeText(){
  if(!cookCtx) return '';
  const r = DATA_STORE[cookCtx.cat][cookCtx.idx];
  const p = currentPortions();
  return r.nom + (p > 1 ? ' (' + p + ' portions)' : '') + '\n' + r.macros + ' • ' + r.type + '\n\nINGRÉDIENTS\n'
    + r.ingredients.map(i => '• ' + scaleIngText(i, p)).join('\n') + '\n\nPRÉPARATION\n' + r.instructions.join('\n');
}
function printRecipe(){
  if(!cookCtx) return;
  const r = DATA_STORE[cookCtx.cat][cookCtx.idx];
  const p = currentPortions();
  document.getElementById('printArea').innerHTML =
    '<h1>' + esc(r.nom) + (p > 1 ? ' — ' + p + ' portions' : '') + '</h1><p class="p-sub">' + esc(r.macros) + ' • ' + esc(r.type) + '</p>'
    + '<h3>Ingrédients</h3><ul>' + r.ingredients.map(i => '<li>' + esc(scaleIngText(i, p)) + '</li>').join('') + '</ul>'
    + '<h3>Préparation</h3><ol>' + r.instructions.map(s => '<li>' + esc(s.replace(/^\d+\.\s*/, '')) + '</li>').join('') + '</ol>';
  window.print();
}
function copyRecipe(){ if(cookCtx) copyText(recipeText(), '📋 Recette copiée !'); }
function copyText(txt, okMsg){
  const done = () => toast(okMsg, 'success');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
  } else fallbackCopy(txt, done);
}
function fallbackCopy(txt, done){
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); done(); } catch(e){ toast('Copie impossible sur ce navigateur 😕', 'warn'); }
  ta.remove();
}

function openGroceryModal(){ renderPlanModal(); openModal('groceryModal'); }
function renderPlanModal(){
  const items = plannedRecipes();
  const t = totals();
  document.getElementById('planTotals').textContent =
    t.kcal + ' kcal • ' + t.prot + ' g protéines • ' + t.carb + ' g glucides • ' + t.fat + ' g lipides';
  const mealsEl = document.getElementById('planMeals');
  if(!items.length){
    mealsEl.innerHTML = '<div class="plan-empty">🍽️ Ton plan est vide.<br>Ajoute des recettes avec « ➕ Ajouter au plan »,<br>ou laisse la magie opérer avec « ✨ Générer auto » !</div>';
  } else {
    mealsEl.innerHTML = '<div class="plan-hint">💡 Change le moment (🌅 ☀️ 🌙 🥤 🫐) et le nombre de portions <strong>(×N p.)</strong> de chaque repas — l\'épicerie et les totaux se recalculent automatiquement.</div>'
      + SLOTS.map(slot => {
        const list = items.filter(x => x.slot === slot);
        if(!list.length) return '';
        return '<div class="slot-block"><div class="slot-title">' + SLOT_LABELS[slot] + '</div>'
          + list.map(x =>
            '<div class="meal-row"><span class="meal-name">' + esc(x.r.nom) + (x.portions > 1 ? ' <span class="meal-qty">×' + x.portions + '</span>' : '') + '</span>'
            + '<div class="meal-ctrl">'
            + '<select onchange="moveSlot(\'' + x.id + '\', this.value)" title="Changer le moment">'
            +   SLOTS.map(s => '<option value="' + s + '"' + (s === slot ? ' selected' : '') + '>' + SLOT_LABELS[s] + '</option>').join('')
            + '</select>'
            + '<label class="portion-mini" title="Nombre de portions">×<input type="number" min="1" max="20" value="' + x.portions + '" onchange="setPortions(\'' + x.id + '\', this.value)">p.</label>'
            + '<button class="mini-btn" title="Ouvrir la recette" onclick="cookMeal(\'' + x.id + '\')">🍳</button>'
            + '<button class="mini-btn del" title="Retirer" onclick="removeFromPlan(\'' + x.id + '\')">✕</button>'
            + '</div></div>').join('') + '</div>';
      }).join('');
  }
  renderGrocery();
}
function moveSlot(id, slot){
  const e = S.plan.find(p => p.id === id);
  if(e) e.slot = slot;
  store.set('plan', S.plan); renderPlanModal();
}
function setPortions(id, val){
  const e = S.plan.find(p => p.id === id);
  if(!e) return;
  let v = parseInt(val, 10);
  if(isNaN(v) || v < 1) v = 1;
  if(v > 20) v = 20;
  e.portions = v;
  store.set('plan', S.plan);
  renderPlanModal(); renderDashboard();
}
function removeFromPlan(id){
  S.plan = S.plan.filter(p => p.id !== id);
  store.set('plan', S.plan);
  renderPlanModal(); renderDashboard(); renderCards();
}
function cookMeal(id){
  const e = S.plan.find(p => p.id === id);
  if(!e) return;
  const f = findRecipe(e.nom);
  if(f) openCook(f.cat, f.idx, e.portions || 1);
}

function splitIngredients(raw){
  let s = String(raw).trim().replace(/\s*\+\s*/g, ', ');
  if(!s.includes(',')) return [s];
  const parts = s.split(/,\s*/).filter(p => p.length);
  if(parts.length < 2) return [s];
  const startsQty = t => /^\d/.test(t.trim());
  const tailHasQty = parts.slice(1).some(startsQty);
  if(startsQty(parts[0]) && !tailHasQty) return [s]; 
  return parts;
}
const FOOD_FIXES = [[/^romaines?$/i, 'Laitue romaine']];
function fixFoodName(s){
  const t = String(s).trim();
  for(const f of FOOD_FIXES){ if(f[0].test(t)) return f[1]; }
  return t;
}
const UNIT_MAP = {'tasses': 'tasse', 'scoops': 'scoop', 'tranches': 'tranche', 'boîtes': 'boîte', 'boites': 'boîte', 'feuilles': 'feuille', 'gousses': 'gousse', 'têtes': 'tête', 'tetes': 'tête', 'paquets': 'paquet',
  'c. à s.': 'c. à soupe', 'c. à s': 'c. à soupe', 'c à s.': 'c. à soupe', 'c à s': 'c. à soupe', 'c.à s.': 'c. à soupe',
  'c. à t.': 'c. à thé', 'c. à t': 'c. à thé', 'c à t.': 'c. à thé', 'c à t': 'c. à thé', 'c.à t.': 'c. à thé'};
function parseIng(raw){
  let s = String(raw).trim();
  let qty = null, rest = s, m;
  if((m = s.match(/^(\d+)\s*\/\s*(\d+)\s+(.+)$/))){ qty = +m[1] / +m[2]; rest = m[3]; }
  else if((m = s.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/))){ qty = parseFloat(m[1].replace(',', '.')); rest = m[2]; }
  let unit = '';
  if(qty !== null){
    const um = rest.match(/^(kg|g|ml|l|tasses?|c\.?\s*à\.?\s*soupe|c\.?\s*à\.?\s*thé|c\.?\s*à\.?\s*s\.?|c\.?\s*à\.?\s*t\.?|scoops?|tranches?|boîtes?|boites?|feuilles?|gousses?|têtes?|tetes?|paquets?)\s+(.+)$/i);
    if(um){
      let u = um[1].toLowerCase().replace(/\s+/g, ' ');
      if(UNIT_MAP[u] !== undefined) u = UNIT_MAP[u];
      if(u){ unit = u; rest = um[2]; }
    }
  }
  return {qty, unit, rest: rest.trim(), raw: s};
}
function foodKey(rest, unit){
  let k = deaccent(rest.toLowerCase()).replace(/\s+/g, ' ').replace(/^de\s+/, '').replace(/^d'/, '').trim();
  k = k.replace(/([^sx])s$/, '$1');
  return (unit ? deaccent(unit) + ' ' : '') + k;
}
function fmtQty(v){
  const r = Math.round(v * 4) / 4;
  if(r === Math.round(r)) return String(Math.round(r));
  const frac = {'0.25': '¼', '0.5': '½', '0.75': '¾'};
  const whole = Math.floor(r);
  const f = frac[String(+(r - whole).toFixed(2))];
  if(f) return (whole ? whole + ' ' : '') + f;
  return String(Math.round(v * 10) / 10).replace('.', ',');
}
function unitDisp(u, qty){
  if(!u) return '';
  const plur = ['tasse', 'tranche', 'boîte', 'feuille', 'gousse', 'tête', 'paquet', 'scoop'];
  return (qty > 1 && plur.includes(u)) ? u + 's' : u;
}
const AISLE_DEFAULT = '🥫 Épicerie & Secs';
const AISLE_OVERRIDES = [
  ['protein', AISLE_DEFAULT],
  ["beurre d'arachide", AISLE_DEFAULT], ["beurre d'amande", AISLE_DEFAULT], ['beurre de cacahuete', AISLE_DEFAULT],
  ['bouillon', AISLE_DEFAULT]
];
const AISLES = [
  {name: '🧂 Assaisonnements & Condiments', keys: ['sel','poivre','pincee','cannelle','curcuma','paprika','muscade','gingembre','poudre','epice','assaisonnement','levure','sauce','salsa','moutarde','dijon','vinaigre','vinaigrette','huile','spray','extrait','stevia','wasabi','origan','herbes sechees']},
  {name: '🧊 Congélateur', keys: ['surgel']},
  {name: '🥬 Fruits & Légumes', keys: ['pomme de terre','patate douce','patate','pomme','poire','banane','bleuet','fraise','framboise','mangue','ananas','kiwi','figue','orange','citron','lime','avocat','tomate','poivron','oignon','echalote','ail','epinard','laitue','roquette','mesclun','concombre','brocoli','chou','champignon','courge','zucchini','carotte','celeri','betterave','citrouille','edamame','persil','coriandre','menthe','basilic','ciboulette','petits pois','legume','fruit','mais']},
  {name: '🥩 Viandes & Poissons', keys: ['poulet','dinde','boeuf','porc','jambon','bacon','saucisse','agneau','veau','thon','saumon','crevette','morue','tilapia','truite','pepperoni','chorizo','prosciutto','steak','bifteck','viande','poitrine']},
  {name: '🥛 Laitier & Œufs', keys: ['fromage','cottage','ricotta','mozzarella','cheddar','feta','parmesan','gruyere','suisse','kefir','yaourt','yogourt','creme','beurre','oeuf','lait','tofu','boisson']},
  {name: '🍞 Boulangerie & Céréales', keys: ['pain','tortilla','bagel','muffin','pita','naan','galette','brioche','avoine','flocon','riz','quinoa','pates','pate','spaghetti','macaroni','nouille','farine','fecule','boulgour','couscous','chapelure','cereal','granola','muesli','craquelin','vermicelle']}
];
function aisleFor(text){
  const t = deaccent(text.toLowerCase());
  for(const o of AISLE_OVERRIDES){ if(t.includes(o[0])) return o[1]; }
  for(const a of AISLES){ for(const k of a.keys){ if(t.includes(k)) return a.name; } }
  return AISLE_DEFAULT;
}
function buildGroceryGroups(){
  const items = plannedRecipes();
  if(!items.length) return null;
  const map = new Map();
  items.forEach(x => {
    const p = Math.max(1, x.portions || 1);
    x.r.ingredients.forEach(raw => {
      splitIngredients(raw).forEach(part => {
        const ing = parseIng(part);
        if(ing.qty === null){
          const name = fixFoodName(ing.raw);
          const key = 'raw|' + deaccent(name.toLowerCase()).replace(/\s+/g, ' ');
          if(!map.has(key)) map.set(key, {count: 0, label: name});
          map.get(key).count += p;
        } else {
          const rest = fixFoodName(ing.rest) || ing.rest;
          const key = foodKey(rest, ing.unit);
          if(!map.has(key)) map.set(key, {qty: 0, unit: ing.unit, rest: rest});
          map.get(key).qty += ing.qty * p;
        }
      });
    });
  });
  const groups = {};
  map.forEach((e, key) => {
    const text = (e.count !== undefined)
      ? cap(e.label) + (e.count > 1 ? ' (×' + e.count + ')' : '')
      : fmtQty(e.qty) + (e.unit ? ' ' + unitDisp(e.unit, e.qty) + ' ' : ' ') + cap(e.rest);
    const aisle = aisleFor(e.count !== undefined ? e.label : e.rest);
    (groups[aisle] = groups[aisle] || []).push({key: key, text: text});
  });
  for(const a in groups) groups[a].sort((x, y) => x.text.localeCompare(y.text, 'fr'));
  return groups;
}
function renderGrocery(){
  const gEl = document.getElementById('gList');
  const groups = buildGroceryGroups();
  if(!groups){
    gEl.innerHTML = '<div class="plan-empty">🛒 La liste d\'épicerie apparaîtra dès que ton plan contiendra des recettes.</div>';
    document.getElementById('groceryCount').textContent = '';
    return;
  }
  const order = AISLES.map(a => a.name).concat([AISLE_DEFAULT]);
  const gc = store.get('groceryChecks', {date: '', keys: []});
  const checked = new Set(gc.date === dkey() ? gc.keys : []);
  let n = 0, html = '';
  order.forEach(a => {
    if(!groups[a]) return;
    n += groups[a].length;
    html += '<div class="aisle-block"><div class="aisle-title">' + a + '</div>'
      + groups[a].map(it => '<label class="check-row grocery-row"><input type="checkbox"'
        + (checked.has(it.key) ? ' checked' : '')
        + ' onchange="toggleGroceryCheck()" data-key="' + esc(it.key) + '"><span>' + esc(it.text) + '</span></label>').join('')
      + '</div>';
  });
  document.getElementById('groceryCount').textContent = ' — ' + n + ' articles cumulés';
  gEl.innerHTML = html;
}
function toggleGroceryCheck(){
  const keys = [...document.querySelectorAll('#gList input:checked')].map(i => i.dataset.key);
  store.set('groceryChecks', {date: dkey(), keys: keys});
}
function toggleGroceryClearChecks(){
  document.querySelectorAll('#gList input:checked').forEach(i => { i.checked = false; });
  store.set('groceryChecks', {date: dkey(), keys: []});
}
function copyGroceryToClipboard(){
  const groups = buildGroceryGroups();
  if(!groups){ toast('Ton plan est vide : ajoute des recettes d\'abord 🙂', 'warn'); return; }
  const order = AISLES.map(a => a.name).concat([AISLE_DEFAULT]);
  let txt = '🛒 MEAL PREP HUB — LISTE D\'ÉPICERIE\n';
  order.forEach(a => {
    if(!groups[a]) return;
    txt += '\n' + a + '\n';
    groups[a].forEach(it => { txt += '  ☐ ' + it.text + '\n'; });
  });
  copyText(txt, '📋 Liste d\'épicerie copiée !');
}

function totalsOf(picks){
  const t = {kcal: 0, prot: 0};
  picks.forEach(p => { const f = findRecipe(p.nom); if(f){ const m = parseMacros(f.r.macros); t.kcal += m.kcal; t.prot += m.prot; } });
  return t;
}
function generateDay(){
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const picks = [], used = new Set();
  [['dejeuners', 'Déjeuner'], ['diners', 'Dîner'], ['soupers', 'Souper']].forEach(pair => {
    const pool = recipesIn(pair[0]).filter(x => !used.has(x.r.nom));
    if(pool.length){ const c = rand(pool); used.add(c.r.nom); picks.push({id: gid(), nom: c.r.nom, slot: pair[1], portions: 1}); }
  });
  let t = totalsOf(picks);
  const coll = recipesIn('shakes').concat(recipesIn('smoothies')).filter(x => !used.has(x.r.nom));
  let guard = 0;
  while(S.goals.cal - t.kcal > 180 && coll.length && guard < 4){
    const remain = S.goals.cal - t.kcal;
    coll.sort((a, b) => Math.abs(a.m.kcal - remain) - Math.abs(b.m.kcal - remain));
    const c = coll.shift();
    used.add(c.r.nom);
    picks.push({id: gid(), nom: c.r.nom, slot: (c.cat === 'smoothies' ? 'Smoothie' : 'Shaker'), portions: 1});
    t.kcal += c.m.kcal; t.prot += c.m.prot;
    guard++;
  }
  S.plan = picks; store.set('plan', S.plan);
  renderDashboard(); renderCards();
  if(document.getElementById('groceryModal').classList.contains('show')) renderPlanModal();
  toast('✨ Journée composée : ' + t.kcal + ' kcal • ' + t.prot + ' g protéines', 'success');
}
function surpriseMe(){
  const all = [];
  for(const c in DATA_STORE) recipesIn(c).forEach(x => all.push(x));
  if(!all.length){ toast('Aucune recette disponible 🙂', 'warn'); return; }
  const p = all[Math.floor(Math.random() * all.length)];
  switchCategory(p.cat);
  openCook(p.cat, p.idx);
  toast('🎲 Le hasard a choisi : <strong>' + esc(p.r.nom) + '</strong>');
}

function openGoals(){
  document.getElementById('gCal').value = S.goals.cal;
  document.getElementById('gProt').value = S.goals.prot;
  document.getElementById('gCarb').value = S.goals.carb;
  document.getElementById('gFat').value = S.goals.fat;
  openModal('goalsModal');
}
function saveGoals(){
  const num = id => { const v = parseInt(document.getElementById(id).value, 10); return (isNaN(v) || v <= 0) ? null : v; };
  S.goals = {cal: num('gCal') || 2300, prot: num('gProt') || 170, carb: num('gCarb') || 235, fat: num('gFat') || 65};
  store.set('goals', S.goals);
  updateCounts(); renderDashboard();
  closeModal('goalsModal');
  toast('⚙️ Objectifs mis à jour : ' + S.goals.cal + ' kcal / ' + S.goals.prot + ' g protéines', 'success');
}

let tInt = null, tEnd = 0, audioCtx = null;
function ensureAudio(){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
  }catch(e){}
}
function startTimer(sec){
  if(sec < 1) return;
  ensureAudio();
  if(tInt) clearInterval(tInt);
  tEnd = Date.now() + sec * 1000;
  document.getElementById('timerBar').style.display = 'flex';
  tickTimer();
  tInt = setInterval(tickTimer, 250);
  closeAllModals();
  toast('⏱️ Minuteur lancé : ' + fmtClock(sec));
}
function customTimer(){
  const v = parseFloat(document.getElementById('customMin').value);
  if(!v || v <= 0){ toast('Entre un nombre de minutes 🙂', 'warn'); return; }
  startTimer(Math.round(v * 60));
}
function customTimerQuick(){
  const v = parseFloat(document.getElementById('customMinQuick').value);
  if(!v || v <= 0){ toast('Entre un nombre de minutes 🙂', 'warn'); return; }
  startTimer(Math.round(v * 60));
}
function fmtClock(s){
  s = Math.max(0, Math.round(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function tickTimer(){
  const ms = Math.max(0, tEnd - Date.now());
  document.getElementById('timerClock').textContent = fmtClock(ms / 1000);
  document.title = '⏱ ' + fmtClock(ms / 1000) + ' • Meal Prep Hub';
  if(ms <= 0){
    clearInterval(tInt); tInt = null;
    beep();
    flashTitle();
    toast('⏰ <strong>C\'est prêt !</strong> Ton minuteur est terminé.', 'success');
  }
}
function addTimerSeconds(sec){
  if(!tInt){ startTimer(sec); return; }
  tEnd += sec * 1000;
}
function stopTimer(){
  if(tInt){ clearInterval(tInt); tInt = null; }
  document.getElementById('timerBar').style.display = 'none';
  updateCounts();
}
function beep(){
  if(!audioCtx) return;
  try{
    [0, 0.4, 0.8].forEach((off, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1174.66 : 880;
      o.connect(g); g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + off;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.start(t0); o.stop(t0 + 0.4);
    });
  }catch(e){}
}
function flashTitle(){
  let n = 0;
  const iv = setInterval(() => {
    n++;
    document.title = n % 2 ? '⏰ C\'EST PRÊT !' : 'Meal Prep Hub';
    if(n >= 8){ clearInterval(iv); updateCounts(); }
  }, 650);
}
function triggerQuickTimer(){ openModal('quickTimerModal'); }

document.addEventListener('keydown', e => {
  if(e.key === 'Escape') closeAllModals();
  const tag = (document.activeElement || {}).tagName;
  if(e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT'){
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
});
(function init(){
  S.plan = (store.get('plan', [])).map(p => {
    let slot = p.slot;
    if(!SLOTS.includes(slot)){
      const f = findRecipe(p.nom);
      slot = f ? (DEFAULT_SLOT[f.cat] || 'Déjeuner') : 'Déjeuner';
    }
    return {id: p.id || gid(), nom: p.nom, slot: slot, portions: Math.max(1, parseInt(p.portions, 10) || 1)};
  });
  store.set('plan', S.plan);
  document.getElementById('mSteps').addEventListener('change', updateStepProg);
  const d = new Date().toLocaleDateString('fr-CA', {weekday: 'long', day: 'numeric', month: 'long'});
  document.getElementById('dashDate').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  updateCounts();
  switchCategory('dejeuners');
  renderDashboard();
})();