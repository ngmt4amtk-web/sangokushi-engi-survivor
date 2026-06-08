// 君主シグネチャ＋難易度revertの検証。NODE_PATH=<playwright> node tools/verify_lordsig.js
const { chromium } = require('playwright');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({channel:'chrome',args:['--use-gl=swiftshader']});
  const page=await browser.newPage({viewport:{width:430,height:800}});
  const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push('C:'+m.text());}); page.on('pageerror',e=>errors.push('P:'+e.message));
  await page.goto('http://localhost:8765/',{waitUntil:'networkidle'});
  await page.waitForSelector('#b-play'); await page.click('#b-play');
  await page.waitForSelector('.card[data-st="s1"]'); await page.click('.card[data-st="s1"]');
  await page.waitForSelector('.card[data-l="liubei"]'); await page.click('.card[data-l="liubei"]'); await page.waitForSelector('#hud.show');
  await page.evaluate(()=>{ new MutationObserver(()=>{const lv=document.getElementById('levelup');if(lv.classList.contains('show')){const c=lv.querySelector('.choice');if(c)c.click();}}).observe(document.getElementById('levelup'),{attributes:true}); });
  await wait(300);

  // 呂布 無双: 旋回する戟の刃に触れた弾(貫通も)は消える / 刃の無い場所・遠方は残る(バブルでない)
  await page.evaluate(()=>{ const R=window.G.getR(); R.lord=window.LORD_BY_ID['lvbu']; R.paused=false;
    R.weapons.length=0; R.eproj.length=0; window.G.addWeapon(window.GENERALS.find(g=>g.id===2)); }); // 呂布(halberd/orbit)を装備
  await wait(150);  // 旋回開始を待つ
  await page.evaluate(()=>{ const R=window.G.getR(),p=R.player; const w=R.weapons[0]; const rad=window.G.effStats(w,R).orbitR; // _orbitはdrawでnull化されるのでeffStatsからrad取得
    R.eproj.push({x:p.x+rad,y:p.y,vx:0,vy:0,r:6,dmg:1,life:30,hue:0,pierce:true});  // 戟の軌道上(貫通弾)→掃かれて消える
    R.eproj.push({x:p.x+rad+40,y:p.y,vx:0,vy:0,r:6,dmg:1,life:30,hue:0});            // 環の外・刃なし→残る(旧バブルなら消えてた)
    R.eproj.push({x:p.x+rad+220,y:p.y,vx:0,vy:0,r:6,dmg:1,life:30,hue:0});           // 遠方→残る
    window.__lv={rad,rx:p.x+rad,mx:p.x+rad+40,fx:p.x+rad+220,py:p.y}; });
  await wait(1300);  // 戟が1回転して軌道上の弾を掃くのを待つ
  const lvbu=await page.evaluate(()=>{ const R=window.G.getR(),c=window.__lv;
    const at=(x,y)=>R.eproj.filter(b=>Math.abs(b.x-x)<24&&Math.abs(b.y-y)<24).length;
    return {rad:+c.rad.toFixed(0), onRingLeft:at(c.rx,c.py), midLeft:at(c.mx,c.py), farLeft:at(c.fx,c.py)}; });

  // 諸葛亮 八陣図: 圏内の敵は圏外より移動が遅い(同speed)
  const zhuge=await page.evaluate(async()=>{ const R=window.G.getR(); R.lord=window.LORD_BY_ID['zhuge']; R.paused=false;
    R.weapons.length=0;  // 武器の攻撃/ノックバックでテスト敵を動かさないようクリア
    R.enemies.length=0; const px=R.player.x,py=R.player.y;
    const mk=(ox)=>({x:px+ox,y:py,vx:0,vy:0,dead:false,hp:9999,maxHp:9999,dmg:0,speed:52,_baseSpeed:52,r:13,xp:0,gold:0,behavior:'chase',shape:'foot',hue:0,knockRes:0,dr:0,hitFlash:0,__tag:ox});
    const A=mk(120),B=mk(400); R.enemies.push(A,B); window.__z={a:A.x,b:B.x};
    return new Promise(res=>setTimeout(()=>{ const a=R.enemies.find(e=>e.__tag===120),b=R.enemies.find(e=>e.__tag===400);
      const da=a?window.__z.a-a.x:0, db=b?window.__z.b-b.x:0;
      res({slowFieldR:R.lord.sig.slowFieldR, inMove:+da.toFixed(2), outMove:+db.toFixed(2), ratio:db?+(da/db).toFixed(2):-1}); },400)); });

  // 曹操 魏武の軍: 魏兵が湧く
  const caocao=await page.evaluate(async()=>{ const R=window.G.getR(); R.lord=window.LORD_BY_ID['caocao']; R.weapons.length=0; R.minions.length=0; R.sigT=0.01; R.paused=false;
    return new Promise(res=>setTimeout(()=>{ res({summonEvery:R.lord.sig.summonEvery, minions:R.minions.length}); },300)); });

  // 孫権 江東制衡: レベルアップで回復
  const sunquan=await page.evaluate(async()=>{ const R=window.G.getR(); R.lord=window.LORD_BY_ID['sunquan']; R.paused=false;
    R.player.maxHp=200; R.player.hp=20; R.pendingLevels=0; const lv0=R.player.level;
    R.gems.push({x:R.player.x,y:R.player.y,xp:600,vx:0,vy:0,mag:true});
    return new Promise(res=>setTimeout(()=>{ res({healOnLevel:R.lord.sig.healOnLevel, hp:Math.round(R.player.hp), lvUp:R.player.level-lv0}); },400)); });

  // 難易度revert確認
  const diff=await page.evaluate(()=>{ const s=window.STAGE_BY_ID; return {s5:s.s5.hpMul,s6:s.s6.hpMul,s7:s.s7.hpMul,s8:s.s8.hpMul,s9:s.s9.hpMul,s5g:s.s5.growthPerMin}; });

  // 孫堅 江東之虎: 大物に最大HPの一部を加算(applyDamage)
  const sunjian=await page.evaluate(()=>{ const R=window.G.getR(); R.lord=window.LORD_BY_ID['sunjian'];
    const e={x:R.player.x+999,y:R.player.y,dead:false,hp:1000,maxHp:1000,r:20,dr:0,knockRes:0,hitFlash:0}; R.enemies.push(e); const hp0=e.hp;
    window.G.applyDamage(e,10,{}); return {bossHunter:R.lord.sig.bossHunter, hpLoss:hp0-e.hp}; });   // 10+min(25,20)=30
  // 董卓 暴虐: 被弾で味方衝撃波nova発生
  const dongzhuo=await page.evaluate(()=>{ const R=window.G.getR(); R.lord=window.LORD_BY_ID['dongzhuo']; R.enemies.length=0; R.eproj.length=0; R.novas.length=0; R.player.ifr=0;
    R.eproj.push({x:R.player.x,y:R.player.y,vx:0,vy:0,r:6,dmg:5,life:5,hue:0});
    return new Promise(res=>setTimeout(()=>res({ragePulse:R.lord.sig.ragePulse, friendlyNovas:window.G.getR().novas.filter(n=>!n.enemy).length}),120)); });
  // 司馬懿 堅忍: 低HPで被ダメ軽減
  const simayi=await page.evaluate(()=>{ const R=window.G.getR(); R.lord=window.LORD_BY_ID['simayi']; R.enemies.length=0; R.player.maxHp=200;
    const hit=(hp)=>new Promise(res=>{ R.player.hp=hp; R.player.ifr=0; R.eproj.length=0; R.eproj.push({x:R.player.x,y:R.player.y,vx:0,vy:0,r:6,dmg:50,life:5,hue:0}); setTimeout(()=>res(hp-R.player.hp),110); });
    return (async()=>{ const f=await hit(200), l=await hit(40); return {lastStand:R.lord.sig.lastStand, lossFull:+f.toFixed(1), lossLow:+l.toFixed(1), lessAtLow:l<f}; })(); });

  console.log('LVBU(無双)',JSON.stringify(lvbu));
  console.log('ZHUGE(八陣図)',JSON.stringify(zhuge));
  console.log('CAOCAO(魏武)',JSON.stringify(caocao));
  console.log('SUNQUAN(制衡)',JSON.stringify(sunquan));
  console.log('SUNJIAN(江東之虎)',JSON.stringify(sunjian));
  console.log('DONGZHUO(暴虐)',JSON.stringify(dongzhuo));
  console.log('SIMAYI(堅忍)',JSON.stringify(simayi));
  console.log('DIFF(revert)',JSON.stringify(diff));
  console.log('ERR('+errors.length+')'); errors.slice(0,15).forEach(e=>console.log(' '+e));
  await browser.close(); process.exit(errors.length?1:0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(2);});
