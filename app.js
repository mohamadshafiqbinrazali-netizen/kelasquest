
'use strict';
const $=id=>document.getElementById(id), COLORS=['#8b7cff','#ff8b66','#50cbb1','#63b9ff','#ffca65','#ed8cc7'];
const CFG=window.KQ_CONFIG||{}, LOCAL=CFG.demo===true||location.protocol==='file:';
const S={token:'',id:'',role:'student',room:null,name:'',color:0,x:500,y:580,hand:false,reaction:'',reactionAt:0,players:[],messages:[],responses:[],roster:[],tab:'chat',keys:new Set(),target:null,pollTimer:null,pollBusy:false,failures:0,epoch:0,answered:new Set(),submitted:new Set(),lastFrame:0,near:'',drawPlayers:new Map()};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch(e){return '';}};
function toast(t){$('toast').textContent=t;$('toast').classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.add('hidden'),4200);}
function show(view){['entry','dashboard','classroom'].forEach(id=>$(id).classList.toggle('hidden',id!==view));}
function saveSession(){try{sessionStorage.setItem('kq-session',JSON.stringify({token:S.token,id:S.id,role:S.role,room:S.room?{code:S.room.code}:null,name:S.name,color:S.color}));}catch(e){}}
function clearSession(){try{sessionStorage.removeItem('kq-session');}catch(e){}}
function backendUrl(){return String(CFG.apiUrl||'').trim();}
function validBackend(u){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u);}
async function request(action,extra={}){
 const payload={action,token:S.token,code:S.room?.code,id:S.id,role:S.role,...extra};
 if(LOCAL)return demoApi(payload);
 const url=backendUrl();if(!validBackend(url))throw new Error('Portal belum tersedia. Hubungi pengendali kelas.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),action==='uploadPdf'||action==='pdfData'?120000:40000);
 try{const response=await fetch(url,{method:'POST',mode:'cors',credentials:'omit',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:controller.signal});
   if(!response.ok)throw new Error('Perkhidmatan kelas tidak tersedia ('+response.status+'). Cuba semula atau hubungi pengendali kelas.');
   const content=await response.text();let r;try{r=JSON.parse(content);}catch(e){throw new Error('Perkhidmatan kelas tidak dapat dibuka. Hubungi pengendali kelas.');}
   if(!r?.ok)throw new Error(r?.error||'Permintaan gagal.');return r.data;
 }catch(e){if(e.name==='AbortError')throw new Error('Sambungan mengambil terlalu lama. Semak rekod sebelum mengulang penghantaran.');
   if(e instanceof TypeError)throw new Error('Tidak dapat menghubungi kelas. Semak internet dan cuba semula.');throw e;
 }finally{clearTimeout(timeout);}
}
async function busy(form,fn,errorId){const btns=[...form.querySelectorAll('button')];btns.forEach(b=>b.disabled=true);if(errorId)$(errorId).textContent='';
 try{await fn();}catch(e){if(errorId)$(errorId).textContent=e.message;else toast(e.message);}finally{btns.forEach(b=>b.disabled=false);}}
function switchEntry(teacher){$('joinForm').classList.toggle('hidden',teacher);$('loginForm').classList.toggle('hidden',!teacher);$('studentTab').classList.toggle('selected',!teacher);$('teacherTab').classList.toggle('selected',teacher);$('entryError').textContent='';}
$('studentTab').onclick=()=>switchEntry(false);$('teacherTab').onclick=()=>switchEntry(true);
COLORS.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.style.background=c;b.className=i===0?'chosen':'';b.setAttribute('aria-label','Warna karakter '+(i+1));b.onclick=()=>{S.color=i;[...$('colorPicker').children].forEach((n,j)=>n.classList.toggle('chosen',i===j));};$('colorPicker').append(b);});
$('joinForm').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{
 const data=await request('join',{code:$('joinCode').value.toUpperCase().trim(),name:$('joinName').value,className:$('joinClass').value,color:S.color});
 S.role='student';S.token=data.token;S.id=data.id;S.name=data.name;S.color=data.color;startRoom(data.room);},'entryError');};
$('loginForm').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{const d=await request('login',{email:$('teacherEmail').value.trim(),pin:$('teacherKey').value});S.token=d.token;S.role='teacher';S.room=null;S.id='teacher';$('teacherKey').value='';saveSession();renderDashboard(d.dashboard);show('dashboard');},'entryError');};
$('logout').onclick=async()=>{try{await request('logout');}catch(e){toast('Log keluar pada peranti ini. '+e.message);}finally{S.token='';S.room=null;clearSession();show('entry');switchEntry(true);}};
$('refreshDashboard').onclick=()=>busy($('dashboard'),async()=>renderDashboard(await request('dashboard')));
$('createForm').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{const d=await request('create',{title:$('createTitle').value,className:$('createClass').value,teacher:$('createTeacher').value});S.role='teacher';S.id='teacher';S.name=d.room.teacher;startRoom(d.room);},'createError');};
function renderDashboard(d){$('adminProfile').textContent='Superadmin · '+(d.profile?.email||'Pratonton');$('voiceConfigNotice').textContent=d.voiceConfigured?'Suara tersedia. Peserta boleh sambung suara dalam kelas.':'Suara belum tersedia. Hubungi pengendali kelas.';$('sheetLink').href=safeUrl(d.sheetUrl)||'#';$('sheetLink').classList.toggle('hidden',LOCAL);
 $('sessionList').innerHTML=d.rooms.length?d.rooms.slice().reverse().map(r=>`<article class="session-card"><div class="row between"><h3>${esc(r.title)}</h3><small>${r.closed?'Tamat':'Aktif'}</small></div><div class="row between"><div><div class="code">${esc(r.code)}</div><small>${esc(r.className)}</small></div><div class="row"><button class="small" data-report="${esc(r.code)}">Rekod</button>${r.closed?'':`<button class="small primary" data-enter="${esc(r.code)}">Masuk →</button>`}</div></div></article>`).join(''):'<p class="hint">Belum ada sesi. Cipta kelas pertama anda.</p>';
 $('sessionList').querySelectorAll('[data-enter]').forEach(b=>b.onclick=()=>busy($('dashboard'),async()=>{const d=await request('enterTeacher',{code:b.dataset.enter});S.id='teacher';S.name=d.room.teacher;startRoom(d.room);}));
 $('sessionList').querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>openReport(b.dataset.report));
}
function startRoom(room){stopPolling();S.room=room;S.players=[];S.messages=[];S.responses=[];S.roster=[];S.failures=0;S.hand=false;S.target=null;S.keys.clear();S.answered.clear();S.submitted.clear();S.drawPlayers.clear();
 S.x=S.role==='teacher'?500:450+Math.random()*100;S.y=S.role==='teacher'?235:580;S.name=S.role==='teacher'?room.teacher:S.name;
 $('teacherSideTab').classList.toggle('hidden',S.role!=='teacher');$('raiseHand').classList.toggle('hidden',S.role==='teacher');
 $('selfLabel').textContent=S.name+(S.role==='teacher'?' · Guru':' · Anda');$('boardText').value=room.board;
 resetSlides();setTab('chat');show('classroom');renderRoom();saveSession();poll();$('world').focus({preventScroll:true});
}
function stopPolling(){clearTimeout(S.pollTimer);S.pollTimer=null;S.epoch++;S.pollBusy=false;}
async function poll(){if(!S.room||$('classroom').classList.contains('hidden')||S.pollBusy)return;
 const epoch=S.epoch;S.pollBusy=true;
 try{const d=await request('sync',{x:Math.round(S.x),y:Math.round(S.y),hand:S.hand,reaction:S.reaction,reactionAt:S.reactionAt});
  if(epoch!==S.epoch)return;S.room=d.room;S.players=d.players;S.messages=d.messages;S.responses=d.responses;S.roster=d.roster;S.failures=0;
  if(S.room.freeze&&S.role==='student'){const me=d.players.find(p=>p.id===S.id);if(me){S.x=me.x;S.y=me.y;}S.target=null;S.keys.clear();}
  d.responses.filter(x=>x.pid===S.id).forEach(x=>x.type==='answer'?S.answered.add(x.ref):S.submitted.add(x.ref));
  $('syncStatus').textContent='Terhubung';$('syncStatus').classList.remove('off');renderRoom();
 }catch(e){if(epoch!==S.epoch)return;S.failures++;$('syncStatus').textContent='Cuba sambung ('+S.failures+')';$('syncStatus').classList.add('off');
  if(/sudah tamat|tidak sah|dikeluarkan|Sesi guru tamat|log masuk guru/i.test(e.message)){await endLocal(e.message);return;}if(S.failures===1)toast(e.message);
 }finally{if(epoch===S.epoch){S.pollBusy=false;if(S.room)S.pollTimer=setTimeout(poll,Math.min(30000,(LOCAL?1700:6000)*Math.pow(1.4,Math.min(S.failures,5))));}}
}
async function endLocal(message){await disconnectVoice();closePresentation();resetSlides();stopPolling();S.room=null;S.keys.clear();toast(message);if(S.role==='teacher'){saveSession();try{renderDashboard(await request('dashboard'));show('dashboard');}catch(e){S.token='';clearSession();show('entry');switchEntry(true);}}else{S.token='';clearSession();show('entry');}}
function setTab(tab){S.tab=tab;['chat','tasks','people','teacher'].forEach(t=>{$('pane'+t[0].toUpperCase()+t.slice(1)).classList.toggle('hidden',t!==tab);document.querySelector(`[data-tab="${t}"]`).classList.toggle('selected',t===tab);});}
$('sideTabs').querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function renderRoom(){const r=S.room;if(!r)return;$('roomTitle').textContent=r.title;$('roomSubtitle').textContent=r.className+' · '+r.teacher;
 $('copyCode').textContent=r.code;$('onlineCount').textContent=S.players.length+' dalam kelas';
 $('focusNotice').textContent=r.freeze?'▣ Masa fokus — pergerakan dihentikan':'✦ '+(r.locked?'Kemasukan dikunci':'Mari belajar bersama');
 $('raiseHand').textContent=S.hand?'✋ Turunkan tangan':'✋ Angkat tangan';$('raiseHand').classList.toggle('active',S.hand);
 renderVoice();syncSlides();$('toggleMics').textContent=r.micsLocked?'Benarkan mikrofon murid':'Kunci mikrofon murid';$('toggleMics').classList.toggle('active',r.micsLocked);
 $('toggleFreeze').textContent=r.freeze?'Benarkan gerak':'Henti pergerakan';$('toggleLock').textContent=r.locked?'Buka kemasukan':'Kunci kemasukan';$('toggleChat').textContent=r.chatEnabled?'Tutup chat':'Buka chat';
 ['toggleFreeze','toggleLock','toggleChat'].forEach((id,i)=>$(id).classList.toggle('active',[r.freeze,r.locked,!r.chatEnabled][i]));
 $('chatInput').disabled=!r.chatEnabled&&S.role!=='teacher';$('chatInput').placeholder=$('chatInput').disabled?'Chat ditutup oleh guru':'Taip mesej…';
 const chatSignature=JSON.stringify(S.messages);if(chatSignature!==renderRoom.chatSig){const atBottom=$('chatList').parentElement.scrollHeight-$('chatList').parentElement.scrollTop-$('chatList').parentElement.clientHeight<120;
 $('chatList').innerHTML=S.messages.length?S.messages.map(m=>`<div class="chat-msg ${m.role==='teacher'?'teacher':''}"><div class="chat-name"><span>${esc(m.name)}${m.role==='teacher'?' · GURU':''}</span><time>${new Date(m.time).toLocaleTimeString('ms-MY',{hour:'2-digit',minute:'2-digit'})}</time></div>${esc(m.text)}</div>`).join(''):'<p class="hint">Belum ada mesej. Katakan hai kepada kelas!</p>';renderRoom.chatSig=chatSignature;if(atBottom&&S.tab==='chat')$('chatList').lastElementChild?.scrollIntoView({block:'nearest'});}
 const taskSignature=JSON.stringify([r.tasks,[...S.submitted],S.role]);if(taskSignature!==renderRoom.taskSig){$('taskList').innerHTML=r.tasks.length?r.tasks.map((t,i)=>`<article class="task-card"><div class="eyebrow" style="font-size:9px;margin-bottom:9px">STESEN ${i+1}</div><h3>${esc(t.title)}</h3><p>${esc(t.instructions||'Ikut arahan dalam pautan aktiviti.')}</p><a class="btn" href="${esc(safeUrl(t.url))}" target="_blank" rel="noopener noreferrer">Buka aktiviti ↗</a>${S.role==='student'?`<button class="complete ${S.submitted.has(t.id)?'active':''}" data-submit="${esc(t.id)}">${S.submitted.has(t.id)?'✓ Respons dihantar · Hantar semula':'Hantar respons / Saya dah siap'}</button>`:`<button class="complete small danger" data-remove="${esc(t.id)}">Buang tugasan</button>`}</article>`).join(''):'<div class="task-card"><h3>Ruang untuk meneroka</h3><p>Cikgu akan menambah pautan aktiviti di sini.</p></div>';
 $('taskList').querySelectorAll('[data-submit]').forEach(b=>b.onclick=()=>submitModal(b.dataset.submit));$('taskList').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>confirmModal('Buang tugasan?','Pautan ini akan dikeluarkan daripada kelas. Rekod respons kekal disimpan.',()=>mutate('task',{remove:b.dataset.remove})));renderRoom.taskSig=taskSignature;}
 const online=new Map(S.players.map(p=>[p.id,p])),people=S.role==='teacher'?S.roster.map(p=>({...p,...online.get(p.id),offline:!online.has(p.id)})):S.players.filter(p=>p.role!=='teacher');
 $('peopleTitle').textContent='Murid ('+people.length+')';$('peopleList').innerHTML=people.length?people.map(p=>`<div class="player-row"><span class="player-dot" style="background:${p.offline?'#606782':COLORS[p.color||0]}"></span><div class="name">${esc(p.name)} ${p.hand?'✋':''}<div class="sub">${p.offline?'Tidak kelihatan':p.id===S.id?'Anda':'Dalam kelas'}</div></div>${S.role==='teacher'?`<button class="small danger" data-kick="${esc(p.id)}" aria-label="Keluarkan ${esc(p.name)}">×</button>`:''}</div>`).join(''):'<p class="hint">Murid yang masuk akan dipaparkan di sini.</p>';
 $('peopleList').querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>confirmModal('Keluarkan murid?','Kemasukan semula menggunakan kod masih boleh berlaku. Kunci kemasukan jika perlu.',()=>mutate('kick',{studentId:b.dataset.kick})));
 $('responseList').innerHTML=S.responses.slice(-12).reverse().map(x=>`<div class="response"><b>${esc(x.name)}</b><small>${esc(x.title||x.type)}</small>${esc(x.text)}</div>`).join('')||'<p class="hint">Respons murid akan muncul di sini. Laporan penuh disimpan dalam Sheet.</p>';
 renderQuestion();
}
function renderQuestion(){const q=S.room.question,key=JSON.stringify([q,S.answered.has(q?.id),S.role]);if(key===renderQuestion.sig)return;renderQuestion.sig=key;
 $('questionArea').innerHTML=q?`<article class="question-card"><div class="eyebrow" style="font-size:9px;margin-bottom:9px">SOALAN CIKGU</div><p>${esc(q.text)}</p>${S.role==='teacher'?'<small>Respons direkod dalam laporan sesi.</small>':S.answered.has(q.id)?'<div class="answered">✓ Jawapan anda telah direkodkan.</div>':q.options.map((o,i)=>`<button data-answer="${i}">${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('')}</article>`:'';
 $('questionArea').querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>busy($('questionArea'),async()=>{await request('answer',{questionId:q.id,option:Number(b.dataset.answer)});S.answered.add(q.id);renderQuestion();toast('Jawapan dihantar kepada cikgu.');}));
}
async function mutate(action,args){const d=await request(action,args);if(d&&d.code){S.room=d;renderRoom();}toast('Disimpan.');return d;}
$('chatForm').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{const text=$('chatInput').value;const m=await request('chat',{text});$('chatInput').value='';S.messages.push(m);renderRoom();});};
$('raiseHand').onclick=()=>{S.hand=!S.hand;renderRoom();};document.querySelectorAll('[data-reaction]').forEach(b=>b.onclick=()=>{S.reaction=b.dataset.reaction;S.reactionAt=Date.now();toast('Reaksi dikongsi pada penyegerakan seterusnya.');});
$('toggleFreeze').onclick=()=>busy($('paneTeacher'),()=>mutate('settings',{freeze:!S.room.freeze}));
$('toggleLock').onclick=()=>busy($('paneTeacher'),()=>mutate('settings',{locked:!S.room.locked}));
$('toggleChat').onclick=()=>busy($('paneTeacher'),()=>mutate('settings',{chatEnabled:!S.room.chatEnabled}));
$('boardForm').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,()=>mutate('settings',{board:$('boardText').value}));};
$('toggleMics').onclick=()=>busy($('paneTeacher'),()=>mutate('settings',{micsLocked:!S.room.micsLocked}));
$('taskForm').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{await mutate('task',{title:$('taskTitle').value,url:$('taskUrl').value,instructions:$('taskInstructions').value});$('taskForm').reset();});};
$('questionForm').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,()=>mutate('question',{text:$('questionText').value,options:$('questionOptions').value.split('\n').map(x=>x.trim()).filter(Boolean)}));};
$('clearQuestion').onclick=()=>busy($('paneTeacher'),()=>mutate('question',{clear:true}));
$('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(S.room.code);toast('Kod kelas disalin: '+S.room.code);}catch(e){openModal('Kod kelas',`<p>Kongsi kod ini dengan murid:</p><input readonly value="${esc(S.room.code)}" aria-label="Kod kelas"><p class="hint">Pilih teks dan salin secara manual.</p>`);}};
$('exitRoom').onclick=()=>confirmModal('Keluar kelas?','Sesi akan terus dibuka untuk peserta lain.',async()=>{await request('leave');await endLocal('Anda telah keluar kelas.');});
$('closeClass').onclick=()=>confirmModal('Tamatkan kelas untuk semua?','Kod ini akan ditutup. Rekod kehadiran dan respons kekal dalam Google Sheet.',async()=>{await request('settings',{closed:true});await endLocal('Sesi kelas ditamatkan.');});
function openModal(title,body){S.keys.clear();S.target=null;$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modal').showModal();}
$('modalClose').onclick=()=>$('modal').close();
function confirmModal(title,description,fn){openModal(title,`<p class="muted">${esc(description)}</p><div class="row"><button id="confirmAction" class="primary">Teruskan</button><button id="cancelAction">Batal</button></div>`);$('cancelAction').onclick=()=>$('modal').close();$('confirmAction').onclick=()=>busy($('modal'),async()=>{await fn();$('modal').close();});}
function submitModal(id){const t=S.room.tasks.find(t=>t.id===id);if(!t)return;openModal(t.title,`<form id="submitForm" class="stack"><p class="hint">Tugasan di pautan luar tidak dihantar secara automatik. Ruangan ini ialah respons atau pengakuan siap anda kepada cikgu.</p><label>Jawapan, pautan hasil kerja atau catatan<textarea id="submitText" maxlength="300" placeholder="Contoh: Saya berjaya menjawab 8 daripada 10 soalan."></textarea></label><button class="primary" type="submit">Hantar kepada cikgu</button></form>`);
 $('submitForm').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{await request('submit',{taskId:id,text:$('submitText').value});S.submitted.add(id);renderRoom();$('modal').close();toast('Respons tugasan disimpan.');});};}
async function openReport(code){try{toast('Memuatkan laporan…');const d=await request('report',{code});
 openModal('Laporan sesi '+code,`<p class="report-meta">${new Set(d.attendance.filter(r=>r.event==='Masuk').map(r=>r.id)).size} peserta berdaftar · ${d.responses.length} respons</p><h3>Kehadiran</h3><div style="overflow:auto"><table class="report-table"><thead><tr><th>Nama</th><th>Peristiwa</th><th>Masa</th></tr></thead><tbody>${d.attendance.map(r=>`<tr><td>${esc(r.name)}<br><small>${esc(r.className)}</small></td><td>${esc(r.event)}</td><td>${esc(new Date(r.time).toLocaleTimeString('ms-MY',{hour:'2-digit',minute:'2-digit'}))}</td></tr>`).join('')}</tbody></table></div><h3 style="margin-top:24px">Respons murid</h3><div style="overflow:auto"><table class="report-table"><thead><tr><th>Nama</th><th>Jenis</th><th>Respons</th></tr></thead><tbody>${d.responses.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.type)}</td><td>${esc(r.text)}</td></tr>`).join('')}</tbody></table></div><button id="downloadReport" style="margin-top:20px">Muat turun CSV respons</button>`);
 $('downloadReport').onclick=()=>{const rows=[['Masa','Nama','Kelas','Jenis','Rujukan','Respons'],...d.responses.map(r=>[r.time,r.name,r.className,r.type,r.ref,r.text])];
 const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/^[\s]*([=+@-])/,'\'$1').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='KelasQuest_'+code+'_respons.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }catch(e){toast(e.message);}}
$('reportBtn').onclick=()=>openReport(S.room.code);

// Dunia dilukis sendiri: tiada aset, pustaka permainan atau CDN diperlukan.
const WORLD={w:1000,h:700},desks=[];[300,430,560,690].forEach(x=>[365,465].forEach(y=>desks.push({x,y,w:86,h:46})));
const obstacles=[...desks,{x:367,y:174,w:266,h:40},{x:830,y:270,w:105,h:225},{x:62,y:315,w:82,h:145}];
function blocked(x,y){return obstacles.some(o=>x>o.x-17&&x<o.x+o.w+17&&y>o.y-12&&y<o.y+o.h+15);}
function move(dx,dy){if(S.room?.freeze&&S.role==='student')return;const x=Math.max(45,Math.min(955,S.x+dx)),y=Math.max(145,Math.min(655,S.y+dy));if(!blocked(x,S.y))S.x=x;if(!blocked(S.x,y))S.y=y;}
window.addEventListener('keydown',e=>{if(!S.room||$('modal').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const key=e.key.toLowerCase();if(!$('presentationPanel').classList.contains('hidden')){if(S.role==='teacher'&&!e.repeat&&(key==='arrowleft'||key==='arrowright')){e.preventDefault();changeSlide(key==='arrowleft'?-1:1);}return;}if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)){e.preventDefault();S.keys.add(key);S.target=null;}if(key==='e'){e.preventDefault();interact();}});
window.addEventListener('keyup',e=>S.keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>S.keys.clear());document.addEventListener('visibilitychange',()=>S.keys.clear());
document.querySelectorAll('[data-dir]').forEach(b=>{const k={up:'w',left:'a',down:'s',right:'d'}[b.dataset.dir];b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);S.keys.add(k);S.target=null;};const release=()=>S.keys.delete(k);b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;});
function canvasPoint(canvas,e){const rect=canvas.getBoundingClientRect(),scale=Math.min(rect.width/WORLD.w,rect.height/WORLD.h),ox=(rect.width-WORLD.w*scale)/2,oy=(rect.height-WORLD.h*scale)/2;return {x:(e.clientX-rect.left-ox)/scale,y:(e.clientY-rect.top-oy)/scale};}
$('world').onpointerdown=e=>{if(!S.room)return;$('world').focus({preventScroll:true});const p=canvasPoint($('world'),e);if(p.x>355&&p.x<645&&p.y>65&&p.y<170){if(S.room.slides?.active||screenPresent())openPresentation();else boardModal();return;}if(p.x>825&&p.x<950&&p.y>250&&p.y<520){setTab('tasks');return;}if(!blocked(p.x,p.y)&&p.y>=145&&p.y<=655&&p.x>=45&&p.x<=955)S.target=p;};
function boardModal(){openModal('Papan pengajaran',`<div style="white-space:pre-wrap;line-height:1.9;color:#e4e0fc">${esc(S.room.board||'Cikgu belum menulis nota.')}</div>`);}
function interact(){if(S.near==='board'){if(S.room.slides?.active||screenPresent())openPresentation();else boardModal();}if(S.near==='tasks'){setTab('tasks');toast('Pilih tugasan di panel Tugasan.');}}
$('interactBtn').onclick=interact;
function round(ctx,x,y,w,h,r,color,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(color){ctx.fillStyle=color;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function label(ctx,text,x,y,size,color='#e9e7ff',align='center'){ctx.fillStyle=color;ctx.font=`600 ${size}px system-ui,sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);}
function drawBase(ctx,r){ctx.fillStyle='#24273e';ctx.fillRect(0,0,1000,700);
 round(ctx,20,22,960,655,26,'#646079','#77728d');round(ctx,36,122,928,537,8,'#b7ada5');
 // Lantai, dinding dan tingkap.
 ctx.save();ctx.beginPath();ctx.roundRect(36,122,928,537,8);ctx.clip();for(let x=36;x<964;x+=58)line(ctx,x,122,x,659,'#a49b952b');for(let y=122;y<659;y+=48)line(ctx,36,y,964,y,'#918a8340');ctx.restore();
 round(ctx,38,42,924,93,10,'#817a93');round(ctx,47,128,904,9,3,'#474456');
 [130,750].forEach(x=>{round(ctx,x,52,115,62,10,'#565d7b');round(ctx,x+6,58,103,50,6,'#9ad5d7');line(ctx,x+56,58,x+56,108,'#57647b',5);line(ctx,x+6,83,x+109,83,'#57647b',5);});
 round(ctx,347,48,306,127,10,'#4e495e');round(ctx,357,57,286,106,6,'#294744','#8ba692');
 label(ctx,r?.slides?.active?'SKRIN SLAID · '+r.slides.page+'/'+r.slides.pages:'PAPAN PENGAJARAN',500,82,11,'#92c5ae');
 const words=(r?.slides?.active?r.slides.name+' — klik skrin untuk paparan penuh':r?.board||'Selamat datang ke kelas digital!').split(/\s+/);let rows=[],row='';words.forEach(w=>{if((row+w).length>34){rows.push(row);row='';}row+=(row?' ':'')+w;});rows.push(row);rows.slice(0,3).forEach((s,i)=>label(ctx,s,500,105+i*18,12,'#edf5df'));if(rows.length>3)label(ctx,'Klik papan untuk baca lagi…',500,157,9,'#a4c1ad');
 round(ctx,367,184,266,37,8,'#7f625b');round(ctx,367,174,266,35,8,'#dab18a','#c09371');
 round(ctx,407,181,47,20,3,'#f4e6c5');line(ctx,411,187,445,187,'#c9b79c',2);line(ctx,411,193,438,193,'#c9b79c',2);round(ctx,554,164,40,25,3,'#3f455c');round(ctx,558,168,32,17,2,'#9898b5');
 label(ctx,'RUANG CIKGU',500,259,11,'#706574');
 // Permaidani pastel di ruang murid.
 round(ctx,262,312,538,240,20,'#a39dbe');round(ctx,272,322,518,220,16,null,'#bcb4d0');
 desks.forEach(o=>{round(ctx,o.x+24,o.y+49,39,24,8,'#706881');round(ctx,o.x+29,o.y+51,29,16,6,'#b5a8c7');round(ctx,o.x,o.y+7,o.w,o.h,8,'#86665e');round(ctx,o.x,o.y,o.w,o.h,8,'#e4c29f','#c1a082');round(ctx,o.x+13,o.y+10,27,24,3,'#faf0d9');line(ctx,o.x+17,o.y+17,o.x+35,o.y+17,'#cdbda3',2);line(ctx,o.x+17,o.y+23,o.x+32,o.y+23,'#cdbda3',2);round(ctx,o.x+56,o.y+10,14,19,3,'#9385c4');});
 // Stesen tugasan.
 round(ctx,830,274,106,230,13,'#7c687d');round(ctx,830,267,106,226,13,'#e6b38a','#c18d72');label(ctx,'TUGASAN',883,289,11,'#5d4251');[0,1,2].forEach(i=>{round(ctx,840,307+i*58,86,49,8,'#f5d6ac');round(ctx,850,315+i*58,44,27,5,['#8b7cff','#63b9ff','#50cbb1'][i]);label(ctx,String(i+1),872,334+i*58,14,'#fff');round(ctx,906,319+i*58,9,18,2,'#b8929f');});
 // Rak buku, tumbuhan, pintu.
 round(ctx,63,322,80,135,10,'#75605f');round(ctx,62,315,82,134,10,'#d8ae8d');[338,380,422].forEach((y,i)=>{round(ctx,69,y,68,5,2,'#947369');[0,1,2,3,4].forEach((v)=>round(ctx,71+v*12,y-24,9,24,2,['#927ac5','#75a6a1','#de947d','#ead1a0','#8295c0'][(v+i)%5]));});label(ctx,'SUDUT ILMU',103,478,10,'#756a73');
 [ [92,208],[908,180],[914,595] ].forEach(([x,y])=>{ctx.fillStyle='#62695335';ctx.beginPath();ctx.ellipse(x,y+12,27,10,0,0,Math.PI*2);ctx.fill();round(ctx,x-14,y-7,28,27,5,'#c99476');ctx.fillStyle='#5f8c74';for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(x+Math.sin(i*1.4)*12,y-17+Math.cos(i*1.4)*10,10,17,i*.7,0,Math.PI*2);ctx.fill();}});
 round(ctx,423,629,154,41,7,'#686079');round(ctx,432,636,136,24,5,'#d4c2b1');label(ctx,'PINTU MASUK',500,653,10,'#5f536b');
 label(ctx,'KELASQUEST',130,594,17,'#7d707a');label(ctx,'Belajar · Teroka · Bersama',130,614,10,'#8d7e87');
}
function avatar(ctx,p,time){const self=p.id===S.id,bob=p.moving?Math.sin(time/100)*2:0,x=p.x,y=p.y+bob,color=COLORS[p.color||0];
 ctx.fillStyle='#392e4940';ctx.beginPath();ctx.ellipse(x,y+15,22,8,0,0,Math.PI*2);ctx.fill();
 if(self){ctx.strokeStyle='#f9f1c5';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+17,27,10,0,0,Math.PI*2);ctx.stroke();}
 round(ctx,x-19,y-30,12,30,6,'#55496b');round(ctx,x-14,y-38,31,48,14,color,'#443854');
 round(ctx,x-12,y+2,12,16,5,color,'#443854');round(ctx,x+3,y+2,12,16,5,color,'#443854');
 round(ctx,x-6,y-29,28,18,8,'#493f66');round(ctx,x-3,y-27,22,12,6,'#d1ecf1');round(ctx,x+1,y-26,9,4,2,'#ffffff');
 if(p.role==='teacher'){ctx.fillStyle='#3f354e';ctx.beginPath();ctx.moveTo(x-23,y-42);ctx.lineTo(x,y-51);ctx.lineTo(x+24,y-42);ctx.lineTo(x,y-33);ctx.fill();line(ctx,x+21,y-42,x+21,y-27,'#f2cb76',2);}
 const name=p.name+(self?' · Anda':'');ctx.font='600 12px system-ui';const w=Math.min(215,ctx.measureText(name).width+18);round(ctx,x-w/2,y-68,w,22,7,p.role==='teacher'?'#5b4b7bef':'#252a44ed');label(ctx,name,x,y-53,12,'#fff');
 const reaction=p.hand?'✋':p.reaction&&Date.now()-p.reactionAt<10000?p.reaction:'';if(reaction){round(ctx,x+16,y-91,32,30,10,'#fff6df');label(ctx,reaction,x+32,y-69,21);}
}
function drawCanvas(canvas,r,players,time){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);const scale=Math.min(w/1000,h/700);ctx.translate((w-1000*scale)/2,(h-700*scale)/2);ctx.scale(scale,scale);drawBase(ctx,r);players.slice().sort((a,b)=>a.y-b.y).forEach(p=>avatar(ctx,p,time));}
function frame(time){const dt=Math.min((time-(S.lastFrame||time))/1000,.04);S.lastFrame=time;
 if(S.room&&!$('classroom').classList.contains('hidden')){let dx=0,dy=0;const k=S.keys;if(k.has('w')||k.has('arrowup'))dy--;if(k.has('s')||k.has('arrowdown'))dy++;if(k.has('a')||k.has('arrowleft'))dx--;if(k.has('d')||k.has('arrowright'))dx++;
  if(!dx&&!dy&&S.target){const tx=S.target.x-S.x,ty=S.target.y-S.y,len=Math.hypot(tx,ty);if(len<6)S.target=null;else{dx=tx/len;dy=ty/len;}}
  const beforeX=S.x,beforeY=S.y,norm=Math.hypot(dx,dy)||1;move(dx/norm*185*dt,dy/norm*185*dt);if(S.target&&S.x===beforeX&&S.y===beforeY)S.target=null;
  const moving=Math.hypot(S.x-beforeX,S.y-beforeY)>.1,now=Date.now(),players=S.players.filter(p=>p.id!==S.id).map(p=>{const old=S.drawPlayers.get(p.id)||{x:p.x,y:p.y};const delta=Math.hypot(p.x-old.x,p.y-old.y);old.x+=(p.x-old.x)*Math.min(1,dt*4);old.y+=(p.y-old.y)*Math.min(1,dt*4);S.drawPlayers.set(p.id,old);return {...p,x:old.x,y:old.y,moving:delta>1};});
  players.push({id:S.id,name:S.name,role:S.role,color:S.color,x:S.x,y:S.y,hand:S.hand,reaction:S.reaction,reactionAt:S.reactionAt,moving});drawCanvas($('world'),S.room,players,time);
  const near=S.x>340&&S.x<660&&S.y<290?'board':S.x>765&&S.y>245&&S.y<540?'tasks':'';S.near=near;$('interactBtn').classList.toggle('hidden',!near);$('interactBtn').textContent=near==='board'?'E · Baca papan':'E · Buka tugasan';
 }else if(!$('entry').classList.contains('hidden')){drawCanvas($('heroCanvas'),null,[{id:'heroT',name:'Cikgu Shafiq',role:'teacher',color:0,x:500,y:242},{id:'h1',name:'Adam',color:3,x:343,y:432},{id:'h2',name:'Aina',color:2,x:602,y:520,hand:true},{id:'h3',name:'Mikail',color:1,x:730,y:572}],time);}
 requestAnimationFrame(frame);}
requestAnimationFrame(frame);

// Adapter pratonton tempatan. Tidak dipakai apabila google.script.run tersedia.
const DEMO={room:null,messages:[],responses:[],rooms:[],attendance:[],removed:new Set(),pdf:null};
async function demoApi(p){
 const room=DEMO.room,uid=()=>Math.random().toString(16).slice(2)+Date.now().toString(16),who=p.role==='teacher'?room?.teacher:S.name;
 switch(p.action){
 case 'login':return {token:'demo-teacher',dashboard:{rooms:DEMO.rooms,sheetUrl:'',profile:{email:'demo@example.com'},voiceConfigured:false}};
 case 'dashboard':return {rooms:DEMO.rooms,sheetUrl:'',profile:{email:'demo@example.com'},voiceConfigured:false};
 case 'create':{const r={code:'DEMO2A',title:p.title,className:p.className,teacher:p.teacher,voiceConfigured:false,micsLocked:false,slides:null,board:'Today we learn about the beach.\nRead the sentences. Find the main idea.\nExplore the activity station on your right.',tasks:[{id:'task1',title:'My Beach Holiday',url:'https://learnenglishkids.britishcouncil.org/',instructions:'Buka bahan pembelajaran. Cari perkataan berkaitan pantai.'}],question:null,closed:false,locked:false,freeze:false,chatEnabled:true,expires:Date.now()+21600000};DEMO.room=r;DEMO.removed.clear();DEMO.attendance=[];DEMO.rooms=[{...r,created:Date.now()}];DEMO.messages=[{id:uid(),name:'Aina',role:'student',text:'Hello, teacher! 👋',time:Date.now(),type:'chat'}];DEMO.responses=[];return {room:structuredClone(r),id:'teacher'};}
 case 'enterTeacher':return {room:structuredClone(room),id:'teacher'};
 case 'join':if(!room||p.code!==room.code)throw new Error('Dalam pratonton, cipta sesi sebagai guru dahulu.');if(room.locked)throw new Error('Kelas dikunci.');DEMO.attendance.push({name:p.name,className:p.className,event:'Masuk',id:'demo-student',time:new Date().toISOString()});return {room:structuredClone(room),token:'demo-student',id:'demo-student',name:p.name,color:p.color};
 case 'sync':{if(room.closed)throw new Error('Sesi sudah tamat.');const students=[{id:'adam',name:'Adam',color:3,x:343,y:432,hand:false},{id:'aina',name:'Aina',color:2,x:600,y:555,hand:true},{id:'mikail',name:'Mikail',color:1,x:760,y:560,hand:false}].filter(x=>!DEMO.removed.has(x.id)).map((x,i)=>({...x,x:x.x+(room.freeze?0:Math.sin(Date.now()/1500+i)*8),role:'student',seen:Date.now()}));const me={id:p.id,name:who,color:S.color,role:p.role,x:p.x,y:p.y,hand:p.hand,reaction:p.reaction,reactionAt:p.reactionAt};return {room:structuredClone(room),players:[...students,me],messages:DEMO.messages.slice(),responses:DEMO.responses.slice(),roster:students.map(x=>({...x,className:room.className})),pollMs:1700};}
 case 'settings':Object.assign(room,Object.fromEntries(Object.entries(p).filter(([k])=>['board','closed','locked','freeze','chatEnabled','micsLocked'].includes(k))));if(p.closed)DEMO.rooms.forEach(r=>r.closed=true);return structuredClone(room);
 case 'voiceToken':throw new Error('Pratonton tiada panggilan suara. Gunakan pautan portal untuk kelas sebenar.');
 case 'adminConfig':return {email:'demo@example.com',appId:'',certificateSet:false,frontendUrl:'',defaultPin:true};
 case 'saveConfig':case 'changePin':return {saved:true};
 case 'uploadPdf':DEMO.pdf={id:uid(),name:p.name,base64:p.base64,pages:p.pages};room.slides={id:DEMO.pdf.id,name:p.name,pages:p.pages,page:1,active:true,revision:Date.now()};return structuredClone(room);
 case 'pdfData':return DEMO.pdf;
 case 'slide':if(p.remove)room.slides=null;else{if(p.page)room.slides.page=p.page;if(typeof p.active==='boolean')room.slides.active=p.active;room.slides.revision=Date.now();}return structuredClone(room);
 case 'chat':{const m={id:uid(),name:who,role:p.role,text:p.text,time:Date.now(),type:'chat'};DEMO.messages.push(m);return m;}
 case 'task':if(p.remove)room.tasks=room.tasks.filter(t=>t.id!==p.remove);else room.tasks.push({id:uid(),title:p.title,url:p.url,instructions:p.instructions});return structuredClone(room);
 case 'question':room.question=p.clear?null:{id:uid(),text:p.text,options:p.options};if(!p.clear&&p.role==='teacher'){const q=room.question;setTimeout(()=>{if(DEMO.room.question?.id===q.id)DEMO.responses.push({id:uid(),type:'answer',pid:'adam',name:'Adam',ref:q.id,title:q.text,text:q.options[0],time:Date.now()});},4500);}return structuredClone(room);
 case 'answer':DEMO.responses.push({id:uid(),type:'answer',pid:p.id,name:who,ref:p.questionId,title:room.question.text,text:room.question.options[p.option],time:Date.now()});return {saved:true};
 case 'submit':DEMO.responses.push({id:uid(),type:'submit',pid:p.id,name:who,ref:p.taskId,title:'Tugasan',text:p.text||'Sudah siap',time:Date.now()});return {saved:true};
 case 'logout':return {saved:true};
 case 'kick':DEMO.removed.add(p.studentId);return {saved:true};
 case 'leave':return {saved:true};
 case 'report':return {attendance:DEMO.attendance,responses:DEMO.responses.map(x=>({name:x.name,className:room.className,type:x.type==='answer'?'Soalan':'Tugasan',ref:x.ref,text:x.text,id:x.pid,time:new Date(x.time).toISOString()}))};
 default:throw new Error('Tindakan tidak tersedia dalam pratonton.');}}
if(LOCAL){$('demoBanner').classList.remove('hidden');$('demoBtn').classList.remove('hidden');$('demoBtn').onclick=async()=>{S.role='teacher';S.id='teacher';S.token='demo-teacher';const d=await demoApi({action:'create',title:'English · My Beach Holiday',className:'2 Bestari',teacher:'Cikgu Shafiq',voiceConfigured:false});S.name=d.room.teacher;startRoom(d.room);};}
async function restore(){if(LOCAL)return;try{const d=JSON.parse(sessionStorage.getItem('kq-session')||'null');if(!d?.token)return;Object.assign(S,d);if(d.room){if(d.role==='teacher'){const r=await request('enterTeacher',{code:d.room.code});startRoom(r.room);}else{const r=await request('sync',{x:500,y:580,hand:false});startRoom(r.room);}}else if(d.role==='teacher'){renderDashboard(await request('dashboard'));show('dashboard');}}catch(e){S.room=null;S.token='';clearSession();toast(e.message);}}
