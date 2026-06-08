// 縁→合体システムの決定論検証。NODE_PATH=<playwright> node tools/verify_kizuna.js
const { chromium } = require('playwright');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({channel:'chrome', args:['--use-gl=swiftshader']});
  const page=await browser.newPage({viewport:{width:430,height:800}});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push('CONSOLE: '+m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  await page.goto('http://localhost:8765/',{waitUntil:'networkidle'});
  await page.waitForSelector('#b-play');

  // 出陣(劉備/s1)
  await page.click('#b-play'); await page.waitForSelector('.card[data-st="s1"]'); await page.click('.card[data-st="s1"]');
  await page.waitForSelector('.card[data-l="liubei"]'); await page.click('.card[data-l="liubei"]'); await page.waitForSelector('#hud.show');
  await page.evaluate(()=>{ new MutationObserver(()=>{const lv=document.getElementById('levelup');if(lv.classList.contains('show')){const c=lv.querySelector('.choice');if(c)c.click();}}).observe(document.getElementById('levelup'),{attributes:true}); });
  await wait(400);

  // ── 下邳(呂布2+陳宮84)の teaser→合体 ──
  const xiapi=await page.evaluate(()=>{
    const G=window.G, R=G.getR(); R.pendingLevels=0; R.paused=false;
    R.weapons.length=0;                                   // 既存武器をクリアして統制
    const gen=id=>window.GENERALS.find(g=>g.id===id);
    G.addWeapon(gen(2)); G.addWeapon(gen(84));             // 呂布・陳宮を装備(未MAX)
    G.recomputeBuffs();
    const teaserCrit=R.buffs.crit;                         // teaser(crit+0.06)が乗るはず
    const active=(G.kizunaActiveList()||[]).map(k=>k.id);
    // 両方Lv MAXにして合体判定
    for(const w of R.weapons) w.level=window.WLEVEL.MAX;
    G.checkFusion();
    const fused=R.weapons.find(w=>w.gen.fused);
    const baseMul = fused? window.G.effStats({gen:{weapon:'halberd',stat:gen(2).stat},level:8,dupMul:1,evo:null}, R).dmg : 0;
    const fusedDmg = fused? window.G.effStats(fused, R).dmg : 0;
    return {
      teaserCrit, active,
      fusedExists: !!fused,
      fusedName: fused?fused.gen.name:null,
      fuseMul: fused?fused.fuseMul:null,
      fuseAuraCrit: fused?fused.fuseAura.crit:null,
      memberGone: !R.weapons.some(w=>w.gen.id===2||w.gen.id===84),
      consumed: [...(R.fusedConsumed||[])].sort((a,b)=>a-b),
      fusedSet: [...(R.fusedKizuna||[])],
      slots: R.weapons.length,
      dmgRatio: baseMul? +(fusedDmg/baseMul).toFixed(2):0,   // 融合dmg/素のLv8呂布dmg ≈ fuseMul
      auraCritInBuffs: R.buffs.crit,                          // 合体後オーラのcrit(0.12)が乗るはず
    };
  });

  // ── 桃園(劉備37+関羽1+張飛13) 3人融合で枠が2つ空く ──
  const taoyuan=await page.evaluate(()=>{
    const G=window.G, R=G.getR(); R.weapons.length=0;
    const gen=id=>window.GENERALS.find(g=>g.id===id);
    G.addWeapon(gen(37)); G.addWeapon(gen(1)); G.addWeapon(gen(13));
    const before=R.weapons.length;
    for(const w of R.weapons) w.level=window.WLEVEL.MAX;
    G.checkFusion();
    const fused=R.weapons.find(w=>w.gen.fused&&w.gen.fromKizuna==='taoyuan');
    return { before, after:R.weapons.length, fusedName:fused?fused.gen.name:null,
      hpAura:fused?fused.fuseAura.hp:null,
      // 消費した関羽がドラフトに出ないか(buildChoices相当: fusedConsumed)
      kanuConsumed:(R.fusedConsumed||new Set()).has? R.fusedConsumed.has(1):false };
  });

  // ── kizunaForGen がカード用ヒントを返すか(クラッシュしないか) ──
  const hint=await page.evaluate(()=>{ const G=window.G; const ks=G.kizunaForGen(46); return Array.isArray(ks); });

  console.log('XIAPI(下邳)',JSON.stringify(xiapi));
  console.log('TAOYUAN(桃園)',JSON.stringify(taoyuan));
  console.log('kizunaForGen ok:',hint);
  console.log('ERRORS('+errors.length+')'); errors.slice(0,20).forEach(e=>console.log('  '+e));
  await browser.close();
  process.exit(errors.length?1:0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(2);});
