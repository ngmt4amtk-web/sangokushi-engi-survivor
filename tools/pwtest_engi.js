// 演義版スモークテスト。NODE_PATH=npxキャッシュ で実行。
const { chromium } = require('playwright');
const BASE='http://localhost:8771/';
const SHOT='/tmp/engi_shots/';
const fs=require('fs'); fs.mkdirSync(SHOT,{recursive:true});
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};

async function serveStatic(page){
  await page.route('**/*', async route=>{
    const url=new URL(route.request().url());
    let p=decodeURIComponent(url.pathname);
    if(p==='/'||p==='') p='/index.html';
    const fp=path.resolve(ROOT,'.'+p);
    if(!fp.startsWith(ROOT)) return route.fulfill({status:403,body:'forbidden'});
    try{
      const body=fs.readFileSync(fp);
      const ext=path.extname(fp);
      return route.fulfill({status:200,contentType:MIME[ext]||'application/octet-stream',body});
    }catch(e){
      return route.fulfill({status:404,body:'not found'});
    }
  });
}

(async()=>{
  let browser;
  try{
    browser=await chromium.launch({channel:'chrome', args:['--use-gl=swiftshader']});
  }catch(e){
    console.warn('WARN: Chrome channel launch failed, falling back to bundled chromium:', e.message.split('\n')[0]);
    browser=await chromium.launch({args:['--use-gl=swiftshader']});
  }
  const context=await browser.newContext({viewport:{width:430,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage();
  await serveStatic(page);
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: '+m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message+' @ '+(e.stack||'').split('\n')[1]));
  page.on('response',r=>{ if(r.status()>=400 && r.url().includes('localhost:8771')) errors.push('HTTP'+r.status()+' '+r.url()); }); // 外部CDNのヘッドレスUAノイズは除外

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

  // 章選択 → s1を直接選択
  await page.click('#b-stage');
  await page.waitForSelector('.scard[data-st="s1"]');
  await page.screenshot({path:SHOT+'02_stages.png'});
  await page.click('.scard[data-st="s1"]');

  // 出陣準備画面(新フロー: .prep-hero / .prep-pill / #b-start)
  await page.waitForSelector('#b-start',{timeout:5000});
  const prepChk=await page.evaluate(()=>({
    heroes:document.querySelectorAll('.prep-hero').length,
    pillSel:document.querySelectorAll('.prep-pill.sel').length,
    hasSortieBtn:!!document.querySelector('#b-start'),
  }));
  console.log('PREP', JSON.stringify(prepChk));
  await page.screenshot({path:SHOT+'03_prep.png'});

  // キャラ選択は廃止(主役は物語が決める)
  await page.click('#b-start');

  // 章タイトルカード(自動1.6s/タップスキップ)→タイプライター(タップ2回)→戦闘 を根気よく進める
  for(let i=0;i<25;i++){
    const hud=await page.$('#hud.show');
    if(hud) break;
    const card=await page.$('#chaptercard.show');
    if(card){ await page.click('#chaptercard'); await page.waitForTimeout(150); continue; }
    const vn=await page.$('#vn-ov.show');
    if(vn){ if(!global.__vnshot){ global.__vnshot=1; await page.waitForTimeout(600); await page.screenshot({path:SHOT+'03b_vn.png'}); }
      await page.evaluate(()=>window.VN&&window.VN.skip&&window.VN.skip()); await page.waitForTimeout(250); continue; }
    const twShow=await page.$('#sceneov.show');
    if(twShow){
      await page.click('#sceneov'); // 1タップ目: 全文表示
      await page.waitForTimeout(120);
      const twShow2=await page.$('#sceneov.show');
      if(twShow2) await page.click('#sceneov'); // 2タップ目: 開戦
      await page.waitForTimeout(250);
      continue;
    }
    await page.waitForTimeout(300);
  }

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
  for(let i=0;i<40;i++){ await page.waitForTimeout(500); won=await page.evaluate(()=>!!document.getElementById('result').classList.contains('show')); if(won)break;
    // シーン連結: 幕間タイプライター/悲運の口上オーバーレイを進め、次幕も時間を進めて勝利強制
    const dg=await page.$('#sceneov.show #doom-go');
    if(dg){ await dg.click(); await page.waitForTimeout(500);
      await page.evaluate(()=>{ const R=window.G.getR(); if(R&&!R.over){ const d=(R.scene&&R.scene.dur)||R.stage.dur; R.t=Math.max(R.t,d-0.01); R.nextBossT=Math.min(R.nextBossT,R.t-1); } });
      continue; }
    const vn2=await page.$('#vn-ov.show');
    if(vn2){ await page.evaluate(()=>window.VN&&window.VN.skip&&window.VN.skip()); await page.waitForTimeout(300); continue; }
    // タイプライター(幕間pre): 2回タップでスキップ→開戦
    const tw=await page.$('#sceneov.show .tw-text');
    if(tw){ await page.click('#sceneov'); await page.waitForTimeout(120); await page.click('#sceneov'); await page.waitForTimeout(400);
      await page.evaluate(()=>{ const R=window.G.getR(); if(R&&!R.over){ const d=(R.scene&&R.scene.dur)||R.stage.dur; R.t=Math.max(R.t,d-0.01); R.nextBossT=Math.min(R.nextBossT,R.t-1); } });
      continue; }
    await page.evaluate(()=>{ const R=window.G.getR(); if(R&&R.boss){ R.boss.x=R.player.x+30; R.boss.y=R.player.y; R.boss.hp=1; } else if(R&&!R.over){ R.nextBossT=R.t-1; } }); }
  await page.keyboard.up('d');
  console.log('RESULT shown:', won);
  await page.screenshot({path:SHOT+'05_result.png'});

  // 物語の続きへ → 後半ストーリー
  if(won){
    await page.click('#r-next');
    // 後半ストーリー → 英雄録
    // storyPre/post がある場合、sceneov タイプライターを2タップで読み飛ばす
    for(let i=0;i<8;i++){
      const vn=await page.$('#vn-ov.show');
      if(vn){ await page.evaluate(()=>window.VN&&window.VN.skip&&window.VN.skip()); await page.waitForTimeout(300); continue; }
      const tw=await page.$('#sceneov.show');
      if(!tw) break;
      await page.click('#sceneov'); await page.waitForTimeout(120);
      const tw2=await page.$('#sceneov.show');
      if(tw2){ await page.click('#sceneov'); await page.waitForTimeout(300); }
      await page.waitForTimeout(300);
    }
    await page.waitForSelector('#hr-next',{timeout:5000});
    const hrChk=await page.evaluate(()=>({
      cards: document.querySelectorAll('.hr-new-card,.hr-up-card').length,
      nextBtn: !!document.querySelector('#hr-next'),
    }));
    console.log('HERO_RECORD', JSON.stringify(hrChk));
    if(hrChk.cards===0) console.warn('WARNING: hero record has no cards (may be expected if s1 roster all new)');
    await page.screenshot({path:SHOT+'06_hero_record.png'});
    // 「次へ」→ステージ選択(s2解放確認)
    await page.click('#hr-next');
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

  // ── 演義を読む: ノベルゲーム式リーダー ──────────────────
  await page.evaluate(()=>{ window.UI.renderTitle(); window.UI.show('s-title'); });
  await page.waitForSelector('#b-read',{timeout:4000});
  await page.click('#b-read');
  await page.waitForSelector('.read-list',{timeout:4000});
  await page.screenshot({path:SHOT+'09_read_list.png'});

  // ch001.json の存在確認
  const ch1Exists=await page.evaluate(async()=>{
    try{ const r=await fetch('reader/ch001.json'); return r.ok; }catch(e){ return false; }
  });
  if(!ch1Exists){
    console.warn('WARN: reader/ch001.json not found – reader test skipped');
  } else {
    // s1クリア済みなら「読む ▶」カードが存在するはず(テスト実行中はクリア済みのはず)
    const readCard=await page.$('.rcard[data-no="1"]');
    if(!readCard){
      console.warn('WARN: .rcard[data-no="1"] not found – chapter 1 may not be cleared');
    } else {
      await readCard.click();
      // scriptがある章はVNモードで開く(第1回)。その場合はVN動作を検証して終わる
      await page.waitForSelector('#vn-ov.show, #readerov.show',{timeout:5000});
      if(await page.$('#vn-ov.show')){
        await page.waitForTimeout(700);
        await page.screenshot({path:SHOT+'10_reader_vn.png'});
        await page.click('#vn-ov'); await page.waitForTimeout(200);
        await page.click('#vn-ov'); await page.waitForTimeout(400);
        await page.screenshot({path:SHOT+'11_reader_vn2.png'});
        await page.evaluate(()=>window.VN&&window.VN.skip&&window.VN.skip());
        await page.waitForTimeout(400);
        console.log('READER VN mode: ok');
      } else {
      const readerChk=await page.evaluate(()=>{
        const ov=document.getElementById('readerov');
        const pager=document.getElementById('rdr-pager');
        const pageEl=document.getElementById('rdr-page');
        const m=pager?pager.textContent.match(/(\d+)\s*\/\s*(\d+)/):null;
        return {
          visible:ov&&ov.classList.contains('show'),
          pageCount:m?+m[2]:0,
          hasContent:!!(pageEl&&pageEl.textContent.trim()),
        };
      });
      console.log('READER', JSON.stringify(readerChk));
      if(readerChk.pageCount<=0) errors.push('READER: pageCount is 0');

      await page.screenshot({path:SHOT+'10_reader_open.png'});

      // 右側タップ × 2 (次ページ)
      await page.click('#rdr-tap-right');
      await page.waitForTimeout(180);
      await page.click('#rdr-tap-right');
      await page.waitForTimeout(180);
      await page.screenshot({path:SHOT+'11_reader_page3.png'});

      // 左側タップ × 1 (前ページ)
      await page.click('#rdr-tap-left');
      await page.waitForTimeout(180);
      await page.screenshot({path:SHOT+'12_reader_page2.png'});

      // ── コントロールバー拡張テスト ──────────────────────────

      // 「次へ」ボタンで 1 ページ進む
      await page.click('#rdr-btn-next');
      await page.waitForTimeout(200);
      const afterNext=await page.evaluate(()=>{
        const m=document.getElementById('rdr-pager').textContent.match(/(\d+)\s*\/\s*(\d+)/);
        return m?{cur:+m[1],total:+m[2]}:null;
      });
      console.log('READER after btn-next:', JSON.stringify(afterNext));
      if(!afterNext||afterNext.cur<2) errors.push('READER: btn-next did not advance page');

      // ログを開く
      await page.click('#rdr-btn-log');
      await page.waitForTimeout(200);
      const logOpen=await page.evaluate(()=>!!document.getElementById('rdr-log').classList.contains('show'));
      if(!logOpen) errors.push('READER: log overlay did not open');

      // エントリ数が 2 以上あること
      const entryCount=await page.evaluate(()=>document.querySelectorAll('.rdr-log-entry').length);
      console.log('READER log entries:', entryCount);
      if(entryCount<2) errors.push('READER: log entries < 2 (got '+entryCount+')');
      await page.screenshot({path:SHOT+'13_reader_log.png'});

      // 先頭エントリをタップ → ページ 1/N に戻ること
      await page.click('.rdr-log-entry:first-child');
      await page.waitForTimeout(200);
      const afterJump=await page.evaluate(()=>{
        const logVisible=document.getElementById('rdr-log').classList.contains('show');
        const m=document.getElementById('rdr-pager').textContent.match(/(\d+)\s*\/\s*(\d+)/);
        return {logVisible, cur:m?+m[1]:null};
      });
      console.log('READER after log jump:', JSON.stringify(afterJump));
      if(afterJump.logVisible) errors.push('READER: log still visible after entry tap');
      if(afterJump.cur!==1) errors.push('READER: expected page 1 after jump, got '+afterJump.cur);

      // ✕ で閉じる
      await page.click('#rdr-close');
      await page.waitForTimeout(200);
      const readerClosed=await page.evaluate(()=>!document.getElementById('readerov').classList.contains('show'));
      console.log('READER closed:', readerClosed);
      if(!readerClosed) errors.push('READER: overlay still visible after close');
      }
    }
  }

  console.log('\n=== ERRORS ('+errors.length+') ===');
  errors.forEach(e=>console.log(e));
  await browser.close();
  process.exit(errors.length?2:0);
})().catch(e=>{ console.error('TEST CRASH:', e.message, e.stack); process.exit(3); });
