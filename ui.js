/* 孩子放假谁来带 · 界面（ui.js）
 * 读 state → AppCore.compute → 把同一次输出画出来。页面自己不做估算。 */
(function () {
  'use strict';
  var A = window.AppCore;
  var KEY = 'who-minds-the-kid:v1';
  var $ = function (id) { return document.getElementById(id); };
  var PRESETS = [
    { key: 'base', name: '秋假五天（默认）', note: '虚构示例：周一到周五，妈妈、爸爸请假一天折 400 元；奶奶只有周二下午到周五上午有空、最多 4 个半天；托管班只收上午、每半天 80 元。' },
    { key: 'nogran', name: '奶奶回老家了', note: '虚构示例：同一周，奶奶一个半天都来不了。', f: function (s) { s.people[2].avail = '0000000000'; } },
    { key: 'gap', name: '下午没人管', note: '虚构示例：爸妈这周各只能请 1 个半天，奶奶只有上午有空，托管班只收上午——有几个下午谁都排不上。', f: function (s) { s.people[0].max = '1'; s.people[1].max = '1'; s.people[2].avail = '1010101010'; } },
    { key: 'long', name: '春假九天带周末', note: '虚构示例：周六开始放九天，周末两天爸妈在家（标「不用安排」），工作日要排；外公外婆周三起能来。', f: function (s) { s.title = '春假九天'; s.days = '9'; s.start = '6'; s.skip = '110000011'; s.people[2] = { name: '外公外婆', price: '0', useLeave: false, max: '8', avail: '000000001111111100' }; s.people[3].avail = '101010101010101010'; s.people[0].avail = '111111111111111111'; s.people[1].avail = '111111111111111111'; } }
  ];
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function presetState(k) { var s = A.defaultState(), p = PRESETS.filter(function (q) { return q.key === k; })[0]; if (p.f) p.f(s); return s; }
  function norm(s) { return JSON.stringify(sanitize(s)); }
  function presetKey(s) { var j = norm(s); for (var i = 0; i < PRESETS.length; i++) if (norm(presetState(PRESETS[i].key)) === j) return PRESETS[i].key; return null; }

  function str(v, n) { return v == null || typeof v === 'object' ? '' : String(v).slice(0, n); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState();
    ['title', 'days', 'start', 'skip', 'leave'].forEach(function (k) { if (k in s) d[k] = str(s[k], k === 'title' ? 24 : k === 'skip' ? A.MAX_DAYS : 8); });
    if (Array.isArray(s.people)) d.people = s.people.slice(0, A.MAX_PEOPLE).map(function (p) {
      p = p && typeof p === 'object' ? p : {};
      return { name: str(p.name, 12), price: str(p.price, 8), useLeave: !!p.useLeave, max: str(p.max, 4), avail: str(p.avail, 2 * A.MAX_DAYS) };
    });
    return d;
  }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return j && j.state ? sanitize(j.state) : null; } catch (e) { return null; } }
  var state = load() || A.defaultState(), out = null, tmr = null;
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, state: state })); $('saveTag').textContent = '· 已自动存在本机'; } catch (e) { $('saveTag').textContent = '· 这台设备存不了，刷新会丢'; } }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function nDays() { var n = A.num(state.days); return isFinite(n) && n >= 1 && n <= A.MAX_DAYS && Math.floor(n) === n ? n : 0; }
  function setBit(s, i, v) { s = String(s || ''); while (s.length <= i) s += '0'; return s.slice(0, i) + v + s.slice(i + 1); }

  function fillTop() { $('title').value = state.title; $('days').value = state.days; $('start').value = String(state.start); $('leave').value = state.leave; }
  ['title', 'days', 'leave'].forEach(function (k) { $(k).addEventListener('input', function () { state[k] = this.value; schedule(); }); });
  $('start').addEventListener('change', function () { state.start = this.value; update(); });
  function schedule() { clearTimeout(tmr); tmr = setTimeout(update, 80); }

  /* 排班格：行 = 人，列 = 半天；点格子切换「有空」，点表头切换「这天不用安排」 */
  function renderGrid() {
    var n = nDays(), P = out && out.ok ? out.P : null, h = '<table class="grid"><thead><tr><th class="who">谁</th>';
    for (var d = 0; d < n; d++) {
      var skip = String(state.skip || '')[d] === '1', w = +state.start ? A.WD[((+state.start - 1 + d) % 7) + 1] : '第' + (d + 1) + '天';
      h += '<th colspan="2" class="dh' + (skip ? ' off' : '') + '"><button type="button" class="dbtn" data-skip="' + d + '" id="skip' + d + '" aria-pressed="' + skip + '" title="点一下：这天不用安排 / 要安排">' + esc(w) + '<small>' + (skip ? '不用安排' : '上 · 下') + '</small></button></th>';
    }
    h += '</tr></thead><tbody>';
    state.people.forEach(function (p, i) {
      h += '<tr><th class="who"><div class="nmrow"><input class="nm" data-i="' + i + '" data-f="name" id="name' + i + '" value="' + esc(p.name) + '" maxlength="12" aria-label="名字">' + (state.people.length > 1 ? '<button type="button" class="del" data-del="' + i + '" id="del' + i + '" aria-label="删掉' + esc(p.name) + '">删</button>' : '') + '</div>' +
        '<div class="pm"><label>每半天<input data-i="' + i + '" data-f="price" id="price' + i + '" value="' + esc(p.price) + '" inputmode="decimal">元</label>' +
        '<label>最多<input data-i="' + i + '" data-f="max" id="max' + i + '" value="' + esc(p.max) + '" inputmode="numeric">个半天</label>' +
        '<label class="ck"><input type="checkbox" data-i="' + i + '" data-f="useLeave" id="leave' + i + '"' + (p.useLeave ? ' checked' : '') + '>要请假</label></div></th>';
      for (var s = 0; s < 2 * n; s++) {
        var skip2 = String(state.skip || '')[s >> 1] === '1', on = String(p.avail || '')[s] === '1';
        var got = P && out.R.assign[s] === i;
        h += '<td class="c' + (s % 2 ? ' pmc' : '') + (skip2 ? ' off' : '') + '"><button type="button" data-cell="' + i + ':' + s + '" id="c' + i + '_' + s + '" class="' + (on ? 'on' : '') + (got ? ' got' : '') + '" aria-pressed="' + on + '" aria-label="' + esc(p.name) + ' ' + (s % 2 ? '下午' : '上午') + (on ? '有空' : '没空') + '"' + (skip2 ? ' disabled' : '') + '>' + (got ? '带' : on && !skip2 ? '✓' : '') + '</button></td>';
      }
      h += '</tr>';
    });
    if (P) {
      h += '<tr class="gaps"><th class="who">排不上</th>';
      for (var s3 = 0; s3 < 2 * n; s3++) { var miss = P.skip[s3 >> 1] !== '1' && out.R.assign[s3] === -1; h += '<td class="c' + (s3 % 2 ? ' pmc' : '') + '">' + (miss ? '<b class="miss">✕</b>' : '') + '</td>'; }
      h += '</tr>';
    }
    h += '</tbody></table>';
    if (!n) h += '<p class="muted" id="gridHint" style="margin:8px 10px">先把「放几天」填成 1–14 的整数，这里会按天列出上午、下午的格子。</p>';
    $('grid').innerHTML = h;
    $('addP').disabled = state.people.length >= A.MAX_PEOPLE;
  }
  $('grid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cell],[data-skip],[data-del]'); if (!b) return;
    if (b.hasAttribute('data-cell')) { var a = b.getAttribute('data-cell').split(':'), p = state.people[+a[0]]; p.avail = setBit(p.avail, +a[1], String(p.avail || '')[+a[1]] === '1' ? '0' : '1'); }
    else if (b.hasAttribute('data-skip')) { var d = +b.getAttribute('data-skip'); state.skip = setBit(state.skip, d, String(state.skip || '')[d] === '1' ? '0' : '1'); }
    else state.people.splice(+b.getAttribute('data-del'), 1);
    update(true);
  });
  $('grid').addEventListener('input', function (e) {
    var t = e.target, i = t.getAttribute('data-i'), f = t.getAttribute('data-f'); if (i == null || f === 'useLeave') return;
    state.people[+i][f] = t.value; clearTimeout(tmr); tmr = setTimeout(function () { update(false); }, 80);
  });
  $('grid').addEventListener('change', function (e) { var t = e.target; if (t.getAttribute('data-f') === 'useLeave') { state.people[+t.getAttribute('data-i')].useLeave = t.checked; update(true); } });
  $('addP').addEventListener('click', function () { if (state.people.length >= A.MAX_PEOPLE) return; state.people.push({ name: '新的一位', price: '0', useLeave: false, max: '4', avail: '' }); update(true); });
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; state = presetState(b.getAttribute('data-p')); fillTop(); update(true); });
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !out || !out.ok) return;
    var a = out.actions.filter(function (x) { return x.id === b.getAttribute('data-act'); })[0]; if (!a) return;
    state = A.applyChange(state, a.ch); update(true);
  });

  function markErrors() {
    document.querySelectorAll('.bad').forEach(function (e) { e.classList.remove('bad'); });
    if (!out.ok) out.errors.forEach(function (er) { var el = $(er.field) || (/^max\d/.test(er.field) ? $(er.field) : null); if (el) el.classList.add('bad'); });
  }
  function renderPresets() {
    var key = presetKey(state);
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (key === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = PRESETS.filter(function (p) { return p.key === key; })[0];
    $('presetNote').textContent = cur ? cur.note : '你改过的安排（人、价格、年假折价都是你填的）。';
  }
  function render() {
    var o = out;
    $('errBox').classList.toggle('hide', o.ok);
    ['okBox', 'cmpPanel'].forEach(function (id) { $(id).classList.toggle('hide', !o.ok); });
    if (!o.ok) { $('errBox').innerHTML = '先改好标红的地方：<ul>' + o.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>'; return; }
    var R = o.R, P = o.P;
    $('tot').innerHTML =
      '<div class="key"><span>合计（现金 + 年假折价）</span><b>' + A.yuan(R.total) + ' 元</b><small>现金 ' + A.yuan(R.cash) + ' 元 + 请假 ' + A.fmt(R.leaveDays, 1) + ' 天</small></div>' +
      '<div><span>排上的半天</span><b class="' + (o.level === 'gap' ? 'neg' : 'pos') + '">' + R.covered + ' / ' + R.need + '</b><small>' + (o.level === 'gap' ? '还差 ' + (R.need - R.covered) + ' 个谁都排不上' : o.level === 'none' ? '没有要安排的' : '全都有人带') + '</small></div>' +
      '<div><span>要请的假</span><b>' + A.fmt(R.leaveDays, 1) + ' 天</b><small>一天折 ' + A.yuan(P.leave) + ' 元</small></div>';
    $('headline').textContent = A.headline(o);
    $('why').textContent = A.explain(o);
    $('acts').innerHTML = o.actions.length ? o.actions.map(function (a) { return '<button type="button" class="act" id="' + a.id + '" data-act="' + a.id + '">→ ' + esc(a.text) + '</button>'; }).join('') : '<span class="muted">' + (o.level === 'none' ? '' : '谁多一个空档都不会更省了：这已经是按你填的条件能排出的最省排法。') + '</span>';
    $('cmp').innerHTML = '<tr><th>情形</th><th>排上</th><th>现金</th><th>请假</th><th>合计</th><th>比现在</th></tr>' + o.cmp.map(function (r) {
      var diff = r.cur ? '—' : r.lost > 0 ? '少排 ' + r.lost + ' 个半天' : r.extra > 1e-9 ? '多花 ' + A.yuan(r.extra) + ' 元' : '一样，别人顶上';
      return '<tr' + (r.cur ? ' class="cur"' : '') + '><td>' + esc(r.name) + '</td><td>' + r.covered + ' / ' + r.need + '</td><td>' + A.yuan(r.cash) + '</td><td>' + A.fmt(r.leaveDays, 1) + ' 天</td><td>' + A.yuan(r.total) + '</td><td class="' + (r.lost > 0 || r.extra > 1e-9 ? 'neg' : '') + '">' + diff + '</td></tr>';
    }).join('');
  }
  function update(regrid) {
    clearTimeout(tmr); out = A.compute(state);
    if (regrid !== false) renderGrid(); else refreshGridMarks();
    markErrors(); renderPresets(); render(); save();
  }
  /* 改价钱/名字时不重画整张表（否则输入框会丢焦点），只更新「带」的标记 */
  function refreshGridMarks() {
    var n = nDays(); if (!out.ok || $('grid').querySelectorAll('thead th.dh').length !== n) { if (!out.ok) return; renderGrid(); return; }
    state.people.forEach(function (p, i) { for (var s = 0; s < 2 * n; s++) { var b = $('c' + i + '_' + s); if (!b) continue; var on = String(p.avail || '')[s] === '1', got = out.R.assign[s] === i; b.className = (on ? 'on' : '') + (got ? ' got' : ''); b.textContent = got ? '带' : on && !b.disabled ? '✓' : ''; } });
    var row = $('grid').querySelector('tr.gaps'); if (row) { var tds = row.querySelectorAll('td'); for (var s2 = 0; s2 < tds.length; s2++) tds[s2].innerHTML = out.P.skip[s2 >> 1] !== '1' && out.R.assign[s2] === -1 ? '<b class="miss">✕</b>' : ''; }
  }
  $('days').addEventListener('change', function () { update(true); });

  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function tag() { return out.ok ? '合计' + A.yuan(out.R.total).replace(/,/g, '') + '元' : '待改'; }
  $('dlCsv').addEventListener('click', function () { if (out.ok) download('孩子放假谁来带-排班.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { if (out.ok) download('孩子放假谁来带-' + tag() + '.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('孩子放假谁来带-备份.json', new Blob([JSON.stringify({ app: '孩子放假谁来带', slug: 'who-minds-the-kid', version: 1, exported_at: stamp(), state: state }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importText(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s || !s.people.length) { $('saveTag').textContent = '· 这个文件读不出来，没改动'; return false; }
    state = s; fillTop(); update(true); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); fillTop(); update(true); });

  /* 结果卡 PNG 1080×1350：文字与格子取自同一次 out */
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), FF = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#eef1ec'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffffff'; g.fillRect(50, 50, W - 100, H - 100);
    var L = 100, Rr = W - 100, maxW = Rr - L, y = 145;
    function font(size, bold) { g.font = (bold ? '700 ' : '') + size + 'px ' + FF; }
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function wrap(t, size, color, bold, lim) {
      font(size, bold); g.fillStyle = color; var cur = '', n = 0;
      var toks = String(t).match(/[0-9.,]+ ?(?:元|天|个)?[）)。，、；：]?|[（(「]?[A-Za-z]+[）)」。，、；：]?|[（(「]?[^\s（(「][）)」。，、；：]?|\s/g) || [];
      for (var i = 0; i < toks.length; i++) { var ch = toks[i]; if (g.measureText(cur + ch).width > maxW && cur) { if (lim && ++n >= lim) { g.fillText(clip(cur + '…', maxW), L, y); y += size * 1.45; return; } g.fillText(cur, L, y); y += size * 1.45; cur = ch.trim() ? ch : ''; } else cur += ch; }
      if (cur) { g.fillText(cur, L, y); y += size * 1.45; }
    }
    font(54, true); g.fillStyle = '#1f2a24'; g.fillText('孩子放假谁来带', L, y); y += 54;
    if (!out.ok) { font(42, true); g.fillStyle = '#b5402f'; g.fillText('还排不了', L, y + 20); y += 90; out.errors.slice(0, 7).forEach(function (e) { wrap('· ' + e.message, 28, '#4a554e', false, 2); y += 8; }); y += 30; wrap('改好标红的地方，排法会自动重算。', 26, '#7d877f'); return cv; }
    var o = out, P = o.P, R = o.R;
    font(26); g.fillStyle = '#7d877f'; g.fillText(clip((P.title || '这次放假') + ' · ' + P.days + ' 天 · ' + R.need + ' 个半天要安排 · 年假一天折 ' + A.yuan(P.leave) + ' 元', maxW), L, y); y += 54;
    wrap(A.headline(o), 34, o.level === 'gap' ? '#a3392b' : '#245c40', true, 4); y += 14;
    /* 排班格 */
    var n = P.days, maxCols = 7, blocks = Math.ceil(n / maxCols);
    for (var b = 0; b < blocks; b++) {
      var d0 = b * maxCols, d1 = Math.min(n, d0 + maxCols), cols = d1 - d0, cw = (maxW - 120) / cols, rh = blocks > 1 ? 52 : 70;
      font(20, true); g.fillStyle = '#7d877f';
      for (var d = d0; d < d1; d++) { var x = L + 120 + (d - d0) * cw; g.textAlign = 'center'; g.fillText(clip(A.slotName(P, 2 * d).replace(/上午$/, '').replace(/^第 (\d+) 天（(.*)）$/, '$2').replace(/^第 (\d+) 天$/, '第$1天'), cw - 6), x + cw / 2, y); g.textAlign = 'left'; }
      y += 18;
      ['上午', '下午'].forEach(function (lab, half) {
        font(22); g.fillStyle = '#4a554e'; g.fillText(lab, L, y + rh / 2 + 8);
        for (var d2 = d0; d2 < d1; d2++) {
          var s = 2 * d2 + half, x2 = L + 120 + (d2 - d0) * cw, skip = P.skip[d2] === '1', w = R.assign[s];
          g.fillStyle = skip ? '#f1f1ee' : w === -1 ? '#f7d9d3' : '#e3efe6'; g.fillRect(x2 + 3, y + 3, cw - 6, rh - 6);
          font(cw < 90 ? 18 : 24, true); g.fillStyle = skip ? '#a7ada8' : w === -1 ? '#a3392b' : '#245c40'; g.textAlign = 'center';
          g.fillText(clip(skip ? '不用' : w === -1 ? '没人' : P.people[w].name, cw - 12), x2 + cw / 2, y + rh / 2 + 8); g.textAlign = 'left';
        }
        y += rh;
      });
      y += 22;
    }
    y += 26;
    A.usage(o).slice(0, 6).forEach(function (u) { wrap('· ' + u, 26, '#4a554e', false, 1); });
    y += 16;
    o.actions.slice(0, 3).forEach(function (ac) { if (y < H - 300) { wrap('改法：' + ac.text + '。', 25, '#7a4a10', false, 2); y += 4; } });
    /* 谁来不了（同一次 o.cmp） */
    var miss = o.cmp.filter(function (r) { return !r.cur; });
    if (miss.length && y < H - 300) {
      y += 24; font(24, true); g.fillStyle = '#4a554e'; g.fillText('谁临时来不了', L, y); y += 40;
      var shown = 0;
      miss.forEach(function (r) {
        if (y > H - 200) return; shown++;
        g.fillStyle = '#f6f8f4'; g.fillRect(L, y - 30, maxW, 44);
        font(23); g.fillStyle = '#1f2a24'; g.fillText(clip(r.name, maxW * 0.55), L + 14, y);
        var t = r.lost > 0 ? '少排 ' + r.lost + ' 个半天' : r.extra > 1e-9 ? '多花 ' + A.yuan(r.extra) + ' 元（合计 ' + A.yuan(r.total) + '）' : '一样，别人顶上';
        font(23, true); g.fillStyle = r.lost > 0 || r.extra > 1e-9 ? '#a3392b' : '#245c40'; g.textAlign = 'right'; g.fillText(t, Rr - 14, y); g.textAlign = 'left';
        y += 52;
      });
      if (shown < miss.length) { font(20); g.fillStyle = '#7d877f'; g.fillText('还有 ' + (miss.length - shown) + ' 种情形，见页面对照表', L, y - 10); }
    }
    y = H - 140;
    wrap('先排上尽量多的半天，再让现金 + 年假折价最少（精确求解）。年假折价是自己定的；默认人物、时间和价格为虚构示例。', 20, '#7d877f', false, 2);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (bl) { if (bl) download('孩子放假谁来带-' + tag() + '-1080x1350.png', bl); }, 'image/png'); });

  window.__wkUi = { state: function () { return clone(state); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };
  fillTop(); update(true);
})();
