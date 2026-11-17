'use strict';
/* 注入测试：对 core.js 做一处小改动，看核心测试能不能抓到。跑完自动还原。 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const F=path.join(__dirname,'../core.js'),src=fs.readFileSync(F,'utf8');
/* 记录的等价变异：改法排序把「省得多」放在「多排上」前面——有缺口时每个人都能靠「这格也能带（上限 +1）」多排上一格，两类改法不会同时出现（300 组 + 随机 2 万组混排都是 0），测不出，删除。 */
const M=[
["(p.useLeave ? Math.round(P.leave * 100) : 0)","(p.useLeave ? Math.round(P.leave * 100) * 2 : 0)"],
["Math.round(p.price * 100) * 2 +","Math.round(p.price * 100) +"],
["uc[j] * 256 + j","uc[j] * 256"],
["uc[j] * 256 + j","uc[j] * 256 + (5 - j)"],
["if (P.people[j].avail[slots[a]] === '1' && P.people[j].max > 0)","if (P.people[j].max > 0)"],
["add(1 + m + j, T, P.people[j].max, 0)","add(1 + m + j, T, P.people[j].max + 1, 0)"],
["if (P.skip[d] !== '1') { r.push(2 * d); r.push(2 * d + 1); }","{ r.push(2 * d); r.push(2 * d + 1); }"],
["if (cap[e] > 0 && dist[u] + cost[e] < dist[to[e]])","if (cap[e] > 0 && dist[u] + cost[e] <= dist[to[e]] && to[e] !== S)"],
["leaveMoney: (units - cashFen * 2) / 200","leaveMoney: (units - cashFen) / 200"],
["leaveDays: lh / 2","leaveDays: lh"],
["function better(r, base) { return r.covered > base.covered || (r.covered === base.covered && r.units < base.units); }","function better(r, base) { return r.covered >= base.covered; }"],
["cands.slice(0, 3)","cands.slice(0, 2)"],
["if (!R.used[i]) return;\n      var r = solve","var r = solve"],
["extra: r.covered === R.covered ? (r.units - R.units) / 200 : null","extra: (r.units - R.units) / 200"],
["o.level = R.need === 0 ? 'none' : R.covered < R.need ? 'gap' : 'ok';","o.level = R.covered < R.need ? 'gap' : 'ok';"],
["P.days = need(st.days, 'days', 1, MAX_DAYS,","P.days = need(st.days, 'days', 1, 30,"],
["P.leave = need(st.leave, 'leave', 0, MAX_LEAVE, false,","P.leave = need(st.leave, 'leave', -1e9, MAX_LEAVE, false,"],
["if (!intOnly && Math.abs(Math.round(x * 100) - x * 100) > 1e-6)","if (false)"],
["max: need(p && p.max, 'max' + i, 0, 2 * MAX_DAYS, true,","max: need(p && p.max, 'max' + i, 0, 2 * MAX_DAYS, false,"],
["st.people.slice(0, MAX_PEOPLE)","st.people.slice(0)"],
["|| ('第 ' + (i + 1) + ' 位')","|| ''"],
["if (/^[=+\\-@]/.test(x)) x = \"'\" + x;",""],
["replace(/[,，\\s]/g, '')","replace(/[，\\s]/g, '')"],
["function daysText(h) { return h % 2 ? fmt(h / 2, 1) + ' 天' : fmt(h / 2, 0) + ' 天'; }","function daysText(h) { return fmt(h / 2, 0) + ' 天'; }"],
["(R.leaveDays > 0 ? '，请假","(R.leaveDays >= 0 ? '，请假"],
["s.people[ch.i].avail = a.slice(0, ch.slot) + '1' + a.slice(ch.slot + 1);","s.people[ch.i].avail = a;"],
["if (R.used[i] >= p.max && p.max < 2 * MAX_DAYS) tryCh","if (false) tryCh"],
["if (p.avail[s] === '1') return;","if (p.avail[s] === '0') return;"],
["((P.start - 1 + d) % 7) + 1","((P.start + d) % 7) + 1"],
];
let caught=0;const rows=[];
for(const [a,b] of M){
  if(src.indexOf(a)<0){rows.push('✗ 找不到原文：'+a.slice(0,80));continue;}
  fs.writeFileSync(F,src.replace(a,b));
  let ok=true;try{execFileSync('node',['--test',path.join(__dirname,'core.test.cjs')],{stdio:'pipe',timeout:60000});}catch(e){ok=false;}
  rows.push((ok?'✗ 没抓到':'✓ 抓到')+'：'+a.slice(0,70).replace(/\n/g,'⏎')+' → '+b.slice(0,70).replace(/\n/g,'⏎'));if(!ok)caught++;
}
fs.writeFileSync(F,src);
console.log(rows.join('\n'));console.log('合计 '+caught+'/'+M.length);
