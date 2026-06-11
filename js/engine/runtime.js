// runtime.js — ゲーム本体ランタイム。ループ/エンティティ/スポーン/当たり/XP/描画/ボス。
// 共有名前空間 G に状態(R)とヘルパを置き、weapons.js から呼ぶ。
window.G = window.G || {};
(function(){
const G = window.G;

// ── テンポ・ビルド喜び調整定数 ────────────────
// ここを変えるだけでゲーム全体のテンポが変わる。
const PACE = {
  spawnRateMul:  1.5,   // 敵スポーンレート倍率(全体)
  spawnEarlyFloor: 1.0, // 開幕60秒の最低レート底上げ(この値以下にならない)
  xpMul:         1.2,   // XP獲得倍率(武将を速く解放=ビルドの喜び)
  playerMoveMul: 1.08,  // プレイヤー移動速度倍率
  heroDrawMul:   0.88,  // 主役スプライト表示倍率(縮小)
  enemyDrawMul:  0.88,  // 敵スプライト表示倍率(縮小)
};
G.PACE = PACE;

// ── 乱数・数学 ─────────────────────────────
const rnd = (a=1,b=null)=> b===null ? Math.random()*a : a+Math.random()*(b-a);
const rint = (a,b)=> Math.floor(rnd(a,b+1));
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const TAU=Math.PI*2;
G.rnd=rnd; G.rint=rint; G.clamp=clamp;

// ── 入力 ───────────────────────────────────
const keys={};
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true; if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase()))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
// タッチ仮想スティック
const touch={active:false,bx:0,by:0,dx:0,dy:0};
function bindTouch(canvas){
  const find=e=>{for(const t of e.changedTouches){if(t.identifier===touch.id)return t;}return null;};
  const reset=()=>{touch.active=false;touch.dx=0;touch.dy=0;};
  canvas.addEventListener('touchstart',e=>{if(touch.active)return;const t=e.changedTouches[0];touch.active=true;touch.id=t.identifier;touch.bx=t.clientX;touch.by=t.clientY;touch.dx=0;touch.dy=0;},{passive:true});
  canvas.addEventListener('touchmove',e=>{if(!touch.active)return;const t=find(e);if(!t)return;let dx=t.clientX-touch.bx,dy=t.clientY-touch.by;const m=Math.hypot(dx,dy)||1;const cap=Math.min(m,46);touch.dx=dx/m*cap/46;touch.dy=dy/m*cap/46;e.preventDefault();},{passive:false});
  canvas.addEventListener('touchend',e=>{if(find(e))reset();},{passive:true});
  canvas.addEventListener('touchcancel',reset,{passive:true}); // iOSの割り込みでスティック固着→暴走を防ぐ
}
G.bindTouch=bindTouch; G.touch=touch;

// ── キャンバス ─────────────────────────────
let canvas,ctx,CW,CH,DPR;
function setupCanvas(cv){
  canvas=cv; ctx=cv.getContext('2d'); resize(); addEventListener('resize',resize); bindTouch(cv);
  // 非アクティブ時は自動ポーズ(復帰時の事故を防ぐ)
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){ if(R&&R.running&&!R.over&&!R.paused){ R.paused=true; G.onAutoPause&&G.onAutoPause(); } }
    else { last=performance.now(); }
  });
}
function resize(){
  DPR=Math.min(devicePixelRatio||1,2);
  CW=innerWidth; CH=innerHeight;
  canvas.width=CW*DPR; canvas.height=CH*DPR; canvas.style.width=CW+'px'; canvas.style.height=CH+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.imageSmoothingEnabled=false;
}
G.setupCanvas=setupCanvas;

// ── ラン状態 ───────────────────────────────
let R=null; G.getR=()=>R;

// 難易度倍率(敵hp/敵dmg/獲得xp)。爽快重視で既定はふつう。
// 難易度=敵の硬さ(ehp)・攻撃力(edmg)・遠隔の量(ranged=弓/術者の出現比)で制御。敵の"数"は難易度に依らず常にワラワラ。
const DIFF={ easy:{ehp:0.60,edmg:0.55,ranged:0.45,xp:1.25}, normal:{ehp:1,edmg:1,ranged:1,xp:1}, hard:{ehp:1.75,edmg:1.55,ranged:2.1,xp:0.9} };
function startRun(opts){
  const lord=opts.lord, stage=opts.stage, owned=opts.owned, save=opts.save;
  const diff=DIFF[opts.difficulty]||DIFF.normal;
  R={
    t:0, running:true, paused:false, over:false, victory:false,
    lord, stage, save, diff,
    meta:(opts.save&&opts.save.meta)||{gold:0,upg:{}}, revives:0, curse:opts.curse||0,
    cam:{x:0,y:0},
    player:{x:0,y:0,hp:0,maxHp:0,move:1,magnet:1,facing:{x:1,y:0},ifr:0,
            level:1,xp:0,xpNext:5,gold:0,kills:0,goldFrac:0},
    weapons:[], passives:{},
    enemies:[], eproj:[], proj:[], swings:[], novas:[], dashes:[], zones:[], minions:[], gems:[], texts:[], parts:[], jars:[],
    ultActs:[], ultFx:[],
    spawnAcc:0, eliteIdx:0, boss:null, bossWarned:false, jarT:rnd(12,18),
    scene:(opts.scene||null),   // 章のシーン{kind:'sweep|survive|doom', dur, last, deathLine, epitaph}。無ければ従来の単発バトル
    // sweep=従来(durでボス→撃破で勝利) / survive=dur生存で勝利(ボス無し) / doom=dur or HP0で強制死(章は進む)
    nextBossT: (opts.scene? (opts.scene.kind==='sweep'?opts.scene.dur:1e9) : (stage.endless? 300:stage.dur)),
    grid:new Map(), GRID:72,
    buffs:{}, uid:1,
    flash:0, shake:0, timeScale:1, doomFx:null,
  };
  // 開幕武将: 君主自身の武将を装備(所持扱い)。号令(aura)君主は攻撃手段の開幕武将も追加で持つ
  const equipStart=(name)=>{ const g=window.GENERALS.find(x=>x.name===name); if(g)addWeapon(g); return g; };
  const selfGen=equipStart(lord.start);
  const extraGen=lord.startExtra? equipStart(lord.startExtra):null;
  // 弱い開幕武将ほど高Lv始動で君主間の序盤格差を均す(攻撃する武器に適用。auraは攻撃しないのでextraが攻撃手)
  const atkGen=extraGen||selfGen;
  if(atkGen){ const w=R.weapons.find(x=>x.gen.id===atkGen.id); if(w){ const pw=atkGen.stat.pwr; w.level= pw<4?4:(pw<6?3:2); } }
  const ultGen=selfGen||atkGen||window.GENERALS.find(g=>g.name===lord.start)||window.GENERALS[0];
  const ultMax=(window.ULTS&&window.ULTS.MAX)||70;
  R.ult={gen:ultGen,def:(window.ULTS&&window.ULTS.forGeneral)?window.ULTS.forGeneral(ultGen):null,
    gauge:(opts.scene&&opts.scene.kind==='doom')?ultMax*0.5:0,max:ultMax,auto:!!(save&&save.opts&&save.opts.autoUlt),
    fullCutin:false,casting:false,moveMul:1,heartBeat:0};
  // 恒久メタ進行: 初期武器Lv / 復活回数
  R.revives=(R.meta.upg.revive)||0;
  const _il=(R.meta.upg.initlv)||0; if(_il) for(const w of R.weapons) w.level=Math.min(window.WLEVEL.MAX,w.level+_il);
  // バフ初期化 → 最大HP確定
  recomputeBuffs();
  R.player.maxHp=Math.round(lord.baseHp*(1+(R.buffs.hp||0)));
  R.player.hp=R.player.maxHp;
  G.onHud&&G.onHud();
  loopStart();
  return R;
}
G.startRun=startRun;

function addWeapon(gen){
  if(R.weapons.length>=6) return false;
  if(R.weapons.some(w=>w.gen.id===gen.id)) return false;
  const dup=(R.save&&R.save.owned&&R.save.owned[gen.id])? (R.save.owned[gen.id]-1):0;
  R.weapons.push({gen, level:1, cd:0, ang:rnd(TAU), uid:R.uid++, evo:null, dupMul:1+Math.min(dup,window.GACHA.dupMax)*window.GACHA.dupBonus, tickMap:new Map()});
  checkEvolve(); checkFusion();
  return true;
}
function addPassive(id){
  R.passives[id]=(R.passives[id]||0)+1; recomputeBuffs(); checkEvolve();
}
G.addWeapon=addWeapon; G.addPassive=addPassive;

// ── バフ集計(君主+兵法+号令武将) ───────────
function recomputeBuffs(){
  const b={dmg:0,area:0,cd:0,move:0,hp:0,regen:0,xp:0,gold:0,crit:0,critDmg:0,pierce:0,duration:0,magnet:0,amount:0,dr:0,
           tacticDmg:0,tacticArea:0,thorns:0};
  const lb=R.lord.buff||{};
  for(const k in lb) b[k]=(b[k]||0)+lb[k];
  for(const id in R.passives){
    const p=window.PASSIVE_BY_ID[id]; if(!p)continue;
    const e=p.eff(R.passives[id]);
    for(const k in e) b[k]=(b[k]||0)+e[k];
  }
  // 号令(aura)武将の寄与
  for(const w of R.weapons){
    if(w.gen.weapon!=='aura')continue;
    const base=window.WBASE.aura, gs=w.gen.stat;
    const evo=w.evo? w.evo.mul : {};  // 汎用進化(EVOLUTIONSに名前が無い)でも壊れないよう w.evo を直接参照
    const scale=gs.pwr/6 * window.WLEVEL.dmgMul(w.level)*w.dupMul;
    b.dmg += (base.buffDmg*(evo.buffDmg||1))*scale;
    b.area+= (base.buffArea*(evo.buffArea||1))*scale;
    b.cd  += (base.buffCd*(evo.buffCd||1))*scale;
  }
  // 縁(未合体・全員装備中)の teaser バフ
  if(window.KIZUNA){ for(const kz of window.KIZUNA){
    if(R.fusedKizuna&&R.fusedKizuna.has(kz.id))continue;
    if(kz.members.every(id=>R.weapons.some(w=>w.gen.id===id))){ for(const k in kz.teaser) b[k]=(b[k]||0)+kz.teaser[k]; }
  } }
  // 融合武将のオーラ(元君主バフを内蔵)
  for(const w of R.weapons){ if(w.fuseAura){ for(const k in w.fuseAura) b[k]=(b[k]||0)+w.fuseAura[k]; } }
  // 恒久メタ進行(軍功で買った永続強化)を積算層に1段加える
  const _mu=(R.meta&&R.meta.upg)||{};
  b.hp+=(_mu.hp||0)*0.08; b.dmg+=(_mu.dmg||0)*0.06; b.move+=(_mu.move||0)*0.04;
  b.magnet+=(_mu.magnet||0)*0.12; b.xp+=(_mu.xp||0)*0.07; b.cd+=(_mu.cd||0)*0.04; b.crit+=(_mu.crit||0)*0.03;
  R.buffs=b;
  // 最大HP更新(増分のみ反映、現在HPは比率維持)
  if(R.player.maxHp){
    const nm=Math.round(R.lord.baseHp*(1+(b.hp||0)));
    const ratio=R.player.hp/R.player.maxHp;
    R.player.maxHp=nm; R.player.hp=Math.min(nm, Math.max(1,Math.round(nm*ratio)));
  }
}
G.recomputeBuffs=recomputeBuffs;

// ── 進化チェック ───────────────────────────
function checkEvolve(){
  for(const w of R.weapons){
    if(w.evo||w.gen.fused)continue;  // 融合武将は進化対象外
    const ev=window.evoFor(w.gen); if(!ev)continue;  // 固有優先・無ければ武器系統の汎用進化
    if(w.level>=window.WLEVEL.MAX && (R.passives[ev.need]||0)>=ev.needLv){
      w.evo=ev;
      if(ev.generic){ pushText(R.player.x,R.player.y-40,ev.name,'#9ad',1.2,20); }                 // 汎用=控えめ(フラッシュなし)
      else { pushText(R.player.x,R.player.y-40,'⚡'+ev.name+'!','#ffd54f',1.6,28); R.flash=0.5; R.hitstop=Math.max(R.hitstop||0,.06); window.SFX&&SFX.play('evolve'); }  // 固有=花形
    }
  }
}
G.checkEvolve=checkEvolve;

// ── 縁→合体 ───────────────────────────────
function kizunaEquipped(kz){ return kz.members.every(id=>R.weapons.some(w=>w.gen.id===id)); }
// teaser発動中(全員装備・未合体)の縁一覧(UI用)
function kizunaActiveList(){ if(!window.KIZUNA)return [];
  return window.KIZUNA.filter(kz=> !(R.fusedKizuna&&R.fusedKizuna.has(kz.id)) && kizunaEquipped(kz)); }
G.kizunaActiveList=kizunaActiveList;
// genが属する未合体の縁と達成状況(レベルアップカードのヒント用)
function kizunaForGen(genId){ if(!window.KIZUNA)return [];
  const eq=R.weapons.map(w=>w.gen.id), out=[];
  for(const kz of window.KIZUNA){ if(R.fusedKizuna&&R.fusedKizuna.has(kz.id))continue;
    if(!kz.members.includes(genId))continue;
    const missing=kz.members.filter(id=>!eq.includes(id)).map(id=>{const g=window.GENERALS.find(x=>x.id===id);return g?g.name:id;});
    const maxed=kz.members.every(id=>{const w=R.weapons.find(x=>x.gen.id===id);return w&&w.level>=window.WLEVEL.MAX;});
    out.push({kz, all:missing.length===0, missing, maxed});
  }
  return out;
}
G.kizunaForGen=kizunaForGen;
// 全員装備かつ全員Lv MAXの縁を融合させる
function checkFusion(){ if(!window.KIZUNA)return; R.fusedKizuna=R.fusedKizuna||new Set();
  for(const kz of window.KIZUNA){ if(R.fusedKizuna.has(kz.id))continue;
    const ws=kz.members.map(id=>R.weapons.find(w=>w.gen.id===id));
    if(ws.some(w=>!w))continue;                          // 全員装備していない
    if(ws.some(w=>w.level<window.WLEVEL.MAX))continue;    // 全員Lv MAXでない
    fuseKizuna(kz,ws);
  }
}
G.checkFusion=checkFusion;
function fuseKizuna(kz,ws){
  const lead=window.GENERALS.find(g=>g.id===kz.lead);
  const memberUids=new Set(ws.map(w=>w.uid));
  R.weapons=R.weapons.filter(w=>!memberUids.has(w.uid));  // メンバー武器を消費
  const fg={ id:1000+window.KIZUNA.indexOf(kz), name:kz.fusedName, weapon:lead.weapon,
    weaponName:lead.weaponName, faction:lead.faction, stat:Object.assign({},lead.stat),
    rarity:6, skill:kz.name, skillDesc:kz.fuseDesc, scores:lead.scores, hist:kz.sub,
    fused:true, fromKizuna:kz.id };
  R.weapons.push({ gen:fg, level:window.WLEVEL.MAX, cd:0, ang:rnd(TAU), uid:R.uid++,
    evo:null, dupMul:1, tickMap:new Map(), fuseMul:kz.fuseMul*1.35, fuseAura:kz.aura||{} });  // ×1.35=合体武器の全体強化ノブ
  R.fusedKizuna.add(kz.id);
  R.fusedConsumed=R.fusedConsumed||new Set();
  kz.members.forEach(id=>R.fusedConsumed.add(id));        // 消費メンバーは再ドラフト不可
  pushText(R.player.x,R.player.y-52,'⚔ '+kz.fusedName+' 合体！','#ffd54f',2.1,32);
  R.flash=0.85; R.shake=0.7; R.hitstop=Math.max(R.hitstop||0,.09); window.SFX&&SFX.play('kizuna'); pushPart(R.player.x,R.player.y,'#ffd54f',44,280);
  recomputeBuffs();
  G.onKizunaFuse&&G.onKizunaFuse(kz);
}

// ── エンティティ生成ヘルパ(weapons.jsから使用) ─
function pushText(x,y,s,col,scl,size){ if(R.texts.length>130)return; R.texts.push({x,y,s,col,scl:scl||1,size:size||16,life:0.9,vy:-34});}
G.pushText=pushText;
function pushPart(x,y,col,n,spd){ if(R.parts.length>320)return; for(let i=0;i<n;i++){const a=rnd(TAU),v=rnd(spd*0.3,spd);R.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(0.25,0.6),col,r:rnd(1.5,3.2)});}}
G.pushPart=pushPart;

// ── 必殺技 ─────────────────────────────────
function chargeUlt(n){
  if(!R||!R.ult||R.over)return;
  R.ult.gauge=clamp((R.ult.gauge||0)+n,0,R.ult.max||70);
  if(R.ult.auto&&R.ult.gauge>=R.ult.max&&!R.ult.casting) triggerUlt();
  G.onHud&&G.onHud();
}
G.chargeUlt=chargeUlt;
function setAutoUlt(v){ if(R&&R.ult)R.ult.auto=!!v; }
G.setAutoUlt=setAutoUlt;
function triggerUlt(){
  if(!R||!R.ult||R.over||!R.running||R.paused||R.ult.casting)return false;
  const u=R.ult, def=u.def||((window.ULTS&&window.ULTS.forGeneral)?window.ULTS.forGeneral(u.gen):null);
  if(!def||u.gauge<u.max)return false;
  u.gauge=0; u.casting=true; u.def=def;
  const full=!u.fullCutin; u.fullCutin=true;
  playUltCutin(u.gen,def,full);
  R.hitstop=Math.max(R.hitstop||0,0.45);
  const run=R;
  setTimeout(()=>{ if(R!==run||!R||R.over)return; executeUlt(def,u.gen); u.casting=false; G.onHud&&G.onHud(); },450);
  G.onHud&&G.onHud();
  return true;
}
G.triggerUlt=triggerUlt;
function playUltCutin(gen,def,full){
  const ov=document.getElementById('ultcutin'); if(!ov)return;
  ov.className='ultcutin show '+(full?'full':'mini');
  ov.innerHTML=`<div class="uc-band"><div class="uc-title"></div><div class="uc-quote"></div></div>`;
  const title=ov.querySelector('.uc-title'), quote=ov.querySelector('.uc-quote');
  title.textContent=def.name||'奥義';
  quote.textContent=def.quote||'';
  if(full){
    const bust=document.createElement('canvas'); bust.width=28; bust.height=28; bust.className='uc-bust';
    const bx=bust.getContext('2d'); bx.imageSmoothingEnabled=false;
    try{ bx.drawImage(window.Sprites.general(gen),0,0); }catch(e){}
    ov.insertBefore(bust,ov.firstChild);
  }
  window.SFX&&SFX.play('evolve');
  clearTimeout(ov._tm);
  ov._tm=setTimeout(()=>{ ov.className='ultcutin'; ov.innerHTML=''; },full?820:520);
}

// ── 当たり判定クエリ(空間グリッド) ─────────
function rebuildGrid(){
  R.grid.clear(); const gs=R.GRID;
  for(const e of R.enemies){ if(e.dead)continue; const k=((e.x/gs)|0)+'_'+((e.y/gs)|0); let a=R.grid.get(k); if(!a){a=[];R.grid.set(k,a);} a.push(e); }
}
function forEachNear(x,y,r,fn){
  const gs=R.GRID, x0=((x-r)/gs|0),x1=((x+r)/gs|0),y0=((y-r)/gs|0),y1=((y+r)/gs|0);
  for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++){const a=R.grid.get(gx+'_'+gy);if(a)for(const e of a)fn(e);}
}
G.forEachNear=forEachNear;
function nearestEnemy(x,y,maxR){
  let best=null,bd=maxR?maxR*maxR:Infinity;
  // ボス優先しすぎないよう通常敵含め最寄り
  forEachNear(x,y,maxR||520,e=>{if(e.dead)return;const d=dist2(x,y,e.x,e.y);if(d<bd){bd=d;best=e;}});
  if(!best && R.boss && !R.boss.dead){best=R.boss;}
  return best;
}
G.nearestEnemy=nearestEnemy;

function ultHue(gen){ const b=gen&&window.WBASE&&window.WBASE[gen.weapon]; return (b&&b.hue!=null)?b.hue:([0,212,140,35][(gen&&gen.faction)||0]||44); }
function ultWeapon(gen){ return (R.weapons.find(w=>gen&&w.gen.id===gen.id)||R.weapons.find(w=>w.gen.name===R.lord.start)||R.weapons[0]); }
function ultDamage(gen,params){
  params=params||{};
  const w=ultWeapon(gen), sec=params.seconds||7;
  let dps=10+R.player.level*1.8;
  if(w&&G.Weapons&&G.Weapons.effStats){
    const E=G.Weapons.effStats(w,R), cd=Math.max(0.18,E.cd||E.tick||0.5);
    if(E.kind==='orbit') dps=E.dmg*Math.max(1,E.amount)/0.45;
    else if(E.kind==='field'||E.kind==='zone') dps=E.dmg*Math.max(1,E.amount)/(E.tick||0.45);
    else if(E.kind==='buff') dps=10+R.player.level*2+(w.gen.stat.pwr||1)*4;
    else dps=E.dmg*Math.max(1,E.amount)/cd;
  }
  return Math.max(24+R.player.level*2.5,dps*sec);
}
function enemyAngleFromPlayer(e){ return Math.atan2(e.y-R.player.y,e.x-R.player.x); }
function strongTargets(n){
  return R.enemies.filter(e=>!e.dead).sort((a,b)=>(b.maxHp||b.hp)-(a.maxHp||a.hp)).slice(0,n);
}
function applyArcDamage(ang,arc,reach,dmg,knock){
  const p=R.player, half=arc/2;
  forEachNear(p.x,p.y,reach+40,e=>{ if(e.dead)return;
    const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy); if(d>reach+e.r)return;
    let da=Math.atan2(dy,dx)-ang; da=Math.atan2(Math.sin(da),Math.cos(da)); if(Math.abs(da)>half)return;
    applyDamage(e,dmg,{critRate:R.buffs.crit||0,knock,kx:dx/(d||1),ky:dy/(d||1)}); e.hitFlash=0.12; bossCounter(e);
  });
}
function executeUlt(def,gen){
  if(!R||!def)return;
  const p=R.player, params=def.params||{}, hue=ultHue(gen);
  R.flash=Math.max(R.flash,0.35); R.shake=Math.max(R.shake,0.35);
  pushText(p.x,p.y-58,def.name||'奥義','#ffe082',1.6,24);
  pushPart(p.x,p.y,'hsl('+hue+',85%,66%)',28,260);
  if(def.prim==='greatslash') ultGreatslash(gen,params,hue);
  else if(def.prim==='roar') ultRoar(gen,params,hue);
  else if(def.prim==='dashes') ultDashes(gen,params,hue);
  else if(def.prim==='spin') ultSpin(gen,params,hue);
  else if(def.prim==='volley') ultVolley(gen,params,hue);
  else if(def.prim==='snipe') ultSnipe(gen,params,hue);
  else if(def.prim==='firestorm') ultFirestorm(gen,params,hue);
  else if(def.prim==='firewall') ultFirewall(gen,params,hue);
  else if(def.prim==='bolt') ultBolt(gen,params,hue);
  else if(def.prim==='timeslow') ultTimeslow(gen,params,hue);
  else if(def.prim==='berserk') ultBerserk(gen,params,hue);
  else if(def.prim==='raid') ultRaid(gen,params,hue);
  else if(def.prim==='heal_rally') ultHealRally(gen,params,hue);
  else ultBerserk(gen,params,hue);
}
function ultGreatslash(gen,params,hue){
  const p=R.player, total=ultDamage(gen,params), hits=params.hits||3, reach=params.reach||210, arc=(params.arc||170)*Math.PI/180;
  const base=Math.atan2(p.facing.y,p.facing.x), dmg=total/hits;
  for(let i=0;i<hits;i++){
    const off=(i-(hits-1)/2)*0.16, a=base+off, life=0.24+i*0.025;
    applyArcDamage(a,arc,reach,dmg,params.knock||1.5);
    R.swings.push({x:p.x,y:p.y,ang:a,arc,reach:reach+i*8,life,maxLife:life,hue,wt:(gen&&gen.weapon)||'podao',follow:true});
  }
  R.shake=Math.max(R.shake,0.55);
}
function ultRoar(gen,params,hue){
  const p=R.player, dmg=ultDamage(gen,params)*0.35, rad=params.radius||900, stun=params.stun||2.2, knock=params.knock||2.0;
  for(const e of R.enemies){ if(e.dead)continue;
    const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy)||1; if(d>rad+e.r)continue;
    e.stunT=Math.max(e.stunT||0,e.isBoss?Math.min(1.0,stun*0.45):stun);
    e.x+=dx/d*22*knock*(1-(e.knockRes||0)); e.y+=dy/d*22*knock*(1-(e.knockRes||0));
    applyDamage(e,dmg,{critRate:R.buffs.crit||0,knock,kx:dx/d,ky:dy/d}); e.hitFlash=0.16;
  }
  R.novas.push({x:p.x,y:p.y,r:8,maxR:Math.min(260,rad*.35),life:0.42,maxLife:0.42,hue,dmg:0,knock:0,crit:0,hitSet:new Set()});
}
function ultDashes(gen,params,hue){
  R.ultActs.push({type:'dashes',gen,hue,left:params.count||6,width:params.width||40,len:params.len||180,seg:0,
    dmg:ultDamage(gen,params)/Math.max(1,params.count||6)*1.05});
  R.player.ifr=Math.max(R.player.ifr||0,1.2);
}
function ultSpin(gen,params,hue){
  const dur=params.dur||4, radius=params.radius||132;
  R.ult.spin={t:dur,size:params.size||1.5,move:params.move||0.2};
  R.ultActs.push({type:'spin',hue,radius,dmg:ultDamage(gen,params)/Math.max(8,dur/0.18),life:dur,tick:0,cool:new Map()});
}
function ultVolley(gen,params,hue){
  const p=R.player, n=params.count||28, total=ultDamage(gen,params), dmg=total/Math.max(7,n*0.35), pierce=params.pierce==null?3:params.pierce;
  const fan=!!params.fan, base=Math.atan2(p.facing.y,p.facing.x), spread=fan?Math.PI*1.15:TAU;
  for(let i=0;i<n;i++){
    const a=fan ? base-spread/2+spread*(i/Math.max(1,n-1)) : i/n*TAU;
    R.proj.push({x:p.x,y:p.y,vx:Math.cos(a)*780,vy:Math.sin(a)*780,r:12,dmg,crit:R.buffs.crit||0,knock:0.7,
      pierce,hit:new Set(),life:1.15,hue:60,ptype:'arrow',spd:780,range:740,t:0,phase:0});
  }
}
function ultSnipe(gen,params,hue){
  const p=R.player, targets=strongTargets(params.count||3), dmg=ultDamage(gen,params)/Math.max(1,targets.length);
  for(const e of targets){
    applyDamage(e,dmg,{crit:true,knock:1.0,kx:(e.x-p.x)/(Math.hypot(e.x-p.x,e.y-p.y)||1),ky:(e.y-p.y)/(Math.hypot(e.x-p.x,e.y-p.y)||1)});
    e.hitFlash=0.25; bossCounter(e);
    R.ultFx.push({type:'line',x1:p.x,y1:p.y,x2:e.x,y2:e.y,hue:55,life:0.22,maxLife:0.22});
    pushPart(e.x,e.y,'#ffe082',18,180);
  }
}
function ultFirestorm(gen,params,hue){
  const count=params.count||11, total=ultDamage(gen,params), life=params.dur||3.4, r=params.radius||56;
  const targets=strongTargets(Math.ceil(count*0.45));
  for(let i=0;i<count;i++){
    const t=targets[i%Math.max(1,targets.length)];
    const x=t?(t.x+rnd(-45,45)):(R.cam.x+rnd(-CW*0.45,CW*0.45));
    const y=t?(t.y+rnd(-45,45)):(R.cam.y+rnd(-CH*0.40,CH*0.40));
    R.zones.push({x,y,r,life,maxLife:life,tick:0.28,nextTick:rnd(0,0.18),dmg:total/(count*5.5),crit:R.buffs.crit||0,hue:18,cool:new Map()});
  }
}
function ultFirewall(gen,params,hue){
  const p=R.player, a=Math.atan2(p.facing.y,p.facing.x);
  R.ultActs.push({type:'firewall',x:p.x+Math.cos(a)*60,y:p.y+Math.sin(a)*60,a,hue:18,life:params.dur||3.8,
    width:params.width||140,speed:params.speed||150,tick:0,dmg:ultDamage(gen,params)/18});
}
function ultBolt(gen,params,hue){
  R.ultActs.push({type:'bolt',hue:50,left:params.count||8,radius:params.radius||64,next:0,dmg:ultDamage(gen,params)/Math.max(1,params.count||8),life:3.4});
}
function ultTimeslow(gen,params,hue){
  const cleared=R.eproj.length; R.eproj.length=0;
  R.ult.enemySlowT=Math.max(R.ult.enemySlowT||0,params.dur||4.0);
  R.ult.enemySlowAmt=Math.max(R.ult.enemySlowAmt||0,params.slow||0.58);
  pushText(R.player.x,R.player.y-42,'敵弾消滅 '+cleared,'#b39ddb',1.2,18);
  R.flash=Math.max(R.flash,0.5); R.shake=Math.max(R.shake,0.35);
}
function ultBerserk(gen,params,hue){
  const p=R.player;
  if(params.hpCost){ const c=Math.max(1,p.maxHp*params.hpCost); p.hp=Math.max(1,p.hp-c); pushText(p.x,p.y-34,'血を代価に','#ff8a80',1.1,16); }
  const lost=1-p.hp/p.maxHp, add=(params.lostHpDmg||0)*lost;
  if(params.heal){ const h=Math.round(p.maxHp*params.heal); p.hp=Math.min(p.maxHp,p.hp+h); }
  R.ult.berserk={t:params.dur||4.2,dmg:(params.dmg||0.45)+add,cd:params.cd||0.82,move:params.move||0.12,lifesteal:params.lifesteal||0};
  pushPart(p.x,p.y,'#ff7043',36,250);
}
function ultRaid(gen,params,hue){
  const n=params.count||6, dur=params.dur||3.2, total=ultDamage(gen,params), riders=[];
  const dir=R.player.facing.x<0?-1:1, sx=R.cam.x-dir*(CW/2+80);
  for(let i=0;i<n;i++) riders.push({x:sx-rnd(0,110)*dir,y:R.cam.y-CH*0.35+(i+0.5)*CH*0.7/n+rnd(-18,18),vx:dir*rnd(280,350),hit:new Set(),phase:rnd(10)});
  R.ultActs.push({type:'raid',gen,hue,life:dur,riders,dmg:total/Math.max(4,n*0.7)});
}
function ultHealRally(gen,params,hue){
  const p=R.player, h=Math.round(p.maxHp*(params.heal||0.25));
  p.hp=Math.min(p.maxHp,p.hp+h);
  R.ult.shield={t:params.dur||4.0,absorb:p.maxHp*(params.shield||0.18),max:p.maxHp*(params.shield||0.18)};
  pushText(p.x,p.y-44,'回復 +'+h,'#69f0ae',1.4,20);
  pushPart(p.x,p.y,'#69f0ae',32,210);
}

// ── ダメージ適用 ───────────────────────────
function queueDamageText(e,d,crit){
  const q=e._dmgText||(e._dmgText={sum:0,crit:false,t:0.25,x:e.x,y:e.y});
  q.sum+=d; q.crit=!!(q.crit||crit); q.t=0.25; q.x=e.x+rnd(-5,5); q.y=e.y-e.r-4;
}
function flushDamageText(e){
  const q=e&&e._dmgText; if(!q||q.sum<=0)return;
  pushText(q.x,q.y,q.sum|0,(q.crit?'#ffe082':'#fff'),q.crit?1.35:1.0,q.crit?19:14);
  q.sum=0; q.crit=false; q.t=0.25;
}
function applyDamage(e, dmg, opts){
  opts=opts||{};
  if(e.dead)return;
  let d=dmg;
  if(R.lord.sig&&R.lord.sig.bossHunter){ d += Math.min(e.maxHp*R.lord.sig.bossHunter, dmg*2); }  // 孫堅「江東之虎」: 敵最大HPの一部を加算(大物特効・base×2で頭打ち)
  let crit=false;
  if(opts.crit!==undefined){crit=opts.crit;}
  else { const cr=opts.critRate||0; if(cr>0&&Math.random()<cr){crit=true;} }
  if(crit){ d*=(1.5+(R.buffs.critDmg||0)); e.hitFlash=0.16; window.SFX&&SFX.play('crit'); if(e.isBoss||e.elite||e.big) R.hitstop=Math.max(R.hitstop||0,.05); }
  if(e.dr) d*= (1-e.dr);
  d=Math.max(1,Math.round(d));
  e.hp-=d;
  if(R.ult&&R.ult.berserk&&R.ult.berserk.t>0&&R.ult.berserk.lifesteal){
    R.player.hp=Math.min(R.player.maxHp,R.player.hp+d*R.ult.berserk.lifesteal);
  }
  // ノックバック
  if(opts.knock&&opts.kx!==undefined){const kr=(1-(e.knockRes||0))*opts.knock*9;e.x+=opts.kx*kr;e.y+=opts.ky*kr;}
  queueDamageText(e,d,crit);
  if(e.hp<=0){ flushDamageText(e); killEnemy(e); }
}
G.applyDamage=applyDamage;

function killEnemy(e){
  if(e.dead)return; e.dead=true;
  if(e.isBoss){ onBossDead(e); return; }
  R.player.kills++;
  // 軍功
  R.player.goldFrac += (e.gold||1)*window.ECON.killGold*(1+(R.buffs.gold||0))*(1+R.curse*0.6);
  // 経験値ジェム
  R.gems.push({x:e.x,y:e.y,xp:e.xp||1,vx:0,vy:0,mag:false});
  chargeUlt(e.elite?((window.ULTS&&window.ULTS.KILL&&window.ULTS.KILL.elite)||15):((window.ULTS&&window.ULTS.KILL&&window.ULTS.KILL.grunt)||1));
  // bomberは爆発
  if(e.explode){ makeEnemyExplosion(e.x,e.y,e.explode); }
  // 精鋭は壺をドロップしやすい
  if(e.elite && R.jars.length<6 && Math.random()<0.6) spawnJar(undefined,e.x,e.y);
  const big=e.elite||e.big; pushPart(e.x,e.y,'hsl('+(e.hue||0)+',60%,55%)',big?18:6,big?230:150); if(big)R.flash=Math.max(R.flash,.18);
  window.SFX&&SFX.play('kill');
}
function makeEnemyExplosion(x,y,dmg){
  R.novas.push({x,y,r:6,maxR:60,life:0.3,maxLife:0.3,hue:20,enemy:true,dmg,hit:false});
}

// ── 敵スポーン ─────────────────────────────
// 画面の縁の少し外に湧かせる(囲まれる感)
function edgePos(margin){
  const m=margin||44, w=CW/2+m, h=CH/2+m, side=rint(0,3); let lx,ly;
  if(side===0){lx=rnd(-w,w);ly=-h;} else if(side===1){lx=rnd(-w,w);ly=h;}
  else if(side===2){lx=-w;ly=rnd(-h,h);} else {lx=w;ly=rnd(-h,h);}
  return {x:R.cam.x+lx, y:R.cam.y+ly};
}
function currentPhase(){const ph=R.stage.pool;const t=R.t;for(const p of ph){if(t<=p.until)return p;}return ph[ph.length-1];}
function weightedArch(w){let tot=0;for(const k in w)tot+=w[k];let r=rnd(tot);for(const k in w){r-=w[k];if(r<=0)return k;}return Object.keys(w)[0];}
function spawnEnemy(){
  // ★ステージ後半=ビルド完成で物量パワーファンタジー。時間で上限を大幅に伸ばす(終盤は画面が埋まる)
  const cap=R.stage.endless? Math.min(2000,400+Math.floor(R.t/40)*130) : Math.min(1500,340+Math.floor(R.t/40)*110);
  if(R.enemies.length>=cap)return;
  // 遠隔の量は難易度で。数(密度)は変えない
  let _pw=currentPhase().w; const _rg=((R.diff&&R.diff.ranged)||1)*(1+R.curse*0.5);
  if(_rg!==1){ _pw=Object.assign({},_pw); for(const _k of ['archer','shaman']){ if(_pw[_k]) _pw[_k]=Math.max(0.01,_pw[_k]*_rg); } }
  const arch=weightedArch(_pw);
  const base=window.ENEMY_ARCH[arch];
  const re=(R.stage.recolor&&R.stage.recolor[arch])||{};
  const mn=R.t/60;
  const hpMul=R.stage.hpMul*(1+R.stage.growthPerMin*mn + mn*mn*0.02)*R.diff.ehp*(1+R.curse); // 後半は二次で硬くなり物量が脅威に＋天命
  const dmgMul=R.stage.dmgMul*(1+R.stage.growthPerMin*mn*0.6)*R.diff.edmg*(1+R.curse);
  const pos=edgePos();
  const e=spawnAt(pos.x, pos.y, base, re, hpMul, dmgMul);
  R.enemies.push(e);
}
function spawnAt(x,y,base,re,hpMul,dmgMul,over){
  const e={x,y,vx:0,vy:0,dead:false,
    hp:Math.round(base.hp*hpMul*((over&&over.hpMul)||1)),
    maxHp:Math.round(base.hp*hpMul*((over&&over.hpMul)||1)),
    dmg:base.dmg*dmgMul*((over&&over.dmgMul)||1),
    speed:base.speed*((over&&over.speedMul)||1), _baseSpeed:base.speed*((over&&over.speedMul)||1), r:(over&&over.r)||base.r,
    xp:base.xp*((over&&over.xpMul)||1), gold:base.gold*((over&&over.goldMul)||1),
    behavior:base.behavior, shape:base.shape, hue:(re.hue!==undefined?re.hue:0),
    name:(over&&over.name)||re.name||arquetypeName(base), knockRes:base.knockRes||0, dr:base.dr||0,
    explode:base.explode||0, big:(over&&over.r>22)?1:0,
    shootCd:base.shootCd?rnd(base.shootCd,base.shootCd*1.6):0, shootEvery:base.shootCd, shotSpeed:base.shotSpeed, range:base.range,
    dashCd:base.dashCd?rnd(base.dashCd):0, dashEvery:base.dashCd, magic:base.magic,
    elite:!!(over&&over.name), hitFlash:0,
  };
  if(over&&over.name){e.maxHp=e.hp;}
  return e;
}
function arquetypeName(b){return '兵';}
function spawnElite(el){
  const base=window.ENEMY_ARCH[el.arch];
  const mn=R.t/60; const hpMul=R.stage.hpMul*(1+R.stage.growthPerMin*mn)*R.diff.ehp;const dmgMul=R.stage.dmgMul*(1+R.stage.growthPerMin*mn*0.6)*R.diff.edmg;
  const pos=edgePos(80);
  // 精鋭は手間に見合う報酬(HP倍率に比例)を持たせる
  const over=Object.assign({xpMul:(el.hpMul||6), goldMul:Math.round((el.hpMul||6)*0.8)}, el);
  const e=spawnAt(pos.x,pos.y,base,{hue:el.hue},hpMul,dmgMul,over);
  e.elite=true; R.enemies.push(e);
  pushText(R.cam.x,R.cam.y-CH*0.32,'精鋭出現: '+el.name,'#ff8a65',1.4,22);
}

// ── ボス ───────────────────────────────────
function spawnBoss(){
  const bd=R.stage.boss; let name=bd.name, title=bd.title, hue=bd.hue, mech=bd.mech, shape=bd.shape, hp=bd.hp, dmg=bd.dmg, line=bd.line;
  if(R.stage.endless){
    const rot=R.stage.bossRotation, tier=Math.floor(R.t/300), r=rot[Math.max(0,tier-1)%rot.length];
    name=r.name; title=r.title; mech=r.mech; hue=r.hue; shape=r.shape; line=r.line;
    hp=bd.hp*Math.pow(1.6,tier); dmg=bd.dmg*(1+tier*0.25);   // HP指数・DMG乗算でプレイヤー成長に追従
  } else {
    hp=bd.hp*2.4;  // フルビルドでも歯ごたえが残るボスHP
  }
  const mn=R.t/60;
  hp*=R.diff.ehp; dmg*=R.diff.edmg;
  const pos=edgePos(60);
  const e={x:pos.x,y:pos.y,vx:0,vy:0,dead:false,isBoss:true,
    hp:Math.round(hp), maxHp:Math.round(hp), dmg:dmg*(1+R.stage.growthPerMin*mn*0.3),
    speed:bd.speed||38, r:bd.r||42, hue, name, title, shape, mech:mech.slice(),
    mt:{}, knockRes:0.85, dr:0.12, hitFlash:0, enraged:false,
  };
  mech.forEach(m=>e.mt[m]=rnd(2,4));
  R.boss=e; R.enemies.push(e);
  R.flash=0.6; R.shake=0.5; window.SFX&&SFX.play('bossIn');
  G.onBossIntro&&G.onBossIntro(name,title,line);
}
function onBossDead(e){
  e.dead=true; R.boss=null;
  chargeUlt((window.ULTS&&window.ULTS.KILL&&window.ULTS.KILL.boss)||40);
  pushPart(e.x,e.y,'hsl('+e.hue+',70%,60%)',40,260);
  R.flash=0.7; R.shake=0.6; R.hitstop=Math.max(R.hitstop||0,.13); window.SFX&&SFX.play('bossDead');
  R.player.goldFrac += (R.stage.no*40)*(1+(R.buffs.gold||0));
  if(R.stage.endless){ R.nextBossT=R.t+300; return; }
  victory();
}
function updateBoss(e,dt){
  const p=R.player;
  const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
  if(e.enrageFlash>0)e.enrageFlash-=dt;
  // 予告(溜め)中: 本体は鳴りを潜める。終わったら発動。新規mechは開始しない
  if(e.windup){
    e.windup.t-=dt;
    if(e.windup.m!=='charge'){ e.x+=dx/d*e.speed*0.4*dt; e.y+=dy/d*e.speed*0.4*dt; } // charge溜め中は止まって溜める
    if(e.windup.t<=0){ const w=e.windup; e.windup=null; fireBossMech(e,w); }
    if(e.chargeT){ e.x+=e.vx*dt; e.y+=e.vy*dt; e.chargeT-=dt; if(e.chargeT<=0){e.vx=0;e.vy=0;} }
    return;
  }
  // 通常接近
  e.x+=dx/d*e.speed*dt; e.y+=dy/d*e.speed*dt;
  if(e.mech.includes('enrage') && !e.enraged && e.hp<e.maxHp*0.35){e.enraged=true;e.speed*=1.5;e.dmg*=1.4;e.enrageFlash=1.4;pushText(e.x,e.y-e.r,'怒・激昂','#ff5252',1.9,28);R.shake=0.45;}
  for(const m of e.mech){
    e.mt[m]-=dt; if(e.mt[m]>0)continue;
    // charge/volley/spin は予告(溜め)を挟む。chargeは溜め開始時に方向をロック(避けられる)
    if(m==='charge'){ e.windup={m:'charge',t:0.55,ang:Math.atan2(dy,dx)}; e.mt[m]=rnd(4.5,6.5); }
    else if(m==='volley'){ e.windup={m:'volley',t:0.45}; e.mt[m]=rnd(3.5,5); }
    else if(m==='spin'){ e.windup={m:'spin',t:0.4}; e.mt[m]=rnd(2.4,3.4); }
    else if(m==='summon'){ for(let i=0;i<4;i++){const a=rnd(TAU);const base=window.ENEMY_ARCH.grunt;const mn=R.t/60;const en=spawnAt(e.x+Math.cos(a)*40,e.y+Math.sin(a)*40,base,{hue:e.hue},R.stage.hpMul*(1+R.stage.growthPerMin*mn),R.stage.dmgMul*(1+R.stage.growthPerMin*mn*0.6));R.enemies.push(en);} e.mt[m]=rnd(5,8); }
    else if(m==='blink'){ const a=rnd(TAU);pushPart(e.x,e.y,'#bbb',10,180);e.x=p.x+Math.cos(a)*140;e.y=p.y+Math.sin(a)*140; pushPart(e.x,e.y,'#bbb',12,200); e.mt[m]=rnd(3,5); }
    else if(m==='fireboss'){ R.zones.push({x:p.x+rnd(-40,40),y:p.y+rnd(-40,40),r:70,life:4.2,maxLife:4.2,warn:0.7,tick:0.4,nextTick:0,dmg:e.dmg*0.4,hue:14,enemy:true,cool:new Map()}); e.mt[m]=rnd(3,4.5); }  // warn=0.7秒の予告
    else if(m==='buffAdds'){ forEachNear(e.x,e.y,260,o=>{if(o!==e&&!o.dead&&o.speed<(o._baseSpeed||o.speed)*1.8){o.speed*=1.12;}}); e.mt[m]=rnd(4,6); }
    else if(m==='heal'){ if(e.hp<e.maxHp) {e.hp=Math.min(e.maxHp,e.hp+e.maxHp*0.04);pushText(e.x,e.y-e.r,'回','#69f0ae',1.1,16);} e.mt[m]=rnd(6,9); }
    else if(m==='counter'){ /* 被弾時に runtime 側で処理 */ e.mt[m]=2; }
    if(e.windup)break;  // 1度に1予告だけ
  }
  if(e.chargeT){ e.x+=e.vx*dt; e.y+=e.vy*dt; e.chargeT-=dt; if(e.chargeT<=0){e.vx=0;e.vy=0;} }
}
// 予告終了後に実発動(charge=ロック方向へ突進 / volley・spin=弾幕)
function fireBossMech(e,w){
  if(w.m==='charge'){ e.vx=Math.cos(w.ang)*380; e.vy=Math.sin(w.ang)*380; e.chargeT=0.4; R.shake=0.3; }
  else if(w.m==='volley'){ const n=10;for(let i=0;i<n;i++){const a=i/n*TAU+rnd(-0.1,0.1);R.eproj.push({x:e.x,y:e.y,vx:Math.cos(a)*220,vy:Math.sin(a)*220,r:7,dmg:e.dmg*0.6,life:3,hue:e.hue,pierce:true});} }
  else if(w.m==='spin'){ for(let i=0;i<6;i++){const a=i/6*TAU+R.t;R.eproj.push({x:e.x,y:e.y,vx:Math.cos(a)*180,vy:Math.sin(a)*180,r:6,dmg:e.dmg*0.5,life:2,hue:e.hue,pierce:true});} }
}

// ── 勝敗 ───────────────────────────────────
function gameOver(){ if(R.over)return;
  if(R.revives>0){ R.revives--; R.player.hp=Math.round(R.player.maxHp*0.5); R.player.ifr=2.6; R.flash=0.9; R.shake=0.7; R.hitstop=Math.max(R.hitstop||0,.12);
    pushText(R.player.x,R.player.y-46,'復活！','#ffd54f',2.3,30); window.SFX&&SFX.play('kizuna');
    for(const e of R.enemies){ if(!e.isBoss && dist2(e.x,e.y,R.player.x,R.player.y)<220*220) killEnemy(e); }
    return; }
  R.over=true; R.running=false; window.SFX&&SFX.play('death'); finalizeRewards(false);
  const _r=buildResult(false); if(R.scene) G.onSceneEnd&&G.onSceneEnd('dead',_r); else G.onGameOver&&G.onGameOver(_r); }
function victory(){ if(R.over)return; R.over=true; R.victory=true; R.running=false; finalizeRewards(true);
  const _r=buildResult(true); if(R.scene) G.onSceneEnd&&G.onSceneEnd('clear',_r); else G.onVictory&&G.onVictory(_r); }
// 悲運シーン: 避けられぬ最期。dur満了 or HP0で必ず散る。章は進むので報酬は保証し、勝敗でなく「どこまで抗えたか」を記録
function doomEnd(){ if(R.over)return; R.over=true; R.victory=true; R.running=false; R.player.hp=0;
  R.shake=1; R.flash=1; R.hitstop=Math.max(R.hitstop||0,.25); window.SFX&&SFX.play('death'); finalizeRewards(true);
  const _r=buildResult(true); _r.doom=true; G.onSceneEnd&&G.onSceneEnd('doom',_r); }
function finalizeRewards(win){
  R.player.gold=Math.floor(R.player.goldFrac);
  R.earned = R.player.gold + Math.floor(R.t/60*window.ECON.surviveGoldPerMin) + (win? R.stage.reward.gold:Math.floor(R.stage.reward.gold*0.3));
  R.earned = Math.round(R.earned*(1+((R.meta.upg.gold)||0)*0.08));   // 恒久「軍功UP」
  R.tickets = win? (R.stage.reward.ticket||0):0;
}
function buildResult(win){return {win,time:R.t,kills:R.player.kills,level:R.player.level,gold:R.earned,tickets:R.tickets,stage:R.stage,lord:R.lord,weapons:R.weapons.map(w=>({name:w.gen.name,level:w.level,rarity:w.gen.rarity,evo:!!w.evo}))};}
G.quitRun=()=>{ if(R){R.running=false;R.over=true;} };

// ── レベルアップ ───────────────────────────
function gainXp(n){
  R.player.xp+=n*(1+(R.buffs.xp||0))*1.8*PACE.xpMul*R.diff.xp*(1+R.curse*0.8);  // ×1.8=経験値ノブ＋難易度＋天命の見返り(危険ほど成長)。PACE.xpMulで×1.2
  let leveled=false;
  while(R.player.xp>=R.player.xpNext){
    R.player.xp-=R.player.xpNext; R.player.level++;
    R.player.xpNext=Math.round(4+R.player.level*3+R.player.level*R.player.level*0.28);  // レベリング高速化(6分で複数武将MAX狙い)
    R.pendingLevels=(R.pendingLevels||0)+1; leveled=true;
    if(R.lord.sig&&R.lord.sig.healOnLevel){ R.player.hp=Math.min(R.player.maxHp,R.player.hp+Math.round(R.player.maxHp*R.lord.sig.healOnLevel)); }  // 孫権「江東制衡」
  }
  if(leveled && !R.paused) processNextLevel(); // 複数レベル分はキューして1つずつ選ばせる
}
function processNextLevel(){
  if(!R.pendingLevels||R.pendingLevels<=0){ R.paused=false; return; }
  const choices=buildChoices();
  if(choices.length===0){ R.player.hp=Math.min(R.player.maxHp,R.player.hp+Math.round(R.player.maxHp*0.2)); R.pendingLevels--; return processNextLevel(); }
  R.paused=true; window.SFX&&SFX.play('levelup'); G.onLevelUp&&G.onLevelUp(choices);
}
function buildChoices(){
  const out=[];
  // 1) 装備中の武器強化
  for(const w of R.weapons){ if(w.level<window.WLEVEL.MAX) out.push({type:'wup',w,gen:w.gen,rarity:w.gen.rarity,weight:8}); }
  // 2) 新武将(未装備、スロット空き)。演義版=ステージの登場人物(roster)に限定。
  //    restrict(swarm/長坂型)では主役(protagonist)のみ=主役の1武器を一気に育てる設計。
  if(R.weapons.length<6){
    const equipIds=R.weapons.map(w=>w.gen.id);
    // restrict=trueでもprotagonistが複数(義兄弟等)なら全員をドラフト対象にする
    // → 第1回で劉備プレイ中に関羽・張飛が候補に出る
    let poolIds;
    if(R.stage.restrict) {
      poolIds = (R.stage.protagonist || []).slice();
    } else {
      poolIds = R.stage.levelPool || R.stage.roster || [];
    }
    // 注意: gachaPoolからの自動補充は禁止(コレクション用プールには敵側武将が入っており、
    // 第3回で丁原・第4回で董卓が「味方」に出る事故の原因になった)。
    // levelPool=味方分類済みリストが唯一の真実。少人数章(曹操+陳宮の逃亡等)はそれが演出。
    // 増やしたい章は scenes.js 側の levelPool:['名前',…] で明示的に上書きする。
    const baseAvail=window.GENERALS.filter(g=> poolIds.includes(g.id) && !equipIds.includes(g.id) && !(R.fusedConsumed&&R.fusedConsumed.has(g.id)));
    for(const g of baseAvail){ out.push({type:'wnew',gen:g,rarity:g.rarity,weight:[0,7,5,3,1.5,0.8][g.rarity]||1}); }
  }
  // 3) 兵法(新規/強化)。装備中で未進化の武器が要る兵法は少し出やすくし「育てたのに進化条件が来ない」死蔵を防ぐ
  const wantNeed=new Set();
  for(const w of R.weapons){ if(w.evo)continue; const ev=window.evoFor(w.gen); if(ev&&(R.passives[ev.need]||0)<ev.needLv) wantNeed.add(ev.need); }
  for(const p of window.PASSIVES){ const lv=R.passives[p.id]||0; if(lv<p.max) out.push({type:'passive',p,lv,rarity:0,weight:6+(wantNeed.has(p.id)?2:0)}); }
  // 重み付き3枚抽選(重複なし)
  const pick=[]; const pool=out.slice();
  for(let i=0;i<3&&pool.length;i++){
    let tot=pool.reduce((s,o)=>s+o.weight,0); let r=rnd(tot); let idx=0;
    for(let j=0;j<pool.length;j++){r-=pool[j].weight;if(r<=0){idx=j;break;}}
    pick.push(pool.splice(idx,1)[0]);
  }
  return pick;
}
function applyChoice(c){
  if(c.type==='wup'){ c.w.level++; checkEvolve(); }
  else if(c.type==='wnew'){ addWeapon(c.gen); }
  else if(c.type==='passive'){ addPassive(c.p.id); }
  recomputeBuffs();
  checkFusion();   // 全員Lv MAX到達で縁が合体
  R.pendingLevels=Math.max(0,(R.pendingLevels||1)-1);
  if(R.pendingLevels>0){ processNextLevel(); } // 残りのレベルアップ選択を続ける
  else { R.paused=false; }
  G.onHud&&G.onHud();
}
G.applyChoice=applyChoice; G.getChoiceLabel=null;
// レベルアップ画面の引き直し(新しい3択を返す)とスキップ(取らずに次へ進む・微回復)
G.rerollChoices=()=>buildChoices();
G.skipLevel=function(){
  R.player.hp=Math.min(R.player.maxHp, R.player.hp+Math.round(R.player.maxHp*0.04)); // スキップの休息(微回復)
  R.pendingLevels=Math.max(0,(R.pendingLevels||1)-1);
  if(R.pendingLevels>0){ processNextLevel(); } else { R.paused=false; }
  G.onHud&&G.onHud();
};

// ── メインループ ───────────────────────────
let raf=0,last=0;
function loopStart(){ last=performance.now(); raf=requestAnimationFrame(loop); }
function loop(now){
  if(!R){return;}
  let dt=(now-last)/1000; last=now; if(dt>0.05)dt=0.05;
  if(R.hitstop>0){ R.hitstop-=dt; dt=0; }   // ヒットストップ=updateだけ止めて一撃の重みを出す(renderは継続)
  if(R.running && !R.paused){ update(dt); }
  render();
  if(R.running){ raf=requestAnimationFrame(loop); }
}

function update(dt){
  const realDt=dt;
  R.t+=realDt;
  updateDoomFx(realDt);
  dt*=(R.timeScale==null?1:R.timeScale);
  const p=R.player;
  updateUlt(realDt,dt);
  if(p.atkT>0)p.atkT-=realDt;
  // 入力→移動
  let ix=0,iy=0;
  if(keys['arrowleft']||keys['a'])ix-=1; if(keys['arrowright']||keys['d'])ix+=1;
  if(keys['arrowup']||keys['w'])iy-=1; if(keys['arrowdown']||keys['s'])iy+=1;
  if(touch.active){ix+=touch.dx;iy+=touch.dy;}
  const im=Math.hypot(ix,iy);
  if(im>0.01){ ix/=Math.max(1,im); iy/=Math.max(1,im); p.facing.x=ix;p.facing.y=iy; }
  const spd=130*PACE.playerMoveMul*R.lord.baseMove*(1+(R.buffs.move||0))*((R.ult&&R.ult.moveMul)||1);  // PACE.playerMoveMulで×1.08
  p.x+=ix*spd*dt; p.y+=iy*spd*dt;
  // カメラ追従
  R.cam.x+=(p.x-R.cam.x)*Math.min(1,dt*8); R.cam.y+=(p.y-R.cam.y)*Math.min(1,dt*8);
  // 回復
  if(R.buffs.regen) p.hp=Math.min(p.maxHp,p.hp+R.buffs.regen*dt);
  if(p.ifr>0)p.ifr-=dt;
  if(R.flash>0)R.flash-=dt*2; if(R.shake>0)R.shake-=dt*2.5;

  // スポーン: 序盤からそこそこ群れ、時間で密度上限ごと伸ばす(後半は物量で殺しに来る)
  const cap=R.stage.endless? Math.min(130,40+Math.floor(R.t/45)*15) : Math.min(110,34+Math.floor(R.t/45)*14);
  // PACE.spawnRateMul で全体倍率。開幕60秒は PACE.spawnEarlyFloor で底上げし最初の波から賑やか。
  const _rateBase = R.stage.rate0*3.0 + (R.t/60)*(6.5 + R.stage.rateGrow*30);
  const _earlyBoost = R.t < 60 ? Math.max(0, PACE.spawnEarlyFloor - _rateBase) : 0;
  const rate=Math.min(cap, (_rateBase + _earlyBoost)*PACE.spawnRateMul*(1+R.curse*0.6));
  R.spawnAcc+=dt*rate*(R.boss?0.6:1);
  while(R.spawnAcc>=1){R.spawnAcc-=1; spawnEnemy();}
  // 精鋭
  while(R.stage.elites && !R.boss && R.eliteIdx<R.stage.elites.length && R.t>=R.stage.elites[R.eliteIdx].t){ spawnElite(R.stage.elites[R.eliteIdx]); R.eliteIdx++; }  // ボス出現中は精鋭を止める
  // ボス
  if(!R.boss && R.t>=R.nextBossT){ spawnBoss(); }
  // シーン終了判定: survive=生存達成で勝利 / doom=満了で強制死
  if(R.scene && !R.over){ const _k=R.scene.kind;
    if(_k==='survive' && R.t>=R.scene.dur) victory();
    else if(_k==='doom' && R.t>=R.scene.dur) beginDoomHold(); }
  if(R.boss && !R.bossWarned){R.bossWarned=true;}
  if(R.boss&&R.boss.dead)R.boss=null;

  // ★脅威スポーン: 消せない色付きビーム術者/貫通突撃。時間と難易度(遠隔量)で頻発=後半は油断すると死ぬ
  // 悲運(doom)シーンでは開幕から避けきれぬ遠隔弾幕を浴びせ「逃れられぬ最期」を体現する
  const _doom=R.scene&&R.scene.kind==='doom';
  if(R.t>(_doom?1:16)){ R.threatT=(R.threatT==null?(_doom?rnd(.4,.9):rnd(3,5)):R.threatT)-dt;
    if(R.threatT<=0){ const mn=R.t/60, dr=((R.diff&&R.diff.ranged)||1)*(1+R.curse)*(_doom?2.4:1);
      R.threatT=Math.max(_doom?0.5:1.4,(8.0-mn*0.9))/Math.max(.5,dr);
      const arch=(Math.random()<(_doom?0.82:0.62))?'beamer':'lancer', base=window.ENEMY_ARCH[arch];
      const hpMul=R.stage.hpMul*(1+R.stage.growthPerMin*mn)*((R.diff&&R.diff.ehp)||1);
      const dmgMul=R.stage.dmgMul*(1+R.stage.growthPerMin*mn*0.6)*((R.diff&&R.diff.edmg)||1);
      const pos=edgePos(70), en=spawnAt(pos.x,pos.y,base,(R.stage.recolor&&R.stage.recolor[arch])||{},hpMul,dmgMul);
      if(arch==='beamer') en.beamHue=(120+(R.stage.no*47)%240);
      R.enemies.push(en); } }

  rebuildGrid();

  // 武器(攻撃)
  G.Weapons.update(dt, R);

  // 敵更新
  updateEnemies(dt);
  // 敵弾
  updateEproj(dt);
  // 攻撃エンティティ
  updateSwings(dt); updateProj(dt); updateNovas(dt); updateDashes(dt); updateZones(dt); updateMinions(dt);
  // ジェム/拾得
  updateGems(dt);
  // 壺(ピックアップ)
  R.jarT-=dt; if(R.jarT<=0){ R.jarT=rnd(22,36); if(R.jars.length<6) spawnJar(); }
  updateJars(dt);
  // 君主シグネチャ: 曹操「魏武の軍」= 魏兵を定期招集(壁＋DPS)
  if(R.lord.sig&&R.lord.sig.summonEvery){ R.sigT=(R.sigT||0)-dt;
    if(R.sigT<=0){ R.sigT=R.lord.sig.summonEvery; const n=R.lord.sig.summonN, dmg=(10+R.player.level*2.2)*(1+(R.buffs.dmg||0));
      for(let i=0;i<n;i++){ const a=rnd(TAU); R.minions.push({x:p.x+Math.cos(a)*26,y:p.y+Math.sin(a)*26,dmg,atk:rnd(0.3),atkCd:window.WBASE.summon.sAtkCd,speed:window.WBASE.summon.sSpeed,life:8,crit:R.buffs.crit||0}); }
      pushText(p.x,p.y-40,'魏兵 招集','#90caf9',1.1,16);
    }
  }
  // テキスト/粒子
  for(const e of R.enemies){ if(e._dmgText&&e._dmgText.sum>0){ e._dmgText.t-=realDt; if(e._dmgText.t<=0)flushDamageText(e); } }
  for(const t of R.texts){t.y+=t.vy*dt;t.life-=dt;} R.texts=R.texts.filter(t=>t.life>0);
  for(const pa of R.parts){pa.x+=pa.vx*dt;pa.y+=pa.vy*dt;pa.vx*=0.92;pa.vy*=0.92;pa.life-=dt;} R.parts=R.parts.filter(pa=>pa.life>0);
  // 死亡敵除去
  R.enemies=R.enemies.filter(e=>!e.dead);

  if(p.hp<=0){
    if(R.scene&&R.scene.kind==='doom'){ if(!(R.doomFx&&R.doomFx.holding)) doomEnd(); }
    else gameOver();
  }
  G.onHud&&G.onHud();
}

function updateUlt(realDt,dt){
  if(!R.ult)return;
  const u=R.ult, p=R.player;
  u.moveMul=1;
  if(u.berserk&&u.berserk.t>0){ u.berserk.t-=realDt; u.moveMul*=1+(u.berserk.move||0); if(u.berserk.t<=0)u.berserk=null; }
  if(u.spin&&u.spin.t>0){ u.spin.t-=realDt; u.moveMul*=1+(u.spin.move||0); if(u.spin.t<=0)u.spin=null; }
  if(u.shield&&u.shield.t>0){ u.shield.t-=realDt; if(u.shield.t<=0||u.shield.absorb<=0)u.shield=null; }
  if(u.enemySlowT>0){ u.enemySlowT-=realDt; if(u.enemySlowT<=0){ u.enemySlowT=0; u.enemySlowAmt=0; } }
  const hpRate=p.hp/p.maxHp;
  if(hpRate<0.30&&!R.over){ u.heartBeat-=realDt; if(u.heartBeat<=0){ u.heartBeat=hpRate<0.15?0.55:0.95; window.SFX&&SFX.play('hurt'); } }
  else u.heartBeat=0;
  if(u.auto&&u.gauge>=u.max&&!u.casting) triggerUlt();

  const alive=[];
  for(const a of R.ultActs){
    if(a.type==='dashes'){ updateUltDashes(a,realDt); if(a.left>0||a.seg>0)alive.push(a); }
    else if(a.type==='spin'){ updateUltSpin(a,realDt); if(a.life>0)alive.push(a); }
    else if(a.type==='firewall'){ updateUltFirewall(a,realDt); if(a.life>0)alive.push(a); }
    else if(a.type==='bolt'){ updateUltBolt(a,realDt); if(a.life>0&&(a.left>0||a.next>0))alive.push(a); }
    else if(a.type==='raid'){ updateUltRaid(a,realDt); if(a.life>0)alive.push(a); }
  }
  R.ultActs=alive;
  for(const fx of R.ultFx)fx.life-=realDt;
  R.ultFx=R.ultFx.filter(fx=>fx.life>0);
}
function startUltDash(a){
  const p=R.player, t=nearestEnemy(p.x,p.y,720), ang=t?Math.atan2(t.y-p.y,t.x-p.x):Math.atan2(p.facing.y,p.facing.x);
  const sp=1120; a.vx=Math.cos(ang)*sp; a.vy=Math.sin(ang)*sp; a.seg=Math.max(0.10,(a.len||180)/sp); a.left--; a.hit=new Set(); a.ang=ang;
  R.dashes.push({x:p.x,y:p.y,vx:a.vx,vy:a.vy,len:a.len||180,traveled:0,w:a.width||40,dmg:a.dmg*0.45,crit:R.buffs.crit||0,knock:1.1,hit:new Set(),life:a.seg+0.05,hue:a.hue,trail:0});
}
function updateUltDashes(a,dt){
  if(a.seg<=0){ if(a.left<=0)return; startUltDash(a); }
  const p=R.player; a.seg-=dt; p.ifr=Math.max(p.ifr||0,0.24);
  p.x+=a.vx*dt; p.y+=a.vy*dt;
  if(Math.random()<0.72)R.parts.push({x:p.x-rnd(-5,5),y:p.y-rnd(-5,5),vx:-a.vx*0.015+rnd(-30,30),vy:-a.vy*0.015+rnd(-30,30),life:0.22,col:'hsl('+a.hue+',85%,68%)',r:rnd(2,4)});
  forEachNear(p.x,p.y,(a.width||40)+26,e=>{ if(e.dead||a.hit.has(e))return; if(dist2(p.x,p.y,e.x,e.y)<((a.width||40)+e.r)*((a.width||40)+e.r)){
    const d=Math.hypot(a.vx,a.vy)||1; applyDamage(e,a.dmg,{critRate:R.buffs.crit||0,knock:1.1,kx:a.vx/d,ky:a.vy/d}); e.hitFlash=0.12; bossCounter(e); a.hit.add(e); } });
}
function updateUltSpin(a,dt){
  a.life-=dt; a.tick-=dt;
  if(a.tick>0)return;
  a.tick=0.16;
  const p=R.player;
  forEachNear(p.x,p.y,a.radius+35,e=>{ if(e.dead)return; const last=a.cool.get(e)||0; if(R.t-last<0.28)return;
    if(dist2(p.x,p.y,e.x,e.y)<(a.radius+e.r)*(a.radius+e.r)){ a.cool.set(e,R.t); const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy)||1;
      applyDamage(e,a.dmg,{critRate:R.buffs.crit||0,knock:1.4,kx:dx/d,ky:dy/d}); e.hitFlash=0.10; bossCounter(e); } });
}
function updateUltFirewall(a,dt){
  a.life-=dt; a.x+=Math.cos(a.a)*a.speed*dt; a.y+=Math.sin(a.a)*a.speed*dt; a.tick-=dt;
  if(a.tick>0)return; a.tick=0.16;
  const nx=Math.cos(a.a), ny=Math.sin(a.a), px=-ny, py=nx;
  forEachNear(a.x,a.y,a.width+70,e=>{ if(e.dead)return; const dx=e.x-a.x,dy=e.y-a.y, front=dx*nx+dy*ny, side=dx*px+dy*py;
    if(Math.abs(front)<42+e.r&&Math.abs(side)<a.width/2+e.r){ applyDamage(e,a.dmg,{critRate:R.buffs.crit||0,knock:0.8,kx:nx,ky:ny}); e.hitFlash=0.08; } });
}
function updateUltBolt(a,dt){
  a.life-=dt; a.next-=dt;
  while(a.left>0&&a.next<=0){ a.next+=0.24; a.left--; strikeUltBolt(a); }
}
function strikeUltBolt(a){
  const targets=strongTargets(8), t=targets.length?targets[rint(0,targets.length-1)]:null;
  const x=t?t.x:R.cam.x+rnd(-CW*.35,CW*.35), y=t?t.y:R.cam.y+rnd(-CH*.35,CH*.35);
  R.ultFx.push({type:'bolt',x,y,hue:a.hue,life:0.24,maxLife:0.24});
  forEachNear(x,y,a.radius+30,e=>{ if(e.dead)return; if(dist2(x,y,e.x,e.y)<(a.radius+e.r)*(a.radius+e.r)){ applyDamage(e,a.dmg,{critRate:R.buffs.crit||0,knock:0.6,kx:(e.x-x)/(Math.hypot(e.x-x,e.y-y)||1),ky:(e.y-y)/(Math.hypot(e.x-x,e.y-y)||1)}); e.hitFlash=0.16; } });
  pushPart(x,y,'#fff59d',14,200); R.shake=Math.max(R.shake,0.18);
}
function updateUltRaid(a,dt){
  a.life-=dt;
  for(const r of a.riders){
    r.phase+=dt*8; r.x+=r.vx*dt;
    forEachNear(r.x,r.y,54,e=>{ if(e.dead||r.hit.has(e))return; if(dist2(r.x,r.y,e.x,e.y)<(54+e.r)*(54+e.r)){
      applyDamage(e,a.dmg,{critRate:R.buffs.crit||0,knock:1.5,kx:Math.sign(r.vx),ky:0}); e.hitFlash=0.1; bossCounter(e); r.hit.add(e); } });
  }
}

function updateDoomFx(dt){
  if(!(R.scene&&R.scene.kind==='doom')){ R.timeScale=1; return; }
  const rem=R.scene.dur-R.t;
  const fx=R.doomFx||(R.doomFx={beat:0,arrows:[],impacts:[],spawned:false,holding:false,hold:0,hitSfx:0});
  R.timeScale=fx.holding?0:(rem<=0.8?0.3:1);
  if(fx.holding){
    fx.hold+=dt;
    R.shake=Math.max(R.shake,0.18);
    if(fx.hold>=1){ doomEnd(); return; }
  }
  if(rem<=4){
    fx.beat-=dt;
    if(fx.beat<=0){ fx.beat=rem<=0.8?0.25:0.48; window.SFX&&SFX.play('hurt'); }
    R.shake=Math.max(R.shake,rem<=0.8?0.7:0.24);
    if(rem<=3 && !fx.spawned){
      fx.spawned=true; R.flash=Math.max(R.flash,0.6); R.shake=Math.max(R.shake,0.65);
      const p=R.player, rad=Math.max(CW,CH)*0.84+180;
      for(let side=0;side<8;side++){
        const base=side*TAU/8, per=12+rint(0,8);
        for(let j=0;j<per;j++){
          const lane=(j-(per-1)/2)*18+rnd(-9,9), dist=rad+rnd(-30,45);
          const txOff=rnd(-12,12), tyOff=rnd(-12,12);
          const sx=p.x+Math.cos(base)*dist+Math.cos(base+Math.PI/2)*lane;
          const sy=p.y+Math.sin(base)*dist+Math.sin(base+Math.PI/2)*lane;
          fx.arrows.push({sx,sy,x:sx,y:sy,a:base+Math.PI,t:0,delay:rnd(0,1.9)+side*0.025,life:rnd(1.05,1.45),txOff,tyOff,hit:false,size:rnd(38,48)});
        }
      }
    }
  }
  if(fx.hitSfx>0)fx.hitSfx-=dt;
  if(fx.arrows.length){
    const p=R.player;
    for(const ar of fx.arrows){
      if(ar.delay>0){ ar.delay-=dt; continue; }
      ar.t+=dt;
      const k=clamp(ar.t/ar.life,0,1), e=k*k*(3-2*k), tx=p.x+ar.txOff, ty=p.y+ar.tyOff;
      ar.x=ar.sx+(tx-ar.sx)*e; ar.y=ar.sy+(ty-ar.sy)*e;
      ar.a=Math.atan2(ty-ar.y,tx-ar.x);
      if(k>=0.985&&!ar.hit){
        ar.hit=true; fx.impacts.push({x:tx,y:ty,life:0.18,maxLife:0.18});
        R.flash=Math.max(R.flash,0.2); R.shake=Math.max(R.shake,0.45);
        if(fx.hitSfx<=0){ fx.hitSfx=0.06; window.SFX&&SFX.play('hurt'); }
      }
    }
    fx.arrows=fx.arrows.filter(ar=>ar.delay>0||ar.t<ar.life);
  }
  if(fx.impacts.length){
    for(const im of fx.impacts)im.life-=dt;
    fx.impacts=fx.impacts.filter(im=>im.life>0);
  }
}
function beginDoomHold(){
  const fx=R.doomFx||(R.doomFx={beat:0,arrows:[],impacts:[],spawned:true,holding:false,hold:0,hitSfx:0});
  if(fx.holding)return;
  fx.holding=true; fx.hold=0; fx.fallen=true;
  R.player.hp=0; R.flash=Math.max(R.flash,1); R.shake=Math.max(R.shake,1); R.timeScale=0;
}

function updateEnemies(dt){
  const p=R.player;
  const fieldR2=(R.lord.sig&&R.lord.sig.slowFieldR)? R.lord.sig.slowFieldR*R.lord.sig.slowFieldR : 0;  // 諸葛亮「八陣図」: 周囲の敵を減速
  const fieldAmt=R.lord.sig? (R.lord.sig.slowAmt||0):0;
  for(const e of R.enemies){
    if(e.dead)continue;
    if(e.hitFlash>0)e.hitFlash-=dt;
    if(e.stunT>0){ e.stunT-=dt; if(e.stunT<0)e.stunT=0; continue; }
    if(e.slowT>0)e.slowT-=dt;
    const field=(fieldR2 && dist2(p.x,p.y,e.x,e.y)<fieldR2)?(1-fieldAmt):1;
    const ultSlow=(R.ult&&R.ult.enemySlowT>0)?(1-(R.ult.enemySlowAmt||0)):1;
    const sf=(e.slowT>0?(1-(e.slowAmt||0)):1)*field*ultSlow;
    if(e.isBoss){ updateBoss(e,dt); }
    else {
      const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
      const spd=e.speed*sf;
      if(e.behavior==='ranged'){
        // 一定距離保ち射撃
        const want=(e.range||300)*0.7;
        const dir=(d>want?1:-0.6);
        e.x+=dx/d*spd*dir*dt; e.y+=dy/d*spd*dir*dt;
        e.shootCd-=dt; if(e.shootCd<=0 && d<(e.range||320)){ e.shootCd=e.shootEvery;
          const sp=e.shotSpeed||220; R.eproj.push({x:e.x,y:e.y,vx:dx/d*sp,vy:dy/d*sp,r:e.magic?8:5,dmg:e.dmg,life:3,hue:e.magic?285:e.hue,magic:e.magic}); }
      } else if(e.behavior==='dasher'){
        e.dashCd-=dt;
        if(e.dashT>0){ e.dashT-=dt; e.x+=e.dvx*sf*dt; e.y+=e.dvy*sf*dt; }
        else if(e.dashCd<=0 && d<420){ e.dashCd=e.dashEvery; e.dashT=0.5; e.dvx=dx/d*260; e.dvy=dy/d*260; }
        else { e.x+=dx/d*spd*dt; e.y+=dy/d*spd*dt; }
      } else if(e.behavior==='beamer'){
        // 予告(aimT)→消せない色付き貫通ビーム。予告中に避ければ被弾しない
        const want=(e.range||520)*0.62, dir=(d>want?1:-0.5);
        if(e.aimT>0){ e.aimT-=dt; e.x+=dx/d*spd*0.18*dt; e.y+=dy/d*spd*0.18*dt;
          if(e.aimT<=0){ const sp=e.shotSpeed||560, a=e.aimAng;
            R.eproj.push({x:e.x,y:e.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:9,dmg:e.dmg,life:1.7,hue:(e.beamHue!=null?e.beamHue:315),pierce:true,beam:true}); } }
        else { e.x+=dx/d*spd*dir*dt; e.y+=dy/d*spd*dir*dt;
          e.shootCd-=dt; if(e.shootCd<=0 && d<(e.range||540) && Math.abs(e.x-R.cam.x)<CW/2+50 && Math.abs(e.y-R.cam.y)<CH/2+50){ e.shootCd=e.shootEvery||3.4; e.aimT=0.72; e.aimAng=Math.atan2(dy,dx); } }
      } else if(e.behavior==='lancer'){
        e.dashCd-=dt;
        if(e.aimT>0){ e.aimT-=dt; if(e.aimT<=0){ e.dvx=Math.cos(e.aimAng)*440; e.dvy=Math.sin(e.aimAng)*440; e.dashT=0.55; } }
        else if(e.dashT>0){ e.dashT-=dt; e.x+=e.dvx*sf*dt; e.y+=e.dvy*sf*dt; }
        else if(e.dashCd<=0 && d<480){ e.dashCd=e.dashEvery||3.2; e.aimT=0.5; e.aimAng=Math.atan2(dy,dx); }
        else { e.x+=dx/d*spd*dt; e.y+=dy/d*spd*dt; }
      } else {
        e.x+=dx/d*spd*dt; e.y+=dy/d*spd*dt;
      }
    }
    // プレイヤー接触
    const pr=e.r+11;
    if(dist2(p.x,p.y,e.x,e.y)<pr*pr){
      if(p.ifr<=0){ hitPlayer(e.dmg*(e.isBoss?1: (e.behavior==='ranged'?0.4:1))); p.ifr=0.6;
        // 堅守反撃(司馬懿君主)
        if(R.buffs.thorns){ applyDamage(e, R.player.maxHp*0.0+ (20+R.player.level*3)*R.buffs.thorns, {}); }
      }
    }
  }
}
function hitPlayer(dmg){
  let drB=R.buffs.dr||0;
  if(R.lord.sig&&R.lord.sig.lastStand){ drB += (1-R.player.hp/R.player.maxHp)*R.lord.sig.lastStand; }  // 司馬懿「堅忍」: HPが減るほど硬くなる
  let d=dmg*(1-Math.min(0.85,drB));
  const sh=R.ult&&R.ult.shield;
  if(sh&&sh.t>0&&sh.absorb>0){ const block=Math.min(d,sh.absorb); sh.absorb-=block; d-=block; if(block>0){ R.flash=Math.max(R.flash,0.12); pushPart(R.player.x,R.player.y,'#9fffc2',4,110); } }
  if(d<=0)return;
  R.player.hp-=d; R.flash=0.25; R.shake=0.3; window.SFX&&SFX.play('hurt');
  pushPart(R.player.x,R.player.y,'#ff5252',6,140);
  if(R.lord.sig&&R.lord.sig.ragePulse){  // 董卓「暴虐」: 被弾するたび周囲を吹き飛ばす衝撃波
    R.novas.push({x:R.player.x,y:R.player.y,r:6,maxR:120,life:0.3,maxLife:0.3,hue:20,dmg:(12+R.player.level*1.6)*(1+(R.buffs.dmg||0)),knock:1.0,crit:R.buffs.crit||0,hitSet:new Set()});
    R.shake=0.4;
  }
}
// 敵被弾時のボスcounter
function bossCounter(e){
  if(e.isBoss && e.mech.includes('counter') && Math.random()<0.08){
    const p=R.player; const a=Math.atan2(p.y-e.y,p.x-e.x);
    for(let i=-1;i<=1;i++){const aa=a+i*0.25;R.eproj.push({x:e.x,y:e.y,vx:Math.cos(aa)*260,vy:Math.sin(aa)*260,r:6,dmg:e.dmg*0.5,life:2.5,hue:e.hue,pierce:true});}
  }
}
G.bossCounter=bossCounter;

function updateEproj(dt){
  const p=R.player;
  // ★自分の攻撃に当てた敵弾は消せる(ヴァンサバ流)。弾/薙ぎ/衝撃波/突進/陣・火計/旋回刃 すべてが消去源
  const hb=[], orbits=[];
  for(const w of R.weapons){ const o=w._orbit; if(o){ for(let i=0;i<o.n;i++){ const a=o.ang+i*TAU/o.n; const bl={x:p.x+Math.cos(a)*o.rad,y:p.y+Math.sin(a)*o.rad,r:o.size+9}; hb.push(bl); orbits.push(bl); } } }
  for(const s of R.swings){ hb.push({x:s.x,y:s.y,r:(s.reach||60)*0.95,ang:s.ang,arc:s.arc}); }
  for(const pr of R.proj){ hb.push({x:pr.x,y:pr.y,r:(pr.r||6)+5}); }
  for(const n of R.novas){ if(!n.enemy) hb.push({x:n.x,y:n.y,r:n.r+6}); }
  for(const d of R.dashes){ hb.push({x:d.x,y:d.y,r:(d.w||30)+9}); }
  for(const z of R.zones){ if(!z.enemy) hb.push({x:z.x,y:z.y,r:z.r}); }
  const sigDef=R.lord.sig&&R.lord.sig.eprojDeflect;
  function inHB(list,b){ for(const h of list){ const rr=h.r+b.r; if(dist2(b.x,b.y,h.x,h.y)<rr*rr){
    if(h.arc!==undefined){ const a=Math.atan2(b.y-h.y,b.x-h.x); const dd=Math.abs(((a-h.ang+Math.PI)%TAU+TAU)%TAU-Math.PI); if(dd>h.arc/2+0.35) continue; }
    return true; } } return false; }
  for(const b of R.eproj){ b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.pierce){ // ボス予告弾(金リング)=避ける用。呂布「無双」だけは旋回戟で弾ける
      if(sigDef && inHB(orbits,b)){ b.life=0; pushPart(b.x,b.y,'#ffd54f',3,80); continue; }
    } else if(inHB(hb,b)){ b.life=0; pushPart(b.x,b.y,'#ffd54f',4,90); continue; }
    if(b.life>0 && dist2(b.x,b.y,p.x,p.y)<(b.r+10)*(b.r+10)){ if(p.ifr<=0){hitPlayer(b.dmg);p.ifr=0.5;} b.life=0; }
  }
  R.eproj=R.eproj.filter(b=>b.life>0);
}

function updateSwings(dt){
  for(const s of R.swings){ s.life-=dt; if(s.follow){s.x=R.player.x;s.y=R.player.y;} }
  R.swings=R.swings.filter(s=>s.life>0);
}
function updateProj(dt){
  for(const pr of R.proj){
    if(pr.boomerang){ pr.phase+=dt; if(pr.t<pr.range/pr.spd){pr.t+=dt;} else {const dx=R.player.x-pr.x,dy=R.player.y-pr.y,d=Math.hypot(dx,dy)||1;pr.vx=dx/d*pr.spd;pr.vy=dy/d*pr.spd; if(d<16)pr.life=0;} }
    pr.x+=pr.vx*dt; pr.y+=pr.vy*dt; pr.life-=dt;
    forEachNear(pr.x,pr.y,pr.r+24,e=>{ if(e.dead||pr.hit.has(e))return;
      if(dist2(pr.x,pr.y,e.x,e.y)<(pr.r+e.r)*(pr.r+e.r)){
        const d=Math.hypot(pr.vx,pr.vy)||1;
        applyDamage(e,pr.dmg,{critRate:pr.crit,knock:pr.knock,kx:pr.vx/d,ky:pr.vy/d}); e.hitFlash=0.08; bossCounter(e);
        pr.hit.add(e); pr.pierce--; if(pr.pierce<0)pr.life=0;
      }
    });
  }
  R.proj=R.proj.filter(pr=>pr.life>0);
}
function updateNovas(dt){
  for(const n of R.novas){ n.life-=dt; const k=1-n.life/n.maxLife; n.r=6+(n.maxR-6)*k;
    if(n.enemy){ if(dist2(n.x,n.y,R.player.x,R.player.y)<(n.r+10)*(n.r+10)&&!n.hitP){n.hitP=true;if(R.player.ifr<=0){hitPlayer(n.dmg);R.player.ifr=0.4;}} continue; }
    if(!n.hitSet)n.hitSet=new Set();
    forEachNear(n.x,n.y,n.r+20,e=>{ if(e.dead||n.hitSet.has(e))return; if(dist2(n.x,n.y,e.x,e.y)<(n.r+e.r)*(n.r+e.r)){const dx=e.x-n.x,dy=e.y-n.y,d=Math.hypot(dx,dy)||1;applyDamage(e,n.dmg,{critRate:n.crit,knock:n.knock,kx:dx/d,ky:dy/d});e.hitFlash=0.08;bossCounter(e);n.hitSet.add(e);}});
  }
  R.novas=R.novas.filter(n=>n.life>0);
}
function updateDashes(dt){
  for(const ds of R.dashes){ ds.x+=ds.vx*dt;ds.y+=ds.vy*dt;ds.traveled+=Math.hypot(ds.vx,ds.vy)*dt;ds.life-=dt; if(ds.traveled>=ds.len)ds.life=0;
    if(ds.trail&&Math.random()<0.5)R.zones.push({x:ds.x,y:ds.y,r:34,life:1.6,maxLife:1.6,tick:0.3,nextTick:0,dmg:ds.dmg*0.25,hue:18,cool:new Map()});
    forEachNear(ds.x,ds.y,ds.w+24,e=>{ if(e.dead||ds.hit.has(e))return; if(dist2(ds.x,ds.y,e.x,e.y)<(ds.w+e.r)*(ds.w+e.r)){const d=Math.hypot(ds.vx,ds.vy)||1;applyDamage(e,ds.dmg,{critRate:ds.crit,knock:ds.knock,kx:ds.vx/d,ky:ds.vy/d});e.hitFlash=0.08;bossCounter(e);ds.hit.add(e);}});
  }
  R.dashes=R.dashes.filter(d=>d.life>0);
}
function updateZones(dt){
  for(const z of R.zones){ z.life-=dt; if(z.warn>0)z.warn-=dt; z.nextTick-=dt;
    if(z.nextTick<=0){ z.nextTick=z.tick;
      if(z.enemy){ if(z.warn<=0 && dist2(z.x,z.y,R.player.x,R.player.y)<(z.r+10)*(z.r+10)){if(R.player.ifr<=0){hitPlayer(z.dmg);R.player.ifr=0.3;}} }  // 予告中(warn>0)はダメージなし
      else { forEachNear(z.x,z.y,z.r+20,e=>{ if(e.dead)return; if(dist2(z.x,z.y,e.x,e.y)<(z.r+e.r)*(z.r+e.r)){applyDamage(e,z.dmg,{critRate:z.crit||0});e.hitFlash=0.06;} }); }
    }
  }
  R.zones=R.zones.filter(z=>z.life>0);
}
function updateMinions(dt){
  for(const m of R.minions){ m.life-=dt; if(m.life<=0)continue;
    const tgt=nearestEnemy(m.x,m.y,360);
    if(tgt){ const dx=tgt.x-m.x,dy=tgt.y-m.y,d=Math.hypot(dx,dy)||1;
      if(d>tgt.r+14){ m.x+=dx/d*m.speed*dt; m.y+=dy/d*m.speed*dt; }
      else { m.atk-=dt; if(m.atk<=0){m.atk=m.atkCd; applyDamage(tgt,m.dmg,{critRate:m.crit,knock:0.4,kx:dx/d,ky:dy/d}); tgt.hitFlash=0.06; bossCounter(tgt);} }
    } else { const dx=R.player.x-m.x,dy=R.player.y-m.y,d=Math.hypot(dx,dy)||1; if(d>40){m.x+=dx/d*m.speed*dt;m.y+=dy/d*m.speed*dt;} }
  }
  R.minions=R.minions.filter(m=>m.life>0);
}
// ── 壺(ピックアップ): heal=回復 / vacuum=経験値全吸収 / clear=全敵破壊(破軍) ──
function spawnJar(type,x,y){
  if(!type){ const r=rnd(10); type = r<5?'heal' : (r<8?'vacuum':'clear'); }
  if(x===undefined){ const a=rnd(TAU), d=rnd(170,300); x=R.player.x+Math.cos(a)*d; y=R.player.y+Math.sin(a)*d; }
  R.jars.push({x,y,type,r:13,bob:rnd(TAU),taken:false});
}
G.spawnJar=spawnJar;
function updateJars(dt){
  const p=R.player;
  for(const j of R.jars){ j.bob+=dt*4;
    if(dist2(j.x,j.y,p.x,p.y) < (j.r+13)*(j.r+13)){ triggerJar(j); j.taken=true; }
  }
  R.jars=R.jars.filter(j=>!j.taken);
}
function triggerJar(j){
  pushPart(j.x,j.y,'#caa07a',8,140);
  if(j.type==='heal'){
    const h=Math.round(R.player.maxHp*0.35); R.player.hp=Math.min(R.player.maxHp,R.player.hp+h);
    pushText(R.player.x,R.player.y-42,'回復 +'+h,'#69f0ae',1.5,22); pushPart(R.player.x,R.player.y,'#69f0ae',18,170);
  } else if(j.type==='vacuum'){
    for(const g of R.gems){ gainXp(g.xp); g.taken=true; }   // その瞬間の全gemを即時回収。永続mag化は解除コードが無くレベル天井を壊すのでしない
    R.gems=R.gems.filter(g=>!g.taken);
    pushText(R.player.x,R.player.y-42,'経験値 全吸収','#82b1ff',1.5,22); pushPart(R.player.x,R.player.y,'#82b1ff',18,200);
  } else { // clear=破軍: 画面の雑魚を一掃(ボスは大ダメージ)
    let n=0;
    for(const e of R.enemies){ if(e.dead)continue;
      if(e.isBoss){ applyDamage(e, Math.max(1,Math.round(e.maxHp*0.08)), {}); }
      else { e.explode=0; killEnemy(e); n++; } }
    R.flash=0.7; R.shake=0.6;
    pushText(R.player.x,R.player.y-42,'破軍 '+n+'体撃破','#ff8a65',1.7,24);
  }
}

function updateGems(dt){
  const p=R.player; const mag=118*(1+(R.buffs.magnet||0))*R.lord.baseMagnet;
  const soft=mag*(1.6+(R.buffs.magnet||0)); // 磁石特化(軍旗/孫堅)ほど吸引が伸びる
  for(const g of R.gems){
    const dx=p.x-g.x,dy=p.y-g.y,d=Math.hypot(dx,dy)||1;
    if(g.mag||d<mag){ g.mag=true; const sp=Math.min(620,Math.max(120,300+(1-d/220)*340)); g.x+=dx/d*sp*dt; g.y+=dy/d*sp*dt; // 下限clampで遠いmag gemが負速で逃げる事故を防ぐ
      if(d<15){ gainXp(g.xp); g.taken=true; window.SFX&&SFX.play('xp'); } }
    else if(d<soft){ const sp=90; g.x+=dx/d*sp*dt; g.y+=dy/d*sp*dt; } // 遠くのジェムも緩く寄ってくる
  }
  R.gems=R.gems.filter(g=>!g.taken);
}

// ── 描画 ───────────────────────────────────
function render(){
  if(!R)return;
  const bg=R.stage.bg;
  ctx.fillStyle=bg.ground; ctx.fillRect(0,0,CW,CH);
  let sx=0,sy=0; if(R.shake>0){sx=rnd(-1,1)*R.shake*8;sy=rnd(-1,1)*R.shake*8;}
  const zoom=doomZoom();
  ctx.save(); ctx.translate(CW/2+sx, CH/2+sy); if(zoom!==1)ctx.scale(zoom,zoom); ctx.translate(-R.cam.x, -R.cam.y);
  drawGrid(bg);
  drawDoomWorld();
  // 君主シグネチャの場(視認用)
  if(R.lord.sig&&R.lord.sig.slowFieldR){ const r=R.lord.sig.slowFieldR; ctx.beginPath();ctx.arc(R.player.x,R.player.y,r,0,TAU);
    ctx.globalAlpha=0.10+0.04*Math.sin(R.t*3); ctx.fillStyle='#7e57c2'; ctx.fill();
    ctx.globalAlpha=0.35; ctx.strokeStyle='#b39ddb'; ctx.lineWidth=2; ctx.stroke(); ctx.globalAlpha=1; }
  // zones(地面)
  for(const z of R.zones)drawZone(z);
  // field(陣/オーラ)・orbit は weapons が描く
  G.Weapons.draw(ctx,R);
  // gems
  for(const g of R.gems){ ctx.fillStyle='#0d2614'; ctx.fillRect(g.x-4,g.y-4,8,8); ctx.fillStyle='#5dff86'; ctx.fillRect(g.x-3,g.y-3,6,6); ctx.fillStyle='#e0ffe8'; ctx.fillRect(g.x-3,g.y-3,6,2); }  // 縁取り付き緑クリスタル=拾う物
  // minions
  for(const m of R.minions){ const s=window.Sprites.minionSprite(R.lord.faction,((R.t*6)|0)&1); blit(s,m.x,m.y,22); }
  // enemies
  for(const e of R.enemies)drawEnemy(e);
  // jars(壺ピックアップ)
  for(const j of R.jars){ const yy=j.y+Math.sin(j.bob)*2;
    ctx.globalAlpha=0.30+0.25*(0.5+0.5*Math.sin(j.bob*1.6));
    ctx.fillStyle=j.type==='heal'?'#69f0ae':(j.type==='clear'?'#ff8a65':'#82b1ff');
    ctx.beginPath();ctx.arc(j.x,yy,17,0,TAU);ctx.fill(); ctx.globalAlpha=1;
    blit(window.Sprites.jar(j.type),j.x,yy,26);
  }
  // player
  drawPlayer();
  // 攻撃描画
  for(const s of R.swings)drawSwing(s);
  for(const pr of R.proj)drawProj(pr);
  for(const n of R.novas)drawNova(n);
  for(const d of R.dashes)drawDash(d);
  drawUltEffects();
  drawDoomArrows();
  // 敵弾
  for(const b of R.eproj){
    if(b.beam){ // 消せない貫通ビーム=色付きの長い閃光＋金リング
      ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(Math.atan2(b.vy,b.vx)); const L=b.r*3.4;
      ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(-L-2,-b.r-2,L*2+4,b.r*2+4);
      ctx.fillStyle='hsl('+(b.hue!=null?b.hue:315)+',95%,62%)'; ctx.fillRect(-L,-b.r,L*2,b.r*2);
      ctx.fillStyle='#fff'; ctx.fillRect(-L*0.45,-b.r*0.4,L*0.9,b.r*0.8); ctx.restore();
      ctx.strokeStyle='#ffe14d'; ctx.lineWidth=2.5; ctx.beginPath();ctx.arc(b.x,b.y,b.r+4,0,TAU);ctx.stroke(); continue; }
    const ba=Math.atan2(b.vy,b.vx), spr=window.Sprites.proj('arrow',b.magic?285:(b.hue||8),ba,0);
    const size=Math.max(30,b.r*4.6);
    drawProjectileSprite(spr,b.x,b.y,size,ba,true);
    if(b.pierce){ ctx.strokeStyle='#ffe14d'; ctx.lineWidth=2.5; ctx.beginPath();ctx.arc(b.x,b.y,b.r+3.5,0,TAU);ctx.stroke(); } }
  // 粒子
  for(const pa of R.parts){ ctx.globalAlpha=Math.max(0,pa.life*2); ctx.fillStyle=pa.col; ctx.fillRect(pa.x-pa.r/2,pa.y-pa.r/2,pa.r,pa.r); } ctx.globalAlpha=1;
  // テキスト
  for(const t of R.texts){ ctx.globalAlpha=Math.max(0,t.life*1.4); ctx.font='bold '+t.size+'px "DotGothic16", ui-monospace,monospace'; ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.strokeText(t.s,t.x,t.y); ctx.fillStyle=t.col; ctx.fillText(t.s,t.x,t.y); } ctx.globalAlpha=1; ctx.textAlign='left';
  ctx.restore();
  drawDoomOverlay();
  if(R.flash>0){ ctx.fillStyle='rgba(255,80,80,'+Math.min(0.4,R.flash*0.4)+')'; ctx.fillRect(0,0,CW,CH); }
}
function drawGrid(bg){
  const pat=ctx.createPattern(window.Sprites.floorTile(bg),'repeat');
  ctx.fillStyle=pat||bg.ground;
  ctx.fillRect(R.cam.x-CW/2-96,R.cam.y-CH/2-96,CW+192,CH+192);
}
function blit(s,x,y,size,flip){ const h=size*s.height/s.width; ctx.save(); ctx.translate(x,y); if(flip)ctx.scale(-1,1); ctx.drawImage(s,-size/2,-h/2,size,h); ctx.restore(); }
function enemyDrawScale(e){ return (e.isBoss?1.8:((e.elite||e.big)?1.5:1.35))*PACE.enemyDrawMul; }  // PACE.enemyDrawMulで約12%縮小(雑兵28-32px級)
function drawEnemy(e){
  // 画面外の雑魚は描画しない(終盤の大物量でも描画負荷を抑える)
  const ds=enemyDrawScale(e);
  if(!e.isBoss){ const m=Math.max(96,e.r*2.3*ds); if(e.x<R.cam.x-CW/2-m||e.x>R.cam.x+CW/2+m||e.y<R.cam.y-CH/2-m||e.y>R.cam.y+CH/2+m) return; }
  const frame=((R.t*7+e.x*0.01+e.y*0.01)|0)&1;
  const s= e.isBoss? window.Sprites.bossSprite(e.shape,e.hue,frame) : window.Sprites.enemy(e.shape,e.hue,e.r>22?1:0,frame);
  const size=e.r*2.3*ds; const flip=R.player.x<e.x;
  // ボスの予告テレグラフ(スプライトの下に描く)
  if(e.isBoss && e.windup){ const w=e.windup, pulse=0.5+0.5*Math.sin(R.t*20);
    if(w.m==='charge'){  // 突進方向の赤い予告ライン＋矢印(避ける)
      ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(w.ang); const len=320, hw=e.r*0.9;
      ctx.globalAlpha=0.22+0.22*pulse; ctx.fillStyle='hsl(6,95%,55%)'; ctx.fillRect(0,-hw,len,hw*2);
      ctx.globalAlpha=0.7+0.3*pulse; ctx.fillStyle='#ff5a2a'; ctx.beginPath();ctx.moveTo(len,-hw*1.4);ctx.lineTo(len+26,0);ctx.lineTo(len,hw*1.4);ctx.closePath();ctx.fill();
      ctx.restore(); ctx.globalAlpha=1;
    } else {  // volley/spin: 溜めの黄リング
      ctx.globalAlpha=0.45+0.4*pulse; ctx.strokeStyle='hsl(45,100%,60%)'; ctx.lineWidth=3.5;
      ctx.beginPath();ctx.arc(e.x,e.y,e.r+8+pulse*10,0,TAU);ctx.stroke(); ctx.globalAlpha=1; }
  }
  // 脅威敵の予告(beamer=色付きビーム線 / lancer=突進線)。避けられるよう発射前に表示
  if(!e.isBoss && e.aimT>0){ const pulse=.5+.5*Math.sin(R.t*22), beam=e.behavior==='beamer';
    ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(e.aimAng);
    ctx.globalAlpha=.22+.34*pulse; ctx.strokeStyle=beam?('hsl('+(e.beamHue!=null?e.beamHue:315)+',92%,62%)'):'hsl(8,95%,58%)';
    ctx.lineWidth=beam?7:e.r*1.6; ctx.setLineDash([12,9]);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(beam?640:360,0); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); ctx.globalAlpha=1; }
  if(e.hitFlash>0){ ctx.globalAlpha=1; }
  blit(s,e.x,e.y,size,flip);
  if(e.hitFlash>0){ ctx.globalAlpha=e.hitFlash*4; ctx.fillStyle='#fff'; ctx.fillRect(e.x-size/2,e.y-size/2,size,size*s.height/s.width); ctx.globalAlpha=1; }
  // 激昂(enrage): 赤いオーラで「強くなった」を明示
  if(e.isBoss && e.enraged){ ctx.globalAlpha=Math.min(0.6,0.22+0.13*Math.sin(R.t*6)+(e.enrageFlash>0?e.enrageFlash*0.5:0)); ctx.strokeStyle='#ff5252'; ctx.lineWidth=3; ctx.beginPath();ctx.arc(e.x,e.y,e.r+6,0,TAU);ctx.stroke(); ctx.globalAlpha=1; }
  if(e.elite||e.isBoss){ // HPバー(頭上)
    const w=e.r*2.4; const hp=clamp(e.hp/e.maxHp,0,1);
    const topY=e.y-(size*s.height/s.width)/2-10;
    ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(e.x-w/2,topY,w,4);
    ctx.fillStyle=e.isBoss?'#ff5252':'#ffb74d';ctx.fillRect(e.x-w/2,topY,w*hp,4);
    ctx.font=(e.isBoss?'12px':'10px')+' "DotGothic16", ui-monospace,monospace';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.78)';
    ctx.strokeText(e.name,e.x,topY-5);ctx.fillStyle=e.isBoss?'#ffe082':'#fff2c7';ctx.fillText(e.name,e.x,topY-5);ctx.textAlign='left';
  }
}
function drawPlayer(){
  const p=R.player; const g=(window.GENERALS&&window.GENERALS.find(x=>x.name===R.lord.start))||{id:R.lord.id,name:R.lord.name,weapon:'sword',faction:R.lord.faction};
  const attacking=p.atkT>0, atkAng=(p.atkAng!=null?p.atkAng:Math.atan2(p.facing.y,p.facing.x));
  const s=window.Sprites.hero(g,((R.t*8)|0)&1,attacking); const flip=(attacking?Math.cos(atkAng):p.facing.x)<0;
  const fallen=R.doomFx&&R.doomFx.fallen, size=s.width*3.9*PACE.heroDrawMul;  // PACE.heroDrawMulで約12%縮小(主役36-40px級)
  // 影
  ctx.fillStyle='rgba(0,0,0,.32)'; ctx.beginPath();ctx.ellipse(p.x,p.y+(fallen?18:17),fallen?26:22,fallen?8:7,0,0,TAU);ctx.fill();
  if(fallen){
    const h=size*s.height/s.width;
    ctx.save(); ctx.translate(p.x,p.y+7); ctx.rotate(Math.PI/2); if(flip)ctx.scale(-1,1);
    ctx.filter='grayscale(1) saturate(.35) contrast(.82)';
    ctx.drawImage(s,-size/2,-h/2,size,h);
    ctx.filter='none'; ctx.globalAlpha=0.45; ctx.fillStyle='rgba(70,0,0,.34)'; ctx.fillRect(-size/2,-h/2,size,h);
    ctx.restore(); ctx.globalAlpha=1; return;
  }
  if(p.ifr>0 && Math.floor(p.ifr*20)%2===0)ctx.globalAlpha=0.4;
  blit(s,p.x,p.y,size,flip); ctx.globalAlpha=1;
  if(attacking)drawPlayerWeaponLunge(g.weapon,p.x,p.y,atkAng);
}
function drawPlayerWeaponLunge(w,x,y,ang){
  const base=window.WBASE&&window.WBASE[w], hue=(base&&base.hue!=null)?base.hue:44;
  const spr=window.Sprites.weaponTip(w,hue,((R.t*10)|0)&1);
  const size=w==='podao'?42:(w==='halberd'?38:(w==='spear'||w==='charge')?36:(w==='bow'||w==='crossbow')?30:28);
  const h=size*spr.height/spr.width, dx=Math.cos(ang), dy=Math.sin(ang);
  ctx.save(); ctx.translate(x+dx*31,y+dy*31); ctx.rotate(ang);
  ctx.globalAlpha=0.28; ctx.drawImage(spr,-size/2-6,-h/2,size,h);
  ctx.globalAlpha=0.95; ctx.drawImage(spr,-size/2,-h/2,size,h);
  ctx.restore(); ctx.globalAlpha=1;
}
function drawSwing(s){
  const a=Math.max(0,s.life/s.maxLife), k=1-a, rad=s.reach*(0.80+0.20*k);
  const hue=s.hue, wt=s.wt||'sword', arc=s.arc, steps=Math.max(10,Math.floor(arc*rad/18));
  const mainCol=wt==='podao'?'#f4c542':(wt==='halberd'?'#f05a5a':('hsl('+hue+',86%,72%)'));
  ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.ang);
  ctx.lineCap='round';
  for(let tr=2;tr>=0;tr--){
    const rr=rad-tr*8, off=-tr*0.12, alpha=a*(tr===0?1:(tr===1?0.36:0.18));
    ctx.globalAlpha=alpha*0.55; ctx.strokeStyle='rgba(0,0,0,.82)'; ctx.lineWidth=tr===0?9:7;
    ctx.beginPath(); ctx.arc(0,0,rr,-arc/2+off,arc/2+off); ctx.stroke();
    ctx.globalAlpha=alpha; ctx.strokeStyle=mainCol; ctx.lineWidth=tr===0?(wt==='twin'?4:6):(tr===1?5:4);
    ctx.beginPath(); ctx.arc(0,0,rr,-arc/2+off,arc/2+off); ctx.stroke();
  }
  for(let i=0;i<=steps;i+=3){
    const t=steps?i/steps:0, aa=-arc/2+arc*t, rr=rad+((i&1)?-3:2), x=Math.cos(aa)*rr, y=Math.sin(aa)*rr;
    ctx.globalAlpha=(0.28+0.38*t)*a; ctx.fillStyle=i%6?'#fff2a8':'#ffffff'; ctx.fillRect(x-1,y-1,2,2);
  }
  const tipA=arc/2-0.08, tx=Math.cos(tipA)*rad, ty=Math.sin(tipA)*rad, spr=window.Sprites.weaponTip(wt,hue,((R.t*10)|0)&1);
  const size=wt==='podao'?46:(wt==='halberd'?42:(wt==='twin'?30:36)), hh=size*spr.height/spr.width;
  ctx.globalAlpha=a; ctx.translate(tx,ty); ctx.rotate(tipA); ctx.drawImage(spr,-size/2,-hh/2,size,hh);
  ctx.restore(); ctx.globalAlpha=1;
}
function drawProj(pr){
  const ang=Math.atan2(pr.vy,pr.vx)+((pr.boomerang?R.t*6:0)), ptype=pr.ptype||'blade';
  const spr=window.Sprites.proj(ptype,pr.hue,ang,((R.t*10)|0)&1);
  const size=Math.max(ptype==='arrow'?32:(ptype==='spear'?36:20),pr.r*(ptype==='arrow'?3.8:(ptype==='spear'?3.2:2.5)));
  drawProjectileSprite(spr,pr.x,pr.y,size,ang,ptype==='arrow'||ptype==='spear');
}
function drawProjectileSprite(spr,x,y,size,ang,trail){
  const stretch=trail?1.15:1, w=size*stretch, h=size*spr.height/spr.width;
  if(trail){
    ctx.globalAlpha=0.30; ctx.drawImage(spr,x-Math.cos(ang)*12-w/2,y-Math.sin(ang)*12-h/2,w,h);
    ctx.globalAlpha=1;
  }
  ctx.drawImage(spr,x-w/2,y-h/2,w,h);
}
function drawNova(n){
  const a=Math.max(0,n.life/n.maxLife), cnt=40, col='hsl('+n.hue+',85%,'+(n.enemy?55:66)+'%)';
  ctx.globalAlpha=a*0.85; ctx.fillStyle=col;
  for(let i=0;i<cnt;i++){ const ang=i*TAU/cnt+R.t*0.2, wob=(i%3)*3, x=n.x+Math.cos(ang)*(n.r+wob), y=n.y+Math.sin(ang)*(n.r+wob), sz=3+(i%2)*2; ctx.fillRect(x-sz/2,y-sz/2,sz,sz); }
  ctx.globalAlpha=a*0.20; ctx.fillStyle=col; ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,TAU);ctx.fill(); ctx.globalAlpha=1;
}
function drawDash(d){
  const ang=Math.atan2(d.vy,d.vx), spr=window.Sprites.proj('spear',d.hue,ang,0), size=Math.max(34,d.w*2.4), h=size*spr.height/spr.width;
  ctx.globalAlpha=0.85; ctx.drawImage(spr,d.x-size/2,d.y-h/2,size,h);
  ctx.globalAlpha=0.35; ctx.fillStyle='hsl('+d.hue+',85%,68%)';
  for(let i=1;i<6;i++){ ctx.fillRect(d.x-Math.cos(ang)*i*12-3,d.y-Math.sin(ang)*i*12-3,6-i*0.5,6-i*0.5); }
  ctx.globalAlpha=1;
}
function drawZone(z){
  if(z.enemy){  // 敵の危険ゾーン: 予告=破線リング＋上に「!」/発動=塗りつぶし赤。踏みっぱなし即死を回避
    const warn=z.warn>0, pulse=0.5+0.5*Math.sin(R.t*(warn?16:8));
    if(warn){
      ctx.globalAlpha=0.06+0.05*pulse; ctx.fillStyle='hsl(8,90%,52%)'; ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill();
      ctx.globalAlpha=0.58+0.34*pulse; ctx.fillStyle='hsl(10,95%,60%)';
      for(let i=0;i<40;i+=2){ const ang=i*TAU/40+R.t*0.08, sz=5; ctx.fillRect(z.x+Math.cos(ang)*z.r-sz/2,z.y+Math.sin(ang)*z.r-sz/2,sz,sz); }
      ctx.globalAlpha=1; ctx.font='bold 24px "DotGothic16", ui-monospace,monospace'; ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.strokeText('!',z.x,z.y-z.r-2); ctx.fillStyle='#ffcf3a'; ctx.fillText('!',z.x,z.y-z.r-2); ctx.textAlign='left';
    } else {
      ctx.globalAlpha=0.28+0.12*pulse; ctx.fillStyle='hsl(10,92%,50%)'; ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill();
      ctx.globalAlpha=0.85; ctx.fillStyle='hsl(16,95%,64%)';
      for(let i=0;i<44;i++){ const ang=i*TAU/44-R.t*0.04, sz=(i%3)?4:6; ctx.fillRect(z.x+Math.cos(ang)*z.r-sz/2,z.y+Math.sin(ang)*z.r-sz/2,sz,sz); }
    }
    ctx.globalAlpha=1; return;
  }
  const a=Math.min(1,z.life/ (z.maxLife*0.5)), pulse=0.5+0.5*Math.sin(R.t*8), cnt=36;
  ctx.globalAlpha=0.12+0.08*pulse; ctx.fillStyle='hsl('+z.hue+',85%,42%)'; ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill();
  ctx.globalAlpha=0.48*a; ctx.fillStyle='hsl('+z.hue+',90%,65%)';
  for(let i=0;i<cnt;i++){ const ang=i*TAU/cnt, rr=z.r+((i&1)?2:-3), sz=(i%4===0)?5:3; ctx.fillRect(z.x+Math.cos(ang)*rr-sz/2,z.y+Math.sin(ang)*rr-sz/2,sz,sz); }
  if(z.hue<40){ for(let i=0;i<10;i++){ const ang=(i*0.61+R.t*1.7)%TAU, rr=z.r*(0.15+((i*17)%70)/100); const spr=window.Sprites.proj('fire',z.hue,0,(i+R.t*8)|0); const sz=12; ctx.drawImage(spr,z.x+Math.cos(ang)*rr-sz/2,z.y+Math.sin(ang)*rr-sz/2,sz,sz); } }
  ctx.globalAlpha=1; }

function drawUltEffects(){
  if(!R.ult)return;
  const p=R.player;
  if(R.ult.shield&&R.ult.shield.t>0){
    const k=Math.max(0,Math.min(1,R.ult.shield.absorb/(R.ult.shield.max||1))), pulse=0.5+0.5*Math.sin(R.t*10);
    ctx.globalAlpha=0.14+0.16*pulse*k; ctx.fillStyle='#69f0ae'; ctx.beginPath();ctx.arc(p.x,p.y,34+8*pulse,0,TAU);ctx.fill();
    ctx.globalAlpha=0.65*k; ctx.strokeStyle='#b9ffd1'; ctx.lineWidth=3; ctx.beginPath();ctx.arc(p.x,p.y,38+4*pulse,0,TAU);ctx.stroke(); ctx.globalAlpha=1;
  }
  for(const a of R.ultActs){
    if(a.type==='spin'){
      const pulse=0.5+0.5*Math.sin(R.t*16), cnt=48;
      ctx.globalAlpha=0.22+0.12*pulse; ctx.strokeStyle='hsl('+a.hue+',90%,66%)'; ctx.lineWidth=4; ctx.beginPath();ctx.arc(p.x,p.y,a.radius,0,TAU);ctx.stroke();
      ctx.globalAlpha=0.75; ctx.fillStyle='hsl('+a.hue+',94%,72%)';
      for(let i=0;i<cnt;i+=2){ const aa=i*TAU/cnt+R.t*5, sz=4+(i%4); ctx.fillRect(p.x+Math.cos(aa)*a.radius-sz/2,p.y+Math.sin(aa)*a.radius-sz/2,sz,sz); }
      ctx.globalAlpha=1;
    } else if(a.type==='firewall'){
      const nx=Math.cos(a.a), ny=Math.sin(a.a), px=-ny, py=nx, n=32;
      ctx.globalAlpha=0.24; ctx.fillStyle='hsl(15,95%,45%)'; ctx.save(); ctx.translate(a.x,a.y); ctx.rotate(a.a); ctx.fillRect(-36,-a.width/2,72,a.width); ctx.restore();
      ctx.globalAlpha=0.92;
      for(let i=0;i<n;i++){ const off=-a.width/2+a.width*i/(n-1), wob=Math.sin(R.t*8+i)*10, x=a.x+px*off+nx*wob, y=a.y+py*off+ny*wob;
        const spr=window.Sprites.proj('fire',18,0,(R.t*10+i)|0), sz=18+(i%4)*3; ctx.drawImage(spr,x-sz/2,y-sz/2,sz,sz); }
      ctx.globalAlpha=1;
    } else if(a.type==='raid'){
      for(const r of a.riders){
        const spr=window.Sprites.hero(a.gen,((R.t*9+r.phase)|0)&1,false), size=46, h=size*spr.height/spr.width;
        ctx.save(); if(r.vx<0){ ctx.translate(r.x,r.y); ctx.scale(-1,1); ctx.drawImage(spr,-size/2,-h/2,size,h); } else ctx.drawImage(spr,r.x-size/2,r.y-h/2,size,h); ctx.restore();
        ctx.globalAlpha=0.38; ctx.fillStyle='hsl('+a.hue+',85%,70%)'; ctx.fillRect(r.x-Math.sign(r.vx)*28,r.y+13,34,4); ctx.globalAlpha=1;
      }
    }
  }
  for(const fx of R.ultFx){
    const k=Math.max(0,fx.life/(fx.maxLife||0.2));
    if(fx.type==='line'){
      ctx.globalAlpha=k; ctx.strokeStyle='hsl('+fx.hue+',96%,72%)'; ctx.lineWidth=5; ctx.beginPath();ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.x2,fx.y2);ctx.stroke();
      ctx.globalAlpha=k; ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath();ctx.moveTo(fx.x1,fx.y1);ctx.lineTo(fx.x2,fx.y2);ctx.stroke();
    } else if(fx.type==='bolt'){
      ctx.globalAlpha=k; ctx.strokeStyle='#fff59d'; ctx.lineWidth=6; ctx.beginPath();ctx.moveTo(fx.x-10,fx.y-260);ctx.lineTo(fx.x+8,fx.y-130);ctx.lineTo(fx.x-5,fx.y);ctx.stroke();
      ctx.globalAlpha=k*0.55; ctx.fillStyle='#fff59d'; ctx.beginPath();ctx.arc(fx.x,fx.y,36*(1-k)+14,0,TAU);ctx.fill();
    }
  }
  ctx.globalAlpha=1;
}

function drawDoomWorld(){
  if(!(R.scene&&R.scene.kind==='doom'))return;
  const rem=R.scene.dur-R.t;
  if(rem>4||rem<=3)return;
  const p=R.player, rad=Math.max(CW,CH)*0.78, pulse=0.5+0.5*Math.sin(R.t*18);
  ctx.globalAlpha=0.24+0.38*pulse; ctx.strokeStyle='#ff3b30'; ctx.lineWidth=3; ctx.setLineDash([12,10]);
  for(let i=0;i<8;i++){ const a=i*TAU/8+R.t*0.04, x=p.x+Math.cos(a)*rad, y=p.y+Math.sin(a)*rad;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(p.x+Math.cos(a)*34,p.y+Math.sin(a)*34); ctx.stroke(); }
  ctx.setLineDash([]); ctx.globalAlpha=1;
}
function drawDoomArrows(){
  const fx=R.doomFx; if(!fx)return;
  if(fx.arrows.length){ for(const a of fx.arrows){
    if(a.delay>0)continue;
    const spr=window.Sprites.proj('arrow',8,a.a,0), size=a.size||42;
    drawProjectileSprite(spr,a.x,a.y,size,a.a,true);
  } }
  if(fx.impacts&&fx.impacts.length){ for(const im of fx.impacts){
    const k=Math.max(0,im.life/im.maxLife), r=16*(1-k)+4;
    ctx.globalAlpha=k; ctx.fillStyle='#fff2d0'; ctx.beginPath(); ctx.arc(im.x,im.y,r,0,TAU); ctx.fill();
    ctx.globalAlpha=k*0.8; ctx.fillStyle='#ff3b30'; ctx.fillRect(im.x-r*.5,im.y-2,r,4);
    ctx.fillRect(im.x-2,im.y-r*.5,4,r); ctx.globalAlpha=1;
  }
  }
}
function drawDoomOverlay(){
  if(!(R.scene&&R.scene.kind==='doom'))return;
  const rem=R.scene.dur-R.t; if(rem>4)return;
  const hard=(R.doomFx&&R.doomFx.holding)?1:clamp((0.8-rem)/0.8,0,1);
  const k=Math.max(clamp((4-rem)/4,0,1),hard), edge=ctx.createRadialGradient(CW/2,CH/2,Math.min(CW,CH)*0.15,CW/2,CH/2,Math.max(CW,CH)*0.70);
  edge.addColorStop(0,'rgba(0,0,0,'+(0.06*k)+')');
  edge.addColorStop(0.54,'rgba(65,0,0,'+(0.16*k)+')');
  edge.addColorStop(1,'rgba(150,0,0,'+(0.68*k)+')');
  ctx.fillStyle=edge; ctx.fillRect(0,0,CW,CH);
  if(rem<=0.8||hard){ ctx.fillStyle='rgba(0,0,0,'+(0.16+0.14*Math.sin(R.t*18)+0.16*hard)+')'; ctx.fillRect(0,0,CW,CH); }
}
function doomZoom(){
  if(!(R&&R.scene&&R.scene.kind==='doom'))return 1;
  const rem=R.scene.dur-R.t, hold=(R.doomFx&&R.doomFx.holding)?1:0;
  return 1+0.08*Math.max(hold,clamp((0.8-rem)/0.8,0,1));
}

// 公開(HUD用)
G.hudData=()=>{ if(!R)return null; return {hp:R.player.hp,maxHp:R.player.maxHp,level:R.player.level,xp:R.player.xp,xpNext:R.player.xpNext,t:R.t,kills:R.player.kills,gold:Math.floor(R.player.goldFrac),weapons:R.weapons,passives:R.passives,boss:R.boss,stage:R.stage,sceneName:(R.scene&&R.scene.name)||'',ult:R.ult}; };
G.pauseToggle=(v)=>{ if(R)R.paused=v; };

})();
