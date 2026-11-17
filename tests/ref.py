#!/usr/bin/env python3
"""孩子放假谁来带 · 独立参考实现（不读 core.js）。
写法与 core.js 完全不同：不用网络流，直接把每个半天交给「某个人或没人」的所有排法逐个枚举，
筛掉违反「有空」「最多几个半天」的，按（排上的半天数 多 → 花费 少 → 名单序号之和 小）取最优。
花费用 Fraction 精确算：现金 + 用年假的人每半天折 一天年假价 / 2。
只在小规模（≤ 6 个半天、≤ 3 人）上可行，生成 300 组随机样例 + 若干手算锚点，输出 tests/ref.json。"""
import json, random, os, itertools
from fractions import Fraction as F

def best(slots, people, leave):
    k = len(people)
    cost = [F(p['price']) + (F(leave) / 2 if p['useLeave'] else 0) for p in people]
    top = None
    for combo in itertools.product(range(-1, k), repeat=len(slots)):
        used = [0] * k
        ok = True
        for s, w in zip(slots, combo):
            if w < 0:
                continue
            if people[w]['avail'][s] != '1':
                ok = False; break
            used[w] += 1
            if used[w] > people[w]['max']:
                ok = False; break
        if not ok:
            continue
        cov = sum(1 for w in combo if w >= 0)
        tot = sum((cost[w] for w in combo if w >= 0), F(0))
        idx = sum(w for w in combo if w >= 0)
        key = (-cov, tot, idx)
        if top is None or key < top[0]:
            top = (key, combo)
    (ncov, tot, idx), combo = top
    return {'covered': -ncov, 'total': float(tot), 'total_str': str(tot), 'idxsum': idx}

def gen(rng):
    days = rng.randint(1, 3)
    skip = ''.join('1' if rng.random() < 0.15 else '0' for _ in range(days))
    slots = [s for s in range(2 * days) if skip[s // 2] != '1']
    while len(slots) > 6:
        d = rng.randrange(days)
        skip = skip[:d] + '1' + skip[d + 1:]
        slots = [s for s in range(2 * days) if skip[s // 2] != '1']
    k = rng.randint(1, 3)
    people = []
    for i in range(k):
        dens = rng.choice([0.3, 0.5, 0.8])
        people.append({
            'name': 'P%d' % i,
            'price': str(rng.choice([0, 0, 30, 50, 80, 120.5, 99.99])),
            'useLeave': rng.random() < 0.5,
            'max': rng.randint(0, 4),
            'avail': ''.join('1' if rng.random() < dens else '0' for _ in range(2 * days)),
        })
    leave = str(rng.choice([0, 200, 300, 400, 650.5]))
    return {'days': days, 'skip': skip, 'leave': leave, 'people': people, 'slots': slots}

def main():
    rng = random.Random(20261117)
    cases = []
    while len(cases) < 300:
        c = gen(rng)
        r = best(c['slots'], c['people'], c['leave'])
        r['need'] = len(c['slots'])
        state = {'title': 'ref', 'days': str(c['days']), 'start': '0', 'skip': c['skip'], 'leave': c['leave'],
                 'people': [{'name': p['name'], 'price': p['price'], 'useLeave': p['useLeave'], 'max': str(p['max']), 'avail': p['avail']} for p in c['people']]}
        cases.append({'state': state, 'expect': r})
    gaps = sum(1 for c in cases if c['expect']['covered'] < c['expect']['need'])
    full = sum(1 for c in cases if c['expect']['need'] and c['expect']['covered'] == c['expect']['need'])
    out = {'note': 'itertools.product 全枚举 + Fraction；与 core.js 的最小费用流写法无共享代码', 'cases': cases,
           'stats': {'n': len(cases), 'has_gap': gaps, 'all_covered': full, 'empty': sum(1 for c in cases if not c['expect']['need'])}}
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ref.json')
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    print(json.dumps(out['stats'], ensure_ascii=False))

if __name__ == '__main__':
    main()
