// zzfxm.js — ZzFXM風の極小WebAudioシーケンサ。
// パターン配列をlookaheadで鳴らす軽量BGM用。外部音源なし。
(function(){
  'use strict';

  let ctx=null, master=null, state=null, resumeName=null, unlocked=false;
  let volume=0.55, muted=false;
  const AHEAD=0.30, TICK=100;
  const SEMI={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  let noiseBuf=null;

  function ac(){
    if(ctx) return ctx;
    try{
      ctx=new (window.AudioContext||window.webkitAudioContext)();
      master=ctx.createGain();
      master.gain.value=muted?0:volume;
      master.connect(ctx.destination);
    }catch(e){}
    return ctx;
  }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function freq(n){
    if(!n||n==='-'||n==='R') return 0;
    const m=String(n).match(/^([A-G])([#b]?)(-?\d)$/);
    if(!m) return 0;
    let s=SEMI[m[1]];
    if(m[2]==='#') s++; else if(m[2]==='b') s--;
    const midi=(+m[3]+1)*12+s;
    return 440*Math.pow(2,(midi-69)/12);
  }
  function makeNoise(){
    const C=ac(); if(!C) return null;
    if(noiseBuf) return noiseBuf;
    noiseBuf=C.createBuffer(1,C.sampleRate,C.sampleRate);
    const d=noiseBuf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return noiseBuf;
  }
  function envGain(g,t,d,gain,a,r){
    a=a==null?0.008:a; r=r==null?0.08:r;
    const end=t+Math.max(0.02,d);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(gain,t+a);
    g.gain.setValueAtTime(gain,Math.max(t+a,end-r));
    g.gain.linearRampToValueAtTime(0,end);
  }
  function connectChain(src,track,t,d,gain){
    const C=ac(), g=C.createGain();
    envGain(g,t,d,gain,track.a,track.r);
    let node=src;
    if(track.filter){
      const f=C.createBiquadFilter();
      f.type=track.filter.type||'lowpass';
      f.frequency.value=track.filter.freq||1200;
      f.Q.value=track.filter.q||0.7;
      node.connect(f); node=f;
    }
    node.connect(g);
    g.connect(state.gain);
  }
  function scheduleNoise(track,t,d,gain){
    const C=ac(), b=makeNoise(); if(!C||!b)return;
    const src=C.createBufferSource(); src.buffer=b;
    src.playbackRate.value=track.rate||1;
    connectChain(src,track,t,d,gain);
    src.start(t);
    src.stop(t+d+0.04);
    state.sources.push(src);
  }
  function scheduleTone(track,cell,t,step){
    if(!cell) return;
    const obj=(typeof cell==='string')?{n:cell}:cell;
    if(obj.n==='-'||obj.n==='R') return;
    const C=ac(), hz=freq(obj.n), len=(obj.d||track.d||1)*step;
    const gain=(track.gain==null?0.08:track.gain)*(obj.g==null?1:obj.g);
    const kind=obj.w||track.wave||'triangle';
    const dur=Math.max(0.025,len*(track.hold==null?0.88:track.hold));
    if(kind==='noise'||kind==='hat'||kind==='snare'||kind==='gong'){
      const nt=Object.assign({},track);
      if(kind==='hat') nt.filter={type:'highpass',freq:6500,q:0.5};
      if(kind==='snare') nt.filter={type:'bandpass',freq:1500,q:1.2};
      if(kind==='gong') nt.filter={type:'lowpass',freq:520,q:0.9};
      scheduleNoise(nt,t,Math.min(dur,obj.noiseDur||track.noiseDur||0.18),gain);
      if(kind==='gong'&&C){
        const osc=C.createOscillator();
        osc.type='sine'; osc.frequency.setValueAtTime(hz||96,t);
        connectChain(osc,Object.assign({},track,{a:0.004,r:0.55}),t,Math.max(0.45,dur),gain*0.75);
        osc.start(t); osc.stop(t+Math.max(0.48,dur)+0.04); state.sources.push(osc);
      }
      return;
    }
    if(!hz||!C) return;
    const osc=C.createOscillator();
    osc.type=kind;
    osc.frequency.setValueAtTime(hz,t);
    if(obj.slide){
      osc.frequency.linearRampToValueAtTime(hz*Math.pow(2,obj.slide/12),t+dur);
    }
    connectChain(osc,track,t,dur,gain);
    osc.start(t);
    osc.stop(t+dur+0.04);
    state.sources.push(osc);
  }
  function songLen(song){
    if(song.len) return song.len;
    return Math.max(1,...(song.tracks||[]).map(t=>(t.seq||[]).length));
  }
  function scheduleStep(){
    if(!state||!state.song)return;
    const song=state.song, tracks=song.tracks||[], idx=state.idx, step=60/(song.bpm||120)/(song.stepsPerBeat||4);
    for(const tr of tracks){
      const seq=tr.seq||[];
      const cell=song.loop?seq[idx%seq.length]:seq[idx];
      scheduleTone(tr,cell,state.next,step);
    }
    state.idx++;
    state.next+=step;
    if(state.idx>=state.len){
      if(song.loop) state.idx=0;
      else state.ending=true;
    }
  }
  function tick(){
    if(!state||!state.song)return;
    const C=ac(); if(!C)return;
    while(state.next<C.currentTime+AHEAD && !state.ending) scheduleStep();
    if(state.ending && C.currentTime>state.next+0.45) stopCurrent(0.12);
  }
  function stopCurrent(fade){
    const old=state;
    if(!old) return;
    clearInterval(old.timer);
    const C=ac(), now=C?C.currentTime:0, f=fade==null?0.16:fade;
    old.sources.forEach(s=>{ try{s.stop(now+f+0.04);}catch(e){} });
    if(C&&old.gain){
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value,now);
      old.gain.gain.linearRampToValueAtTime(0,now+f);
      setTimeout(()=>{ try{old.gain.disconnect();}catch(e){} },Math.ceil((f+0.08)*1000));
    }
    if(state===old) state=null;
  }
  function start(name,fade){
    const C=ac(); if(!C||!window.MUSIC) return;
    const song=typeof name==='string'?window.MUSIC[name]:name;
    const id=typeof name==='string'?name:(song&&song.id)||'custom';
    if(!song) return;
    resumeName=id;
    if(muted||volume<=0||document.hidden) return;
    if(ctx.state==='suspended') ctx.resume();
    if(state&&state.name===id&&!state.ending) return;
    stopCurrent(fade==null?0.18:fade);
    const g=C.createGain();
    g.gain.value=0;
    g.connect(master);
    const now=C.currentTime;
    g.gain.linearRampToValueAtTime(1,now+(fade==null?0.18:fade));
    state={name:id,song,gain:g,sources:[],idx:0,next:now+0.04,len:songLen(song),timer:0,ending:false};
    state.timer=setInterval(tick,TICK);
    tick();
  }
  function setVolume(v){
    volume=clamp((+v||0)/100,0,1);
    const C=ac(); if(master&&C){
      master.gain.cancelScheduledValues(C.currentTime);
      master.gain.linearRampToValueAtTime(muted?0:volume,C.currentTime+0.05);
    }
    if(!muted&&volume>0&&resumeName&&!state) start(resumeName,0.08);
  }
  function setMuted(v){
    muted=!!v;
    const C=ac(); if(master&&C) master.gain.linearRampToValueAtTime(muted?0:volume,C.currentTime+0.05);
    if(muted) stopCurrent(0.08);
    else if(resumeName&&volume>0) start(resumeName,0.08);
  }
  function unlock(){
    if(unlocked)return;
    const C=ac();
    if(C&&C.state==='suspended') C.resume();
    unlocked=true;
    if(resumeName&&!muted&&volume>0&&!state) start(resumeName,0.08);
  }
  ['pointerdown','touchstart','keydown','click'].forEach(ev=>addEventListener(ev,unlock,{passive:true}));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){ if(state) resumeName=state.name; stopCurrent(0.04); }
    else if(resumeName&&!muted&&volume>0) start(resumeName,0.08);
  });

  window.ZzFXM=window.BGM={
    play:start,
    stop(){ resumeName=null; stopCurrent(0.18); },
    setVolume,
    getVolume(){ return Math.round(volume*100); },
    setMuted,
    isMuted(){ return muted; },
    current(){ return state&&state.name; },
  };
})();
