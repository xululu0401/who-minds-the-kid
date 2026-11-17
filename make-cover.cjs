/* 封面 cover.svg（1200×1200），读数与格子来自 core.js 同一次 compute；再用浏览器截成 cover.png。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState());
if (!o.ok || o.R.total !== 720 || o.R.covered !== 10) throw new Error('默认场景不对');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
let grid = '';
const days = ['周一', '周二', '周三', '周四', '周五'];
days.forEach((d, i) => { grid += `<text x="${290 + i * 156 + 70}" y="400" font-family="${F}" font-size="32" font-weight="700" fill="#4a554e" text-anchor="middle">${d}</text>`; });
['上午', '下午'].forEach((lab, h) => {
  const y = 430 + h * 140;
  grid += `<text x="150" y="${y + 78}" font-family="${F}" font-size="36" fill="#4a554e">${lab}</text>`;
  for (let d = 0; d < 5; d++) {
    const s = 2 * d + h, nm = A.cellText(o, s), x = 290 + d * 156;
    grid += `<rect x="${x}" y="${y}" width="140" height="120" rx="10" fill="#2f7a55"/><text x="${x + 70}" y="${y + 74}" font-family="${F}" font-size="${nm.length > 2 ? 34 : 40}" font-weight="700" fill="#fff" text-anchor="middle">${nm}</text>`;
  }
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#eef1ec"/>
  <rect x="60" y="60" width="1080" height="1080" rx="18" fill="#ffffff"/>
  <text x="140" y="215" font-family="${F}" font-size="112" font-weight="800" fill="#1f2a24">孩子放假谁来带</text>
  <text x="140" y="292" font-family="${F}" font-size="40" fill="#4a554e">爸妈请假、老人帮忙、托管班，怎么排最省</text>
  ${grid}
  <text x="140" y="820" font-family="${F}" font-size="30" fill="#4a554e">五天十个半天，最省合计</text>
  <text x="140" y="910" font-family="${F}" font-size="84" font-weight="800" fill="#7a4a10">${A.yuan(o.R.total)} 元</text>
  <text x="620" y="820" font-family="${F}" font-size="30" fill="#4a554e">奶奶来不了</text>
  <text x="620" y="910" font-family="${F}" font-size="84" font-weight="800" fill="#a3392b">多花 ${A.yuan(o.cmp[2].extra)} 元</text>
  <text x="140" y="990" font-family="${F}" font-size="28" fill="#4a554e">现金 ${A.yuan(o.R.cash)} 元 + 妈妈请假 ${A.fmt(o.R.leaveDays, 1)} 天（一天折 ${A.yuan(o.P.leave)} 元）</text>
  <text x="140" y="1095" font-family="${F}" font-size="24" fill="#7d877f">最小费用流精确求解 · 人物、时间与价格为虚构示例</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
fs.writeFileSync('/tmp/cover96.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body>' + svg + '</body></html>');
console.log('cover.svg', svg.length);
