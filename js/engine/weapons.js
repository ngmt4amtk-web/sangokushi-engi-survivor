// weapons.js — 武器発火システム。effStats(WBASE×武将stat×Lv×バフ×進化) を系統別に発火。
window.G = window.G || {};
(function(){
const G=window.G;
const TAU=Math.PI*2;
const rnd=(a=1,b=null)=> b===null?Math.random()*a:a+Math.random()*(b-a);
const d2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};

function effStats(w,R){
  const wt=w.gen.weapon, base=window.WBASE[wt], gs=w.gen.stat, lvl=w.level, b=R.buffs;
  const kind=base.kind, evo=w.evo? w.evo.mul : {};
  const isTactic=(wt==='fire'||wt==='array'||wt==='aura');
  const tdmg=isTactic?(1+(b.tacticDmg||0)):1, tarea=isTactic?(1+(b.tacticArea||0)):1;
  const E={kind,wt,hue:base.hue};
  E.dmg = base.dmg*gs.dmg*window.WLEVEL.dmgMul(lvl)*(1+(b.dmg||0))*w.dupMul*tdmg*(evo.dmg||1);
  E.area= (base.area||0)*gs.area*window.WLEVEL.areaMul(lvl)*(1+(b.area||0))*tarea*(evo.area||1);
  E.cd  = base.cd*gs.cd*window.WLEVEL.cdMul(lvl)*(1-Math.min(0.7,(b.cd||0)))*(evo.cd||1);
  E.amount = Math.max(1, base.amount+(gs.amount-1)+window.WLEVEL.amountAdd(lvl,kind)+(b.amount||0)+(evo.amount||0));
  E.knock = (base.knock||0)*gs.knock*(evo.knock||1);
  E.crit = Math.min(0.85, 0.05+gs.crit+(b.crit||0)+(evo.crit||0));
  E.pierce = (base.pierce||0)+window.WLEVEL.pierceAdd(lvl)+(b.pierce||0)+(evo.pierce||0);
  E.life = (base.life||0)*(1+(b.duration||0))*(evo.life||1);
  E.reach = (base.reach||base.area||60)*gs.area*window.WLEVEL.areaMul(lvl)*(1+(b.area||0))*(evo.reach||1);
  E.arcDeg = (evo.arcDeg!==undefined?evo.arcDeg:(base.arcDeg||90));
  E.speed=base.speed||0; E.range=base.range||0; E.spreadDeg=base.spreadDeg||0;
  E.boomerang=base.boomerang||false; E.aim=base.aim||'facing';
  E.orbitR=(base.orbitR||0)*(1+(b.area||0)*0.5)*(evo.orbitR||1); E.spin=base.spin||0;
  E.len=(base.len||0)*(evo.len||1); E.bsize=Math.max(6,(base.area||14)*0.5*(1+(b.area||0)*0.4));
  E.slow=(base.slow||0)+(evo.slowAdd||0); E.tick=base.tick||0.5; E.trail=evo.trail||0;
  if(w.fuseMul){ const m=w.fuseMul, ha=1+(m-1)*0.5;  // 合体武将: ダメージ全乗・範囲/射程/旋回は半分乗せ
    E.dmg*=m; E.area*=ha; E.reach*=ha; E.orbitR*=ha; }
  return E;
}
G.effStats=effStats;

function update(dt,R){
  for(const w of R.weapons){
    const wt=w.gen.weapon, kind=window.WBASE[wt].kind;
    if(kind==='buff')continue;
    const E=effStats(w,R);
    if(kind==='orbit'){ updateOrbit(w,E,dt,R); continue; }
    if(kind==='field'){ updateField(w,E,dt,R); continue; }
    w.cd-=dt;
    if(w.cd<=0){ w.cd=E.cd; fire(w,E,R); }
  }
}

// 攻撃方向: 最寄りの敵を自動で狙う(idle時も群れに当たる)。敵が居なければ移動方向。
function aimAngle(R){ const p=R.player; const t=G.nearestEnemy(p.x,p.y,680); if(t)return Math.atan2(t.y-p.y,t.x-p.x); return Math.atan2(p.facing.y,p.facing.x); }
function markAttack(R,a){ const p=R.player; p.atkT=0.14; p.atkAng=a; }

function fire(w,E,R){
  switch(E.kind){
    case 'arc':   fireArc(E,R); break;
    case 'proj':  fireProj(E,R); break;
    case 'nova':  fireNova(E,R); break;
    case 'dash':  fireDash(E,R); break;
    case 'summon':fireSummon(E,R); break;
    case 'zone':  fireZone(E,R); break;
  }
}

function fireArc(E,R){
  const p=R.player, ang0=aimAngle(R);
  const full=E.arcDeg*Math.PI/180, n=(E.arcDeg>=360)?1:E.amount, reach=E.reach;
  markAttack(R,ang0);
  for(let i=0;i<n;i++){
    const off=(E.arcDeg>=360)?0:(n>1?(i-(n-1)/2)*(full*0.85):0);
    const a=ang0+off;
    G.forEachNear(p.x,p.y,reach+30,e=>{ if(e.dead)return;
      const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy); if(d>reach+e.r)return;
      if(E.arcDeg<360){ let da=Math.atan2(dy,dx)-a; da=Math.atan2(Math.sin(da),Math.cos(da)); if(Math.abs(da)>full/2)return; }
      G.applyDamage(e,E.dmg,{critRate:E.crit,knock:E.knock,kx:dx/(d||1),ky:dy/(d||1)}); e.hitFlash=0.08; G.bossCounter(e);
    });
    const life=Math.max(0.18,E.life||0.16);
    R.swings.push({x:p.x,y:p.y,ang:a,arc:Math.min(full,TAU*0.99),reach,life,maxLife:life,hue:E.hue,wt:E.wt,follow:true});
  }
}

function fireProj(E,R){
  const p=R.player; let baseAng;
  if(E.aim==='nearest'){ const t=G.nearestEnemy(p.x,p.y,E.range||520); baseAng=t?Math.atan2(t.y-p.y,t.x-p.x):Math.atan2(p.facing.y,p.facing.x); }
  else baseAng=aimAngle(R);
  markAttack(R,baseAng);
  const n=E.amount, spread=(E.spreadDeg||0)*Math.PI/180, sp=E.speed;
  for(let i=0;i<n;i++){
    let a=baseAng;
    if(spread>0) a+= (n>1?(i-(n-1)/2)*(spread/(n-1)):0);
    else if(n>1) a+= (i-(n-1)/2)*0.13;
    const life=E.boomerang?((E.range/sp)*2.4+0.6):((E.range||400)/sp+0.2);
    R.proj.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:E.bsize,dmg:E.dmg,crit:E.crit,knock:E.knock,
      pierce:E.pierce,hit:new Set(),life,hue:E.hue,ptype:window.Sprites.projType(E.wt),spd:sp,range:E.range||400,t:0,phase:0,boomerang:E.boomerang});
  }
}

function fireNova(E,R){ const p=R.player;
  markAttack(R,Math.atan2(p.facing.y,p.facing.x));
  R.novas.push({x:p.x,y:p.y,r:6,maxR:E.area,life:0.34,maxLife:0.34,hue:E.hue,dmg:E.dmg,knock:E.knock,crit:E.crit,hitSet:new Set()});
  G.pushPart(p.x,p.y,'hsl('+E.hue+',70%,60%)',8,180);
}

function fireDash(E,R){ const p=R.player; const sp=window.WBASE.charge.speed;
  const base=aimAngle(R); const cnt=Math.min(4,E.amount);
  markAttack(R,base);
  for(let i=0;i<cnt;i++){ const a=base+(cnt>1?(i-(cnt-1)/2)*0.18:0);
    R.dashes.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,len:E.len,traveled:0,w:E.area,dmg:E.dmg,crit:E.crit,knock:E.knock,hit:new Set(),life:E.len/sp+0.1,hue:E.hue,trail:E.trail}); }
}

function fireSummon(E,R){ const p=R.player; const cap=26;
  for(let i=0;i<E.amount && R.minions.length<cap;i++){ const a=rnd(TAU);
    R.minions.push({x:p.x+Math.cos(a)*22,y:p.y+Math.sin(a)*22,dmg:E.dmg,atk:rnd(0.3),atkCd:window.WBASE.summon.sAtkCd,speed:window.WBASE.summon.sSpeed,life:E.life,crit:E.crit}); }
}

function fireZone(E,R){ const p=R.player; const t=G.nearestEnemy(p.x,p.y,420);
  const tx=t?t.x:p.x+p.facing.x*70, ty=t?t.y:p.y+p.facing.y*70;
  markAttack(R,Math.atan2(ty-p.y,tx-p.x));
  const extra=Math.max(1,E.amount-window.WBASE.fire.amount+1);
  for(let i=0;i<extra;i++){ const ox=i?rnd(-E.area,E.area):0, oy=i?rnd(-E.area,E.area):0;
    R.zones.push({x:tx+ox,y:ty+oy,r:E.area,life:E.life,maxLife:E.life,tick:E.tick,nextTick:0,dmg:E.dmg,crit:E.crit,hue:E.hue,cool:new Map()}); }
}

function updateOrbit(w,E,dt,R){
  if(w.tickMap.size>120){ for(const k of w.tickMap.keys()){ if(k.dead) w.tickMap.delete(k); } } // 死亡敵キーを掃除(Map肥大/リーク防止)
  w.ang=(w.ang+E.spin*dt)%TAU; const p=R.player, n=E.amount, rad=E.orbitR, size=Math.max(8,E.area*0.4);
  for(let i=0;i<n;i++){ const a=w.ang+i*TAU/n, bx=p.x+Math.cos(a)*rad, by=p.y+Math.sin(a)*rad;
    G.forEachNear(bx,by,size+20,e=>{ if(e.dead)return; const rr=size+e.r; if(d2(e.x,e.y,bx,by)<rr*rr){
      const last=w.tickMap.get(e)||0; if(R.t-last>=0.45){ w.tickMap.set(e,R.t);
        const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy)||1; G.applyDamage(e,E.dmg,{critRate:E.crit,knock:E.knock,kx:dx/d,ky:dy/d}); e.hitFlash=0.08; G.bossCounter(e);} } });
  }
  w._orbit={n,rad,ang:w.ang,hue:E.hue,size,wt:E.wt};
}

function updateField(w,E,dt,R){
  const p=R.player; w.fieldT=(w.fieldT||0)-dt;
  const tick=w.fieldT<=0;
  if(tick) w.fieldT=E.tick;
  const R2=(E.area)*(E.area);
  G.forEachNear(p.x,p.y,E.area+24,e=>{ if(e.dead)return; if(d2(e.x,e.y,p.x,p.y)<(E.area+e.r)*(E.area+e.r)){
    e.slowT=Math.max(e.slowT||0,E.tick+0.05); e.slowAmt=E.slow;
    if(tick){ G.applyDamage(e,E.dmg,{critRate:E.crit}); e.hitFlash=0.05; }
  } });
  w._field={r:E.area,hue:E.hue};
}

function draw(ctx,R){
  // 陣/オーラ(下地)
  for(const w of R.weapons){ if(w._field){ const p=R.player,f=w._field;
    const pulse=0.5+0.5*Math.sin(R.t*5);
    ctx.globalAlpha=0.08+0.04*pulse; ctx.fillStyle='hsl('+f.hue+',70%,42%)'; ctx.beginPath();ctx.arc(p.x,p.y,f.r,0,TAU);ctx.fill();
    ctx.globalAlpha=0.40+0.18*pulse; ctx.fillStyle='hsl('+f.hue+',85%,70%)';
    const n=44;
    for(let i=0;i<n;i++){ const a=i*TAU/n+R.t*0.25, rr=f.r+((i&1)?3:-2), sz=(i%3===0)?5:3;
      ctx.fillRect(p.x+Math.cos(a)*rr-sz/2,p.y+Math.sin(a)*rr-sz/2,sz,sz); }
    ctx.globalAlpha=1; w._field=null; } }
  // 旋回刃
  for(const w of R.weapons){ if(w._orbit){ const p=R.player,o=w._orbit;
    for(let i=0;i<o.n;i++){ const a=o.ang+i*TAU/o.n, bx=p.x+Math.cos(a)*o.rad, by=p.y+Math.sin(a)*o.rad;
      const spr=window.Sprites.proj(o.wt==='halberd'?'halberd':'blade',o.hue,a+Math.PI/2,((R.t*10)|0)&1);
      const size=Math.max(18,o.size*1.15), h=size*spr.height/spr.width;
      ctx.drawImage(spr,bx-size/2,by-h/2,size,h);
      ctx.globalAlpha=0.35; ctx.fillStyle='hsl('+o.hue+',85%,70%)';
      ctx.fillRect(bx-Math.cos(a)*9-2,by-Math.sin(a)*9-2,4,4); ctx.globalAlpha=1; }
    w._orbit=null; } }
}

G.Weapons={update,draw,effStats};
})();
