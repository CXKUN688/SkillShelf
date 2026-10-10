const TOML=require('smol-toml'),{isDeepStrictEqual}=require('node:util'),{key,hash}=require('./util.cjs');
function matching(value,s){return (value.skills?.config||[]).filter(x=>typeof x.path==='string'&&[s.file,s.folder,s.physicalFile,s.physicalFolder].filter(Boolean).map(key).includes(key(x.path)));}
function fingerprint(value,s){return hash(JSON.stringify(matching(value,s).map(x=>Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))))));}
function comments(text){const out=[];let quote=null,triple=false,escaped=false;
for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(escaped){escaped=false;continue;}if(quote==='"'&&c==='\\'){escaped=true;continue;}if(triple){if(text.slice(i,i+3)===quote.repeat(3)){i+=2;quote=null;triple=false;}}else if(c===quote)quote=null;continue;}
if(c==='"'||c==="'"){quote=c;triple=text.slice(i,i+3)===c.repeat(3);if(triple)i+=2;}
else if(c==='#'){const end=text.indexOf('\n',i);out.push(text.slice(i,end<0?text.length:end).replace(/\r$/,''));if(end<0)break;i=end;}}
return out.join('\n');}
function rewrite(text,value,s,enabled){const entries=matching(value,s);value.skills??=Object.create(null);value.skills.config??=[];if(entries.length)for(const e of entries)e.enabled=enabled;else value.skills.config.push(Object.assign(Object.create(null),{path:s.file,enabled}));
let found=false;let candidate=text.replace(/\[\[skills\.config\]\][\s\S]*?(?=\r?\n\s*\[|$)/g,block=>{let x;try{x=TOML.parse(block).skills.config[0];}catch{return block;}if(!x.path||![s.file,s.folder,s.physicalFile,s.physicalFolder].filter(Boolean).map(key).includes(key(x.path)))return block;found=true;return /^\s*enabled\s*=.*$/m.test(block)?block.replace(/^(\s*enabled\s*=\s*)(true|false)/m,'$1'+enabled):block.trimEnd()+'\nenabled = '+enabled+'\n';});
if(!found)candidate=candidate.trimEnd()+'\n\n[[skills.config]]\npath = '+JSON.stringify(s.file)+'\nenabled = '+enabled+'\n';
try{if(isDeepStrictEqual(TOML.parse(candidate),value))return candidate;}catch{}
const retained=comments(text);candidate=(retained?retained+'\n':'')+TOML.stringify(value);
if(!isDeepStrictEqual(TOML.parse(candidate),value))throw Error('无法安全保存当前 Codex 设置，请手动检查其格式。');return candidate;}
module.exports={matching,fingerprint,comments,rewrite};
