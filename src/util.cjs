const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const key=p=>path.resolve(p).toLowerCase();
const inside=(p,r)=>{const rel=path.relative(r,p);return !!rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
async function atomic(file,body){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,body);await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
async function readJSON(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function manifest(dir){const rows=[];async function walk(p){for(const d of await fs.readdir(p,{withFileTypes:true})){const f=path.join(p,d.name);if(d.isSymbolicLink())throw Error('目录包含链接，无法安全备份。');if(d.isDirectory())await walk(f);else if(d.isFile())rows.push([path.relative(dir,f),hash(await fs.readFile(f))]);}}await walk(dir);return rows.sort((a,b)=>a[0].localeCompare(b[0]));}
module.exports={fs,path,hash,key,inside,atomic,readJSON,manifest};
