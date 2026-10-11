'use strict';
const V={client:null,mic:null,screen:null,connected:false,connecting:false,muted:true,busy:false,remoteScreen:null,remoteScreenUid:null,expires:0,renewing:false,volume:new Set(),error:'',epoch:0};
function renderVoice(){
 const configured=!!S.room?.voiceConfigured&&!LOCAL;
 $('joinVoice').classList.toggle('hidden',V.connected);$('joinVoice').disabled=V.connecting||!configured;
 $('joinVoice').textContent=V.connecting?'Menyambung…':configured?'🎧 Sambung suara':'🎧 Suara belum tersedia';
 $('leaveVoice').classList.toggle('hidden',!V.connected);$('toggleMic').disabled=!V.connected||V.busy||(S.role==='student'&&S.room?.micsLocked);
 $('toggleMic').textContent=!V.muted?'🎙 Mikrofon hidup':S.role==='student'&&S.room?.micsLocked?'🔒 Mikrofon dikunci':'🎙 Mikrofon tutup';
 $('toggleMic').classList.toggle('active',!V.muted);
 $('voiceStatus').textContent=V.connected?'Suara tersambung':V.connecting?'Menyambung suara…':V.error||'Suara belum disambung';
 $('shareScreen').textContent=V.screen?'Hentikan perkongsian skrin':'Kongsi skrin · kuota video';
 $('shareScreen').disabled=LOCAL||!V.connected||V.busy;
 if(S.role==='student'&&S.room?.micsLocked&&!V.muted&&!V.busy)muteMicrophone(true).catch(e=>toast(e.message));
}
async function connectVoice(){
 if(V.connected||V.connecting||!S.room)return;
 if(LOCAL){toast('Pratonton tidak mempunyai suara sebenar.');return;}
 if(!window.AgoraRTC){toast('Suara tidak dapat dimuatkan. Semak internet dan muat semula halaman.');return;}
 if(!window.isSecureContext){toast('Mikrofon memerlukan halaman HTTPS. Gunakan pautan GitHub Pages.');return;}
 const epoch=++V.epoch;V.connecting=true;V.error='';renderVoice();
 try{
  const token=await request('voiceToken');if(epoch!==V.epoch)return;
  const client=AgoraRTC.createClient({mode:'rtc',codec:'vp8'});V.client=client;
  client.on('user-published',async(user,media)=>{try{await client.subscribe(user,media);if(V.client!==client)return;
   if(media==='audio')user.audioTrack?.play();
   if(media==='video'&&Number(user.uid)===1){V.remoteScreen=user.videoTrack;V.remoteScreenUid=user.uid;openPresentation();}
  }catch(e){toast('Audio/video tidak dapat dimainkan: '+(e.message||e));}});
  client.on('user-unpublished',(user,media)=>{if(media==='video'&&V.remoteScreenUid===user.uid){V.remoteScreen=null;V.remoteScreenUid=null;updatePresentationSurface();}});
  client.on('user-left',user=>{if(V.remoteScreenUid===user.uid){V.remoteScreen=null;V.remoteScreenUid=null;updatePresentationSurface();}});
  client.on('token-privilege-will-expire',()=>renewVoiceToken().catch(e=>{V.error=e.message;renderVoice();toast(e.message);}));
  client.on('token-privilege-did-expire',()=>renewVoiceToken().catch(async e=>{await disconnectVoice();toast('Token suara tamat. Sambung suara semula. '+e.message);}));
  client.on('connection-state-change',(state,prev,reason)=>{if(V.client!==client)return;if(state==='RECONNECTING')$('voiceStatus').textContent='Menyambung semula suara…';
   if(state==='DISCONNECTED'&&reason){V.error='Suara terputus. Sambung semula.';disconnectVoice(false).then(renderVoice);}});
  await client.join(token.appId,token.channel,token.token,token.uid);
  if(epoch!==V.epoch){await client.leave();return;}
  V.connected=true;V.expires=token.expires;V.muted=true;
  // Handle already-published users when reconnecting to an existing class.
  for(const user of client.remoteUsers){if(user.hasAudio){await client.subscribe(user,'audio');user.audioTrack?.play();}if(user.hasVideo&&Number(user.uid)===1){await client.subscribe(user,'video');V.remoteScreen=user.videoTrack;V.remoteScreenUid=user.uid;}}
  AgoraRTC.onAutoplayFailed=()=>{$('resumeAudio').classList.remove('hidden');toast('Tekan Dengar semula untuk membenarkan audio.');};
  toast('Suara tersambung. Mikrofon masih tutup; tekan Mikrofon untuk bercakap.');
 }catch(e){if(epoch===V.epoch){V.error=voiceError(e);await disconnectVoice(false);toast(V.error);}}
 finally{if(epoch===V.epoch){V.connecting=false;renderVoice();}}
}
function voiceError(e){const t=String(e.message||e);if(/NOT_ALLOWED|PERMISSION|NotAllowedError/i.test(t))return 'Akses mikrofon ditolak. Benarkan mikrofon untuk laman ini dalam pelayar.';
 if(/INVALID_TOKEN|TOKEN_EXPIRED|INVALID_APP_ID/i.test(t))return 'Sambungan suara tidak dapat disahkan. Hubungi pengendali kelas.';
 return t;}
async function renewVoiceToken(){if(!V.client||V.renewing)return;V.renewing=true;try{const token=await request('voiceToken');if(V.client){await V.client.renewToken(token.token);V.expires=token.expires;}}finally{V.renewing=false;}}
async function muteMicrophone(mute){if(V.busy)return;V.busy=true;renderVoice();
 try{if(!mute&&S.role==='student'&&S.room?.micsLocked)throw new Error('Guru sedang mengunci mikrofon murid.');
  if(!mute&&!V.mic){V.mic=await AgoraRTC.createMicrophoneAudioTrack({encoderConfig:'speech_standard'});
    try{await V.client.publish(V.mic);}catch(e){V.mic.close();V.mic=null;throw e;}}
  if(V.mic)await V.mic.setEnabled(!mute);V.muted=mute;
 }catch(e){throw new Error(voiceError(e));}finally{V.busy=false;renderVoice();}}
async function disconnectVoice(clearError=true){V.epoch++;V.connecting=false;V.connected=false;V.busy=false;
 if(V.screen){try{V.screen.close();}catch(e){}V.screen=null;}
 if(V.mic){try{V.mic.close();}catch(e){}V.mic=null;}
 const client=V.client;V.client=null;if(client){try{await client.leave();}catch(e){}}
 V.remoteScreen=null;V.remoteScreenUid=null;V.muted=true;V.expires=0;if(clearError)V.error='';renderVoice();updatePresentationSurface();}
function screenPresent(){return !!(V.screen||V.remoteScreen);}
async function toggleScreenShare(){if(!V.connected){toast('Sambung suara dahulu.');return;}if(S.role!=='teacher')return;
 if(V.screen){await stopScreenShare();return;}
 if(!navigator.mediaDevices?.getDisplayMedia){toast('Perkongsian skrin tidak disokong pada peranti ini. Gunakan PDF.');return;}
 V.busy=true;renderVoice();
 try{const track=await AgoraRTC.createScreenVideoTrack({encoderConfig:'720p_1'},'disable');V.screen=Array.isArray(track)?track[0]:track;
  V.screen.on('track-ended',()=>stopScreenShare().catch(e=>toast(e.message)));await V.client.publish(V.screen);openPresentation();toast('Skrin dikongsi. Penggunaan ini melibatkan kuota video Agora.');
 }catch(e){if(V.screen){V.screen.close();V.screen=null;}if(!/cancel|denied|notallowed/i.test(String(e.message)))toast(voiceError(e));}
 finally{V.busy=false;renderVoice();}}
async function stopScreenShare(){const track=V.screen;if(!track)return;V.screen=null;try{if(V.client)await V.client.unpublish(track);}finally{track.close();renderVoice();updatePresentationSurface();}}
$('joinVoice').onclick=()=>connectVoice();
$('toggleMic').onclick=()=>muteMicrophone(!V.muted).catch(e=>toast(e.message));
$('leaveVoice').onclick=()=>disconnectVoice().then(()=>toast('Suara diputuskan. Anda masih berada dalam kelas.'));
$('shareScreen').onclick=()=>toggleScreenShare();
$('resumeAudio').onclick=()=>{V.client?.remoteUsers.forEach(u=>u.audioTrack?.play());$('resumeAudio').classList.add('hidden');};
window.addEventListener('pagehide',()=>{V.mic?.close();V.screen?.close();});
