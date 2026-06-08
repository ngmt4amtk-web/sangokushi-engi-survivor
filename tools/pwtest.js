// 実ブラウザ(Chrome)スモークテスト + スクショ。NODE_PATH=npxキャッシュ で実行。
const { chromium } = require('playwright');
const BASE='http://localhost:8765/';
const SHOT='/tmp/sgss_shots/';
const fs=require('fs'); fs.mkdirSync(SHOT,{recursive:true});

(async()=>{
  const browser=await chromium.launch({channel:'chrome', args:['--use-gl=swiftshader']});
  const page=await browser.newPage({viewport:{width:430,height:800},deviceScaleFactor:1});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push('CONSOLE: '+m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));

  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.waitForSelector('#b-play',{timeout:8000});
  await page.screenshot({path:SHOT+'01_title.png'});

  // データ整合チェック(ページ内)
  const dataChk=await page.evaluate(()=>({
    generals:window.GENERALS.length,
    weaponsDefined:window.GENERALS.every(g=>window.WBASE[g.weapon]),
    lords:window.LORDS.length, stages:window.STAGES.length,
    passives:window.PASSIVES.length, evos:Object.keys(window.EVOLUTIONS).length,
  }));

  // 出陣 → s1 → 劉備
  await page.click('#b-play');
  await page.waitForSelector('.card[data-st="s1"]');
  await page.click('.card[data-st="s1"]');
  await page.waitForSelector('.card[data-l="liubei"]');
  await page.click('.card[data-l="liubei"]');
  await page.waitForSelector('#hud.show',{timeout:5000});

  // レベルアップ自動消化 + 移動キー + ボス早期化を仕込む
  await page.evaluate(()=>{
    window.__lvups=0;
    const obs=new MutationObserver(()=>{ const lv=document.getElementById('levelup'); if(lv.classList.contains('show')){ const c=lv.querySelector('.choice'); if(c){window.__lvups++;c.click();} } });
    obs.observe(document.getElementById('levelup'),{attributes:true});
  });
  // 円を描くように移動して群れを巻き込みつつ生存(ヴァンサバ的)
  const seq=[['d',4000],['s',4000],['a',4000],['w',4000],['d',4000],['s',4000]];
  for(const [k,ms] of seq){ await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); }
  await page.screenshot({path:SHOT+'02_battle.png'});

  // ボスを早期出現
  await page.evaluate(()=>{ const R=window.G.getR(); if(R) R.nextBossT=R.t+2.5; });
  await page.waitForTimeout(4000);
  await page.screenshot({path:SHOT+'03_boss.png'});
  await page.keyboard.up('s');

  const runState=await page.evaluate(()=>{ const R=window.G.getR(); return R?{t:Math.round(R.t),kills:R.player.kills,lv:R.player.level,xp:Math.round(R.player.xp),gems:R.gems.length,hp:Math.round(R.player.hp),weapons:R.weapons.length,enemies:R.enemies.length,proj:R.proj.length,minions:R.minions.length,lvups:window.__lvups,boss:!!R.boss}:null; });

  // 中断 → メニュー → ガチャ10連
  await page.evaluate(()=>{ const R=window.G.getR(); if(R){R.running=false;R.over=true;} document.getElementById('hud').classList.remove('show'); window.UI.renderTitle(); window.UI.show('s-title'); });
  await page.waitForSelector('#b-gacha');
  await page.click('#b-gacha');
  await page.waitForSelector('#g10');
  await page.click('#g10');
  await page.waitForTimeout(1200);
  await page.screenshot({path:SHOT+'04_gacha.png'});
  const gachaShown=await page.evaluate(()=>document.getElementById('gachaFx').classList.contains('show'));
  await page.click('#gachaFx');
  await page.waitForTimeout(300);

  // 図鑑 → 詳細
  await page.evaluate(()=>{ window.UI.renderTitle(); window.UI.show('s-title'); });
  await page.click('#b-codex');
  await page.waitForSelector('.cell');
  await page.screenshot({path:SHOT+'05_codex.png'});
  await page.click('.cell');
  await page.waitForSelector('#modal.show');
  await page.screenshot({path:SHOT+'06_detail.png'});

  console.log('DATA:',JSON.stringify(dataChk));
  console.log('RUN:',JSON.stringify(runState));
  console.log('GACHA shown:',gachaShown);
  console.log('ERRORS('+errors.length+'):'); errors.slice(0,30).forEach(e=>console.log('  '+e));
  await browser.close();
  process.exit(errors.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
