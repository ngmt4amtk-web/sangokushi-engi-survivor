// 変更点ピンポイント検証: Q1二層進化カバレッジ / Q2 vacuum瞬間回収 / Q3 敵弾相殺・貫通
// NODE_PATH=<playwright> node tools/verify_changes.js
const { chromium } = require('playwright');
const BASE='http://localhost:8765/';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({channel:'chrome', args:['--use-gl=swiftshader']});
  const page=await browser.newPage({viewport:{width:430,height:800},deviceScaleFactor:1});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push('CONSOLE: '+m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.waitForSelector('#b-play',{timeout:8000});

  // ── Q1: 全85武将が進化先を持つ(固有 or 武器系統別の汎用)。need兵法が実在するか ──
  const q1=await page.evaluate(()=>{
    const G=window.GENERALS; let noEvo=[],generic=0,unique=0,badNeed=[];
    for(const g of G){ const ev=window.evoFor(g); if(!ev){noEvo.push(g.name);continue;}
      if(ev.generic)generic++; else unique++;
      if(!window.PASSIVE_BY_ID[ev.need]) badNeed.push(g.name+'→'+ev.need); }
    return {total:G.length, noEvoCount:noEvo.length, noEvo:noEvo.slice(0,8), generic, unique, badNeed};
  });

  // 出陣(劉備/s1)
  await page.click('#b-play'); await page.waitForSelector('.card[data-st="s1"]'); await page.click('.card[data-st="s1"]');
  await page.waitForSelector('.card[data-l="liubei"]'); await page.click('.card[data-l="liubei"]'); await page.waitForSelector('#hud.show',{timeout:5000});
  // レベルアップは自動消化(ポーズ解除)
  await page.evaluate(()=>{ new MutationObserver(()=>{const lv=document.getElementById('levelup');if(lv.classList.contains('show')){const c=lv.querySelector('.choice');if(c)c.click();}}).observe(document.getElementById('levelup'),{attributes:true}); });
  await wait(700);

  // ── Q2: vacuum=その瞬間の全gem即時回収 ──
  await page.evaluate(()=>{ const R=window.G.getR(); R.pendingLevels=0; R.paused=false; R.gems.length=0; window.__lv0=R.player.level;
    for(let i=0;i<8;i++) R.gems.push({x:R.player.x+(i*20-80),y:R.player.y+50,xp:6,vx:0,vy:0,mag:false}); window.__gem0=R.gems.length;
    window.G.spawnJar('vacuum',R.player.x,R.player.y); });
  await wait(400);
  const q2=await page.evaluate(()=>{ const R=window.G.getR(); return {gemBefore:window.__gem0, gemAfter:R.gems.length, lvUp:R.player.level-window.__lv0, jarsLeft:R.jars.length}; });

  // ── Q3a: ボスのvolleyが貫通(pierce)弾を撃つ ──
  await page.evaluate(()=>{ const R=window.G.getR(); R.pendingLevels=0; R.paused=false; R.nextBossT=R.t+0.1; });
  await wait(800);
  await page.evaluate(()=>{ const R=window.G.getR(); if(R.boss){ R.boss.mt.volley=0; } }); // volleyを即発火
  await wait(300);
  const q3a=await page.evaluate(()=>{ const R=window.G.getR(); return {boss:!!R.boss, pierceEproj:R.eproj.filter(b=>b.pierce).length}; });

  // ── Q3b: 自弾で非pierce敵弾を相殺・pierce敵弾は残る(自機から遠方に設置して1:1検証) ──
  await page.evaluate(()=>{ const R=window.G.getR(); const ex=R.player.x+700, ey=R.player.y+700; window.__ex=ex; window.__ey=ey;
    R.eproj.push({x:ex,y:ey,vx:0,vy:0,r:6,dmg:1,life:6,hue:0});                       // 非pierce=消せるはず
    R.eproj.push({x:ex+220,y:ey,vx:0,vy:0,r:6,dmg:1,life:6,hue:0,pierce:true});       // pierce=消せないはず
    R.proj.push({x:ex,y:ey,vx:0,vy:0,r:5,dmg:1,crit:0,knock:0,pierce:1,hit:new Set(),life:6,hue:0,spd:0,range:400,t:0,phase:0,boomerang:false}); });
  await wait(250);
  const q3b=await page.evaluate(()=>{ const R=window.G.getR(),ex=window.__ex,ey=window.__ey; const near=(b,x)=>Math.abs(b.x-x)<50&&Math.abs(b.y-ey)<50;
    return { nonPierceLeft:R.eproj.filter(b=>!b.pierce&&near(b,ex)).length, pierceLeft:R.eproj.filter(b=>b.pierce&&near(b,ex+220)).length }; });

  console.log('Q1',JSON.stringify(q1));
  console.log('Q2',JSON.stringify(q2));
  console.log('Q3a',JSON.stringify(q3a));
  console.log('Q3b',JSON.stringify(q3b));
  console.log('ERRORS('+errors.length+')'); errors.slice(0,20).forEach(e=>console.log('  '+e));
  await browser.close();
  process.exit(errors.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
