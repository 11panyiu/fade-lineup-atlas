/* FADE LINEUPS Cloud Sync (optional; inactive until cloud settings exist).
   Requires window.FADE_CLOUD_CONFIG and browser Supabase JS v2.
   Local IndexedDB remains the source of truth while offline. */
(function(){
'use strict';
const conf=window.FADE_CLOUD_CONFIG||{};
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(conf.url||'') ||
   !/^(sb_publishable_|eyJ)/.test(conf.publishableKey||'') ||
   !window.supabase?.createClient)return;
const api=window.supabase.createClient(conf.url,conf.publishableKey);
const BUCKET='fade-lineups-private',TABLE='fade_cloud_maps',META='fadeCloudRevisionV1_',OFFLINE='fadeCloudOfflineEditsV1_';
let session=null,working=false,applying=false,timer=0,decisionOpen=false;
const el=id=>document.getElementById(id);
const toolrow=document.querySelector('#fadeWorkspace .tools');
if(!toolrow)return;
const launcher=document.createElement('button');
launcher.type='button';launcher.id='cloudLaunch';launcher.textContent='☁ 云同步';
toolrow.appendChild(launcher);
const pane=document.createElement('div');
pane.className='cloud-overlay hidden';pane.id='cloudOverlay';
pane.innerHTML=
'<section class="cloud-window" role="dialog" aria-modal="true" aria-label="跨设备云同步">'+
'<div class="cloud-title"><strong>☁ 跨设备云同步</strong><button id="cloudClose" type="button">✕</button></div>'+
'<p>电脑和手机登录相同账号，即可同步点位、截图、地图和复习记录。</p>'+
'<div id="cloudAuth">'+
'<label>邮箱<input id="cloudEmail" type="email" autocomplete="email"></label>'+
'<label>密码<input id="cloudPassword" type="password" autocomplete="current-password"></label>'+
'<div class="cloud-buttons"><button id="cloudLogin" class="primary">登录</button>'+
'<button id="cloudSignup">注册账号</button></div>'+
'<small>密码只发送给 Supabase 登录服务，不会保存在 GitHub。注册可能需要邮箱验证。</small></div>'+
'<div id="cloudAccount" class="hidden"><div id="cloudWho"></div>'+
'<div class="cloud-buttons"><button id="cloudCheck" class="primary">立即检查同步</button>'+
'<button id="cloudLogout">退出</button></div></div>'+
'<p id="cloudMessage" role="status" aria-live="polite">登录后开始云同步。</p>'+
'<div id="cloudConflict" class="cloud-conflict hidden"><strong>检测到不同的版本</strong>'+
'<p>当前地图在手机或电脑上存在不同数据。下载或上传可能覆盖另一端，请先导出 JSON 备份。</p>'+
'<div class="cloud-buttons"><button id="cloudDownload">保留云端版本</button>'+
'<button id="cloudUpload">保留本机版本</button><button id="cloudLater">稍后</button></div></div>'+
'</section>';
document.body.append(pane);
function msg(text,error){
 el('cloudMessage').textContent=text;
 el('cloudMessage').classList.toggle('cloud-error',!!error);
 launcher.title=text;
}
function authUI(){
 el('cloudAuth').classList.toggle('hidden',!!session);
 el('cloudAccount').classList.toggle('hidden',!session);
 el('cloudWho').textContent=session?.user.email||'';
 launcher.textContent=session?'☁ 已连接':'☁ 云同步';
}
const metaKey=(id)=>META+session.user.id+'_'+id;
function getMeta(id){try{return JSON.parse(localStorage.getItem(metaKey(id))||'{}')}catch(e){return {}}}
function putMeta(id,meta){
 try{localStorage.setItem(metaKey(id),JSON.stringify(meta))}
 catch(e){msg('同步状态无法保存，请检查浏览器存储。',true)}
}
function markDirty(id){
 if(applying)return;
 if(!session){
   try{localStorage.setItem(OFFLINE+id,'1')}catch(e){}
   return;
 }
 const m=getMeta(id);
 putMeta(id,{revision:m.revision||null,dirty:true,serial:(m.serial||0)+1});
 msg('本机已保存，等待上传云端…');
 clearTimeout(timer);
 timer=setTimeout(()=>{check(currentMapId,false)},1800);
}
function reviewData(id){
 try{return JSON.parse(localStorage.getItem('fadeAtlasPractice_v1_'+id)||'null')||{version:1,statuses:{}}}
 catch(e){return {version:1,statuses:{}}}
}
function emptyLocal(id){
 const rows=db.lineups||[];
 const builtIn=id==='corrode'&&rows.length===1&&rows[0].id==='first-fade-b-defense-jump-20261015';
 return !db.mapImage&&(rows.length===0||builtIn)&&
   Object.keys(reviewData(id).statuses||{}).length===0;
}
async function remoteVersion(id){
 const result=await api.from(TABLE).select('revision,object_path,updated_at')
   .eq('user_id',session.user.id).eq('map_id',id).maybeSingle();
 if(result.error)throw result.error;
 return result.data;
}
async function pull(id,remote){
 if(id!==currentMapId||editing||storageWriting||switchingMap)throw Error('请关闭编辑窗口再同步');
 const result=await api.storage.from(BUCKET).download(remote.object_path);
 if(result.error)throw result.error;
 const body=JSON.parse(await result.data.text());
 if(body.mapId!==id||!Array.isArray(body.collection?.lineups))throw Error('云端文件格式错误，未修改本地数据');
 applying=true;
 try{
   await writeStoredMap(mapStorageKey(id),body.collection);
   db=body.collection;DB=mapStorageKey(id);
   if(body.review&&window.fadePractice?.importStateForCurrentMap)
     window.fadePractice.importStateForCurrentMap(body.review);
   else if(body.review)localStorage.setItem('fadeAtlasPractice_v1_'+id,JSON.stringify(body.review));
   putMeta(id,{revision:remote.revision,dirty:false,serial:getMeta(id).serial||0});
   selected=null;tacticalQuickFilter='';areaQuickFilter='';
   for(const field of ['search','sideFilter','abilityFilter','mappingFilter'])el(field).value='';
   el('detailOverlay').classList.add('hidden');
   setMap();render();
   msg('云端地图和截图已下载 ✓');
 }finally{applying=false}
}
async function push(id,remote){
 if(id!==currentMapId||editing||storageWriting||switchingMap)throw Error('请关闭编辑窗口再同步');
 const m=getMeta(id),expectedSerial=m.serial||0;
 const collection=await readStoredMap(mapStorageKey(id));
 if(!Array.isArray(collection?.lineups))throw Error('本机地图读取失败，未上传');
 const revision=crypto.randomUUID();
 const path=session.user.id+'/'+id+'/'+revision+'.json';
 const snap={version:1,mapId:id,collection,review:reviewData(id)};
 const blob=new Blob([JSON.stringify(snap)],{type:'application/json'});
 if(blob.size>48*1024*1024)throw Error('本地图超过 48 MB，云端上传受限，请先导出备份');
 const uploaded=await api.storage.from(BUCKET).upload(path,blob,{contentType:'application/json',upsert:false});
 if(uploaded.error)throw uploaded.error;
 let result;
 if(!remote)result=await api.from(TABLE).insert({
   user_id:session.user.id,map_id:id,revision,object_path:path
 }).select('revision');
 else result=await api.from(TABLE).update({
   revision,object_path:path,updated_at:new Date().toISOString()
 }).eq('user_id',session.user.id).eq('map_id',id)
 .eq('revision',remote.revision).select('revision');
 if(result.error)throw result.error;
 if(!result.data||result.data.length!==1)throw Error('另一设备已更新云端，停止覆盖。请重新检查同步。');
 const last=getMeta(id);
 const dirty=last.serial!==expectedSerial;
 putMeta(id,{revision,dirty,serial:last.serial||0});
 msg(dirty?'仍有新改动正在等待上传…':'同步成功 ✓');
 if(dirty){clearTimeout(timer);timer=setTimeout(()=>check(id,false),1500)}
 if(remote?.object_path)api.storage.from(BUCKET).remove([remote.object_path])
   .then(r=>{if(r.error)console.warn('旧云端备份清理失败',r.error)}).catch(()=>{});
}
function askChoice(){
 return new Promise(resolve=>{
   decisionOpen=true;
   pane.classList.remove('hidden');
   el('cloudConflict').classList.remove('hidden');
   const settle=(choice)=>{
     decisionOpen=false;
     el('cloudConflict').classList.add('hidden');
     el('cloudDownload').onclick=null;
     el('cloudUpload').onclick=null;
     el('cloudLater').onclick=null;
     resolve(choice);
   };
   el('cloudDownload').onclick=()=>settle('download');
   el('cloudUpload').onclick=()=>settle('upload');
   el('cloudLater').onclick=()=>settle('later');
 });
}
async function check(id,manual){
 if(!session||working||decisionOpen||editing||switchingMap||storageWriting||id!==currentMapId)return;
 working=true;
 try{
   const unsynced=localStorage.getItem(OFFLINE+id)==='1';
   if(unsynced){
     const m=getMeta(id);
     putMeta(id,{...m,dirty:true,serial:(m.serial||0)+1});
     localStorage.removeItem(OFFLINE+id);
   }
   const remote=await remoteVersion(id);
   const meta=getMeta(id);
   if(!remote){await push(id,null);return}
   if(meta.revision===remote.revision){
     if(meta.dirty)await push(id,remote);
     else if(manual)msg('当前地图已是最新版本 ✓');
     return;
   }
   if(!meta.dirty&&(meta.revision||emptyLocal(id))){await pull(id,remote);return}
   if(!manual){msg('检测到不同地图版本。点击云同步选择保留哪个版本。',true);return}
   const choice=await askChoice();
   if(choice==='download')await pull(id,remote);
   else if(choice==='upload')await push(id,remote);
   else msg('已取消操作，两端数据均未修改。');
 }catch(error){
   console.error('云同步失败',error);
   msg('同步失败：'+(error.message||String(error))+'。本机数据未清除。',true);
 }finally{working=false}
}
async function login(){
 const email=el('cloudEmail').value.trim(),password=el('cloudPassword').value;
 if(!email||!password)return msg('请输入邮箱和密码。',true);
 const r=await api.auth.signInWithPassword({email,password});
 if(r.error)return msg('登录失败：'+r.error.message,true);
 session=r.data.session;authUI();msg('已登录，正在检查云端…');
 await check(currentMapId,true);
}
async function signup(){
 const email=el('cloudEmail').value.trim(),password=el('cloudPassword').value;
 if(!email||password.length<8)return msg('请输入邮箱及至少 8 位密码。',true);
 const r=await api.auth.signUp({email,password});
 if(r.error)return msg('注册失败：'+r.error.message,true);
 if(r.data.session){
   session=r.data.session;authUI();await check(currentMapId,true);
 }else msg('注册已提交，请查看验证邮件，然后回来登录。');
}
el('cloudLogin').onclick=()=>login().catch(e=>msg(e.message,true));
el('cloudSignup').onclick=()=>signup().catch(e=>msg(e.message,true));
el('cloudLogout').onclick=async()=>{
 await api.auth.signOut();session=null;authUI();msg('已退出。本地地图仍然保留。');
};
el('cloudCheck').onclick=()=>check(currentMapId,true);
launcher.onclick=()=>{pane.classList.remove('hidden')};
el('cloudClose').onclick=()=>{if(!decisionOpen)pane.classList.add('hidden')};
pane.onclick=e=>{if(e.target===pane&&!decisionOpen)pane.classList.add('hidden')};
const oldSave=save;
save=async function(){const id=currentMapId;const ok=await oldSave();if(ok)markDirty(id);return ok};
const oldSwitch=switchMapCollection;
switchMapCollection=async function(id){
 const before=currentMapId;
 if(session&&getMeta(before).dirty)await check(before,false);
 const answer=await oldSwitch(id);
 if(session&&currentMapId!==before)await check(currentMapId,true);
 return answer;
};
window.addEventListener('fade-review-changed',e=>markDirty(e.detail?.mapId||currentMapId));
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible')check(currentMapId,false);
});
window.addEventListener('focus',()=>check(currentMapId,false));
setInterval(()=>{if(document.visibilityState==='visible')check(currentMapId,false)},120000);
api.auth.onAuthStateChange((event,next)=>{
 if(event==='SIGNED_OUT'){session=null;authUI()}
 if(event==='TOKEN_REFRESHED'){session=next;authUI()}
});
api.auth.getSession().then(async r=>{
 if(r.error)throw r.error;
 session=r.data.session;
 authUI();
 if(session){
   while(switchingMap)await new Promise(resolve=>setTimeout(resolve,70));
   await check(currentMapId,true);
 }
}).catch(e=>msg('读取云端账号失败：'+e.message,true));
authUI();
})();
