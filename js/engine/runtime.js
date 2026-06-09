// runtime.js — ゲーム本体ランタイム。ループ/エンティティ/スポーン/当たり/XP/描画/ボス。
// 共有名前空間 G に状態(R)とヘルパを置き、weapons.js から呼ぶ。
window.G = window.G || {};
(function(){
const G = window.G;

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
    cam:{x:0,y:0},
    player:{x:0,y:0,hp:0,maxHp:0,move:1,magnet:1,facing:{x:1,y:0},ifr:0,
            level:1,xp:0,xpNext:5,gold:0,kills:0,goldFrac:0},
    weapons:[], passives:{},
    enemies:[], eproj:[], proj:[], swings:[], novas:[], dashes:[], zones:[], minions:[], gems:[], texts:[], parts:[], jars:[],
    spawnAcc:0, eliteIdx:0, boss:null, bossWarned:false, jarT:rnd(12,18),
    nextBossT: stage.endless? 300:stage.dur,
    grid:new Map(), GRID:72,
    buffs:{}, uid:1,
    flash:0, shake:0, timeScale:1,
  };
  // 開幕武将: 君主自身の武将を装備(所持扱い)。号令(aura)君主は攻撃手段の開幕武将も追加で持つ
  const equipStart=(name)=>{ const g=window.GENERALS.find(x=>x.name===name); if(g)addWeapon(g); return g; };
  const selfGen=equipStart(lord.start);
  const extraGen=lord.startExtra? equipStart(lord.startExtra):null;
  // 弱い開幕武将ほど高Lv始動で君主間の序盤格差を均す(攻撃する武器に適用。auraは攻撃しないのでextraが攻撃手)
  const atkGen=extraGen||selfGen;
  if(atkGen){ const w=R.weapons.find(x=>x.gen.id===atkGen.id); if(w){ const pw=atkGen.stat.pwr; w.level= pw<4?4:(pw<6?3:2); } }
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

// ── ダメージ適用 ───────────────────────────
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
  // ノックバック
  if(opts.knock&&opts.kx!==undefined){const kr=(1-(e.knockRes||0))*opts.knock*9;e.x+=opts.kx*kr;e.y+=opts.ky*kr;}
  // ダメージ表示(間引き)
  if(Math.random()<(crit?1:0.5)) pushText(e.x+rnd(-6,6),e.y-e.r-4,d,(crit?'#ffe082':'#fff'),crit?1.25:0.95,crit?17:13);
  if(e.hp<=0) killEnemy(e);
}
G.applyDamage=applyDamage;

function killEnemy(e){
  if(e.dead)return; e.dead=true;
  if(e.isBoss){ onBossDead(e); return; }
  R.player.kills++;
  // 軍功
  R.player.goldFrac += (e.gold||1)*window.ECON.killGold*(1+(R.buffs.gold||0));
  // 経験値ジェム
  R.gems.push({x:e.x,y:e.y,xp:e.xp||1,vx:0,vy:0,mag:false});
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
  let _pw=currentPhase().w; const _rg=(R.diff&&R.diff.ranged)||1;
  if(_rg!==1){ _pw=Object.assign({},_pw); for(const _k of ['archer','shaman']){ if(_pw[_k]) _pw[_k]=Math.max(0.01,_pw[_k]*_rg); } }
  const arch=weightedArch(_pw);
  const base=window.ENEMY_ARCH[arch];
  const re=(R.stage.recolor&&R.stage.recolor[arch])||{};
  const mn=R.t/60;
  const hpMul=R.stage.hpMul*(1+R.stage.growthPerMin*mn + mn*mn*0.02)*R.diff.ehp; // 後半は二次で硬くなり物量が脅威に
  const dmgMul=R.stage.dmgMul*(1+R.stage.growthPerMin*mn*0.6)*R.diff.edmg;
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
function gameOver(){ if(R.over)return; R.over=true; R.running=false; window.SFX&&SFX.play('death'); finalizeRewards(false); G.onGameOver&&G.onGameOver(buildResult(false)); }
function victory(){ if(R.over)return; R.over=true; R.victory=true; R.running=false; finalizeRewards(true); G.onVictory&&G.onVictory(buildResult(true)); }
function finalizeRewards(win){
  R.player.gold=Math.floor(R.player.goldFrac);
  R.earned = R.player.gold + Math.floor(R.t/60*window.ECON.surviveGoldPerMin) + (win? R.stage.reward.gold:Math.floor(R.stage.reward.gold*0.3));
  R.tickets = win? (R.stage.reward.ticket||0):0;
}
function buildResult(win){return {win,time:R.t,kills:R.player.kills,level:R.player.level,gold:R.earned,tickets:R.tickets,stage:R.stage,lord:R.lord,weapons:R.weapons.map(w=>({name:w.gen.name,level:w.level,rarity:w.gen.rarity,evo:!!w.evo}))};}
G.quitRun=()=>{ if(R){R.running=false;R.over=true;} };

// ── レベルアップ ───────────────────────────
function gainXp(n){
  R.player.xp+=n*(1+(R.buffs.xp||0))*1.8*R.diff.xp;  // ×1.8=経験値収入ノブ(6分で5武将MAX狙い)・難易度xp補正
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
    const poolIds = R.stage.restrict ? (R.stage.protagonist||[]) : (R.stage.levelPool || R.stage.roster || []);
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
  R.t+=dt;
  const p=R.player;
  // 入力→移動
  let ix=0,iy=0;
  if(keys['arrowleft']||keys['a'])ix-=1; if(keys['arrowright']||keys['d'])ix+=1;
  if(keys['arrowup']||keys['w'])iy-=1; if(keys['arrowdown']||keys['s'])iy+=1;
  if(touch.active){ix+=touch.dx;iy+=touch.dy;}
  const im=Math.hypot(ix,iy);
  if(im>0.01){ ix/=Math.max(1,im); iy/=Math.max(1,im); p.facing.x=ix;p.facing.y=iy; }
  const spd=130*R.lord.baseMove*(1+(R.buffs.move||0));
  p.x+=ix*spd*dt; p.y+=iy*spd*dt;
  // カメラ追従
  R.cam.x+=(p.x-R.cam.x)*Math.min(1,dt*8); R.cam.y+=(p.y-R.cam.y)*Math.min(1,dt*8);
  // 回復
  if(R.buffs.regen) p.hp=Math.min(p.maxHp,p.hp+R.buffs.regen*dt);
  if(p.ifr>0)p.ifr-=dt;
  if(R.flash>0)R.flash-=dt*2; if(R.shake>0)R.shake-=dt*2.5;

  // スポーン: 序盤からそこそこ群れ、時間で密度上限ごと伸ばす(後半は物量で殺しに来る)
  const cap=R.stage.endless? Math.min(130,40+Math.floor(R.t/45)*15) : Math.min(110,34+Math.floor(R.t/45)*14);
  const rate=Math.min(cap, R.stage.rate0*3.0 + (R.t/60)*(6.5 + R.stage.rateGrow*30));
  R.spawnAcc+=dt*rate*(R.boss?0.6:1);
  while(R.spawnAcc>=1){R.spawnAcc-=1; spawnEnemy();}
  // 精鋭
  while(R.stage.elites && !R.boss && R.eliteIdx<R.stage.elites.length && R.t>=R.stage.elites[R.eliteIdx].t){ spawnElite(R.stage.elites[R.eliteIdx]); R.eliteIdx++; }  // ボス出現中は精鋭を止める
  // ボス
  if(!R.boss && R.t>=R.nextBossT){ spawnBoss(); }
  if(R.boss && !R.bossWarned){R.bossWarned=true;}
  if(R.boss&&R.boss.dead)R.boss=null;

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
  for(const t of R.texts){t.y+=t.vy*dt;t.life-=dt;} R.texts=R.texts.filter(t=>t.life>0);
  for(const pa of R.parts){pa.x+=pa.vx*dt;pa.y+=pa.vy*dt;pa.vx*=0.92;pa.vy*=0.92;pa.life-=dt;} R.parts=R.parts.filter(pa=>pa.life>0);
  // 死亡敵除去
  R.enemies=R.enemies.filter(e=>!e.dead);

  if(p.hp<=0) gameOver();
  G.onHud&&G.onHud();
}

function updateEnemies(dt){
  const p=R.player;
  const fieldR2=(R.lord.sig&&R.lord.sig.slowFieldR)? R.lord.sig.slowFieldR*R.lord.sig.slowFieldR : 0;  // 諸葛亮「八陣図」: 周囲の敵を減速
  const fieldAmt=R.lord.sig? (R.lord.sig.slowAmt||0):0;
  for(const e of R.enemies){
    if(e.dead)continue;
    if(e.hitFlash>0)e.hitFlash-=dt;
    if(e.slowT>0)e.slowT-=dt;
    const field=(fieldR2 && dist2(p.x,p.y,e.x,e.y)<fieldR2)?(1-fieldAmt):1;
    const sf=(e.slowT>0?(1-(e.slowAmt||0)):1)*field;
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
  ctx.save(); ctx.translate(CW/2-R.cam.x+sx, CH/2-R.cam.y+sy);
  drawGrid(bg);
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
  for(const m of R.minions){ const s=window.Sprites.minionSprite(R.lord.faction); blit(s,m.x,m.y,16); }
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
  // 敵弾
  for(const b of R.eproj){
    // 敵弾は常に危険色(通常=橙/魔法=紫)に固定し緑のジェムと混同させない。暗い縁取りで地面から浮かせる
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.beginPath();ctx.arc(b.x,b.y,b.r+1.6,0,TAU);ctx.fill();
    ctx.fillStyle=b.magic?'#b35cff':'#ff5a2a'; ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath();ctx.arc(b.x-b.r*0.28,b.y-b.r*0.28,Math.max(1.2,b.r*0.42),0,TAU);ctx.fill();  // 白い熱の芯
    if(b.pierce){ ctx.strokeStyle='#ffe14d'; ctx.lineWidth=2.5; ctx.beginPath();ctx.arc(b.x,b.y,b.r+3.5,0,TAU);ctx.stroke(); } }  // 貫通弾=金リング(撃ち落とせない・避ける)
  // 粒子
  for(const pa of R.parts){ ctx.globalAlpha=Math.max(0,pa.life*2); ctx.fillStyle=pa.col; ctx.fillRect(pa.x-pa.r/2,pa.y-pa.r/2,pa.r,pa.r); } ctx.globalAlpha=1;
  // テキスト
  for(const t of R.texts){ ctx.globalAlpha=Math.max(0,t.life*1.4); ctx.font='bold '+t.size+'px ui-monospace,monospace'; ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.strokeText(t.s,t.x,t.y); ctx.fillStyle=t.col; ctx.fillText(t.s,t.x,t.y); } ctx.globalAlpha=1; ctx.textAlign='left';
  ctx.restore();
  if(R.flash>0){ ctx.fillStyle='rgba(255,80,80,'+Math.min(0.4,R.flash*0.4)+')'; ctx.fillRect(0,0,CW,CH); }
}
function drawGrid(bg){
  const gs=96; const x0=Math.floor((R.cam.x-CW/2)/gs)*gs, y0=Math.floor((R.cam.y-CH/2)/gs)*gs;
  ctx.strokeStyle=bg.grid; ctx.lineWidth=1; ctx.globalAlpha=0.5; ctx.beginPath();
  for(let x=x0;x<R.cam.x+CW/2+gs;x+=gs){ctx.moveTo(x,R.cam.y-CH/2-gs);ctx.lineTo(x,R.cam.y+CH/2+gs);}
  for(let y=y0;y<R.cam.y+CH/2+gs;y+=gs){ctx.moveTo(R.cam.x-CW/2-gs,y);ctx.lineTo(R.cam.x+CW/2+gs,y);}
  ctx.stroke(); ctx.globalAlpha=1;
}
function blit(s,x,y,size,flip){ const h=size*s.height/s.width; ctx.save(); ctx.translate(x,y); if(flip)ctx.scale(-1,1); ctx.drawImage(s,-size/2,-h/2,size,h); ctx.restore(); }
function drawEnemy(e){
  // 画面外の雑魚は描画しない(終盤の大物量でも描画負荷を抑える)
  if(!e.isBoss){ const m=64; if(e.x<R.cam.x-CW/2-m||e.x>R.cam.x+CW/2+m||e.y<R.cam.y-CH/2-m||e.y>R.cam.y+CH/2+m) return; }
  const s= e.isBoss? window.Sprites.bossSprite(e.shape,e.hue) : window.Sprites.enemy(e.shape,e.hue,e.r>22?1:0);
  const size=e.r*2.3; const flip=R.player.x<e.x;
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
  if(e.hitFlash>0){ ctx.globalAlpha=1; }
  blit(s,e.x,e.y,size,flip);
  if(e.hitFlash>0){ ctx.globalAlpha=e.hitFlash*4; ctx.fillStyle='#fff'; ctx.fillRect(e.x-size/2,e.y-size/2,size,size*s.height/s.width); ctx.globalAlpha=1; }
  // 激昂(enrage): 赤いオーラで「強くなった」を明示
  if(e.isBoss && e.enraged){ ctx.globalAlpha=Math.min(0.6,0.22+0.13*Math.sin(R.t*6)+(e.enrageFlash>0?e.enrageFlash*0.5:0)); ctx.strokeStyle='#ff5252'; ctx.lineWidth=3; ctx.beginPath();ctx.arc(e.x,e.y,e.r+6,0,TAU);ctx.stroke(); ctx.globalAlpha=1; }
  if(e.elite||e.isBoss){ // HPバー(頭上)
    const w=e.isBoss?0:e.r*2.2; if(w){ const hp=clamp(e.hp/e.maxHp,0,1); ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(e.x-w/2,e.y-e.r-9,w,4); ctx.fillStyle=e.isBoss?'#ff5252':'#ffb74d';ctx.fillRect(e.x-w/2,e.y-e.r-9,w*hp,4); }
    if(e.elite&&!e.isBoss){ ctx.font='10px ui-monospace';ctx.textAlign='center';ctx.fillStyle='#ffd';ctx.fillText(e.name,e.x,e.y-e.r-12);ctx.textAlign='left'; }
  }
}
function drawPlayer(){
  const p=R.player; const s=window.Sprites.lordSprite(R.lord); const flip=p.facing.x<0;
  // 影
  ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath();ctx.ellipse(p.x,p.y+12,12,5,0,0,TAU);ctx.fill();
  if(p.ifr>0 && Math.floor(p.ifr*20)%2===0)ctx.globalAlpha=0.4;
  blit(s,p.x,p.y,30,flip); ctx.globalAlpha=1;
}
function drawSwing(s){
  const a=Math.max(0,s.life/s.maxLife); const k=1-a; ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.ang);
  const rad=s.reach*(0.78+0.22*k);
  // 控えめな扇(薙ぎの軌跡)
  ctx.globalAlpha=0.10+a*0.13; ctx.fillStyle='hsl('+s.hue+',64%,55%)';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,rad,-s.arc/2,s.arc/2); ctx.closePath(); ctx.fill();
  // 刃の光(外周)
  ctx.globalAlpha=0.78*a; ctx.strokeStyle='hsl('+s.hue+',72%,76%)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(0,0,rad,-s.arc/2,s.arc/2); ctx.stroke();
  ctx.restore(); ctx.globalAlpha=1;
}
function drawProj(pr){ ctx.save(); ctx.translate(pr.x,pr.y); ctx.rotate(Math.atan2(pr.vy,pr.vx)); ctx.fillStyle='hsl('+pr.hue+',70%,60%)'; ctx.fillRect(-pr.r*1.6,-pr.r*0.5,pr.r*3.2,pr.r); ctx.fillStyle='#fff'; ctx.fillRect(pr.r*0.6,-pr.r*0.3,pr.r,pr.r*0.6); ctx.restore(); }
function drawNova(n){ const a=Math.max(0,n.life/n.maxLife); ctx.globalAlpha=a*0.7; ctx.strokeStyle='hsl('+n.hue+',85%,'+(n.enemy?55:65)+'%)'; ctx.lineWidth=4+(1-a)*6; ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,TAU);ctx.stroke(); ctx.globalAlpha=1; }
function drawDash(d){ ctx.save();ctx.translate(d.x,d.y);ctx.rotate(Math.atan2(d.vy,d.vx)); ctx.globalAlpha=0.6;ctx.fillStyle='hsl('+d.hue+',80%,60%)';ctx.fillRect(-d.w,-d.w*0.5,d.w*2,d.w); ctx.globalAlpha=1;ctx.restore(); }
function drawZone(z){
  if(z.enemy){  // 敵の危険ゾーン: 予告=破線リング＋上に「!」/発動=塗りつぶし赤。踏みっぱなし即死を回避
    const warn=z.warn>0, pulse=0.5+0.5*Math.sin(R.t*(warn?16:8));
    if(warn){
      ctx.globalAlpha=0.06+0.05*pulse; ctx.fillStyle='hsl(8,90%,52%)'; ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill();
      ctx.globalAlpha=0.55+0.4*pulse; ctx.strokeStyle='hsl(10,95%,60%)'; ctx.lineWidth=3.5; ctx.setLineDash([10,8]); ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha=1; ctx.font='bold 24px ui-monospace,monospace'; ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.strokeText('!',z.x,z.y-z.r-2); ctx.fillStyle='#ffcf3a'; ctx.fillText('!',z.x,z.y-z.r-2); ctx.textAlign='left';
    } else {
      ctx.globalAlpha=0.28+0.12*pulse; ctx.fillStyle='hsl(10,92%,50%)'; ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill();
      ctx.globalAlpha=0.9; ctx.strokeStyle='hsl(16,95%,64%)'; ctx.lineWidth=4; ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.stroke();
    }
    ctx.globalAlpha=1; return;
  }
  const a=Math.min(1,z.life/ (z.maxLife*0.5)); ctx.globalAlpha=0.18+0.12*Math.sin(R.t*8); ctx.fillStyle='hsl('+z.hue+',85%,50%)'; ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill(); ctx.globalAlpha=0.5*a;ctx.strokeStyle='hsl('+z.hue+',90%,65%)';ctx.lineWidth=2;ctx.stroke(); ctx.globalAlpha=1; }

// 公開(HUD用)
G.hudData=()=>{ if(!R)return null; return {hp:R.player.hp,maxHp:R.player.maxHp,level:R.player.level,xp:R.player.xp,xpNext:R.player.xpNext,t:R.t,kills:R.player.kills,gold:Math.floor(R.player.goldFrac),weapons:R.weapons,passives:R.passives,boss:R.boss,stage:R.stage}; };
G.pauseToggle=(v)=>{ if(R)R.paused=v; };

})();
