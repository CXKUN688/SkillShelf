const {app,BrowserWindow,ipcMain,dialog,shell}=require('electron'),os=require('node:os'),path=require('node:path'),fs=require('node:fs/promises');
const local=require('./local.cjs'),github=require('./github.cjs'),installer=require('./install.cjs'),{atomic,readJSON,key}=require('./util.cjs');
const singleInstance=app.requestSingleInstanceLock();if(!singleInstance)app.quit();
let win,data,settings={},busy=false;const o=()=>({data,extra:settings.extra||[]});
async function mutate(fn){if(busy)throw Error('另一项管理操作正在执行，请稍等。');busy=true;try{return await fn();}finally{busy=false;}}
function handle(name,fn){ipcMain.handle(name,async(e,...args)=>{if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)throw Error('请求来源无效');try{return {ok:true,value:await fn(...args)};}catch(err){return {ok:false,error:err.message||String(err)};}});}
async function chooseData(){const preferred=path.join(app.isPackaged?path.dirname(process.execPath):path.resolve(__dirname,'..'),'data');try{await fs.mkdir(preferred,{recursive:true});const probe=path.join(preferred,'.write-probe-'+process.pid+'-'+Date.now());await fs.writeFile(probe,'',{flag:'wx'});await fs.rm(probe);return preferred;}catch{return app.getPath('userData');}}
if(singleInstance)app.whenReady().then(async()=>{
data=await chooseData();settings=await readJSON(path.join(data,'settings.json'),{extra:[]});
win=new BrowserWindow({width:1440,height:960,minWidth:900,minHeight:640,title:'SkillShelf · 本地技能管理',backgroundColor:'#f6f7fb',autoHideMenuBar:true,icon:path.join(__dirname,'../assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
handle('scan',async()=>{const result=await local.scan(o());const hist=await local.journal(o());result.skills=result.skills.map(s=>{const source=hist.find(h=>h.type==='install'&&key(h.file)===key(s.file));return {...s,source:source?{repo:source.repo,sha:source.sha}:null};});return result;});
handle('read',async file=>{const s=(await local.scan(o())).skills.find(s=>key(s.file)===key(file));if(!s)throw Error('文件不在扫描结果中');return (await fs.readFile(s.file,'utf8')).slice(0,500000);});
handle('toggle',(file,value)=>mutate(()=>local.toggle(file,value,o())));
handle('uninstall',file=>mutate(async()=>{const s=await local.editable(file,o());const result=await dialog.showMessageBox(win,{type:'warning',title:'卸载技能',message:'卸载 '+s.name+'？',detail:'将先备份并校验文件，再移除该技能目录。可在「备份与恢复」中恢复。',buttons:['取消','备份并卸载'],defaultId:0,cancelId:0});return result.response===1?local.uninstall(file,o()):null;}));
handle('restore',id=>mutate(()=>local.restore(id,o())));
handle('history',()=>local.journal(o()));
handle('settings',()=>({extra:settings.extra||[],data,home:os.homedir(),codexHome:local.codexFor(o()),version:app.getVersion()}));
handle('addRoot',async()=>{const r=await dialog.showOpenDialog(win,{title:'添加技能扫描目录',properties:['openDirectory']});if(r.canceled)return null;const p=await fs.realpath(r.filePaths[0]);settings.extra=[...new Set([...(settings.extra||[]),p])];await atomic(path.join(data,'settings.json'),JSON.stringify(settings,null,2));return settings;});
handle('removeRoot',async p=>{settings.extra=(settings.extra||[]).filter(x=>x!==p);await atomic(path.join(data,'settings.json'),JSON.stringify(settings,null,2));return settings;});
handle('openFolder',async file=>{const allowed=(await local.scan(o())).skills.find(s=>key(s.file)===key(file));if(!allowed)throw Error('目录不在扫描结果中');const error=await shell.openPath(allowed.folder);if(error)throw Error(error);return true;});
handle('openData',async()=>{const error=await shell.openPath(data);if(error)throw Error(error);return true;});
handle('openRepo',async repo=>{if(!github.safeRepo(repo))throw Error('仓库地址无效');await shell.openExternal('https://github.com/'+repo);return true;});
let trendPromise=null;handle('trending',force=>{if(!trendPromise)trendPromise=github.trending(data,force===true,p=>win.webContents.send('github-progress',p)).finally(()=>trendPromise=null);return trendPromise;});
handle('inspect',repo=>github.inspect(repo));
handle('install',selection=>mutate(async()=>{const r=await dialog.showMessageBox(win,{type:'question',title:'安装技能',message:'安装 '+selection.name+'？',detail:'来源：'+selection.repo+'\\n将下载所选提交的技能文件到本机 Codex 技能目录。技能内容会影响 AI 行为，请先查看预览；程序不会执行其中的脚本。',buttons:['取消','安装到本机'],defaultId:0,cancelId:0});return r.response===1?installer.install(selection,o()):null;}));
win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());await win.loadFile(path.join(__dirname,'index.html'));
});
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
app.on('window-all-closed',()=>app.quit());
