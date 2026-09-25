import fs from 'node:fs';
const lines = fs.readFileSync('source/面试官Prompt_可直接复制.md', 'utf8').split('\n');
const body = lines[70]; // 行 71 = M 线枚举体
console.log('====== M 线枚举整行原文 ======');
console.log(body);
console.log('');
const sents = body.replace(/^\[/, '').replace(/\]$/, '').split(/；|。/).map(s => s.trim()).filter(Boolean);
console.log('====== M 线分句（1..N） ======');
sents.forEach((s, i) => console.log((i + 1) + '. ' + s));
console.log('共 ' + sents.length + ' 句');

// V2 家族命名条目
const v2 = Object.values(JSON.parse(fs.readFileSync('_codes-v2.json', 'utf8')).codes);
const fam = v2.filter(c => /未展开|未单独|未逐条|未定义|未披露|未提供/.test(c.name || ''));
console.log('');
console.log('====== V2(commit 5acc1b5) 家族命名条目，共 ' + fam.length + ' 条 ======');
fam.forEach(c => console.log(c.code + ' | ' + c.name));
