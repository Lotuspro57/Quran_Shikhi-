#!/usr/bin/env node
/* ব্যবহার: node release.js 1.1.0 "নতুন কী যুক্ত হলো" "আরেকটি পরিবর্তন"
   index.html, sw.js ও version.json-এর সংস্করণ একসাথে বদলায়।
   এরপর git commit + push করলেই ব্যবহারকারীদের অ্যাপে "নতুন আপডেট এসেছে" দেখাবে। */
const fs=require('fs');
const [,,ver,...notes]=process.argv;
if(!/^\d+\.\d+\.\d+$/.test(ver||'')){console.error('সংস্করণ দিন, যেমন: node release.js 1.1.0 "নতুন সূরা যুক্ত"');process.exit(1)}
if(!notes.length){console.error('অন্তত একটি পরিবর্তনের বর্ণনা দিন');process.exit(1)}
const sub=(f,re,to)=>{const s=fs.readFileSync(f,'utf8');if(!re.test(s)){console.error(f+' এ সংস্করণ লাইন পাওয়া যায়নি');process.exit(1)}fs.writeFileSync(f,s.replace(re,to))};
sub('index.html',/const APP_VERSION='[^']*'/,`const APP_VERSION='${ver}'`);
sub('sw.js',/const VERSION='[^']*'/,`const VERSION='${ver}'`);
const d=new Date(Date.now()+6*3600e3).toISOString().slice(0,10);
let old={};try{old=JSON.parse(fs.readFileSync('version.json','utf8'))}catch(e){}
fs.writeFileSync('version.json',JSON.stringify({...old,version:ver,date:d,notes},null,2)+'\n');
console.log('সংস্করণ '+ver+' প্রস্তুত। এখন: git add -A && git commit -m "v'+ver+'" && git push');
