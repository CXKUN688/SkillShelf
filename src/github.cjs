const {fs,path,atomic,readJSON}=require('./util.cjs');const {frontmatter}=require('./scan.cjs');const {execFile}=require('node:child_process');const {promisify}=require('node:util');const run=promisify(execFile);
function safeRepo(s){return typeof s==='string'&&/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(s)&&!s.split('/').some(x=>x==='.'||x==='..');}
function safeRelative(s){return typeof s==='string'&&s.length>0&&!s.includes('\\')&&!s.includes(':')&&!s.startsWith('/')&&!s.split('/').some(x=>!x||x==='.'||x==='..');}
function weekMetric(history,now=new Date()){
const today=now.toISOString().slice(0,10),buckets=new Map();
for(const w of history){if(!Number.isFinite(w.week)||!Array.isArray(w.days)||w.days.length!==7)continue;for(let i=0;i<7;i++){const date=new Date((w.week+i*86400)*1000).toISOString().slice(0,10);if(date<today&&Number.isFinite(w.days[i])&&w.days[i]>=0)buckets.set(date,w.days[i]);}}
const end=new Date(today+'T00:00:00Z');const dates=Array.from({length:7},(_,i)=>new Date(end.getTime()-(7-i)*86400000).toISOString().slice(0,10));if(dates.some(d=>!buckets.has(d)))return null;
return {value:dates.reduce((sum,d)=>sum+buckets.get(d),0),start:dates[0],end:dates[6],days:dates.map(d=>({date:d,value:buckets.get(d)}))};}
let ghPath,checked=false;
async function findGH(){if(checked)return ghPath;checked=true;try{const r=await run(process.platform==='win32'?'where.exe':'which',['gh'],{windowsHide:true,timeout:5000});ghPath=r.stdout.trim().split(/\r?\n/)[0];}catch{}return ghPath;}
async function api(endpoint){if(typeof endpoint!=='string'||endpoint.startsWith('/')||endpoint.includes('..'))throw Error('API 路径无效');
const gh=await findGH();if(gh){try{const r=await run(gh,['api',endpoint,'-H','Accept: application/vnd.github+json','-H','X-GitHub-Api-Version: 2026-03-10'],{windowsHide:true,timeout:25000,maxBuffer:20*1024*1024});return JSON.parse(r.stdout);}catch(e){if(/rate limit/i.test(e.stderr||''))throw Error('GitHub 请求额度已用完，请稍后重试。');}}
const r=await fetch('https://api.github.com/'+endpoint,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'SkillShelf/1.0'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(r.status===403||r.status===429?'GitHub 请求额度已用完或被限流，请稍后重试。':'GitHub 请求失败（'+r.status+'）');return r.json();}
async function raw(repo,sha,rel){if(!safeRepo(repo)||!/^[a-f0-9]{40}$/.test(sha)||!safeRelative(rel))throw Error('仓库文件地址无效');const url='https://raw.githubusercontent.com/'+repo+'/'+sha+'/'+rel.split('/').map(encodeURIComponent).join('/');const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('无法读取仓库文件（'+r.status+'）');const declared=Number(r.headers.get('content-length'));if(declared>8*1024*1024)throw Error('文件超过 8 MB 上限。');const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>8*1024*1024)throw Error('文件过大');return Buffer.from(bytes);}
async function repositoryTree(repo){const commit=await api('repos/'+repo+'/commits/HEAD');if(!/^[a-f0-9]{40}$/.test(commit.sha))throw Error('提交标识无效');const tree=await api('repos/'+repo+'/git/trees/'+commit.sha+'?recursive=1');return {...tree,commitSha:commit.sha};}
async function inspect(repo){if(!safeRepo(repo))throw Error('请输入 owner/repository 形式的 GitHub 仓库名。');const tree=await repositoryTree(repo);if(tree.truncated)throw Error('仓库目录过大，无法完整检查。');const files=tree.tree.filter(f=>f.type==='blob'&&safeRelative(f.path));const md=files.filter(f=>f.path==='SKILL.md'||f.path.endsWith('/SKILL.md'));const choices=[];
const found=await mapLimit(md.slice(0,150),4,async f=>{try{const text=(await raw(repo,tree.commitSha,f.path)).toString('utf8');return {...frontmatter(text),path:f.path,sha:tree.commitSha,preview:text.slice(0,60000)};}catch{return null;}});choices.push(...found.filter(Boolean));
if(!choices.length)throw Error('仓库中没有可识别的 SKILL.md 技能。');return {repo,sha:tree.commitSha,files,choices,truncated:md.length>150};}
async function mapLimit(list,limit,fn){let i=0;const output=[];await Promise.all(Array.from({length:Math.min(list.length,limit)},async()=>{while(i<list.length){const n=i++;output[n]=await fn(list[n],n);}}));return output;}
async function trending(data,force=false,onProgress=()=>{}){
const cacheFile=path.join(data,'github-cache.json'),cached=await readJSON(cacheFile,null);
if(!force&&cached&&Date.now()-new Date(cached.updatedAt).getTime()<6*3600000)return {...cached,cached:true};
const warnings=[],repos=new Map();
for(const q of ['agent-skills in:name,description','codex-skills in:name,description','claude-code-skills in:name,description']){try{const search=await api('search/repositories?q='+encodeURIComponent(q)+'&sort=stars&order=desc&per_page=12');for(const r of search.items||[])repos.set(r.full_name,r);}catch(e){warnings.push(e.message);}}
const candidates=[...repos.values()].sort((a,b)=>b.stargazers_count-a.stargazers_count).slice(0,(await findGH())?24:16);let completed=0;
const rows=(await mapLimit(candidates,3,async r=>{try{const tree=await repositoryTree(r.full_name);if(tree.truncated)throw Error('目录结果不完整');const files=tree.tree.filter(f=>f.type==='blob'&&(f.path==='SKILL.md'||f.path.endsWith('/SKILL.md'))&&safeRelative(f.path));if(!files.length)return null;let valid=false;for(const f of files.slice(0,3)){try{frontmatter((await raw(r.full_name,tree.commitSha,f.path)).toString('utf8'));valid=true;break;}catch{}}if(!valid)return null;
let metric=null,error;try{metric=weekMetric(await api('repos/'+r.full_name+'/stargazers/history?per_page=2'));if(!metric)error='七日历史不完整';}catch(e){error=e.message;}
return {repo:r.full_name,description:r.description||'',total:r.stargazers_count,metric,error,skillCount:files.length,url:r.html_url};
}catch(e){warnings.push(r.full_name+'：'+e.message);return null;}finally{onProgress({done:++completed,total:candidates.length});}})).filter(Boolean).sort((a,b)=>(b.metric?.value??-1)-(a.metric?.value??-1));
if(!rows.length){if(cached)return {...cached,cached:true,stale:true,warnings};throw Error(warnings[0]||'没有找到可验证的技能仓库。');}
const result={rows,updatedAt:new Date().toISOString(),candidateCount:candidates.length,discovered:repos.size,warnings,coverage:'关键词检索候选仓库，按七个完整数据日新增 Stars 排序；仓库热度不代表单个技能热度，非全站完整榜单。'};
await atomic(cacheFile,JSON.stringify(result,null,2));return result;}
module.exports={safeRepo,safeRelative,weekMetric,api,raw,inspect,mapLimit,trending};
