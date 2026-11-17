/* 孩子放假谁来带 · 计算核心（core.js）
 * 问题：孩子放春假 / 秋假，爸妈照常上班。几天里每个上午、下午都得有人看着：
 *       爸妈请假（用掉年假）、老人帮忙（不花钱但只有某几天有空）、托管班（按半天收钱）……
 *       怎么排最省？哪个半天谁都排不上？谁多帮一个半天能省多少，谁来不了要多花多少？
 * 模型（设计选择，页面「怎么算的」写明）：
 *   - 一天分上午、下午两个半天；每个要安排的半天恰好交给一个人（或一家托管）。
 *   - 每个人：哪些半天有空（格子里勾）、最多带几个半天、每带一个半天花多少钱、是否用掉年假。
 *   - 年假按「一天折多少钱」换算成钱（半天折一半），和现金加起来比较。这个折价是你自己定的。
 *   - 先让能排上的半天尽量多，再让合计花费（现金 + 年假折价）最少；花费相同时优先用名单里靠前的人。
 *   - 求解：最小费用最大流（源 → 每个半天 → 有空的人 → 汇，人的容量 = 最多几个半天），结果是精确最优，不是试出来的近似。
 * 独立参考：tests/ref.py 小规模逐个枚举所有排法对拍。 */
(function (root) {
  'use strict';
  var MAX_DAYS = 14, MAX_PEOPLE = 6, MAX_PRICE = 2000, MAX_LEAVE = 5000;
  var WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  function defaultState() {
    return {
      title: '秋假五天', days: '5', start: '1', skip: '00000', leave: '400',
      people: [
        { name: '妈妈', price: '0', useLeave: true, max: '6', avail: '1111111111' },
        { name: '爸爸', price: '0', useLeave: true, max: '4', avail: '1111111111' },
        { name: '奶奶', price: '0', useLeave: false, max: '4', avail: '0011111100' },
        { name: '托管班', price: '80', useLeave: false, max: '10', avail: '1010101010' }
      ]
    };
  }

  function half(s) { return String(s == null ? '' : s).replace(/[\uFF01-\uFF5E]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); }).replace(/\u3000/g, ' ').replace(/[,，\s]/g, ''); }
  function num(s) { s = half(s).replace(/。/g, '.'); if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s); return NaN; }
  function isInt(x) { return isFinite(x) && Math.floor(x) === x; }
  function bits(s, n) { s = String(s == null ? '' : s).replace(/[^01]/g, ''); while (s.length < n) s += '0'; return s.slice(0, n); }

  function parse(st) {
    var errs = [], P = { title: String(st.title == null ? '' : st.title).trim().slice(0, 24) };
    function need(v, f, lo, hi, intOnly, msg) {
      var x = num(v);
      if (!isFinite(x)) { errs.push({ field: f, message: msg + '：要填数字' }); return NaN; }
      if (intOnly && !isInt(x)) { errs.push({ field: f, message: msg + '：要填整数' }); return NaN; }
      if (x < lo || x > hi) { errs.push({ field: f, message: msg + '：要在 ' + lo + '–' + hi + ' 之间' }); return NaN; }
      if (!intOnly && Math.abs(Math.round(x * 100) - x * 100) > 1e-6) { errs.push({ field: f, message: msg + '：最多两位小数' }); return NaN; }
      return x;
    }
    P.days = need(st.days, 'days', 1, MAX_DAYS, true, '放几天');
    var s = num(st.start); P.start = isInt(s) && s >= 0 && s <= 7 ? s : 0;
    P.leave = need(st.leave, 'leave', 0, MAX_LEAVE, false, '一天年假折多少钱');
    var n = isFinite(P.days) ? P.days : 0;
    P.skip = bits(st.skip, n);
    var ppl = Array.isArray(st.people) ? st.people.slice(0, MAX_PEOPLE) : [];
    if (!ppl.length) errs.push({ field: 'people', message: '至少要有一个人能带' });
    P.people = ppl.map(function (p, i) {
      var nm = String(p && p.name != null ? p.name : '').trim().slice(0, 12) || ('第 ' + (i + 1) + ' 位');
      return {
        name: nm,
        price: need(p && p.price, 'price' + i, 0, MAX_PRICE, false, nm + ' 每半天花多少钱'),
        useLeave: !!(p && p.useLeave),
        max: need(p && p.max, 'max' + i, 0, 2 * MAX_DAYS, true, nm + ' 最多带几个半天'),
        avail: bits(p && p.avail, 2 * n)
      };
    });
    return { P: P, errors: errs };
  }

  /* 一天的年假折价按「半分」做单位，保证半天折价是整数 */
  function unitCost(P, p) { return Math.round(p.price * 100) * 2 + (p.useLeave ? Math.round(P.leave * 100) : 0); }
  function slotList(P) { var r = []; for (var d = 0; d < P.days; d++) if (P.skip[d] !== '1') { r.push(2 * d); r.push(2 * d + 1); } return r; }
  function slotName(P, s) { var d = s >> 1, w = P.start ? WD[((P.start - 1 + d) % 7) + 1] : ''; return '第 ' + (d + 1) + ' 天' + (w ? '（' + w + '）' : '') + (s % 2 ? '下午' : '上午'); }
  function slotShort(P, s) { var d = s >> 1, w = P.start ? WD[((P.start - 1 + d) % 7) + 1] : '第' + (d + 1) + '天'; return w + (s % 2 ? '下午' : '上午'); }

  /* 最小费用最大流（逐条最短增广路，Bellman-Ford；规模最多 28 个半天 × 6 人） */
  function solve(P) {
    var slots = slotList(P), m = slots.length, k = P.people.length;
    var N = 2 + m + k, S = 0, T = N - 1, to = [], cap = [], cost = [], head = [], nxt = [];
    for (var i = 0; i < N; i++) head.push(-1);
    function add(u, v, c, w) { to.push(v); cap.push(c); cost.push(w); nxt.push(head[u]); head[u] = to.length - 1; to.push(u); cap.push(0); cost.push(-w); nxt.push(head[v]); head[v] = to.length - 1; }
    var uc = P.people.map(function (p) { return unitCost(P, p); });
    var edgeOf = [];
    for (var a = 0; a < m; a++) {
      add(S, 1 + a, 1, 0); edgeOf.push([]);
      for (var j = 0; j < k; j++) if (P.people[j].avail[slots[a]] === '1' && P.people[j].max > 0) { edgeOf[a].push([j, to.length]); add(1 + a, 1 + m + j, 1, uc[j] * 256 + j); }
    }
    for (j = 0; j < k; j++) if (P.people[j].max > 0) add(1 + m + j, T, P.people[j].max, 0);
    var flow = 0;
    for (;;) {
      var dist = [], pe = [], inq = [], q = [S];
      for (i = 0; i < N; i++) { dist.push(Infinity); pe.push(-1); inq.push(false); }
      dist[S] = 0; inq[S] = true;
      while (q.length) {
        var u = q.shift(); inq[u] = false;
        for (var e = head[u]; e >= 0; e = nxt[e]) if (cap[e] > 0 && dist[u] + cost[e] < dist[to[e]]) { dist[to[e]] = dist[u] + cost[e]; pe[to[e]] = e; if (!inq[to[e]]) { inq[to[e]] = true; q.push(to[e]); } }
      }
      if (dist[T] === Infinity) break;
      for (var v = T; v !== S; v = to[pe[v] ^ 1]) { cap[pe[v]]--; cap[pe[v] ^ 1]++; }
      flow++;
    }
    var assign = {}, used = P.people.map(function () { return 0; }), units = 0, cashFen = 0, leaveHalf = P.people.map(function () { return 0; });
    var uncovered = [];
    for (a = 0; a < m; a++) {
      var who = -1;
      edgeOf[a].forEach(function (x) { if (cap[x[1]] === 0) who = x[0]; });
      assign[slots[a]] = who;
      if (who < 0) { uncovered.push(slots[a]); continue; }
      used[who]++; units += uc[who]; cashFen += Math.round(P.people[who].price * 100);
      if (P.people[who].useLeave) leaveHalf[who]++;
    }
    var lh = leaveHalf.reduce(function (s, x) { return s + x; }, 0);
    return { slots: slots, assign: assign, used: used, covered: flow, need: m, uncovered: uncovered,
      units: units, total: units / 200, cash: cashFen / 100, leaveHalf: leaveHalf, leaveDays: lh / 2, leaveMoney: (units - cashFen * 2) / 200 };
  }

  /* 把一个改动作用到 state 上（不改原对象） */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function applyChange(st, ch) {
    var s = clone(st);
    if (ch.kind === 'max') s.people[ch.i].max = String(ch.value);
    else if (ch.kind === 'avail') { var a = String(s.people[ch.i].avail || ''); while (a.length <= ch.slot) a += '0'; s.people[ch.i].avail = a.slice(0, ch.slot) + '1' + a.slice(ch.slot + 1); if (ch.max != null) s.people[ch.i].max = String(ch.max); }
    else if (ch.kind === 'drop') s.people.splice(ch.i, 1);
    return s;
  }
  function better(r, base) { return r.covered > base.covered || (r.covered === base.covered && r.units < base.units); }

  function compute(st) {
    var pr = parse(st);
    if (pr.errors.length) return { ok: false, errors: pr.errors, P: pr.P };
    var P = pr.P, R = solve(P), o = { ok: true, errors: [], P: P, R: R };
    o.level = R.need === 0 ? 'none' : R.covered < R.need ? 'gap' : 'ok';
    /* 改法：每个人「这一格也有空」或「多带一个半天」，真的重算一次，只留有好处的；每人最多一条，取好处最大的三条 */
    var cands = [];
    if (o.level !== 'none') {
      P.people.forEach(function (p, i) {
        var best = null;
        function tryCh(ch, label) {
          var r = solve(parse(applyChange(st, ch)).P);
          if (!better(r, R)) return;
          var c = { ch: ch, r: r, i: i, label: label, gain: r.covered - R.covered, save: (R.units - r.units) / 200 };
          if (!best || c.gain > best.gain || (c.gain === best.gain && c.save > best.save + 1e-9)) best = c;
        }
        if (R.used[i] >= p.max && p.max < 2 * MAX_DAYS) tryCh({ kind: 'max', i: i, value: p.max + 1 }, p.name + '多带一个半天（最多 ' + (p.max + 1) + ' 个）');
        R.slots.forEach(function (s) {
          if (p.avail[s] === '1') return;
          var atCap = R.used[i] >= p.max;
          tryCh({ kind: 'avail', i: i, slot: s, max: atCap && p.max < 2 * MAX_DAYS ? p.max + 1 : null }, p.name + slotShort(P, s) + '也能带' + (atCap && p.max < 2 * MAX_DAYS ? '（最多 ' + (p.max + 1) + ' 个半天）' : ''));
        });
        if (best) cands.push(best);
      });
    }
    cands.sort(function (a, b) { return b.gain - a.gain || b.save - a.save || a.i - b.i; });
    o.actions = cands.slice(0, 3).map(function (c, n) {
      var t = c.label + '：';
      if (c.gain > 0) t += '多排上 ' + c.gain + ' 个半天' + (c.r.covered === c.r.need ? '，全部排上' : '，还差 ' + (c.r.need - c.r.covered) + ' 个') + '，合计 ' + yuan(c.r.total) + ' 元';
      else t += '省 ' + yuan(c.save) + ' 元，合计 ' + yuan(c.r.total) + ' 元';
      return { id: 'act' + n, ch: c.ch, text: t, covered: c.r.covered, total: c.r.total, save: c.save, gain: c.gain };
    });
    /* 对照：每个人都来不了时会怎样（真的去掉重算） */
    o.cmp = [{ name: '最省的排法', cur: true, covered: R.covered, need: R.need, total: R.total, cash: R.cash, leaveDays: R.leaveDays }];
    if (o.level !== 'none') P.people.forEach(function (p, i) {
      if (!R.used[i]) return;
      var r = solve(parse(applyChange(st, { kind: 'drop', i: i })).P);
      o.cmp.push({ name: p.name + '来不了', covered: r.covered, need: r.need, total: r.total, cash: r.cash, leaveDays: r.leaveDays, extra: r.covered === R.covered ? (r.units - R.units) / 200 : null, lost: R.covered - r.covered });
    });
    return o;
  }

  /* ── 格式 ── */
  function fmt(v, d) { var s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); if (d) s = s.replace(/\.?0+$/, ''); var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.'); }
  function yuan(v) { return fmt(v, 2); }
  function daysText(h) { return h % 2 ? fmt(h / 2, 1) + ' 天' : fmt(h / 2, 0) + ' 天'; }

  function usage(o) {
    var P = o.P, R = o.R, L = [];
    P.people.forEach(function (p, i) {
      if (!R.used[i]) return;
      var t = p.name + ' ' + R.used[i] + ' 个半天';
      var extra = [];
      if (p.useLeave) extra.push('请 ' + daysText(R.leaveHalf[i]) + '假');
      if (p.price > 0) extra.push(yuan(R.used[i] * p.price) + ' 元');
      L.push(t + (extra.length ? '（' + extra.join('、') + '）' : ''));
    });
    return L;
  }
  function headline(o) {
    var P = o.P, R = o.R;
    if (o.level === 'none') return '这 ' + P.days + ' 天都标了「不用安排」，没有要带的半天。';
    var money = '现金 ' + yuan(R.cash) + ' 元' + (R.leaveDays > 0 ? '，请假 ' + fmt(R.leaveDays, 1) + ' 天（按一天 ' + yuan(P.leave) + ' 元折 ' + yuan(R.leaveMoney) + ' 元），合计 ' + yuan(R.total) + ' 元' : '，不用请假');
    if (o.level === 'gap') return '有 ' + R.uncovered.length + ' 个半天谁都排不上：' + R.uncovered.map(function (s) { return slotShort(P, s); }).join('、') + '。其余 ' + R.covered + ' 个半天最省的排法是' + money + '。';
    return R.need + ' 个半天都有人带。最省的排法：' + money + '。';
  }
  function explain(o) {
    if (o.level === 'none') return '';
    var u = usage(o);
    return (u.length ? '谁带几个半天：' + u.join('；') + '。' : '') + '花费相同的排法有好几种时，优先排名单里靠前的人。';
  }
  function cellText(o, s) { var w = o.R.assign[s]; return w == null ? '' : w < 0 ? '没人' : o.P.people[w].name; }

  function csvCell(v) { var x = String(v); if (/^[=+\-@]/.test(x)) x = "'" + x; return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  function toCSV(o, when) {
    var P = o.P, rows = [['半天', '谁来带', '这半天现金（元）', '这半天用掉年假（天）']];
    for (var s = 0; s < 2 * P.days; s++) {
      if (P.skip[s >> 1] === '1') { rows.push([slotName(P, s), '不用安排', '', '']); continue; }
      var w = o.R.assign[s], p = w >= 0 ? P.people[w] : null;
      rows.push([slotName(P, s), p ? p.name : '谁都排不上', p ? yuan(p.price) : '', p && p.useLeave ? '0.5' : p ? '0' : '']);
    }
    rows.push([], ['标题', P.title], ['合计现金（元）', yuan(o.R.cash)], ['合计请假（天）', fmt(o.R.leaveDays, 1)], ['一天年假折（元）', yuan(P.leave)], ['合计（元）', yuan(o.R.total)], ['排不上的半天', o.R.uncovered.length], ['导出时间', when || ''], ['说明', '默认人物与价格为虚构示例；年假折价是你自己定的']);
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }
  function toMD(o, when) {
    var P = o.P, L = [];
    L.push('# 孩子放假谁来带 · ' + (P.title || '这次放假'), '', '_导出：' + (when || '') + '_', '', '**' + headline(o) + '**', '');
    if (explain(o)) L.push(explain(o), '');
    o.actions.forEach(function (a) { L.push('- 改法：' + a.text); });
    L.push('', '| 第几天 | 上午 | 下午 |', '|---|---|---|');
    for (var d = 0; d < P.days; d++) {
      var nm = slotName(P, 2 * d).replace(/上午$/, '');
      if (P.skip[d] === '1') { L.push('| ' + nm + ' | 不用安排 | 不用安排 |'); continue; }
      L.push('| ' + nm + ' | ' + cellText(o, 2 * d) + ' | ' + cellText(o, 2 * d + 1) + ' |');
    }
    L.push('', '_最小费用最大流精确求解：先排上尽量多的半天，再让现金 + 年假折价最少。默认人物、时间和价格是虚构示例。_');
    return L.join('\n') + '\n';
  }

  var api = { MAX_DAYS: MAX_DAYS, MAX_PEOPLE: MAX_PEOPLE, WD: WD, defaultState: defaultState, num: num, parse: parse, solve: solve, applyChange: applyChange, compute: compute,
    slotList: slotList, slotName: slotName, slotShort: slotShort, fmt: fmt, yuan: yuan, daysText: daysText, usage: usage, headline: headline, explain: explain, cellText: cellText, toCSV: toCSV, toMD: toMD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AppCore = api;
})(typeof window !== 'undefined' ? window : this);
