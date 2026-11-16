// Análisis del grupo (página aparte: analisis.html, fuera del juego, para el equipo): se cargan los "Resumen (CSV)" que manda cada familia (uno por niño) y sale una
// comparación de todos: por niño, por edad, Historia y Desafío, Modo Examen y cuánto cambió cada uno. Los archivos se
// leen aquí mismo, en el navegador: no se suben a ningún lado. Se descarga en PDF o todo junto en un solo CSV.

const GROUP_AGES = [['6 y 7 años', 6, 7], ['8 y 9 años', 8, 9], ['10 a 12 años', 10, 12]];
const EXAM_TESTS = ['Clásico', 'Menos uno', 'Pista'];

// ---------- leer los CSV ----------
function parseGroupCSV(text) {
  text = text.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return null;
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const head = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  return { head, rows: lines.slice(1).map(l => { const c = l.split(sep), o = {}; head.forEach((h, i) => { o[h] = (c[i] || '').trim().replace(/^"|"$/g, ''); }); return o; }) };
}
const gNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const gMean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const gPct = (a, b) => (b ? Math.round(a / b * 100) : null);
const gTxt = (v, suf) => (v === null || v === undefined ? '-' : v + (suf || ''));

// ---------- medidas de un niño ----------
function childMeasures(kid) {
  const rows = kid.rows;
  const isExam = r => /examen/i.test(r.modo);
  const isMem = r => r.minijuego === 'Memoria';
  const play = rows.filter(r => !isMem(r) && r.minijuego !== 'Camino' && gNum(r.objetivos) > 0);
  const att = g => {
    const t = g.reduce((a, r) => a + gNum(r.objetivos), 0), h = g.reduce((a, r) => a + (gNum(r.aciertos) || 0), 0);
    return { pct: gPct(h, t), err: gMean(g.map(r => gNum(r.comisiones) || 0)), rt: gMean(g.map(r => gNum(r.tr_medio_ms)).filter(v => v !== null)) };
  };
  const all = att(play);
  // cambio: primeras partidas frente a las últimas (un tercio de cada lado, mínimo 2)
  let change = null;
  if (play.length >= 4) {
    const k = Math.max(2, Math.floor(play.length / 3)), a = att(play.slice(0, k)), b = att(play.slice(-k));
    const up = b.pct - a.pct >= 5 || a.err - b.err >= 1, down = a.pct - b.pct >= 5 || b.err - a.err >= 1;
    change = { k, first: a, last: b, trend: up && !down ? 'mejoró' : down && !up ? 'bajó' : 'igual' };
  }
  // Historia: mejor resultado de cada capítulo
  const best = {};
  rows.filter(r => r.modo === 'Historia').forEach(r => {
    const key = r.mundo + '|' + r.capitulo;
    best[key] = Math.max(best[key] || 0, gNum(r.estrellas) || 0);
  });
  const keys = Object.keys(best);
  const story = {
    worlds: new Set(keys.map(k => k.split('|')[0])).size,
    passed: keys.filter(k => best[k] >= PASS_STARS).length,
    finished: keys.filter(k => k.split('|')[1] === '5' && best[k] >= PASS_STARS).length,
    stars: keys.reduce((a, k) => a + best[k], 0)
  };
  const des = rows.filter(r => r.modo === 'Desafío');
  const topLevel = des.length ? Math.max(...des.map(r => gNum(r.nivel) || 0)) : null;
  // Modo Examen: cada prueba, la primera vez frente a la última
  const exam = EXAM_TESTS.map(t => {
    const g = rows.filter(r => isExam(r) && r.minijuego === t && gNum(r.objetivos) > 0);
    if (!g.length) return null;
    const one = r => gPct(gNum(r.aciertos) || 0, gNum(r.objetivos));
    return { test: t, n: g.length, first: one(g[0]), last: one(g[g.length - 1]), err: gMean(g.map(r => gNum(r.comisiones) || 0)),
      rt: gMean(g.map(r => gNum(r.tr_medio_ms)).filter(v => v !== null)) };
  }).filter(Boolean);
  const mem = rows.filter(r => isExam(r) && isMem(r));
  const memory = mem.length ? { n: mem.length, fwd: Math.max(...mem.map(r => gNum(r.span_adelante) || 0)),
    bwd: Math.max(...mem.map(r => gNum(r.span_al_reves) || 0)) } : null;
  return {
    label: kid.label, age: gNum(rows[0] && rows[0].edad), games: rows.length,
    minutes: Math.round(rows.reduce((a, r) => a + (gNum(r.segundos_aprox) || 0), 0) / 60),
    pct: all.pct, err: all.err, rt: all.rt, change, story, topLevel, exam, memory
  };
}

function groupMeasures(kids) {
  const m = kids.map(childMeasures);
  const ages = GROUP_AGES.map(([name, lo, hi]) => {
    const g = m.filter(k => k.age !== null && k.age >= lo && k.age <= hi);
    return { name, n: g.length, pct: gMean(g.map(k => k.pct).filter(v => v !== null)), err: gMean(g.map(k => k.err).filter(v => v !== null)),
      rt: gMean(g.map(k => k.rt).filter(v => v !== null)), games: gMean(g.map(k => k.games)) };
  });
  const other = m.filter(k => k.age === null || !GROUP_AGES.some(([, lo, hi]) => k.age >= lo && k.age <= hi));
  const withChange = m.filter(k => k.change);
  const words = [];
  if (withChange.length) {
    const up = withChange.filter(k => k.change.trend === 'mejoró').length, down = withChange.filter(k => k.change.trend === 'bajó').length;
    words.push(up + ' de ' + withChange.length + ' niños mejoraron entre sus primeras y sus últimas partidas' +
      (down ? ', ' + down + ' bajaron' : '') + ' y ' + (withChange.length - up - down) + ' se mantuvieron igual.');
    const dp = gMean(withChange.map(k => k.change.last.pct - k.change.first.pct)), de = gMean(withChange.map(k => k.change.first.err - k.change.last.err));
    words.push('En promedio, los aciertos ' + (dp >= 0 ? 'subieron ' : 'bajaron ') + Math.abs(Math.round(dp)) + ' puntos y los errores por partida ' +
      (de >= 0 ? 'bajaron ' : 'subieron ') + Math.abs(de).toFixed(1) + '.');
  }
  const ag = ages.filter(a => a.n && a.pct !== null);
  if (ag.length >= 2) words.push('Por edad, los aciertos van de ' + Math.round(ag[0].pct) + ' % (' + ag[0].name + ') a ' +
    Math.round(ag[ag.length - 1].pct) + ' % (' + ag[ag.length - 1].name + ').');
  const few = m.filter(k => k.games < 5);
  if (few.length) words.push(few.length === 1 ? few[0].label + ' jugó menos de 5 partidas: sus resultados dicen poco.'
    : few.length + ' niños jugaron menos de 5 partidas: sus resultados dicen poco.');
  return { m, ages, other, words, games: m.reduce((a, k) => a + k.games, 0), minutes: m.reduce((a, k) => a + k.minutes, 0),
    pct: gMean(m.map(k => k.pct).filter(v => v !== null)) };
}

// ---------- tablas (las mismas en pantalla y en el PDF) ----------
const r0 = v => (v === null || v === undefined ? null : Math.round(v));
const r1 = v => (v === null || v === undefined ? null : v.toFixed(1));
function groupTables(G) {
  const arrow = t => (t === 'mejoró' ? '↑ mejoró' : t === 'bajó' ? '↓ bajó' : '= igual');
  const t = [];
  t.push({ title: 'Por niño', head: ['Niño', 'Edad', 'Partidas', 'Minutos', 'Aciertos', 'Errores/partida', 'Reacción', 'Primeras → últimas', 'Cambio'],
    rows: G.m.map(k => [k.label, gTxt(k.age), k.games, k.minutes, gTxt(r0(k.pct), ' %'), gTxt(r1(k.err)), gTxt(r0(k.rt), ' ms'),
      k.change ? k.change.first.pct + ' % → ' + k.change.last.pct + ' %' : '-', k.change ? arrow(k.change.trend) : 'pocas partidas']) });
  t.push({ title: 'Por edad', head: ['Edad', 'Niños', 'Partidas (prom.)', 'Aciertos', 'Errores/partida', 'Reacción'],
    rows: G.ages.map(a => [a.name, a.n, gTxt(r0(a.games)), gTxt(r0(a.pct), ' %'), gTxt(r1(a.err)), gTxt(r0(a.rt), ' ms')])
      .concat(G.other.length ? [['Otra edad o sin edad', G.other.length, '', '', '', '']] : []) });
  t.push({ title: 'Historia y Desafío', head: ['Niño', 'Mundos jugados', 'Capítulos superados', 'Mundos terminados', 'Estrellas', 'Desafío: nivel más alto'],
    rows: G.m.map(k => [k.label, k.story.worlds, k.story.passed, k.story.finished, k.story.stars, gTxt(k.topLevel)]) });
  // Modo Examen: una fila por niño (cada prueba: la primera vez → la última)
  const ex = G.m.filter(k => k.exam.length || k.memory).map(k => {
    const cell = t => { const e = k.exam.find(x => x.test === t); return e ? (e.n > 1 ? e.first + ' → ' + e.last + ' %' : e.first + ' %') : '-'; };
    const errs = k.exam.map(e => e.err).filter(v => v !== null), rts = k.exam.map(e => e.rt).filter(v => v !== null);
    return [k.label].concat(EXAM_TESTS.map(cell), [k.memory ? k.memory.fwd + ' / ' + (k.memory.bwd || '-') : '-',
      gTxt(r1(gMean(errs))), gTxt(r0(gMean(rts)), ' ms')]);
  });
  t.push({ title: 'Modo Examen (mismas condiciones para todos)',
    head: ['Niño', 'Clásico (1.ª → última)', 'Menos uno', 'Pista', 'Memoria (adelante / al revés)', 'Errores (prom.)', 'Reacción'],
    rows: ex, empty: 'Ningún niño hizo el Modo Examen.' });
  return t;
}

// ---------- pantalla ----------
function openGroupCompare(el) {
  let kids = [], warn = [];
  // en el computador también se pueden arrastrar los archivos a la página
  el.addEventListener('dragover', e => e.preventDefault());
  el.addEventListener('drop', e => { e.preventDefault(); loadFiles([...e.dataTransfer.files]); });
  const draw = () => {
    const G = kids.length ? groupMeasures(kids) : null;
    el.innerHTML = '<div class="mf-wrap"><header><h1>Focus Quest · Análisis del grupo</h1><div class="mf-tools">' +
      '<label class="mf-primary" style="padding:8px 12px;border-radius:10px;background:#7c3aed;color:#fff;cursor:pointer">Cargar archivos (CSV)' +
      '<input type="file" class="mf-files" accept=".csv,text/csv,text/plain" multiple style="display:none"></label>' +
      (G ? '<button class="mf-gpdf">Comparación (PDF)</button><button class="mf-gcsv">Todo junto (CSV)</button><button class="mf-gclear">Quitar archivos</button>' : '') +
      '</div></header>' +
      '<p class="mf-note">Carguen el <b>Resumen (CSV)</b> de cada niño (el que mandan las familias desde la Zona de resultados). ' +
      'Se pueden elegir varios a la vez o arrastrarlos aquí. Los archivos se leen solo en este equipo: no se suben a ningún lado.</p>' +
      (warn.length ? '<p class="mf-card" style="color:#b45309">' + warn.map(esc).join('<br>') + '</p>' : '') +
      (!G ? '<p class="mf-muted">Todavía no hay archivos cargados.</p>' :
        '<h2>Archivos cargados</h2><p class="mf-muted">Pueden cambiar el nombre con el que sale cada niño (por ejemplo, si todos vienen como P01).</p>' +
        '<div class="mf-scroll"><table><thead><tr><th>Niño</th><th>Archivo</th><th class="num">Partidas</th></tr></thead><tbody>' +
        kids.map((k, i) => '<tr><td><input class="mf-lbl" data-i="' + i + '" value="' + esc(k.label) + '" style="font:inherit;padding:4px 6px;width:140px"></td><td>' +
          esc(k.file) + '</td><td class="num">' + k.rows.length + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="mf-kpis" style="margin-top:16px">' + [[kids.length, 'niños'], [G.games, 'partidas'], [G.minutes + ' min', 'jugando (aprox.)'],
          [gTxt(r0(G.pct), ' %'), 'aciertos (promedio)']].map(([b, s]) => '<div class="mf-kpi"><b>' + esc(b) + '</b><span>' + esc(s) + '</span></div>').join('') + '</div>' +
        (G.words.length ? '<div class="mf-card mf-report"><b>En palabras</b><ul>' + G.words.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div>' : '') +
        groupTables(G).map(t => '<h2>' + esc(t.title) + '</h2>' + (!t.rows.length ? '<p class="mf-muted">' + esc(t.empty || '-') + '</p>' :
          '<div class="mf-scroll"><table><thead><tr>' + t.head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
          t.rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>')).join('') +
        '<h2>Aciertos: primeras partidas frente a las últimas</h2>' + groupChartSVG(G)) +
      '<p class="mf-muted" style="margin-top:20px">' + esc(PANEL_NOTE) + '</p></div>';
    const q = s => el.querySelector(s);
    q('.mf-files').onchange = e => loadFiles([...e.target.files]);
    if (!G) return;
    q('.mf-gpdf').onclick = () => groupPDF(G);
    q('.mf-gcsv').onclick = () => groupCSV(kids);
    q('.mf-gclear').onclick = () => { kids = []; warn = []; draw(); };
    el.querySelectorAll('.mf-lbl').forEach(inp => { inp.onchange = () => { kids[Number(inp.dataset.i)].label = inp.value.trim() || kids[Number(inp.dataset.i)].label; draw(); }; });
  };
  const loadFiles = files => {
    warn = [];
    Promise.all(files.map(f => f.text().then(text => ({ f, data: parseGroupCSV(text) }), () => ({ f, data: null })))).then(list => {
      list.forEach(({ f, data }) => {
        if (!data || !data.rows.length) { warn.push(f.name + ': no se pudo leer o está vacío.'); return; }
        if (data.head.includes('tipo_evento')) { warn.push(f.name + ': es el de "Datos detallados". Pidan el "Resumen (CSV)".'); return; }
        if (!data.head.includes('aciertos') || !data.head.includes('modo')) { warn.push(f.name + ': no es un Resumen (CSV) de Focus Quest.'); return; }
        // varias familias pueden mandar archivos con el mismo nombre (todos empiezan en P01): se compara el contenido
        const sig = rs => rs.length + '|' + JSON.stringify(rs[0]) + '|' + JSON.stringify(rs[rs.length - 1]);
        if (kids.some(k => sig(k.rows) === sig(data.rows))) { warn.push(f.name + ': ese mismo archivo ya estaba cargado.'); return; }
        const r = data.rows[0];
        // nombre: el del niño si viene; si no (CSV sin nombre), Niño 1, Niño 2...
        // (el código no sirve: en cada celular el primer niño es P01)
        let label = r.jugador || 'Niño ' + (kids.length + 1);
        if (kids.some(k => k.label === label)) label += ' (' + (kids.length + 1) + ')';
        kids.push({ file: f.name, label, rows: data.rows });
      });
      draw();
    });
  };
  draw();
}

// gráfica de barras (pantalla): por niño, primeras partidas (gris) y últimas (morado)
function groupChartSVG(G) {
  const ks = G.m.filter(k => k.change);
  if (!ks.length) return '<p class="mf-muted">Hace falta que cada niño tenga al menos 4 partidas.</p>';
  const bw = 18, gap = 26, L = 40, H = 220, W = L + ks.length * (2 * bw + gap) + 10, y = v => 190 - v * 1.7;
  const bars = ks.map((k, i) => {
    const x = L + i * (2 * bw + gap);
    return '<rect x="' + x + '" y="' + y(k.change.first.pct) + '" width="' + bw + '" height="' + (190 - y(k.change.first.pct)) + '" fill="#cbd5e1"/>' +
      '<rect x="' + (x + bw) + '" y="' + y(k.change.last.pct) + '" width="' + bw + '" height="' + (190 - y(k.change.last.pct)) + '" fill="#7c3aed"/>' +
      '<text x="' + (x + bw) + '" y="' + (H - 12) + '" text-anchor="middle">' + esc(k.label.slice(0, 10)) + '</text>';
  }).join('');
  const grid = [0, 50, 100].map(v => '<line x1="' + L + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e2e8f0"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '%</text>').join('');
  return '<figure class="mf-chart" style="max-width:100%;overflow-x:auto"><svg width="' + W + '" height="' + H + '">' + grid + bars + '</svg>' +
    '<figcaption class="mf-muted">Gris: primeras partidas · Morado: últimas partidas</figcaption></figure>';
}

// ---------- descargas ----------
function groupCSV(kids) {
  const heads = [];
  kids.forEach(k => Object.keys(k.rows[0] || {}).forEach(h => { if (!heads.includes(h)) heads.push(h); }));
  const rows = [].concat(...kids.map(k => k.rows.map(r => Object.assign({ _nino: k.label }, r))));
  saveCSV([['nino', r => r._nino]].concat(heads.map(h => [h, r => r[h]])), rows, 'grupo_todo_junto');
}
function groupPDF(G) {
  const pdf = new MiniPDF(), L = 40, R = pdf.W - 40;
  reportHeader(pdf, 'Comparación del grupo');
  let y = 110;
  const room = h => { if (y + h > 775) { reportFooter(pdf); pdf.addPage(); y = 50; } };
  pdf.text(L, y, G.m.length + ' niños  ·  ' + G.games + ' partidas  ·  ' + G.minutes + ' min de juego  ·  aciertos promedio ' + gTxt(r0(G.pct), ' %'), { size: 12, bold: true });
  y += 16; pdf.text(L, y, 'Informe del ' + reportDate(Date.now()), { size: 10, color: '#64748b' }); y += 24;
  if (G.words.length) {
    pdf.text(L, y, 'En palabras', { size: 13, bold: true }); y += 18;
    G.words.forEach(w => pdf.wrap(w, 10.5, R - L - 14).forEach((l, i) => { if (!i) pdf.rect(L, y - 6, 4, 4, '#7c3aed'); pdf.text(L + 12, y, l, { size: 10.5 }); y += 14; }));
    y += 10;
  }
  groupTables(G).forEach(t => {
    room(60);
    pdf.text(L, y, t.title, { size: 13, bold: true }); y += 18;
    if (!t.rows.length) { pdf.text(L, y, t.empty || '-', { size: 10, color: '#64748b' }); y += 22; return; }
    // anchos según el texto más largo de cada columna
    const fs = 8.5, need = t.head.map((h, j) => Math.max(MiniPDF.width(h.replace(/→/g, '->'), fs, true), ...t.rows.map(r => MiniPDF.width(String(r[j]).replace(/[↑↓→]/g, '->'), fs))) + 10);
    const scale = Math.min(1, (R - L) / need.reduce((a, b) => a + b, 0)), ws = need.map(w => w * scale);
    const xs = ws.map((w, j) => L + ws.slice(0, j).reduce((a, b) => a + b, 0));
    const head = () => { pdf.rect(L, y - 11, R - L, 17, '#1e1b4b'); t.head.forEach((h, j) => pdf.text(xs[j] + 4, y + 1, h.replace(/→/g, '->'), { size: fs, bold: true, color: '#ffffff' })); y += 18; };
    head();
    t.rows.forEach((r, i) => {
      if (y > 770) { reportFooter(pdf); pdf.addPage(); y = 50; head(); }
      if (i % 2) pdf.rect(L, y - 11, R - L, 15, '#f8fafc');
      r.forEach((c, j) => pdf.text(xs[j] + 4, y, String(c).replace(/↑/g, '+').replace(/↓/g, '-').replace(/→/g, '->'), { size: fs }));
      y += 15;
    });
    y += 16;
  });
  // barras: primeras frente a últimas
  const ks = G.m.filter(k => k.change);
  if (ks.length) {
    room(200);
    pdf.text(L, y, 'Aciertos: primeras partidas (gris) frente a las últimas (morado)', { size: 13, bold: true }); y += 20;
    const top = y, base = y + 130, bw = Math.min(16, (R - L - 30) / ks.length / 2.6), step = (R - L - 30) / ks.length;
    [0, 50, 100].forEach(v => { const yy = base - v * 1.3; pdf.line(L + 26, yy, R, yy, '#e2e8f0'); pdf.text(L + 20, yy + 3, v + '%', { size: 8, color: '#64748b', align: 'right' }); });
    ks.forEach((k, i) => {
      const x = L + 30 + i * step + step / 2 - bw;
      const h1 = k.change.first.pct * 1.3, h2 = k.change.last.pct * 1.3;
      pdf.rect(x, base - h1, bw, h1, '#cbd5e1'); pdf.rect(x + bw, base - h2, bw, h2, '#7c3aed');
      pdf.text(x + bw, base + 12, k.label.slice(0, 12), { size: 8, align: 'center' });
    });
    y = top + 160;
  }
  room(40);
  pdf.wrap('Cómo se calcula: "Aciertos" y "Errores/partida" usan los juegos de atención (no Memoria ni Camino). "Primeras -> últimas" compara el primer tercio de las partidas de cada niño con el último. El Modo Examen tiene siempre las mismas condiciones, por eso es la comparación más justa entre niños.', 9, R - L)
    .forEach(l => { pdf.text(L, y, l, { size: 9, color: '#64748b' }); y += 12; });
  reportFooter(pdf);
  const blob = pdf.blob();
  withGesture(() => deliverFile(blob, reportFileName('comparacion_grupo')));
}
