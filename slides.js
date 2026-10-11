'use strict';
const P={library:null,doc:null,id:null,loading:false,page:0,renderTask:null,generation:0,renderVersion:0,error:'',autoSeen:null,failureId:null,attempts:0,nextAttempt:0};
async function pdfLibrary(){if(!P.library){P.library=await import('./vendor/pdfjs/legacy/build/pdf.mjs');P.library.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/legacy/build/pdf.worker.mjs',location.href).href;}return P.library;}
async function readPdf(bytes){const lib=await pdfLibrary(),base=new URL('./vendor/pdfjs/',location.href).href;
 const task=lib.getDocument({data:bytes,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/',isEvalSupported:false});
 try{return await task.promise;}catch(e){await task.destroy().catch(()=>{});throw e;}}
async function disposePdf(doc){if(doc?.loadingTask)await doc.loadingTask.destroy();else if(doc?.destroy)await doc.destroy();}
function resetSlides(){P.generation++;P.renderVersion++;P.renderTask?.cancel();P.renderTask=null;disposePdf(P.doc).catch(()=>{});P.doc=null;P.id=null;P.page=0;P.loading=false;P.error='';P.autoSeen=null;P.failureId=null;P.attempts=0;P.nextAttempt=0;}
function openPresentation(){S.keys.clear();S.target=null;$('presentationPanel').classList.remove('hidden');$('presentationControls').classList.toggle('hidden',S.role!=='teacher');updatePresentationSurface();}
function closePresentation(){$('presentationPanel').classList.add('hidden');}
function updatePresentationSurface(){const screen=screenPresent();$('pdfSurface').classList.toggle('hidden',screen);$('screenSurface').classList.toggle('hidden',!screen);
 if(screen){$('presentationTitle').textContent='Perkongsian skrin cikgu';$('presentationStatus').textContent='Langsung melalui Agora · video';$('presentationPage').textContent='';$('presentationControls').classList.add('hidden');
  (V.screen||V.remoteScreen)?.play('screenVideo',{fit:'contain'});
 }else{const s=S.room?.slides;$('presentationControls').classList.toggle('hidden',S.role!=='teacher');$('presentationTitle').textContent=s?.name||'Skrin kelas';
  $('presentationStatus').textContent=s?.active?'Paparan mengikut halaman guru':'Pembentangan belum dimulakan';$('presentationPage').textContent=s?.active?'Halaman '+s.page+' / '+s.pages:'';
  if(s?.active){$('slideEmpty').textContent=P.error||'Memuatkan slaid…';if(P.id===s.id&&P.doc){renderPdfPage(s.page).catch(e=>pdfError(e));}}
  else{$('slideEmpty').classList.remove('hidden');$('slideEmpty').textContent='Cikgu belum memulakan pembentangan.';$('slideCanvas').classList.add('hidden');}}
}
function pdfError(e){if(e?.name==='RenderingCancelledException')return;P.error='Slaid tidak dapat dibuka: '+(e.message||e);$('slideEmpty').textContent=P.error;$('slideEmpty').classList.remove('hidden');}
async function syncSlides(){const s=S.room?.slides;
 $('slidePageLabel').textContent=s?s.page+' / '+s.pages:'Tiada slaid';$('slidePrev').disabled=!s||s.page<=1;$('slideNext').disabled=!s||s.page>=s.pages;
 $('slidePrevBig').disabled=!s||s.page<=1;$('slideNextBig').disabled=!s||s.page>=s.pages;$('toggleSlides').disabled=!s;$('removeSlides').disabled=!s;$('toggleSlides').textContent=s?.active?'Sembunyi slaid':'Paparkan slaid';
 $('openPresentation').textContent=screenPresent()?'▣ Skrin langsung':s?.active?'▣ Slaid '+s.page+'/'+s.pages:'▣ Skrin kelas';
 if(!s){if(P.doc)resetSlides();updatePresentationSurface();return;}
 if(P.failureId!==s.id){P.failureId=s.id;P.attempts=0;P.nextAttempt=0;}
 if(P.id!==s.id&&!P.loading&&P.attempts<3&&Date.now()>=P.nextAttempt){const generation=++P.generation;P.loading=true;P.error='';
  try{const data=await request('pdfData',{slideId:s.id});const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));const doc=await readPdf(bytes);
   if(generation!==P.generation||S.room?.slides?.id!==s.id){await disposePdf(doc);return;}
   P.renderTask?.cancel();P.renderTask=null;await disposePdf(P.doc);P.doc=doc;P.id=s.id;P.page=0;
  }catch(e){if(generation===P.generation){P.attempts++;P.nextAttempt=Date.now()+10000*P.attempts;pdfError(e);}}finally{if(generation===P.generation)P.loading=false;}}
 if(s.active&&P.autoSeen!==s.id){P.autoSeen=s.id;openPresentation();}else updatePresentationSurface();
}
async function renderPdfPage(n){if(!P.doc||!S.room?.slides?.active||$('presentationPanel').classList.contains('hidden')||screenPresent())return;
 if(P.page===n&&P.id===S.room.slides.id&&!P.renderTask){$('slideEmpty').classList.add('hidden');$('slideCanvas').classList.remove('hidden');return;}
 const generation=P.generation,id=P.id,renderVersion=++P.renderVersion;P.renderTask?.cancel();P.renderTask=null;
 const page=await P.doc.getPage(n);if(generation!==P.generation||id!==P.id||renderVersion!==P.renderVersion)return;const viewport=page.getViewport({scale:1}),surface=$('pdfSurface').getBoundingClientRect();
 const scale=Math.min(Math.max(280,surface.width-30)/viewport.width,Math.max(220,surface.height-30)/viewport.height)*Math.min(devicePixelRatio||1,2);
 const view=page.getViewport({scale});const canvas=$('slideCanvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
 $('slideEmpty').classList.add('hidden');canvas.classList.remove('hidden');const task=page.render({canvasContext:canvas.getContext('2d'),viewport:view});P.renderTask=task;
 try{await task.promise;if(generation===P.generation&&P.renderTask===task){P.page=n;P.renderTask=null;}}catch(e){if(e.name!=='RenderingCancelledException')throw e;}
}
async function changeSlide(delta){const s=S.room?.slides;if(!s)return;const page=Math.max(1,Math.min(s.pages,s.page+delta));
 await busy($('paneTeacher'),()=>mutate('slide',{slideId:s.id,page}));}
$('slidePrev').onclick=() => changeSlide(-1);$('slideNext').onclick=()=>changeSlide(1);$('slidePrevBig').onclick=()=>changeSlide(-1);$('slideNextBig').onclick=()=>changeSlide(1);
$('toggleSlides').onclick=()=>busy($('paneTeacher'),()=>mutate('slide',{slideId:S.room.slides.id,active:!S.room.slides.active}));
$('removeSlides').onclick=()=>confirmModal('Buang pembentangan?','Slaid akan dikeluarkan daripada kelas. Fail asal kekal dalam folder Drive pemilik.',()=>mutate('slide',{remove:true}));
$('openPresentation').onclick=()=>{if(P.error){P.attempts=0;P.nextAttempt=0;syncSlides();}openPresentation();};$('closePresentation').onclick=closePresentation;
$('pdfForm').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{const file=$('pdfFile').files[0];if(!file)throw new Error('Pilih PDF dahulu.');if(file.size>3*1024*1024)throw new Error('PDF maksimum 3 MB. Mampatkan PDF atau gunakan perkongsian skrin.');
 $('pdfUploadStatus').textContent='Memeriksa PDF…';let doc;
 try{const bytes=new Uint8Array(await file.arrayBuffer());doc=await readPdf(bytes.slice());if(doc.numPages>150)throw new Error('Had 150 halaman.');
  let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  $('pdfUploadStatus').textContent='Memuat naik PDF…';await mutate('uploadPdf',{name:file.name,pages:doc.numPages,base64:btoa(binary)});$('pdfUploadStatus').textContent='PDF siap dikongsi.';$('pdfForm').reset();
 }catch(e){$('pdfUploadStatus').textContent=e.message;throw e;}finally{await disposePdf(doc);}});};
window.addEventListener('resize',()=>{P.page=0;if(!$('presentationPanel').classList.contains('hidden'))updatePresentationSurface();});
