const $=s=>document.querySelector(s),E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',trend:'<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="16" cy="17" r="3" fill="white"/>',monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 8a8 8 0 0 1 13-3l2 3M19 16a8 8 0 0 1-13 3l-2-3"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',box:'<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l10 5"/>',check:'<path d="m5 12 4 4L19 6"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',folder:'<path d="M3 7V5h7l2 3h9v12H3V7z"/>',code:'<path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 4l-4 16"/>',star:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',shield:'<path d="m12 3 8 3v7c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>'};
const I=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+(icons[name]||icons.box)+'</svg>';
function paintIcons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=I(el.dataset.icon));}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),5000);}
const date=s=>s?new Date(s).toLocaleString('zh-CN',{hour12:false}):'—',num=n=>Number(n||0).toLocaleString('zh-CN');
const kind=s=>({personal:'个人技能',custom:'自定义',system:'系统内置',plugin:'插件技能'}[s.kind]||s.kind);
const status=s=>s.kind==='plugin'?({enabled:'插件已启用',disabled:'插件已停用',unknown:'插件状态未知'}[s.pluginStatus]):s.enabled===null?'状态未知':s.enabled?'已启用':'已停用';
const S={page:'library',scan:null,filter:'all',query:'',trending:null,history:[],prefs:null,selected:null,inspection:null,choice:null};
function heading(title,subtitle,action=''){return '<div class="page-heading"><div><div class="eyebrow">SKILLSHELF / YOUR WORKSPACE</div><h1>'+E(title)+'</h1><p>'+E(subtitle)+'</p></div>'+action+'</div>';}
function empty(text){return '<div class="empty">'+E(text)+'</div>';}
async function refreshScan(){const b=$('#refresh');b.disabled=true;$('#status').textContent='正在扫描本机技能…';try{S.scan=await skillshelf.scan();$('#navCount').textContent=S.scan.skills.length;$('#userLabel').textContent=S.scan.home;$('#userLabel').title=S.scan.home;$('#status').textContent='扫描完成 · '+S.scan.skills.length+' 个技能 · '+date(S.scan.scannedAt)+(S.scan.warnings.length?' · '+S.scan.warnings.length+' 条提示':'');if(S.page==='library'||S.page==='settings')renderPage();}finally{b.disabled=false;}}
function renderPage(){document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===S.page));$('#breadcrumb').textContent={library:'本地技能',trending:'七日热门',history:'备份与恢复',settings:'扫描设置'}[S.page];if(S.page==='library')renderLibrary();if(S.page==='trending')renderTrending();if(S.page==='history')renderHistory();if(S.page==='settings')renderSettings();}
async function navigate(page){S.page=page;$('#main').scrollTop=0;renderPage();try{if(page==='trending'&&!S.trending)await loadTrending(false);if(page==='history'){S.history=await skillshelf.history();if(S.page===page)renderHistory();}if(page==='settings'){S.prefs=await skillshelf.settings();if(S.page===page)renderSettings();}}catch(e){toast(e.message);}}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.page){await navigate(b.dataset.page);return;}const a=b.dataset.action;if(!a)return;b.disabled=true;try{await action(a,b.dataset,b);}catch(e){toast(e.message);}finally{if(b.isConnected)b.disabled=false;}});
$('#refresh').addEventListener('click',()=>refreshScan().catch(e=>toast(e.message)));
document.addEventListener('input',e=>{if(e.target.id==='librarySearch'){S.query=e.target.value;renderCards();}});
skillshelf.onProgress(p=>{const el=$('#githubProgress');if(el)el.textContent='正在检查技能仓库 '+p.done+' / '+p.total;});
async function action(a,d,b){if(a==='filter'){S.filter=d.filter;renderLibrary();}else if(a==='detail')await openDetail(d.id);else if(a==='toggle'){const s=S.scan.skills.find(s=>s.id===d.id);await skillshelf.toggle(s.file,!s.enabled);await refreshScan();toast('已保存设置；重启 Codex 后生效。');}
else if(a==='uninstall'){const s=S.selected;const r=await skillshelf.uninstall(s.file);if(r){$('#detail').close();await refreshScan();toast('已备份并卸载，可在备份与恢复中找回。');}}
else if(a==='closeDetail')$('#detail').close();else if(a==='closeInstall')$('#installDialog').close();
else if(a==='openFolder')await skillshelf.openFolder(S.selected.file);
else if(a==='openRepo')await skillshelf.openRepo(d.repo);
else if(a==='installOpen')openInstall();
else if(a==='inspect')await inspectRepo(d.repo||$('#repoName').value.trim().replace(/^https:\/\/github\.com\//,'').replace(/\/$/,''));
else if(a==='choice'){S.choice=S.inspection.choices.find(c=>c.path===d.path);renderInspection();}
else if(a==='installConfirm'){const r=await skillshelf.install({repo:S.inspection.repo,...S.choice});if(r){$('#installDialog').close();await refreshScan();toast('技能已安装到本机。');}}
else if(a==='refreshTrending')await loadTrending(true);
else if(a==='addRoot'){await skillshelf.addRoot();S.prefs=await skillshelf.settings();await refreshScan();}
else if(a==='removeRoot'){await skillshelf.removeRoot(d.path);S.prefs=await skillshelf.settings();await refreshScan();}
else if(a==='openData')await skillshelf.openData();
else if(a==='restore'){await skillshelf.restore(d.id);S.history=await skillshelf.history();await refreshScan();renderHistory();toast('恢复完成；设置变更需重启 Codex 生效。');}}
