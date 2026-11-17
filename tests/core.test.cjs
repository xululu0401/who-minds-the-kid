/* 孩子放假谁来带 · 核心测试：node --test tests/core.test.cjs
 * 锚点：tests/ref.json（独立 Python：itertools 全枚举 + Fraction，300 组）、默认场景手算读数、
 *       最优性（任意单格改动都不更省）、改法与对照表真的重算、边界与非法输入、导出。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require(path.join(__dirname, '..', 'core.js'));
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
const D = () => A.defaultState();

test('默认场景：读数、标题、谁带几个半天', () => {
  const o = A.compute(D());
  assert.ok(o.ok, JSON.stringify(o.errors));
  assert.equal(o.level, 'ok'); assert.equal(o.R.need, 10); assert.equal(o.R.covered, 10);
  /* 手算：奶奶免费 4 格（周二下午到周五上午共 6 格可选，最多 4）、托管班 80 元只收上午、
   * 剩下的格子由爸妈请假（半天折 200 元）。上午 5 个：托管班 80 < 请假 200；奶奶占 4 格应优先放在下午（下午只有请假 200 这个替代）。
   * 奶奶能带的下午：周二、周三、周四（3 个）+ 一个上午（周三或周四或周五，替代是托管班 80）。
   * → 奶奶 3 下午 + 1 上午；托管 4 上午；剩周一下午、周五下午 → 妈妈请 1 天 = 400；现金 4×80 = 320；合计 720。 */
  assert.equal(o.R.cash, 320); assert.equal(o.R.leaveDays, 1); assert.equal(o.R.leaveMoney, 400); assert.equal(o.R.total, 720);
  assert.equal(A.headline(o), '10 个半天都有人带。最省的排法：现金 320 元，请假 1 天（按一天 400 元折 400 元），合计 720 元。');
  assert.deepEqual(A.usage(o), ['妈妈 2 个半天（请 1 天假）', '奶奶 4 个半天', '托管班 4 个半天（320 元）']);
  /* 并列时优先名单靠前：两次请假都给妈妈而不是爸爸 */
  assert.equal(o.R.used[1], 0);
  assert.equal(A.cellText(o, 1), '妈妈'); assert.equal(A.cellText(o, 9), '妈妈');
  assert.equal(A.slotName(o.P, 1), '第 1 天（周一）下午');
});

test('与独立 Python 全枚举逐组对拍（300 组）', () => {
  assert.equal(REF.cases.length, 300);
  assert.ok(REF.stats.has_gap >= 60 && REF.stats.all_covered >= 60, '有缺口 / 全排上 两类都要有足够样本：' + JSON.stringify(REF.stats));
  for (const c of REF.cases) {
    const pr = A.parse(c.state); assert.equal(pr.errors.length, 0, JSON.stringify(pr.errors));
    const r = A.solve(pr.P), m = JSON.stringify(c.state);
    assert.equal(r.covered, c.expect.covered, m + ' 排上');
    assert.equal(r.need, c.expect.need, m + ' 要排');
    assert.ok(Math.abs(r.total - c.expect.total) < 1e-9, m + ' 合计 ' + r.total + ' vs ' + c.expect.total_str);
    let idx = 0; r.slots.forEach((s) => { if (r.assign[s] >= 0) idx += r.assign[s]; });
    assert.equal(idx, c.expect.idxsum, m + ' 并列时名单靠前');
  }
});

test('排法本身合法：只排有空的格、不超过每人上限、计数一致', () => {
  for (const c of REF.cases.concat([{ state: D() }])) {
    const P = A.parse(c.state).P, r = A.solve(P), used = P.people.map(() => 0);
    r.slots.forEach((s) => { const w = r.assign[s]; if (w >= 0) { assert.equal(P.people[w].avail[s], '1'); used[w]++; } });
    used.forEach((u, i) => { assert.ok(u <= P.people[i].max); assert.equal(u, r.used[i]); });
    assert.equal(r.covered + r.uncovered.length, r.need);
    assert.ok(Math.abs(r.total - (r.cash + r.leaveMoney)) < 1e-9);
  }
});

test('最优性：默认场景里任何人多勾一格 / 少勾一格，重算都不会比「改之前能做到的」更差', () => {
  /* 多勾一格只会更好或一样（可行集变大）；少勾一格只会更差或一样 */
  const st = D(), base = A.solve(A.parse(st).P);
  st.people.forEach((p, i) => {
    for (let s = 0; s < 10; s++) {
      const t = JSON.parse(JSON.stringify(st)); const on = t.people[i].avail[s] === '1';
      t.people[i].avail = t.people[i].avail.slice(0, s) + (on ? '0' : '1') + t.people[i].avail.slice(s + 1);
      const r = A.solve(A.parse(t).P);
      if (on) assert.ok(r.covered < base.covered || (r.covered === base.covered && r.units >= base.units));
      else assert.ok(r.covered > base.covered || (r.covered === base.covered && r.units <= base.units));
    }
  });
});

test('改法：真的改一格重算，按钮里的合计和应用后的一致；只留有好处的', () => {
  const o = A.compute(D());
  assert.deepEqual(o.actions.map((a) => a.text), ['奶奶周一下午也能带（最多 5 个半天）：省 200 元，合计 520 元', '托管班周一下午也能带：省 120 元，合计 600 元']);
  for (const a of o.actions) {
    const o2 = A.compute(A.applyChange(D(), a.ch));
    assert.equal(o2.R.total, a.total); assert.ok(o2.R.total < o.R.total);
  }
  /* 有缺口时，改法优先「多排上」 */
  const g = D(); g.people[0].max = '1'; g.people[1].max = '1'; g.people[2].avail = '1010101010';
  const og = A.compute(g);
  assert.equal(og.level, 'gap'); assert.deepEqual(og.R.uncovered, [1, 3, 5]);
  assert.equal(A.headline(og), '有 3 个半天谁都排不上：周一下午、周二下午、周三下午。其余 7 个半天最省的排法是现金 80 元，请假 1 天（按一天 400 元折 400 元），合计 480 元。');
  assert.ok(og.actions.length === 3 && og.actions.every((a) => a.gain === 1));
  for (const a of og.actions) assert.equal(A.compute(A.applyChange(g, a.ch)).R.covered, 8);
  /* 300 组参考样例上：每条改法都真的有好处（多排上或更省），且按「多排上」优先、再按「省得多」排序 */
  let withActs = 0, mixed = 0;
  for (const c of REF.cases) {
    const oc = A.compute(c.state); if (!oc.actions.length) continue; withActs++;
    oc.actions.forEach((a) => assert.ok(a.gain > 0 || a.save > 1e-9, JSON.stringify(c.state) + a.text));
    for (let i = 1; i < oc.actions.length; i++) { const x = oc.actions[i - 1], y = oc.actions[i]; assert.ok(x.gain > y.gain || (x.gain === y.gain && x.save >= y.save - 1e-9), JSON.stringify(c.state)); if (x.gain !== y.gain) mixed++; }
  }
  assert.ok(withActs >= 100, '改法样本 ' + withActs);
  /* 有缺口时，任何人「这格也能带（必要时上限 +1）」都能多排上一格，所以「多排上」与「只省钱」不会混排（300 组里混排 = 0，另随机 2 万组也没有）。 */
  assert.equal(mixed, 0);
  /* applyChange 不改原 state */
  assert.equal(g.people[2].avail, '1010101010');
});

test('谁来不了：对照表每行都是去掉此人重排', () => {
  const o = A.compute(D());
  const names = o.cmp.map((r) => r.name);
  assert.deepEqual(names, ['最省的排法', '妈妈来不了', '奶奶来不了', '托管班来不了']); /* 爸爸一格没带，不列 */
  const mom = o.cmp[1]; assert.equal(mom.extra, 0); /* 爸爸同价顶上 */
  const gran = o.cmp[2]; assert.equal(gran.total, 1400); assert.equal(gran.extra, 680); assert.equal(gran.leaveDays, 2.5);
  const care = o.cmp[3]; assert.equal(care.total, 1200); assert.equal(care.extra, 480); assert.equal(care.cash, 0);
  /* 掉了人导致排不上时，extra 为 null、lost 记少排几个 */
  const s = D(); s.people[2].avail = '0000000000'; s.people.splice(1, 1);
  const o2 = A.compute(s); const m2 = o2.cmp.filter((r) => r.name === '妈妈来不了')[0];
  assert.equal(m2.lost, 5); assert.equal(m2.extra, null); /* 妈妈是唯一能带下午的人（托管只收上午、爸爸已删、奶奶没空） */
});

test('不用安排的天、没有要安排的半天、没人有空', () => {
  const s = D(); s.skip = '11111';
  const o = A.compute(s); assert.equal(o.level, 'none'); assert.equal(o.R.need, 0); assert.deepEqual(o.actions, []);
  assert.equal(A.headline(o), '这 5 天都标了「不用安排」，没有要带的半天。'); assert.equal(A.explain(o), '');
  const t = D(); t.people.forEach((p) => { p.avail = ''; });
  const o2 = A.compute(t); assert.equal(o2.R.covered, 0); assert.equal(o2.level, 'gap'); assert.equal(o2.R.total, 0);
  assert.ok(A.headline(o2).indexOf('有 10 个半天谁都排不上') === 0);
  /* 跳过中间一天：那天两格不计 */
  const u = D(); u.skip = '00100'; assert.equal(A.compute(u).R.need, 8);
  /* 上限 0：这个人不参与 */
  const v = D(); v.people.forEach((p) => { p.max = '0'; }); assert.equal(A.compute(v).R.covered, 0);
});

test('不用请假、年假折 0、小数价格的口径', () => {
  const s = D(); s.leave = '0';
  const o = A.compute(s); /* 请假不花钱时，爸妈先上（名单靠前）：妈妈 6 + 爸爸 4 = 10 个半天，托管 80 元一格不用 */
  assert.equal(o.R.cash, 0); assert.equal(o.R.total, 0);
  assert.ok(A.headline(o).indexOf('请假 5 天（按一天 0 元折 0 元），合计 0 元') > 0, A.headline(o));
  const t = D(); t.people[3].price = '99.99'; t.leave = '199.98';
  const o2 = A.compute(t); /* 托管 99.99 vs 请假半天 99.99：同价，名单靠前的妈妈/爸爸优先 */
  assert.equal(Math.round(o2.R.total * 100), 6 * 9999);
  assert.equal(A.daysText(3), '1.5 天'); assert.equal(A.daysText(4), '2 天');
  const w = D(); w.people.forEach((p) => { p.useLeave = false; }); w.people[3].price = '0';
  assert.ok(A.headline(A.compute(w)).endsWith('现金 0 元，不用请假。'));
});

test('非法输入：逐项报错', () => {
  const s = D(); s.days = '15'; s.leave = '-1'; s.people[0].price = 'abc'; s.people[1].max = '1.5'; s.people[3].price = '1.234';
  const o = A.compute(s); assert.equal(o.ok, false);
  assert.deepEqual(o.errors.map((e) => e.field).sort(), ['days', 'leave', 'max1', 'price0', 'price3'].sort());
  assert.equal(A.compute(Object.assign(D(), { people: [] })).errors[0].field, 'people');
  assert.equal(A.compute(Object.assign(D(), { days: '0' })).ok, false);
  /* 全角与千分位 */
  const t = D(); t.leave = '１,２００'; t.days = '５'; const o2 = A.compute(t); assert.ok(o2.ok); assert.equal(o2.P.leave, 1200);
  /* 超过 6 人截断；名字空着给默认名 */
  const u = D(); for (let i = 0; i < 5; i++) u.people.push({ name: '', price: '0', useLeave: false, max: '1', avail: '' });
  const P = A.parse(u).P; assert.equal(P.people.length, 6); assert.equal(P.people[4].name, '第 5 位');
});

test('边界：14 天 × 6 人规模、1 天、星期换算', () => {
  const s = D(); s.days = '14'; s.start = '5'; s.people = [];
  for (let i = 0; i < 6; i++) s.people.push({ name: 'P' + i, price: String(10 * i), useLeave: i % 2 === 0, max: '28', avail: '1'.repeat(28) });
  const t0 = Date.now(); const o = A.compute(s); const ms = Date.now() - t0;
  assert.ok(o.ok); assert.equal(o.R.covered, 28); assert.ok(ms < 3000, '耗时 ' + ms);
  /* P1 每半天 10 元、不请假，是最便宜的 → 28 格全给 P1 */
  assert.equal(o.R.used[1], 28); assert.equal(o.R.total, 280);
  assert.equal(A.slotName(o.P, 0), '第 1 天（周五）上午'); assert.equal(A.slotName(o.P, 27), '第 14 天（周四）下午');
  const one = D(); one.days = '1'; one.start = '0'; assert.equal(A.compute(one).R.need, 2); assert.equal(A.slotShort(A.parse(one).P, 1), '第1天下午');
});

test('导出：CSV 防公式注入与行数、MD 含标题与表', () => {
  const s = D(); s.title = '=HYPERLINK("x")'; s.skip = '00010';
  const o = A.compute(s); const csv = A.toCSV(o, '2026-11-17 16:00');
  assert.ok(csv.indexOf('"\'=HYPERLINK(""x"")"') > 0);
  assert.equal(csv.split('\r\n').filter(Boolean).length, 1 + 10 + 8); /* 表头 + 10 个半天 + 8 行设定（空行被 filter 掉） */
  assert.ok(csv.indexOf('第 4 天（周四）上午,不用安排') > 0);
  const md = A.toMD(A.compute(D()), 'w');
  assert.ok(md.indexOf('**10 个半天都有人带。') > 0 && md.indexOf('| 第 1 天（周一） | 托管班 | 妈妈 |') > 0 && md.indexOf('虚构示例') > 0, md);
});
