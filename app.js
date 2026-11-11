// Pickleball Tournament Maker. Data is saved in this browser (localStorage).
const KEY = 'pickleballTourney.v1';
const COURTS = 4, ROUNDS_PER_DAY = 3;
let ROOT = load(), S = cur(), view = 'days', curDay = null;

function freshClass(name) { return { id: Date.now(), name, roster: [], days: [], nextId: 1 }; }
function fresh() { const c = freshClass('Class 1'); return { classes: [c], current: c.id }; }
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (!r) return fresh();
    if (!r.classes) { // upgrade data saved by the first version
      const c = Object.assign(freshClass('My class'), { roster: r.roster, days: r.days, nextId: r.nextId });
      return { classes: [c], current: c.id };
    }
    return r;
  } catch (e) { return fresh(); }
}
function save() { localStorage.setItem(KEY, JSON.stringify(ROOT)); }
function cur() { return ROOT.classes.find(c => c.id === ROOT.current) || ROOT.classes[0]; }
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nm = id => (S.roster.find(p => p.id === id) || { name: '?' }).name;
const active = () => S.roster.filter(p => !p.removed).sort((a, b) => a.name.localeCompare(b.name));
const pk = (a, b) => a < b ? a + '-' + b : b + '-' + a;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function addPlayer(name) {
  name = name.trim(); if (!name) return null;
  let p = S.roster.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (p) { p.removed = false; return p; }
  p = { id: S.nextId++, name }; S.roster.push(p); return p;
}

// Everything the scheduler needs to know about the past
function stats() {
  const partner = {}, opp = {}, games = {}, wins = {}, pts = {}, sat = {};
  for (const d of S.days) for (const r of d.rounds) {
    (r.sitting || []).forEach(id => sat[id] = (sat[id] || 0) + 1);
    for (const g of r.games) {
      for (const t of [g.t1, g.t2]) if (t.length === 2) partner[pk(...t)] = (partner[pk(...t)] || 0) + 1;
      for (const a of g.t1) for (const b of g.t2) opp[pk(a, b)] = (opp[pk(a, b)] || 0) + 1;
      for (const p of [...g.t1, ...g.t2]) games[p] = (games[p] || 0) + 1;
      if (g.winner) for (const p of (g.winner === 1 ? g.t1 : g.t2)) { wins[p] = (wins[p] || 0) + 1; pts[p] = (pts[p] || 0) + (+g.pts || 0); }
    }
  }
  return { partner, opp, games, wins, pts, sat };
}

// Split ids into pairs where nobody has partnered more than t times before
function pairUp(ids, partner, t) {
  let nodes = 0; const rem = new Set(ids), res = [];
  (function rec() {
    if (!rem.size) return true;
    if (++nodes > 3000) return false;
    let best = null, opts = null;
    for (const a of rem) {
      const o = [...rem].filter(b => b !== a && (partner[pk(a, b)] || 0) <= t);
      if (!o.length) return false;
      if (!opts || o.length < opts.length) { best = a; opts = o; }
    }
    shuffle(opts); rem.delete(best);
    for (const b of opts) { rem.delete(b); res.push([best, b]); if (rec()) return true; res.pop(); rem.add(b); }
    rem.add(best); return false;
  })();
  return res.length * 2 === ids.length ? res.slice() : null;
}

function makeSinglesRound(day) {
  const st = stats();
  const here = day.present.filter(id => S.roster.some(p => p.id === id && !p.removed));
  const k = Math.min(COURTS * 2, Math.floor(here.length / 2) * 2);
  if (k < 2) { alert('Need at least 2 people marked here.'); return null; }
  const order = here.map(id => [id, (st.games[id] || 0) + Math.random() * 0.99]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  const play = order.slice(0, k);
  let best = null, bestScore = 1e9;
  for (let s = 0; s < 300 && bestScore > 0; s++) {
    shuffle(play); let sc = 0;
    for (let j = 0; j < k; j += 2) sc += st.opp[pk(play[j], play[j + 1])] || 0;
    if (sc < bestScore) { bestScore = sc; best = play.slice(); }
  }
  const games = [];
  for (let j = 0; j < k; j += 2) games.push({ court: j / 2 + 1, t1: [best[j]], t2: [best[j + 1]], winner: null, pts: '' });
  return { mode: 'singles', games, sitting: order.slice(k), repeats: 0, oppRepeats: bestScore };
}

function makeRound(day) {
  if (S.mode === 'singles') return makeSinglesRound(day);
  const st = stats();
  const here = day.present.filter(id => S.roster.some(p => p.id === id && !p.removed));
  const k = Math.min(COURTS * 4, Math.floor(here.length / 4) * 4);
  if (k < 4) { alert('Need at least 4 people marked here.'); return null; }
  for (let t = 0; t <= 10; t++) for (let i = 0; i < 60; i++) {
    // fewest games played gets priority to play; ties are random
    const order = here.map(id => [id, (st.games[id] || 0) + Math.random() * 0.99]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    const play = order.slice(0, k);
    const teams = pairUp(play, st.partner, t);
    if (!teams) continue;
    let bestT = null, bestScore = 1e9;
    for (let s = 0; s < 40; s++) {
      shuffle(teams); let sc = 0;
      for (let j = 0; j < teams.length; j += 2) for (const a of teams[j]) for (const b of teams[j + 1]) sc += st.opp[pk(a, b)] || 0;
      if (sc < bestScore) { bestScore = sc; bestT = teams.map(x => x.slice()); }
    }
    const games = [];
    for (let j = 0; j < bestT.length; j += 2) games.push({ court: j / 2 + 1, t1: bestT[j], t2: bestT[j + 1], winner: null, pts: '' });
    return { games, sitting: order.slice(k), repeats: t };
  }
  alert('Could not build a round.'); return null;
}

function classBar() {
  $('#classbar').innerHTML = `<select onchange="switchClass(+this.value)">${ROOT.classes.map(c => `<option value="${c.id}" ${c.id === S.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
  <button onclick="newClass()">+ New class</button><button onclick="renameClass()">Rename</button><button onclick="deleteClass()">Delete</button>`;
}
function switchClass(id) { ROOT.current = id; S = cur(); curDay = null; save(); render(); }
function newClass() {
  const n = prompt('Name of the new class (for example, 10am class):'); if (!n || !n.trim()) return;
  const c = freshClass(n.trim()); ROOT.classes.push(c); switchClass(c.id);
}
function renameClass() { const n = prompt('New name for this class:', S.name); if (n && n.trim()) { S.name = n.trim(); save(); render(); } }
function deleteClass() {
  if (ROOT.classes.length < 2) { alert('You need at least one class.'); return; }
  if (!confirm('Delete "' + S.name + '" with its class list and all its days?')) return;
  ROOT.classes = ROOT.classes.filter(c => c.id !== S.id); switchClass(ROOT.classes[0].id);
}

// ---------- Spreadsheet export (CSV opens in Excel / Google Sheets) ----------
function download(filename, rows) {
  const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
const nmo = id => id == null ? '' : nm(id);
const fileBase = () => S.name.replace(/[^\w-]+/g, '_');
function exportGames() {
  const rows = [['Class', 'Day', 'Date', 'Game', 'Format', 'Court', 'Team 1 player A', 'Team 1 player B', 'Team 2 player A', 'Team 2 player B', 'Winning team', 'Winning points', 'Sitting out']];
  S.days.forEach((d, di) => d.rounds.forEach((r, ri) => r.games.forEach(g => rows.push([S.name, di + 1, d.date, ri + 1, r.mode === 'singles' ? 'Singles' : 'Doubles', g.court,
    nmo(g.t1[0]), nmo(g.t1[1]), nmo(g.t2[0]), nmo(g.t2[1]), g.winner ? 'Team ' + g.winner : '', g.pts, r.sitting.map(nm).join('; ')]))));
  download(fileBase() + '_games.csv', rows);
}
function exportStandings() {
  const rows = [['Class', 'Player', 'Games', 'Wins', 'Points', 'Sat out']];
  standingRows().forEach(r => rows.push([S.name, r.p.name, r.g, r.w, r.pt, r.s]));
  download(fileBase() + '_standings.csv', rows);
}

function render() {
  classBar();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  $('#app').innerHTML = view === 'roster' ? rosterView() : view === 'standings' ? standingsView() : daysView();
}
document.querySelector('nav').onclick = e => { if (e.target.dataset.view) { view = e.target.dataset.view; render(); } };

// ---------- Class list ----------
function rosterView() {
  const list = active();
  return `<section><h2>Class list (${list.length})</h2>
  <div class="row"><input type="text" id="np" placeholder="Add a name" onkeydown="if(event.key==='Enter')addOne()">
  <button class="b" onclick="addOne()">Add</button></div>
  <div class="row"><label>Import from spreadsheet (save as .csv, names in the first column): <input type="file" id="csv" accept=".csv,.txt" onchange="importCsv(this)"></label></div>
  <ul>${list.map(p => `<li>${esc(p.name)} <button class="x" onclick="removeP(${p.id})">remove</button></li>`).join('') || '<li class="muted">No names yet.</li>'}</ul>
  <button class="g" onclick="resetAll()">Erase this class and start over</button></section>`;
}
function addOne() { const el = $('#np'); addPlayer(el.value); save(); render(); $('#np').focus(); }
function removeP(id) { S.roster.find(p => p.id === id).removed = true; save(); render(); }
function importCsv(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let n = 0;
    r.result.split(/\r?\n/).forEach((line, i) => {
      let v = line.split(',')[0].replace(/^"|"$/g, '').trim();
      if (!v || (i === 0 && /^(name|names|student|player)s?$/i.test(v))) return;
      addPlayer(v); n++;
    });
    save(); render(); alert('Imported ' + n + ' names.');
  };
  r.readAsText(f);
}
function resetAll() { if (confirm('Delete this class list and all its days?')) { S.roster = []; S.days = []; S.nextId = 1; curDay = null; save(); render(); } }

// ---------- Play days ----------
function daysView() {
  if (!S.days.length) return `<section><h2>Play days</h2><p>Start a day, mark who showed up, then make each game round.</p><button class="b" onclick="newDay()">Start day 1</button></section>`;
  const day = S.days.find(d => d.id === curDay) || S.days[S.days.length - 1]; curDay = day.id;
  const pastGames = S.days.reduce((n, d) => n + d.rounds.length, 0);
  return `<section><div class="row"><select onchange="curDay=+this.value;render()">${S.days.map((d, i) => `<option value="${d.id}" ${d.id === day.id ? 'selected' : ''}>Day ${i + 1} (${esc(d.date)})</option>`).join('')}</select>
  <button class="g" onclick="newDay()">+ New day</button><button class="x" onclick="delDay(${day.id})">delete this day</button></div></section>
  <section><h2>Who is here today (${day.present.filter(id => active().some(p => p.id === id)).length})</h2>
  <p class="muted">Tap a name to mark here or absent. Changes apply to the next round you make.</p>
  <div class="chips">${active().map(p => `<span class="chip ${day.present.includes(p.id) ? 'here' : ''}" onclick="toggleHere(${day.id},${p.id})">${esc(p.name)}</span>`).join('')}</div>
  <div class="row"><input type="text" id="late" placeholder="New person arriving" onkeydown="if(event.key==='Enter')addLate(${day.id})"><button class="g" onclick="addLate(${day.id})">Add and mark here</button></div></section>
  ${day.rounds.map((r, ri) => roundView(day, r, ri)).join('')}
  <section><div class="row"><label>Format for the next game: <select onchange="S.mode=this.value;save()"><option value="doubles" ${S.mode !== 'singles' ? 'selected' : ''}>Doubles (2 v 2)</option><option value="singles" ${S.mode === 'singles' ? 'selected' : ''}>Singles (1 v 1)</option></select></label></div>
  <button class="b" ${day.rounds.length >= ROUNDS_PER_DAY ? 'disabled' : ''} onclick="nextRound(${day.id})">${day.rounds.length >= ROUNDS_PER_DAY ? 'All ' + ROUNDS_PER_DAY + ' games done for today' : 'Make game ' + (day.rounds.length + 1) + ' of ' + ROUNDS_PER_DAY}</button>
  ${day.rounds.length ? `<button class="g" onclick="redoRound(${day.id})">Redo last game (clears its scores)</button>` : ''}</section>`;
}
let editKey = null;
function teamHtml(day, r, ri, gi, tn) {
  const team = tn === 1 ? r.games[gi].t1 : r.games[gi].t2;
  if (editKey !== day.id + '-' + ri) return team.map(nm).map(esc).join(' &amp; ');
  const inRound = new Set([...r.games.flatMap(g => [...g.t1, ...g.t2]), ...r.sitting]);
  const pool = S.roster.filter(p => !p.removed && (day.present.includes(p.id) || inRound.has(p.id))).sort((x, y) => x.name.localeCompare(y.name));
  return team.map((id, ix) => `<select onchange="setPlayer(${day.id},${ri},${gi},${tn},${ix},+this.value)">${pool.map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`).join(' ');
}
function toggleEdit(did, ri) { editKey = editKey === did + '-' + ri ? null : did + '-' + ri; render(); }
// Swap a player into a slot. If the new person is already in this game round (playing or sitting), the two trade places.
function setPlayer(did, ri, gi, tn, ix, newId) {
  const r = dayById(did).rounds[ri], g = r.games[gi], team = tn === 1 ? g.t1 : g.t2, old = team[ix];
  if (newId === old) return;
  team[ix] = newId;
  let done = false;
  for (const g2 of r.games) for (const t of [g2.t1, g2.t2]) for (let i = 0; i < t.length && !done; i++)
    if (t[i] === newId && !(t === team && i === ix)) { t[i] = old; done = true; }
  if (!done) { const si = r.sitting.indexOf(newId); if (si >= 0) r.sitting[si] = old; else r.sitting.push(old); }
  r.repeats = 0; r.oppRepeats = 0; // warnings no longer apply after a manual change
  save(); render();
}
function roundView(day, r, ri) {
  return `<section><h2>Game ${ri + 1} (${r.mode === 'singles' ? 'singles' : 'doubles'})</h2>
  ${r.oppRepeats ? `<p class="note">Everyone has already played some of the people here, so some opponents repeat.</p>` : ''}
  ${r.repeats ? `<p class="note">Not enough fresh partners left, so ${r.repeats > 1 ? 'some players' : 'some players'} had to repeat a partner.</p>` : ''}
  <div class="games">${r.games.map((g, gi) => `<div class="game"><div class="ct">Court ${g.court}</div>
   <div class="team ${g.winner === 1 ? 'win' : ''}">${teamHtml(day, r, ri, gi, 1)}</div><div class="vs">vs</div>
   <div class="team ${g.winner === 2 ? 'win' : ''}">${teamHtml(day, r, ri, gi, 2)}</div>
   <div class="row"><select onchange="setWin(${day.id},${ri},${gi},this.value)"><option value="0">Winner?</option><option value="1" ${g.winner === 1 ? 'selected' : ''}>Top team</option><option value="2" ${g.winner === 2 ? 'selected' : ''}>Bottom team</option></select>
   <input type="number" min="0" placeholder="pts" value="${g.pts}" onchange="setPts(${day.id},${ri},${gi},this.value)"></div></div>`).join('')}</div>
  ${r.sitting.length ? `<p class="muted">Sitting out: ${r.sitting.map(nm).map(esc).join(', ')}</p>` : ''}
  <button class="g" onclick="toggleEdit(${day.id},${ri})">${editKey === day.id + '-' + ri ? 'Done editing' : 'Edit players'}</button>${editKey === day.id + '-' + ri ? ' <span class="muted">Pick a different name in any slot. If that person is already in this game, you two swap places.</span>' : ''}</section>`;
}
const dayById = id => S.days.find(d => d.id === id);
function newDay() {
  const prev = S.days[S.days.length - 1];
  const d = { id: S.nextId++, date: new Date().toLocaleDateString(), present: prev ? prev.present.slice() : active().map(p => p.id), rounds: [] };
  S.days.push(d); curDay = d.id; save(); render();
}
function delDay(id) { if (confirm('Delete this day and its games?')) { S.days = S.days.filter(d => d.id !== id); curDay = null; save(); render(); } }
function toggleHere(did, pid) { const d = dayById(did); d.present = d.present.includes(pid) ? d.present.filter(x => x !== pid) : [...d.present, pid]; save(); render(); }
function addLate(did) { const el = $('#late'), p = addPlayer(el.value); if (!p) return; const d = dayById(did); if (!d.present.includes(p.id)) d.present.push(p.id); save(); render(); }
function nextRound(did) { const d = dayById(did), r = makeRound(d); if (r) { d.rounds.push(r); save(); render(); } }
function redoRound(did) { const d = dayById(did); d.rounds.pop(); save(); render(); }
function setWin(did, ri, gi, v) { dayById(did).rounds[ri].games[gi].winner = +v || null; save(); render(); }
function setPts(did, ri, gi, v) { dayById(did).rounds[ri].games[gi].pts = v; save(); }

// ---------- Standings ----------
function standingRows() {
  const st = stats();
  return active().concat(S.roster.filter(p => p.removed && st.games[p.id])).map(p => ({ p, g: st.games[p.id] || 0, w: st.wins[p.id] || 0, pt: st.pts[p.id] || 0, s: st.sat[p.id] || 0 }))
    .sort((a, b) => b.w - a.w || b.pt - a.pt);
}
function standingsView() {
  const rows = standingRows();
  return `<section><h2>Standings</h2><div class="row"><button class="b" onclick="exportGames()">Download all games and scores (.csv)</button><button class="g" onclick="exportStandings()">Download standings (.csv)</button></div>
  <p class="muted">Points = total points scored by the winning team in games a player won.</p>
  <table><tr><th>Player</th><th>Games</th><th>Wins</th><th>Points</th><th>Sat out</th></tr>
  ${rows.map(r => `<tr><td>${esc(r.p.name)}</td><td>${r.g}</td><td>${r.w}</td><td>${r.pt}</td><td>${r.s}</td></tr>`).join('')}</table></section>`;
}
render();