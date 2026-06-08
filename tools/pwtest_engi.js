// 演義版スモークテスト。NODE_PATH=npxキャッシュ で実行。
const { chromium } = require('playwright');
const BASE='http://localhost:8771/';
const SHOT='/tmp/engi_shots/';
const fs=require('fs'); fs.mkdirSync(SHOT,{recursive:true});

(async()=>{
  const browser=await chromium.launch({channel:'chrome', args:['--use-gl=swiftshader']});
  const page=await browser.newPage({viewport:{width:430,height:800},deviceScaleFactor:1});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push('CONSOLE: '+m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message+' @ '+(e.stack||'').split('\n')[1]));

  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.waitForSelector('#b-play',{timeout:8000});
  await page.screenshot({path:SHOT+'01_title.png'});

  const dataChk=await page.evaluate(()=>({
    generals:window.GENERALS.length, stages:window.STAGES.length,
    weaponsDefined:window.GENERALS.every(g=>window.WBASE[g.weapon]),
    iconsDefined:[...new Set(window.GENERALS.map(g=>g.weapon))].every(k=>!!window.WEAPON_ICONS[k]),
    enemyArch:Object.keys(window.ENEMY_ARCH||{}).length,
    key:(localStorage&&true),
  }));
  console.log('DATA', JSON.stringify(dataChk));

  // 出陣 → ステージ選択(s1)
  await page.click('#b-play');
  await page.waitForSelector('.scard[data-st="s1"]');
  await page.screenshot({path:SHOT+'02_stages.png'});
  await page.click('.scard[data-st="s1"]');

  // 前半ストーリー
  await page.waitForSelector('#b-start',{timeout:5000});
  const preChk=await page.evaluate(()=>({
    storyLen:document.querySelector('.story-text').textContent.length,
    protos:document.querySelectorAll('.proto-card').length,
    diffSel:document.querySelectorAll('.diff-btn.sel').length,
  }));
  console.log('PRE', JSON.stringify(preChk));
  await page.screenshot({path:SHOT+'03_prestory.png'});

  // 難易度ふつう確認 + 2番目の主役を選んでみる
  const protoCards=await page.$$('.proto-card');
  if(protoCards.length>1) await protoCards[1].click();
  await page.click('#b-start');

  // 戦闘開始
  await page.waitForSelector('#hud.show',{timeout:5000});
  await page.evaluate(()=>{
    window.__lvups=0;
    const obs=new MutationObserver(()=>{ const lv=document.getElementById('levelup'); if(lv.classList.contains('show')){ const c=lv.querySelector('.choice'); if(c){window.__lvups++;c.click();} } });
    obs.observe(document.getElementById('levelup'),{attributes:true});
  });
  // 円移動で群れを巻き込み生存
  const seq=[['d',2500],['s',2500],['a',2500],['w',2500],['d',2500]];
  for(const [k,ms] of seq){ await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); }
  const runState=await page.evaluate(()=>{ const R=window.G.getR(); return R?{t:Math.round(R.t),kills:R.player.kills,lv:R.player.level,hp:Math.round(R.player.hp),weapons:R.weapons.length,enemies:R.enemies.length,lvups:window.__lvups,diff:R.diff}:null; });
  console.log('RUN', JSON.stringify(runState));
  await page.screenshot({path:SHOT+'04_battle.png'});

  // 勝利を強制(ボス早期化→撃破は時間がかかるので victory を直接呼ぶ)
  await page.evaluate(()=>{ const R=window.G.getR(); if(R){ R.t=R.stage.dur; R.nextBossT=R.t-1; } });
  await page.waitForTimeout(500);
  // ボスを即死させて勝利フローへ
  await page.evaluate(()=>{ const R=window.G.getR(); if(R&&R.boss){ R.boss.hp=1; } });
  // ボスにダメージが入るまで少し移動
  await page.keyboard.down('d');
  let won=false;
  for(let i=0;i<20;i++){ await page.waitForTimeout(500); won=await page.evaluate(()=>!!document.getElementById('result').classList.contains('show')); if(won)break;
    await page.evaluate(()=>{ const R=window.G.getR(); if(R&&R.boss){ R.boss.x=R.player.x+30; R.boss.y=R.player.y; R.boss.hp=1; } else if(R&&!R.over){ R.nextBossT=R.t-1; } }); }
  await page.keyboard.up('d');
  console.log('RESULT shown:', won);
  await page.screenshot({path:SHOT+'05_result.png'});

  // 物語の続きへ → 後半ストーリー
  if(won){
    await page.click('#r-next');
    await page.waitForSelector('#b-pull',{timeout:4000});
    const postChk=await page.evaluate(()=>({ storyLen:document.querySelector('#s-story .story-text').textContent.length, pullBtn:document.querySelector('#b-pull').textContent.trim() }));
    console.log('POST', JSON.stringify(postChk));
    await page.screenshot({path:SHOT+'06_poststory.png'});
    // ガチャを引く
    await page.click('#b-pull');
    await page.waitForSelector('#gachaFx.show',{timeout:4000});
    const gachaChk=await page.evaluate(()=>({ pulls:document.querySelectorAll('#gachabox .pull').length, owned:Object.keys(JSON.parse(localStorage.getItem('sangokushi-engi-v1')).owned).length }));
    console.log('GACHA', JSON.stringify(gachaChk));
    await page.screenshot({path:SHOT+'07_gacha.png'});
    // 閉じる→ステージ選択(s2解放確認)
    await page.click('#gachaFx');
    await page.waitForSelector('.scard[data-st="s2"]');
    const s2locked=await page.evaluate(()=>document.querySelector('.scard[data-st="s2"]').classList.contains('locked'));
    console.log('s2 unlocked after s1 clear:', !s2locked);
  }

  // 図鑑
  await page.evaluate(()=>{ window.UI.renderTitle(); window.UI.show('s-title'); });
  await page.click('#b-codex');
  await page.waitForSelector('.dex',{timeout:4000});
  await page.screenshot({path:SHOT+'08_codex.png'});
  const codexChk=await page.evaluate(()=>({ cells:document.querySelectorAll('.dex .cell').length, unlocked:document.querySelectorAll('.dex .cell:not(.locked)').length }));
  console.log('CODEX', JSON.stringify(codexChk));

  console.log('\n=== ERRORS ('+errors.length+') ===');
  errors.forEach(e=>console.log(e));
  await browser.close();
  process.exit(errors.length?2:0);
})().catch(e=>{ console.error('TEST CRASH:', e.message, e.stack); process.exit(3); });
