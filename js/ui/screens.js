// screens.js — UIコントローラ(演義版)。
// フロー: タイトル→ステージ選択→前半ストーリー(主役選択+難易度)→戦闘→結果→後半ストーリー→ガチャ→ステージ選択
window.UI = (function(){
const $=s=>document.querySelector(s);
const G=window.G;
const RAR=window.RARITY_INFO, FAC=window.FACTION_INFO;
let selStage=null, selProto=null, selDiff='normal', lastResult=null;

function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
function stars(r){return '★'.repeat(r);}
function fmtT(s){s=Math.floor(s);return (Math.floor(s/60))+':'+String(s%60).padStart(2,'0');}
function genById(id){return window.GENERALS.find(g=>g.id===id);}

// ── 武器SVGアイコン要素 ─────────────────────
function wiconEl(weaponKey,cls){ const d=el('div','wsvg'+(cls?' '+cls:'')); d.innerHTML=window.weaponIconSvg(weaponKey); return d; }
function avatar(g,px){const c=document.createElement('canvas');c.width=px;c.height=px;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(window.Sprites.general(g),0,0,px,px);return c;}

// ── 進化ヒント ──────────────
function evoHint(gen){
  const ev=window.evoFor&&window.evoFor(gen); if(!ev)return '';
  const need=window.PASSIVE_BY_ID[ev.need]; const needNm=need?need.name:ev.need;
  let cls='evohint';
  const R=G.getR&&G.getR();
  if(R){
    const w=R.weapons.find(x=>x.gen.id===gen.id);
    if(w&&w.evo) return `<div class="evohint done">⚡進化済 ${w.evo.name}</div>`;
    const lvOk=w?w.level>=window.WLEVEL.MAX:false, pOk=(R.passives[ev.need]||0)>=ev.needLv;
    if(lvOk&&pOk)cls='evohint ready'; else if(lvOk||pOk)cls='evohint near';
  }
  return `<div class="${cls}">${ev.generic?'':'⚡'}${ev.name} ← ${needNm}Lv${ev.needLv}＋武器MAX</div>`;
}
const KIND_LABEL={arc:'薙ぎ',proj:'弾',summon:'伏兵',dash:'突進',buff:'号令',field:'陣',zone:'火計',nova:'衝撃波',orbit:'旋回'};
function passiveEvoHint(pid){
  const kinds=[];
  for(const k in window.EVO_GENERIC){ if(window.EVO_GENERIC[k].need===pid) kinds.push(KIND_LABEL[k]||k); }
  return kinds.length? `<div class="evohint">→ ${kinds.join('・')}系が進化</div>` : '';
}

function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
  $('#hud').classList.remove('show');
  if(id) $('#'+id).classList.add('show');
}

// ── タイトル ───────────────────────────────
function renderTitle(){
  const S=window.Save.get();
  const ownedN=Object.keys(S.owned).length;
  const clearedN=Object.keys(S.cleared).length;
  const c=$('#s-title .content');
  c.innerHTML=`
    <div class="title-jp">三国志演義</div>
    <h1 class="logo">三国志演義 survivor</h1>
    <div class="sub">武将＝武器。号令ひとつで群を薙ぎ払え。桃園の誓いより、乱世を駆け抜けろ。</div>
    <button class="btn primary" id="b-play">⚔ 出陣する<small>全120の戦い ─ ${clearedN}/120 制覇</small></button>
    <button class="btn" id="b-codex">📖 英雄図鑑<small>集めた武将を閲覧（所持 ${ownedN}人）</small></button>
    <div class="note">操作：<span class="kbd">WASD</span>/<span class="kbd">←↑↓→</span> または画面ドラッグで移動。攻撃は全自動。レベルアップで武将（武器）と兵法を選んで強くなる。勝てばその戦いの英雄が5連ガチャで仲間になる。</div>
    <button class="btn" id="b-reset" style="margin-top:24px;opacity:.6;font-size:13px;padding:9px;">セーブをリセット</button>
  `;
  $('#b-play').onclick=()=>{renderStage();show('s-stage');};
  $('#b-codex').onclick=()=>{renderCodex();show('s-codex');};
  $('#b-reset').onclick=()=>{if(confirm('全セーブを消去して最初から始めますか？')){window.Save.reset();renderTitle();}};
}

// ── ステージ選択(120) ───────────────────────
const TYPE_LABEL={battle:'会戦',skirmish:'遭遇',swarm:'物量',tactics:'軍略'};
function renderStage(){
  const S=window.Save.get();
  const c=$('#s-stage .content');
  let h=`<div class="topbar"><h2 class="sec" style="margin:0;border:none;">出陣 ─ 戦いを選べ（全120）</h2></div>
    <div class="note">前の戦いをクリアで次が解放。クリア済みは再挑戦できる。</div>
    <div class="stage-grid" style="margin-top:12px;">`;
  for(const st of window.STAGES){
    const ok=window.Save.stageUnlocked(st);
    const cleared=!!S.cleared[st.id];
    h+=`<div class="scard ${ok?'':'locked'} ${cleared?'cleared':''}" data-st="${st.id}" ${ok?'':'data-lock=1'}>
      ${cleared?'<span class="ckmark">✓</span>':''}
      <div class="sno">第${st.no}回 <span class="fac-chip f${st.faction}" style="font-size:10px">${FAC[st.faction].name}</span></div>
      <div class="snm">${ok?st.name:'？？？'}</div>
      <div class="ssub">${ok?(st.sub||''):'前の戦いをクリアで解放'}</div>
      <div class="srow">
        <span class="tbadge ${st.type}">${TYPE_LABEL[st.type]||st.type}</span>
        <span style="font-size:11px;color:var(--txt2)">${ok?Math.round(st.dur/60)+'分':''}</span>
      </div>
    </div>`;
  }
  h+=`</div>`;
  c.innerHTML=h;
  c.querySelectorAll('.scard').forEach(card=>{
    if(card.dataset.lock)return;
    card.onclick=()=>{ selStage=window.STAGE_BY_ID[card.dataset.st]; selProto=null; selDiff=window.Save.get().difficulty||'normal'; renderPreStory(); show('s-lord'); };
  });
}

// ── 前半ストーリー(主役選択＋難易度＋開始) ───
function renderPreStory(){
  const st=selStage;
  const protos=(st.protagonist||[]).map(genById).filter(Boolean);
  if(!selProto) selProto=protos[0];
  const c=$('#s-lord .content');
  let h=`<button class="btn back" style="position:static;width:auto;display:inline-block;margin:0 0 8px;">← 戻る</button>
    <div class="topbar"><h2 class="sec" style="margin:0;border:none;">第${st.no}回 『${st.name}』 ─ ${st.year||''}</h2></div>
    <div class="story-text">${st.storyPre||''}</div>
    <h2 class="sec">主役を選べ ─ あなたが操る武将</h2>
    <div class="proto-pick" id="protoPick">`;
  for(const g of protos){
    h+=`<div class="proto-card" data-id="${g.id}">
      <canvas class="pav" data-av="${g.id}"></canvas>
      <div class="pnm txt-r${g.rarity}">${g.name}</div>
      <div class="pwp">${g.weaponName}（${window.WTYPE[g.weapon].jp}）</div>
      <div class="psk">${g.skillDesc||''}</div>
    </div>`;
  }
  h+=`</div>
    <h2 class="sec">難易度</h2>
    <div class="diff-row" id="diffRow">
      <button class="diff-btn" data-d="easy">やさしい<small>敵が柔く弱い・遠隔少なめ（数は多い）</small></button>
      <button class="diff-btn" data-d="normal">ふつう<small>標準バランス（推奨）</small></button>
      <button class="diff-btn" data-d="hard">むずかしい<small>敵が硬く強く遠隔多め（数は同じ）</small></button>
    </div>
    <button class="btn primary" id="b-start" style="margin-top:16px;">⚔ 戦闘開始</button>`;
  c.innerHTML=h;
  // back ボタン(画面内)
  c.querySelector('.back').onclick=()=>{ renderStage(); show('s-stage'); };
  // アバター描画
  c.querySelectorAll('canvas[data-av]').forEach(cv=>{ const g=genById(+cv.dataset.av); cv.width=60;cv.height=60;const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(window.Sprites.general(g),0,0,60,60); });
  // 主役選択
  function refreshProto(){ c.querySelectorAll('.proto-card').forEach(p=>p.classList.toggle('sel', +p.dataset.id===selProto.id)); }
  c.querySelectorAll('.proto-card').forEach(p=>{ p.onclick=()=>{ selProto=genById(+p.dataset.id); refreshProto(); }; });
  refreshProto();
  // 難易度選択
  function refreshDiff(){ c.querySelectorAll('.diff-btn').forEach(b=>b.classList.toggle('sel', b.dataset.d===selDiff)); }
  c.querySelectorAll('.diff-btn').forEach(b=>{ b.onclick=()=>{ selDiff=b.dataset.d; window.Save.setDifficulty(selDiff); refreshDiff(); }; });
  refreshDiff();
  $('#b-start').onclick=()=>startGame();
}

// ── 主役general → lord 互換オブジェクト ──────
const ROLE_HP={'君主':140,'武将':125,'軍師参謀':100,'文官':95,'婦人':100,'異民族':130,'宦官':100};
function buildLord(gen){
  let baseHp=ROLE_HP[gen.role];
  if(baseHp===undefined){ // その他/武將(異体字)等
    if(gen.role==='武將') baseHp=125;
    else if(/異民族|羌|匈奴|烏桓|南蛮/.test(gen.role)) baseHp=130;
    else baseHp=110;
  }
  return {
    id:gen.id, name:gen.name, faction:gen.faction,
    start:gen.name, startExtra:null,
    baseHp, baseMove:1.0, baseMagnet:1.0,
    buff:{}, passiveName:gen.title, passiveDesc:gen.skillDesc,
    sig:null, voice:gen.voice||'',
  };
}

// ── ゲーム開始 ─────────────────────────────
function startGame(){
  const S=window.Save.get(); S.stats.runs++; window.Save.save();
  const lord=buildLord(selProto);
  show(null); $('#hud').classList.add('show'); $('#pausebtn').style.display='block';
  lastWsig='';
  G.startRun({lord, stage:selStage, owned:S.owned, save:S, difficulty:selDiff});
}

// ── HUD ────────────────────────────────────
let lastWsig='';
function updateHud(){
  const d=G.hudData(); if(!d)return;
  $('#xpbar').style.width=(d.xp/d.xpNext*100)+'%';
  const hpp=Math.max(0,d.hp/d.maxHp*100);
  $('#hpbar').style.width=hpp+'%';
  $('#hptxt').textContent=Math.ceil(d.hp)+' / '+d.maxHp;
  $('#topinfo').innerHTML=fmtT(d.t)+'<small>'+d.stage.name+'</small>';
  $('#lvline').innerHTML='Lv <b>'+d.level+'</b>';
  $('#statline').innerHTML='☠ '+d.kills+'　軍功 <b>'+d.gold+'</b>';
  // 武器アイコン(SVG)。変化時のみ再構築
  const sig=d.weapons.map(w=>w.gen.id+':'+w.level+':'+(w.evo?'e':'')+(w.gen.fused?'f':'')).join(',');
  if(sig!==lastWsig){ lastWsig=sig; const wl=$('#wlist'); wl.innerHTML='';
    for(const w of d.weapons){ const div=el('div','wico'+(w.evo?' evo':'')+(w.gen.fused?' fused':'')); div.appendChild(wiconEl(w.gen.weapon)); div.appendChild(el('span','lv',w.gen.fused?'⚔':'L'+w.level)); wl.appendChild(div); }
    $('#kizunaline').innerHTML=''; }
  // ボスバー
  const bb=$('#bossbar');
  if(d.boss && !d.boss.dead){ bb.classList.add('show'); $('#bossname').textContent='【'+(d.boss.title||'')+'】'+d.boss.name; $('#bosshp').style.width=Math.max(0,d.boss.hp/d.boss.maxHp*100)+'%'; }
  else bb.classList.remove('show');
}

// ── レベルアップ ───────────────────────────
let rerollLeft=1;
function renderChoiceCards(choices){
  const box=$('#lvchoices'); box.innerHTML='';
  for(const c of choices){
    const card=el('div','choice'); let ico,inner;
    if(c.type==='wnew'){
      ico=wiconEl(c.gen.weapon,'ci');
      inner=`<div class="crow"><span class="tag txt-r${c.gen.rarity}">${RAR[c.gen.rarity].name}新武将</span><span class="cnm">${c.gen.name}</span></div>
        <div class="ct">${c.gen.weaponName}（${window.WTYPE[c.gen.weapon].jp}）</div>
        <div class="cd">${c.gen.skillDesc}</div>${evoHint(c.gen)}`;
    } else if(c.type==='wup'){
      ico=wiconEl(c.gen.weapon,'ci');
      inner=`<div class="crow"><span class="tag" style="color:var(--gold2)">強化 Lv${c.w.level+1}</span><span class="cnm">${c.gen.name}</span></div>
        <div class="ct">${c.gen.weaponName}</div>
        <div class="cd">${window.WTYPE[c.gen.weapon].note||c.gen.skillDesc}</div>${evoHint(c.gen)}`;
    } else {
      ico=el('div','ci ci-emoji',c.p.icon);
      inner=`<div class="crow"><span class="tag">兵法 ${c.lv>0?('Lv'+c.lv+'→'+(c.lv+1)):'新規'}</span><span class="cnm">${c.p.name}</span></div>
        <div class="cd">${c.p.desc}</div>${passiveEvoHint(c.p.id)}`;
    }
    card.appendChild(ico);
    card.appendChild(el('div','cinfo',inner));
    card.onclick=()=>{ $('#levelup').classList.remove('show'); G.applyChoice(c); };
    box.appendChild(card);
  }
}
function renderLvBtns(){
  const b=$('#lvbtns'); b.innerHTML='';
  const rr=el('button','lvbtn'+(rerollLeft>0?'':' disabled'), rerollLeft>0?'🔄 引き直し':'🔄 引き直し済');
  rr.onclick=()=>{ if(rerollLeft<=0)return; rerollLeft--; renderChoiceCards(G.rerollChoices()); renderLvBtns(); };
  const sk=el('button','lvbtn','⏭ スキップ (微回復)');
  sk.onclick=()=>{ $('#levelup').classList.remove('show'); G.skipLevel(); };
  b.appendChild(rr); b.appendChild(sk);
}
function onLevelUp(choices){
  rerollLeft=1;
  renderChoiceCards(choices);
  renderLvBtns();
  $('#levelup').classList.add('show');
}

// ── ボス登場トースト ───────────────────────
function onBossIntro(name,title,line){
  const t=$('#bosstoast'); t.innerHTML=`<div style="font-size:13px;color:var(--txt2)">大将出現</div><div style="font-size:26px;font-weight:900;color:var(--redL)">【${title}】${name}</div><div class="voice">「${line}」</div>`;
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600);
}

// ── 結果 → 後半ストーリーへ ────────────────
function onEnd(res){
  $('#pausebtn').style.display='none';
  const S=window.Save.get();
  S.stats.kills+=res.kills; if(res.win)S.stats.wins++;
  if(res.win){ window.Save.clearStage(res.stage.id,res); }
  window.Save.save();
  lastResult=res;
  const box=$('#resultbox');
  box.innerHTML=`
    <h2 style="color:${res.win?'var(--gold)':'var(--redL)'}">${res.win?'勝利 ─ 大将を討ち取った':'敗北 ─ 力尽きた'}</h2>
    <div class="hint">${res.stage.name}（主役 ${res.lord.name}）</div>
    <div class="res-stat">
      <div class="k">生存時間</div><div class="v">${fmtT(res.time)}</div>
      <div class="k">撃破数</div><div class="v">${res.kills}</div>
      <div class="k">到達レベル</div><div class="v">${res.level}</div>
    </div>
    <div style="font-size:12px;color:var(--txt2);max-width:340px;text-align:center;margin-bottom:6px;">編成: ${res.weapons.map(w=>w.name+(w.evo?'⚡':'')+'L'+w.level).join('・')}</div>
    <div class="row" style="max-width:340px;width:100%;margin-top:14px;">
      <button class="btn primary" id="r-next">物語の続きへ ▶</button>
    </div>`;
  $('#result').classList.add('show');
  $('#r-next').onclick=()=>{ $('#result').classList.remove('show'); renderPostStory(res); show('s-story'); };
}

// ── 後半ストーリー → ガチャ ────────────────
function renderPostStory(res){
  const st=res.stage;
  const c=$('#s-story .content');
  const pulls=res.win?5:1;
  c.innerHTML=`
    <div class="topbar"><h2 class="sec" style="margin:0;border:none;">第${st.no}回 『${st.name}』 ─ 結末</h2></div>
    <div class="story-text">${st.storyPost||''}</div>
    <div class="note" style="text-align:center;">${res.win?'勝利の褒賞':'敗れたが…'}この戦いの英雄 <b>${pulls}人</b> を招集できる。</div>
    <button class="btn gold" id="b-pull" style="margin-top:14px;">🎴 ${pulls}連 招集する</button>
    <button class="btn" id="b-skip" style="opacity:.7">招集せずステージ選択へ</button>`;
  $('#b-pull').onclick=()=>doStageGacha(pulls, st);
  $('#b-skip').onclick=()=>{ renderStage(); show('s-stage'); };
}

// ── ステージ報酬ガチャ ─────────────────────
function rollRarityFrom(pool){
  // その回の登場武将プールは小さく目玉(高レア)こそ狙い。重みはフラット寄りにして関羽級も出る
  const W=[0,2.4,2.8,3.0,3.0,2.6];
  const items=pool.map(id=>genById(id)).filter(Boolean);
  let tot=0; for(const g of items) tot+=W[g.rarity]||1;
  let x=Math.random()*tot;
  for(const g of items){ x-=(W[g.rarity]||1); if(x<=0) return g; }
  return items[items.length-1];
}
function doStageGacha(n, st){
  const S=window.Save.get();
  const pool=(st.gachaPool&&st.gachaPool.length)?st.gachaPool:(st.roster||[]);
  const rolls=[];
  for(let i=0;i<n;i++) rolls.push(rollRarityFrom(pool));
  // 5連(クリア)は最低1人をその回の目玉(SSR/UR)で確定。関羽が全然出ない問題への対策
  if(n>=3){
    const high=pool.map(genById).filter(g=>g&&g.rarity>=4);
    if(high.length && !rolls.some(g=>g&&g.rarity>=4)) rolls[rolls.length-1]=high[Math.floor(Math.random()*high.length)];
  }
  const drops=[];
  for(const g of rolls){
    const before=S.owned[g.id]||0;
    let refund=0, isNew=before===0;
    if(before>=window.GACHA.dupMax){ refund=window.GACHA.dupRefund[g.rarity]||0; }
    else { S.owned[g.id]=before+1; }
    drops.push({g,isNew,refund,dup:before});
  }
  window.Save.save();
  playGacha(drops);
}
function playGacha(drops){
  const fx=$('#gachabox'); fx.innerHTML='';
  const grid=el('div','pull-grid');
  drops.sort((a,b)=>b.g.rarity-a.g.rarity);
  drops.forEach((d,i)=>{
    const p=el('div','pull r'+d.g.rarity); p.style.animationDelay=(i*0.06)+'s';
    p.style.borderColor=RAR[d.g.rarity].color;
    p.appendChild(wiconEl(d.g.weapon));
    p.appendChild(el('div','pn txt-r'+d.g.rarity, d.g.name));
    p.appendChild(el('div',null,`<span style="font-size:9px" class="txt-r${d.g.rarity}">${stars(d.g.rarity)}</span> ${d.isNew?'<span style="color:#7CFC8A;font-size:10px;font-weight:800">NEW</span>':(d.refund?`<span style="color:var(--gold2);font-size:9px">+${d.refund}</span>`:`<span style="color:var(--txt2);font-size:9px">凸</span>`)}`));
    grid.appendChild(p);
  });
  fx.appendChild(grid);
  const hint=el('div','tap-hint','タップで閉じる'); fx.appendChild(hint);
  $('#gachaFx').classList.add('show');
  $('#gachaFx').onclick=()=>{ $('#gachaFx').classList.remove('show'); renderStage(); show('s-stage'); };
}

// ── ポーズ ─────────────────────────────────
function togglePause(){
  const R=G.getR(); if(!R||R.over)return;
  if($('#pause').classList.contains('show')){ $('#pause').classList.remove('show'); G.pauseToggle(false); }
  else { G.pauseToggle(true); $('#pause').classList.add('show'); }
}

// ── 図鑑 ───────────────────────────────────
function renderCodex(){
  const S=window.Save.get();
  const c=$('#s-codex .content');
  const list=[...window.GENERALS].sort((a,b)=> b.rarity-a.rarity || (b.scores.W-a.scores.W));
  const ownedN=Object.keys(S.owned).length;
  let h=`<div class="topbar"><h2 class="sec" style="margin:0;border:none;">英雄図鑑（演義390人 / 所持 ${ownedN}）</h2></div>
    <div class="note">戦いに勝つとその回の英雄が招集できる。集めた武将はここに並ぶ。未所持はシルエット表示。</div>
    <div class="dex" style="margin-top:12px;">`;
  for(const g of list){
    const owned=S.owned[g.id]||0; const avail=owned>0;
    h+=`<div class="cell r${g.rarity} ${avail?'':'locked'}" data-id="${g.id}">
      ${owned>1?`<span class="dup">+${owned-1}</span>`:''}
      <div class="av wsvg" data-w="${g.weapon}"></div>
      <div class="cn txt-r${g.rarity}">${avail?g.name:'？？'}</div>
      <div class="stars txt-r${g.rarity}">${stars(g.rarity)}</div>
    </div>`;
  }
  h+=`</div>`;
  c.innerHTML=h;
  // 武器SVGアイコン描画
  c.querySelectorAll('.av[data-w]').forEach(d=>{ d.innerHTML=window.weaponIconSvg(d.dataset.w); });
  c.querySelectorAll('.cell').forEach(cell=>{ const g=genById(+cell.dataset.id); const avail=(S.owned[g.id]||0)>0; cell.onclick=()=>{ if(avail)openDetail(g); }; });
}
const DLAB=['実証','武名','膂力','恐怖','戦術','戦略','統率'];
function openDetail(g){
  const owned=window.Save.get().owned[g.id]||0;
  let bars='';
  for(let i=0;i<7;i++) bars+=`<span>${DLAB[i]}</span><div class="dbar"><i style="width:${g.d[i]*10}%"></i></div><b>${g.d[i]}</b>`;
  $('#modalbox').innerHTML=`
    <div style="display:flex;gap:14px;align-items:center;">
      <div class="wsvg" style="width:84px;height:84px;flex:0 0 84px;border:2px solid var(--${['n','r','sr','ssr','ur'][g.rarity-1]||'n'})">${window.weaponIconSvg(g.weapon)}</div>
      <div>
        <h3 class="txt-r${g.rarity}">${g.name}</h3>
        <div style="color:var(--txt2);font-size:13px;">【${g.title}】 <span class="fac-chip f${g.faction}">${FAC[g.faction].name}</span> ${stars(g.rarity)}</div>
        <div style="margin-top:4px;font-size:13px;">武器：<b>${g.weaponName}</b>（${window.WTYPE[g.weapon].jp}）${owned>1?` ・ <span style="color:var(--gold2)">+${owned-1}凸</span>`:''}</div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:13px;"><b style="color:var(--gold2)">${g.skill}</b> ─ ${g.skillDesc}</div>
    ${g.bio?`<div class="lore">${g.bio}</div>`:''}
    ${g.chapN?`<div style="font-size:12px;color:var(--txt2);margin:6px 0;line-height:1.55;">演義での登場：全 <b style="color:var(--gold2)">${g.chapN}</b> 回　主な舞台 ${(g.chapters||[]).map(n=>'第'+n+'回').join('・')}</div>`:''}
    <div class="dscore">${bars}</div>
    <div style="font-size:12px;color:var(--txt2)">集約：腕W <b>${g.scores.W}</b> / 戦場B <b>${g.scores.B}</b> / 戦略S <b>${g.scores.S}</b>${g.scores.G?` / 政G <b>${g.scores.G}</b>`:''}</div>
    ${g.voice?`<div class="voice">「${g.voice}」</div>`:''}
    <button class="btn" id="m-close" style="margin-top:16px">閉じる</button>`;
  $('#modal').classList.add('show');
  $('#m-close').onclick=()=>$('#modal').classList.remove('show');
}

// ── 初期化 ─────────────────────────────────
function init(){
  G.onHud=updateHud; G.onLevelUp=onLevelUp; G.onGameOver=onEnd; G.onVictory=onEnd; G.onBossIntro=onBossIntro;
  G.onAutoPause=()=>{ if(!$('#pause').classList.contains('show'))$('#pause').classList.add('show'); };
  $('#pausebtn').onclick=togglePause;
  $('#p-resume').onclick=togglePause;
  $('#p-quit').onclick=()=>{ $('#pause').classList.remove('show'); G.quitRun(); G.pauseToggle(false); renderStage(); show('s-stage'); };
  document.querySelectorAll('.screen > .back').forEach(b=>b.onclick=()=>{renderTitle();show('s-title');});
  addEventListener('keydown',e=>{ if((e.key==='Escape'||e.key.toLowerCase()==='p')){const R=G.getR();if(R&&!R.over)togglePause();} });
  renderTitle(); show('s-title');
}
return {init,renderTitle,show};
})();
