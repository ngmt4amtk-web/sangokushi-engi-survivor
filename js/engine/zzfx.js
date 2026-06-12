// zzfx.js — ZzFXMicro (Zuper Zmall Zound Zynth, MIT / Frank Force) ＋ 演義版SFXラッパー
// 外部素材なしで手続き的に効果音を合成。window.SFX.play(name) で再生。
(function(){
  let zzfxV=0.30;            // マスター音量
  const zzfxR=44100;        // サンプルレート
  let ctx=null;
  function ac(){ if(!ctx){ try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return ctx; }

  // ── ZzFXMicro 波形生成 ─────────────────────────
  function zzfxG(volume=1,randomness=.05,frequency=220,attack=0,sustain=0,release=.1,shape=0,shapeCurve=1,
    slide=0,deltaSlide=0,pitchJump=0,pitchJumpTime=0,repeatTime=0,noise=0,modulation=0,bitCrush=0,
    delay=0,sustainVolume=1,decay=0,tremolo=0){
    let PI2=Math.PI*2, sign=v=>v>0?1:-1,
      startSlide=slide*=500*PI2/zzfxR/zzfxR,
      startFrequency=frequency*=(1+randomness*2*Math.random()-randomness)*PI2/zzfxR,
      b=[], t=0, tm=0, i=0, j=1, r=0, c=0, s=0, f, length;
    attack=attack*zzfxR+9; decay*=zzfxR; sustain*=zzfxR; release*=zzfxR; delay*=zzfxR;
    deltaSlide*=500*PI2/zzfxR**3; modulation*=PI2/zzfxR; pitchJump*=PI2/zzfxR; pitchJumpTime*=zzfxR;
    repeatTime=repeatTime*zzfxR|0;
    for(length=attack+decay+sustain+release+delay|0; i<length; b[i++]=s){
      if(!(++c%(bitCrush*100|0))){
        s = shape? shape>1? shape>2? shape>3?
          Math.sin((t%PI2)**3) :
          Math.max(Math.min(Math.tan(t),1),-1):
          1-(2*t/PI2%2+2)%2:
          1-4*Math.abs(Math.round(t/PI2)-t/PI2):
          Math.sin(t);
        s = (repeatTime? 1-tremolo+tremolo*Math.sin(PI2*i/repeatTime) : 1) *
          sign(s)*(Math.abs(s)**shapeCurve) * volume * zzfxV * (
          i<attack? i/attack :
          i<attack+decay? 1-((i-attack)/decay)*(1-sustainVolume) :
          i<attack+decay+sustain? sustainVolume :
          i<length-delay? (length-i-delay)/release*sustainVolume : 0);
        s = delay? s/2+(delay>i?0:(i<length-delay?1:(length-i)/delay)*b[i-delay|0]/2) : s;
      }
      f=(frequency+=slide+=deltaSlide)*Math.cos(modulation*tm++);
      t+=f-f*noise*(1-(Math.sin(i)+1)*1e9%2);
      if(j&&++j>pitchJumpTime){ frequency+=pitchJump; startFrequency+=pitchJump; j=0; }
      if(repeatTime&&!(++r%repeatTime)){ frequency=startFrequency; slide=startSlide; j=j||1; }
    }
    return b;
  }
  function zzfxPlay(samples){ const C=ac(); if(!C)return; const buf=C.createBuffer(1,samples.length,zzfxR);
    buf.getChannelData(0).set(samples); const src=C.createBufferSource(); src.buffer=buf; src.connect(C.destination); src.start(); }
  function zzfx(){ try{ zzfxPlay(zzfxG.apply(null,arguments)); }catch(e){} }

  // ── 効果音プリセット(ZzFXパラメータ) ───────────
  const SND={
    xp:      [.7,.05,1675,,.02,.05,,1.6,,,420,.05],          // 経験値取得=軽いコイン
    kill:    [.8,.1,180,.01,.02,.07,4,1.4,,,,,,1.1,,.2],     // 雑魚撃破=小クランチ
    crit:    [1.4,.05,540,,.02,.09,1,2.1,,,,,,.4,,.1],       // 会心=鋭い
    hurt:    [1.3,.08,110,.02,.04,.18,1,1.4,-3,,,,,1.6],     // 被弾=鈍い衝撃
    levelup: [1.2,.05,539,0,.05,.28,1,1.9,,,210,.05,.03,,,,.04], // Lvアップ=上昇
    evolve:  [1.4,.05,420,.02,.1,.4,1,1.8,,,320,.07,.06,,,,.05],  // 進化
    kizuna:  [1.6,.05,200,.05,.2,.5,1,1.6,,,460,.09,.12,,,.1],    // 縁合体=最豪華
    bossIn:  [1.4,.1,70,.1,.25,.5,1,.9,,,,,.2,1],            // ボス出現=不穏な低音
    bossDead:[1.6,.1,420,.02,.2,.8,4,1.4,-3,.5,,,,1.4,,.3,,.6],  // ボス撃破=爆発
    death:   [1.2,.05,300,.05,.18,.4,1,1,-8,,,,,1.5],        // 死亡=下降
    gacha:   [1.1,.05,330,.03,.1,.3,1,1.7,,,260,.05,.05,,,,.05], // ガチャ排出
  };

  // ── 間引き(survivorは秒間数百イベント=飽和すると無音同義) ──
  const last={}; const MIN={xp:55,kill:38,crit:60,hurt:130,levelup:0,evolve:0,kizuna:0,bossIn:0,bossDead:0,death:0,gacha:90};
  let muted=false, unlocked=false;
  function now(){ try{return performance.now();}catch(e){return Date.now();} }
  function play(name){
    if(muted||!SND[name])return;
    const t=now(), m=MIN[name]||0;
    if(m && last[name] && t-last[name]<m) return;
    last[name]=t;
    zzfx.apply(null,SND[name]);
  }
  // モバイルautoplayロック解除(初回ジェスチャ)
  function unlock(){ if(unlocked)return; const C=ac(); if(C&&C.state==='suspended')C.resume(); unlocked=true; }
  ['pointerdown','touchstart','keydown','click'].forEach(ev=>addEventListener(ev,unlock,{passive:true}));

  window.SFX={
    play,
    setMuted(v){ muted=!!v; },
    isMuted(){ return muted; },
    toggle(){ muted=!muted; return muted; },
    setVolume(v){ zzfxV=Math.max(0,Math.min(1,v)); },
    getVolume(){ return zzfxV; },
  };
})();
