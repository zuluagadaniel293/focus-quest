// Informes en PDF, fáciles de leer (en vez de la tabla larga del CSV, que queda solo en el Panel como "Datos detallados"):
// - reportSession(ses, player): una partida (botón "Descargar informe" en los resultados y en "Tu resultado anterior")
// - reportPlayer(player, sessions, minutes): todas las partidas de un niño (Panel)
// El PDF se arma aquí mismo, sin librerías: letra Helvetica (trae tildes y ñ), cuadros, líneas y estrellas dibujadas.

// ---------- PDF mínimo (hoja A4, medidas en puntos, y = desde arriba) ----------
class MiniPDF {
  constructor() { this.pages = []; this.W = 595; this.H = 842; this.addPage(); }
  addPage() { this.ops = []; this.pages.push(this.ops); }
  static str(t) {
    // texto en WinAnsi: lo que no exista ahí (emojis, ★) se cambia o se quita
    t = String(t === undefined || t === null ? '' : t).replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/…/g, '...');
    let out = '';
    for (const ch of t) {
      const c = ch.codePointAt(0);
      if (c === 40 || c === 41 || c === 92) out += '\\' + ch;
      else if (c >= 32 && c < 127) out += ch;
      else if (c >= 160 && c <= 255) out += '\\' + c.toString(8);
    }
    return '(' + out + ')';
  }
  static rgb(hex) { return [0, 2, 4].map(i => (parseInt(hex.slice(1 + i, 3 + i), 16) / 255).toFixed(3)).join(' '); }
  text(x, y, t, o = {}) {
    const size = o.size || 11, w = MiniPDF.width(t, size, o.bold);
    if (o.align === 'right') x -= w; else if (o.align === 'center') x -= w / 2;
    this.ops.push('BT /' + (o.bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + MiniPDF.rgb(o.color || '#111111') + ' rg ' +
      x.toFixed(1) + ' ' + (this.H - y).toFixed(1) + ' Td ' + MiniPDF.str(t) + ' Tj ET');
  }
  // ancho aproximado en Helvetica (suficiente para alinear y partir líneas)
  static width(t, size, bold) {
    let w = 0;
    for (const ch of String(t)) w += /[il.,:;'|!]/.test(ch) ? 0.28 : /[mwMW]/.test(ch) ? 0.85 : /[A-Z]/.test(ch) ? 0.68 : /[0-9]/.test(ch) ? 0.56 : ch === ' ' ? 0.28 : 0.53;
    return w * size * (bold ? 1.06 : 1);
  }
  wrap(t, size, maxW, bold) {
    const lines = []; let cur = '';
    String(t).split(' ').forEach(w => {
      const next = cur ? cur + ' ' + w : w;
      if (MiniPDF.width(next, size, bold) > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  rect(x, y, w, h, fill, stroke) {
    this.ops.push((fill ? MiniPDF.rgb(fill) + ' rg ' : '') + (stroke ? MiniPDF.rgb(stroke) + ' RG 0.8 w ' : '') +
      x.toFixed(1) + ' ' + (this.H - y - h).toFixed(1) + ' ' + w.toFixed(1) + ' ' + h.toFixed(1) + ' re ' + (fill && stroke ? 'B' : fill ? 'f' : 'S'));
  }
  line(x1, y1, x2, y2, color, width) {
    this.ops.push(MiniPDF.rgb(color || '#cbd5e1') + ' RG ' + (width || 0.8) + ' w ' + x1.toFixed(1) + ' ' + (this.H - y1).toFixed(1) +
      ' m ' + x2.toFixed(1) + ' ' + (this.H - y2).toFixed(1) + ' l S');
  }
  star(cx, cy, r, filled) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      pts.push((cx + rr * Math.cos(a)).toFixed(1) + ' ' + (this.H - (cy + rr * Math.sin(a))).toFixed(1));
    }
    this.ops.push((filled ? MiniPDF.rgb('#f5b301') + ' rg ' : '') + MiniPDF.rgb(filled ? '#c98a00' : '#94a3b8') + ' RG 1 w ' +
      pts[0] + ' m ' + pts.slice(1).map(p => p + ' l').join(' ') + ' h ' + (filled ? 'B' : 'S'));
  }
  blob() {
    const objs = [];
    const add = s => { objs.push(s); return objs.length; };
    const catalog = add(''), pagesId = add('');
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = this.pages.map(ops => {
      const body = ops.join('\n');
      const content = add('<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream');
      return add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + this.W + ' ' + this.H + '] /Contents ' + content +
        ' 0 R /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> >>');
    });
    objs[catalog - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>';
    objs[pagesId - 1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
    let out = '%PDF-1.4\n';
    const offs = objs.map((o, i) => { const at = out.length; out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; return at; });
    const xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return new Blob([out], { type: 'application/pdf' });
  }
}

// ---------- textos comunes ----------
const REPORT_MODE = { historia: 'Historia', desafio: 'Desafío', prueba: 'Modo Examen', memoria: 'Modo Examen' };
const reportDate = t => new Date(t).toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const reportDay = t => new Date(t).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
const reportGame = s => (s.boss ? 'Jefe final' : s.mode === 'memoria' || s.minigame === 'memory' ? 'Memoria' : MG[s.minigame] ? MG[s.minigame].label : s.minigame || '');
const reportPlace = s => (s.mode === 'historia' ? (s.boss ? 'Capítulo 5 (jefe final)' : 'Capítulo ' + (s.chapter + 1))
  : s.mode === 'desafio' ? 'Nivel ' + s.level : '');
const reportIsMemory = s => !!s.memory || (s.minigame === 'memory' && !s.boss);
const pctOf = (a, b) => (b ? Math.round(a / b * 100) : 0);
const ms = v => (typeof v === 'number' && isFinite(v) ? Math.round(v) + ' ms' : '-');

// Lo que significa la partida, en palabras sencillas (sin diagnóstico)
function reportMeaning(s) {
  const st = s.stats || {};
  if (reportIsMemory(s)) {
    const m = s.memory || {};
    return ['Recordó caminos de hasta ' + (m.fwd || 0) + ' casillas' + (m.bwd ? ' y, al revés, de hasta ' + m.bwd + '.' : '.'),
      'Entre más largo el camino que recuerda, mejor está su memoria de trabajo (guardar algo en la mente mientras lo usa).'];
  }
  if (s.minigame === 'path' && !s.boss) {
    return [pctOf(st.hits, st.targets) >= 75 ? 'Completó la mayoría de los caminos.' : 'Le costó completar los caminos; puede repetir el nivel.',
      st.commissions ? 'Pisó ' + st.commissions + ' piedras equivocadas.' : 'No pisó ninguna piedra equivocada.'];
  }
  const out = [], hr = st.targets ? st.hits / st.targets : 1;
  out.push(hr >= 0.9 ? 'Mantuvo muy bien la atención: encontró casi todo lo que tenía que tocar.'
    : hr >= 0.75 ? 'Mantuvo la atención la mayor parte del tiempo; se le pasaron algunos.'
      : hr >= 0.5 ? 'Se le pasaron varios: pudo distraerse o el nivel le quedó difícil.'
        : 'Se le pasaron muchos: conviene repetir este nivel o uno más fácil.');
  const base = ['find', 'dodge'].includes(s.minigame) ? st.trials : st.distractors;
  const cr = st.commissions ? st.commissions / Math.max(base || 0, 8) : 0;
  out.push(!st.commissions ? 'No tocó nada que no debía: muy buen control de los impulsos.'
    : st.commissions <= 2 || cr <= 0.1 ? 'Casi siempre esperó bien antes de tocar.'
      : cr <= 0.25 ? 'A veces tocó sin esperar (algo de impulsividad).'
        : 'Tocó muchas veces sin esperar: le cuesta frenar el impulso; vale la pena seguir practicando.');
  if (isFinite(st.meanRT) && isFinite(st.sdRT) && st.meanRT > 0) {
    const cv = st.sdRT / st.meanRT;
    out.push('Su velocidad para responder fue ' + (cv < 0.25 ? 'pareja durante toda la partida.' : cv < 0.4 ? 'algo variable.'
      : 'muy variable (a ratos rápido y a ratos lento), algo común cuando la atención va y viene.'));
  }
  return out;
}
// Filas de resultados [nombre, valor, explicación]
function reportRows(s) {
  const st = s.stats || {};
  if (reportIsMemory(s)) {
    const m = s.memory || {};
    return [['Caminos bien recordados', st.hits + ' de ' + st.targets, ''],
      ['Camino más largo (adelante)', (m.fwd || 0) + ' casillas', 'repitiendo en el mismo orden'],
      ['Camino más largo (al revés)', m.bwd ? m.bwd + ' casillas' : '-', 'repitiendo del último al primero']];
  }
  if (s.minigame === 'path' && !s.boss) {
    return [['Caminos completados', st.hits + ' de ' + st.targets, ''], ['Piedras equivocadas', String(st.commissions || 0), '']];
  }
  return [
    ['Aciertos', st.hits + ' de ' + st.targets + '  (' + pctOf(st.hits, st.targets) + ' %)', 'tocó cuando debía'],
    ['Se le pasaron', String(st.omissions || 0), 'debía tocar y no tocó (despiste)'],
    ['Errores por impulso', String(st.commissions || 0), 'tocó cuando no debía'],
    ['Tiempo de reacción', ms(st.meanRT), 'lo que tarda en tocar (promedio)']
  ];
}

function reportHeader(pdf, subtitle) {
  pdf.rect(0, 0, pdf.W, 74, '#1e1b4b');
  pdf.text(40, 38, 'FOCUS QUEST', { size: 24, bold: true, color: '#fde047' });
  pdf.text(40, 60, subtitle, { size: 12, color: '#e2e8f0' });
  pdf.text(pdf.W - 40, 60, 'Juego de entrenamiento de la atención', { size: 10, color: '#cbd5e1', align: 'right' });
}
function reportFooter(pdf) {
  pdf.line(40, 790, pdf.W - 40, 790);
  pdf.wrap('Focus Quest es un juego de entrenamiento: este informe muestra cómo le fue al jugar y no es un diagnóstico ni reemplaza una evaluación profesional.', 8.5, pdf.W - 80)
    .forEach((l, i) => pdf.text(40, 804 + i * 11, l, { size: 8.5, color: '#64748b' }));
}
function reportFileName(base, t) {
  const d = new Date(t || Date.now()), p = n => String(n).padStart(2, '0');
  return 'focusquest_' + base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_') + '_' +
    d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + 'h' + p(d.getMinutes()) + '.pdf';
}

// ---------- informe de una partida ----------
function reportSession(ses, player) {
  if (!ses) return;
  player = player || currentPlayer() || {};
  const pdf = new MiniPDF(), L = 40, R = pdf.W - 40;
  reportHeader(pdf, 'Informe de partida');
  let y = 110;
  const info = [['Jugador', (player.name || '-') + (player.code ? '  (' + player.code + ')' : '')],
    ['Edad', player.age ? player.age + ' años' : '-'], ['Fecha', reportDate(ses.t)],
    ['Modo', REPORT_MODE[ses.mode] || ses.mode],
    ['Mundo', ses.theme === 'mixto' ? 'Varios mundos' : worldLabel(ses.theme)]];
  if (reportPlace(ses)) info.push([ses.mode === 'historia' ? 'Capítulo' : 'Nivel', reportPlace(ses)]);
  info.push(['Juego', reportGame(ses)]);
  info.forEach(([k, v]) => { pdf.text(L, y, k, { size: 11, color: '#64748b' }); pdf.text(L + 110, y, v, { size: 12, bold: true }); y += 20; });
  // estrellas (no en el Modo Examen, donde el niño no ve resultados)
  if (ses.mode !== 'prueba' && ses.mode !== 'memoria') {
    pdf.text(R - 120, 110, 'Estrellas', { size: 11, color: '#64748b' });
    for (let i = 0; i < 3; i++) pdf.star(R - 108 + i * 38, 138, 15, i < (ses.stars || 0));
  }
  y += 18;
  pdf.text(L, y, 'Resultados', { size: 15, bold: true }); y += 8;
  pdf.line(L, y, R, y, '#7c3aed', 1.5); y += 22;
  reportRows(ses).forEach(([k, v, why]) => {
    pdf.text(L, y, k, { size: 12 });
    pdf.text(L + 190, y, v, { size: 13, bold: true });
    if (why) pdf.text(L + 330, y, why, { size: 9.5, color: '#64748b' });
    y += 9; pdf.line(L, y, R, y); y += 20;
  });
  y += 12;
  pdf.text(L, y, '¿Qué significa?', { size: 15, bold: true }); y += 8;
  pdf.line(L, y, R, y, '#7c3aed', 1.5); y += 22;
  reportMeaning(ses).forEach(t => {
    pdf.wrap(t, 12, R - L - 16).forEach((l, i) => { if (!i) pdf.rect(L, y - 7, 5, 5, '#7c3aed'); pdf.text(L + 14, y, l, { size: 12 }); y += 17; });
    y += 5;
  });
  reportFooter(pdf);
  const blob = pdf.blob(), name = reportFileName((player.name || 'jugador') + '_' + (REPORT_MODE[ses.mode] || ses.mode) + '_' + reportGame(ses), ses.t);
  withGesture(() => deliverFile(blob, name));
}

// ---------- informe de un jugador (todas sus partidas) ----------
function reportPlayer(player, sessions, minutes) {
  const pdf = new MiniPDF(), L = 40, R = pdf.W - 40;
  reportHeader(pdf, 'Informe del jugador');
  let y = 110;
  pdf.text(L, y, player.name + '  (' + player.code + ')' + (player.age ? '  ·  ' + player.age + ' años' : ''), { size: 16, bold: true }); y += 20;
  pdf.text(L, y, 'Informe del ' + reportDate(Date.now()), { size: 10, color: '#64748b' }); y += 26;
  const play = sessions.filter(s => s.stats && s.stats.targets && !reportIsMemory(s) && !(s.minigame === 'path' && !s.boss));
  const hits = play.reduce((a, s) => a + s.stats.hits, 0), targets = play.reduce((a, s) => a + s.stats.targets, 0);
  const errs = play.reduce((a, s) => a + (s.stats.commissions || 0), 0);
  const kpis = [[String(sessions.length), 'partidas'], [Math.round(minutes || 0) + ' min', 'jugando (aprox.)'],
    [targets ? pctOf(hits, targets) + ' %' : '-', 'aciertos en total'], [play.length ? (errs / play.length).toFixed(1) : '-', 'errores por partida']];
  const bw = (R - L - 30) / 4;
  kpis.forEach(([b, s], i) => {
    const x = L + i * (bw + 10);
    pdf.rect(x, y, bw, 52, '#f1f5f9', '#cbd5e1');
    pdf.text(x + bw / 2, y + 26, b, { size: 17, bold: true, align: 'center' });
    pdf.text(x + bw / 2, y + 42, s, { size: 9, color: '#64748b', align: 'center' });
  });
  y += 70;
  // cómo cambió: primeras partidas frente a las últimas
  if (play.length >= 4) {
    const k = Math.max(2, Math.floor(play.length / 3)), first = play.slice(0, k), last = play.slice(-k);
    const rate = g => pctOf(g.reduce((a, s) => a + s.stats.hits, 0), g.reduce((a, s) => a + s.stats.targets, 0));
    const err = g => g.reduce((a, s) => a + (s.stats.commissions || 0), 0) / g.length;
    const a = rate(first), b = rate(last), ea = err(first), eb = err(last);
    const t = 'Primeras ' + k + ' partidas: ' + a + ' % de aciertos y ' + ea.toFixed(1) + ' errores por partida. Últimas ' + k + ': ' + b +
      ' % y ' + eb.toFixed(1) + '. ' + (b - a >= 5 || ea - eb >= 1 ? 'Va mejorando con la práctica.' : a - b >= 5 || eb - ea >= 1
        ? 'Las últimas le fueron más difíciles (pueden ser niveles más difíciles o cansancio).' : 'Se ha mantenido parecido.');
    pdf.text(L, y, '¿Cómo ha cambiado?', { size: 13, bold: true }); y += 18;
    pdf.wrap(t, 11, R - L).forEach(l => { pdf.text(L, y, l, { size: 11 }); y += 15; });
    y += 12;
  }
  // tabla: una fila por partida
  const cols = [['Fecha', 0], ['Modo', 52], ['Mundo / dónde', 102], ['Juego', 238], ['Estrellas', 298], ['Aciertos', 346], ['Errores', 418], ['Reacción', 458]];
  const head = () => {
    pdf.rect(L, y - 13, R - L, 20, '#1e1b4b');
    cols.forEach(([n, x]) => pdf.text(L + 4 + x, y + 1, n, { size: 9, bold: true, color: '#ffffff' }));
    y += 22;
  };
  pdf.text(L, y, 'Todas las partidas', { size: 13, bold: true }); y += 22;
  head();
  const cut = (t, w) => { t = String(t); while (t.length > 3 && MiniPDF.width(t, 9) > w) t = t.slice(0, -2); return t; };
  sessions.forEach((s, i) => {
    if (y > 770) { reportFooter(pdf); pdf.addPage(); y = 50; head(); }
    if (i % 2) pdf.rect(L, y - 12, R - L, 17, '#f8fafc');
    const st = s.stats || {}, mem = reportIsMemory(s);
    const where = (s.theme === 'mixto' ? 'Varios' : worldLabel(s.theme)) + (reportPlace(s) ? ' · ' + reportPlace(s).replace('Capítulo', 'Cap.').replace(' (jefe final)', '') : '');
    const exam = s.mode === 'prueba' || s.mode === 'memoria';
    const cells = [reportDay(s.t), exam ? 'Examen' : REPORT_MODE[s.mode] || s.mode, where, reportGame(s), exam ? '-' : (s.stars || 0) + ' de 3',
      mem ? st.hits + '/' + st.targets + ' caminos' : st.hits + '/' + st.targets + ' (' + pctOf(st.hits, st.targets) + '%)',
      mem ? '-' : String(st.commissions || 0), mem ? '-' : ms(st.meanRT)];
    cells.forEach((c, j) => pdf.text(L + 4 + cols[j][1], y, cut(c, (j < cols.length - 1 ? cols[j + 1][1] - cols[j][1] : R - L - cols[j][1]) - 4), { size: 9 }));
    y += 17;
  });
  if (!sessions.length) pdf.text(L, y, 'Todavía no hay partidas.', { size: 11, color: '#64748b' });
  reportFooter(pdf);
  const blob = pdf.blob();
  withGesture(() => deliverFile(blob, reportFileName(player.name + '_informe_completo')));
}
