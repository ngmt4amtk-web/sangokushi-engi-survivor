// screens.js — UIコントローラ(演義版)。
// フロー: タイトル→ステージ選択→前半ストーリー(主役選択+難易度)→戦闘→結果→後半ストーリー→ガチャ→ステージ選択
window.UI = (function(){
const $=s=>document.querySelector(s);
const G=window.G;
const RAR=window.RARITY_INFO, FAC=window.FACTION_INFO;
let selStage=null, selProto=null, selDiff='normal', selCurse=0, lastResult=null;

function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
function stars(r){return '★'.repeat(r);}
function fmtT(s){s=Math.floor(s);return (Math.floor(s/60))+':'+String(s%60).padStart(2,'0');}
function genById(id){return window.GENERALS.find(g=>g.id===id);}
function genByName(n){const g=window.GENERALS.find(x=>x.name===n);return g?g.id:null;}
// その回のシーン定義(章=シーン連結)。主役名→idへ解決して返す。無ければnull
function chapterScenesFor(stage){
  const raw = (stage&&stage.scenes) || (window.CHAPTER_SCENES && stage && window.CHAPTER_SCENES[stage.no]);
  if(!raw||!raw.length) return null;
  return raw.map(sc=>Object.assign({},sc,{proto:(typeof sc.proto==='number'?sc.proto:genByName(sc.proto))}));
}
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');}

// ── 武器SVGアイコン要素 ─────────────────────
function wiconEl(weaponKey,cls){ const d=el('div','wsvg'+(cls?' '+cls:'')); d.innerHTML=window.weaponIconSvg(weaponKey); return d; }
function avatar(g,px){const c=document.createElement('canvas');c.width=px;c.height=px;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(window.Sprites.general(g),0,0,px,px);return c;}
// 顔(立ち絵)＋武器種の小バッジ。図鑑/選択/ガチャの主役割アイコンに使う
function faceEl(g,px,cls){ const w=el('div','face'+(cls?' '+cls:'')); const cv=avatar(g,px); cv.className='fav'; w.appendChild(cv);
  const b=el('div','wbadge'); b.innerHTML=window.weaponIconSvg(g.weapon); b.title=g.weaponName; w.appendChild(b); return w; }

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
  if(id){ const s=$('#'+id); s.classList.add('show'); s.scrollTop=0; }   // 遷移先は必ず先頭から(前画面のスクロール位置を持ち越さない)
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
    <button class="btn" id="b-read">📜 演義を読む<small>クリアした戦いの物語をたどる（${clearedN}/120 開放）</small></button>
    <button class="btn" id="b-barracks">🏯 修練場 ─ 永続強化<small>軍功 ${(S.meta&&S.meta.gold)||0}（勝敗問わず貯まる・死んでも積み上がる）</small></button>
    <div class="note">${navigator.maxTouchPoints>0?'操作：画面を<b>ドラッグで移動</b>。攻撃は全自動。':'操作：<span class="kbd">WASD</span>/<span class="kbd">←↑↓→</span> または画面ドラッグで移動。攻撃は全自動。'}レベルアップで武将（武器）と兵法を選んで強くなる。勝てばその戦いの英雄が仲間になる。</div>
    <button class="btn" id="b-reset" style="margin-top:24px;opacity:.6;font-size:13px;padding:9px;">セーブをリセット</button>
  `;
  $('#b-play').onclick=()=>{renderStage();show('s-stage');};
  $('#b-codex').onclick=()=>{renderCodex();show('s-codex');};
  $('#b-read').onclick=()=>{renderRead();show('s-read');};
  $('#b-barracks').onclick=()=>{renderBarracks();show('s-barracks');};
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
    `;
  const _scn = chapterScenesFor(st);
  const isChapter = _scn && _scn.length;
  if(isChapter){
    h+=`<h2 class="sec">この回の場面 ─ ${_scn.length}幕を連続で戦う（主役が替わる）</h2><div class="scene-list">`;
    _scn.forEach((sc,i)=>{ const g=genById(sc.proto); const kl={sweep:'掃討',survive:'耐久',doom:'悲運'}[sc.kind]||sc.kind;
      h+=`<div class="sl-row"><span class="sl-n">${i+1}</span><span class="sl-nm txt-r${g?g.rarity:1}">${g?g.name:'？'}</span><span class="sl-k ${sc.kind}">${kl}</span><span class="sl-t">${sc.dur}秒</span></div>`; });
    h+=`</div>`;
  } else {
    h+=`<h2 class="sec">主役を選べ ─ あなたが操る武将</h2><div class="proto-pick" id="protoPick">`;
    for(const g of protos){
      h+=`<div class="proto-card" data-id="${g.id}">
        <canvas class="pav" data-av="${g.id}"></canvas>
        <div class="pnm txt-r${g.rarity}">${g.name}</div>
        <div class="pwp">${g.weaponName}（${window.WTYPE[g.weapon].jp}）</div>
        <div class="psk">${g.skillDesc||''}</div>
      </div>`;
    }
    h+=`</div>`;
  }
  h+=`<h2 class="sec">難易度</h2>
    <div class="diff-row" id="diffRow">
      <button class="diff-btn" data-d="easy">やさしい<small>敵が柔く弱い・遠隔少なめ（数は多い）</small></button>
      <button class="diff-btn" data-d="normal">ふつう<small>標準バランス（推奨）</small></button>
      <button class="diff-btn" data-d="hard">むずかしい<small>敵が硬く強く遠隔多め（数は同じ）</small></button>
    </div>
    <h2 class="sec">天命 ─ 危険を盛るほど 経験値・軍功 が増える</h2>
    <div class="diff-row" id="curseRow">
      <button class="diff-btn" data-c="0">封印<small>追加なし</small></button>
      <button class="diff-btn" data-c="0.3">乱世 +30%<small>敵強化／報酬↑</small></button>
      <button class="diff-btn" data-c="0.6">動乱 +60%<small>敵強化／報酬↑↑</small></button>
      <button class="diff-btn" data-c="1">修羅 +100%<small>敵激化／報酬 大</small></button>
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
  function refreshDiff(){ c.querySelectorAll('#diffRow .diff-btn').forEach(b=>b.classList.toggle('sel', b.dataset.d===selDiff)); }
  c.querySelectorAll('#diffRow .diff-btn').forEach(b=>{ b.onclick=()=>{ selDiff=b.dataset.d; window.Save.setDifficulty(selDiff); refreshDiff(); }; });
  refreshDiff();
  // 天命(危険⇄報酬)
  function refreshCurse(){ c.querySelectorAll('#curseRow .diff-btn').forEach(b=>b.classList.toggle('sel', parseFloat(b.dataset.c)===selCurse)); }
  c.querySelectorAll('#curseRow .diff-btn').forEach(b=>{ b.onclick=()=>{ selCurse=parseFloat(b.dataset.c); refreshCurse(); }; });
  refreshCurse();
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
  const stage=selStage;
  const _scenes=chapterScenesFor(stage);
  if(_scenes && _scenes.length){   // 章=シーン連結(複数幕の連続)
    chap={stage, scenes:_scenes, idx:0, accum:{kills:0,gold:0,level:1,time:0}};
    playScene(); return;
  }
  chap=null;
  const lord=buildLord(selProto);
  show(null); $('#hud').classList.add('show'); $('#pausebtn').style.display='block'; lastWsig='';
  G.startRun({lord, stage, owned:S.owned, save:S, difficulty:selDiff, curse:selCurse});
  maybeOnboard(S);
}
function maybeOnboard(S){
  // 初回オンボーディング(最初の1ランだけ寄り添う)
  if(!S.seenIntro){ S.seenIntro=true; window.Save.save();
    const tips=['画面をドラッグで移動。攻撃は自動だ','緑の結晶＝経験値。集めてレベルアップ','赤い円や矢印＝危険。避けろ'];
    tips.forEach((tx,i)=>setTimeout(()=>{ const R=G.getR(); if(!R||R.over)return; const t=$('#bosstoast');
      t.innerHTML='<div style="font-size:18px;font-weight:800;color:var(--gold2);text-shadow:0 1px 3px #000">'+tx+'</div>';
      t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2700); }, 1100+i*3400)); }
}

// ── 章シーケンサ(1回=複数シーンの連続。主役・型・秒数がシーンごとに変わる) ──
let chap=null;
function sceneStageOf(stage,sc){   // 章stageを土台に、そのシーンの主役/型/秒数/敵で上書き
  const st=Object.assign({},stage);
  st.name=sc.name||stage.name;
  st.chapterName=stage.name;
  st.dur=sc.dur;
  st.protagonist=[sc.proto];
  if(sc.roster) st.roster=sc.roster;
  st.boss = (sc.kind==='sweep') ? (sc.boss||stage.boss) : null;   // sweepのみボス撃破で勝利。survive/doomはボス無し
  if(sc.recolor) st.recolor=sc.recolor;
  if(sc.pool) st.pool=sc.pool;
  st.elites = (sc.kind==='sweep') ? (sc.elites!==undefined?sc.elites:stage.elites) : [];
  st.endless=false;
  return st;
}
function playScene(){
  const S=window.Save.get();
  const sc=chap.scenes[chap.idx];
  const gen=genById(sc.proto)||genById((chap.stage.protagonist||[])[0]);
  const lord=buildLord(gen);
  const last=chap.idx===chap.scenes.length-1;
  show(null); $('#hud').classList.add('show'); $('#pausebtn').style.display='block'; lastWsig='';
  G.startRun({lord, stage:sceneStageOf(chap.stage,sc), owned:S.owned, save:S, difficulty:selDiff, curse:selCurse,
    scene:{kind:sc.kind, dur:sc.dur, name:sc.name||'', last, deathLine:sc.deathLine, epitaph:sc.epitaph}});
  sceneIntro(sc,gen);
}
function sceneIntro(sc,gen){
  const t=$('#bosstoast');
  const kl={sweep:'討て',survive:'耐えよ',doom:'避けられぬ最期'}[sc.kind]||'';
  t.innerHTML=`<div style="font-size:12px;color:var(--txt2)">第${chap.idx+1}幕 ／ ${chap.scenes.length}　${kl}</div>
    <div style="font-size:23px;font-weight:900;color:${sc.kind==='doom'?'var(--redL)':'var(--gold2)'}">${gen?gen.name:''}</div>
    <div style="font-size:13px;color:var(--txt2);margin-top:2px">${esc(sc.name||'')}</div>
    ${sc.kind==='doom'?'<div class="voice" style="color:var(--redL);margin-top:4px">これは避けられぬ運命──どこまで抗える？</div>':''}
    ${sc.kind==='survive'?`<div class="voice" style="color:var(--gold2);margin-top:4px">${sc.dur}秒、生き延びろ</div>`:''}`;
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), sc.kind==='sweep'?2000:3200);
}
function onSceneEnd(reason,res){
  if(!chap){ onEnd(res); return; }
  chap.accum.kills+=res.kills; chap.accum.gold+=res.gold; chap.accum.time+=res.time; chap.accum.level=Math.max(chap.accum.level,res.level);
  $('#pausebtn').style.display='none';
  const sc=chap.scenes[chap.idx];
  const last=chap.idx===chap.scenes.length-1;
  if(reason==='dead'){ finishChapter(false,res); return; }   // 通常シーンで力尽き＝章敗北
  const advance=()=>{ if(last) finishChapter(true,res); else { chap.idx++; interlude(playScene); } };
  if(reason==='doom') showDoom(sc, advance); else advance();
}
function showDoom(sc, next){
  const box=$('#scenebox'); box.className='sb-doom';
  box.innerHTML=`<div class="doom-mark">─ 避けられぬ最期 ─</div>
    <div class="doom-line">${sc.deathLine?('「'+esc(sc.deathLine)+'」'):''}</div>
    <div class="doom-epi">${esc(sc.epitaph||'')}</div>
    <button class="btn" id="doom-go">先へ ▶</button>`;
  $('#sceneov').classList.add('show');
  const line=box.querySelector('.doom-line'), epi=box.querySelector('.doom-epi'), btn=box.querySelector('#doom-go');
  [line,epi,btn].forEach(e=>e&&(e.style.opacity=0));
  setTimeout(()=>line&&(line.style.opacity=1),400);
  setTimeout(()=>epi&&(epi.style.opacity=1),2000);
  setTimeout(()=>btn&&(btn.style.opacity=1),2800);
  window.SFX&&SFX.play('bossDead');
  $('#doom-go').onclick=()=>{ $('#sceneov').classList.remove('show'); next(); };
}
function interlude(next){
  const sc=chap.scenes[chap.idx];   // idxは進めた後＝これが次の幕
  const gen=genById(sc.proto);
  const box=$('#scenebox'); box.className='sb-il';
  box.innerHTML=`<div class="il-mark">― 第${chap.idx+1}幕 ／ ${chap.scenes.length} ―</div>
    <div class="il-name">${esc(sc.name||'')}</div>
    ${gen?`<div class="il-who">主役 <b class="txt-r${gen.rarity}">${gen.name}</b></div>`:''}
    <div class="il-text">${esc(sc.pre||'物語は続く。')}</div>
    <button class="btn primary" id="il-go">進む ▶</button>`;
  $('#sceneov').classList.add('show');
  $('#il-go').onclick=()=>{ $('#sceneov').classList.remove('show'); next(); };
}
function finishChapter(win,res){
  const names=chap.scenes.map(s=>{const g=genById(s.proto);return g?g.name:'';}).filter((v,i,a)=>v&&a.indexOf(v)===i);
  const merged=Object.assign({},res,{win, stage:chap.stage, kills:chap.accum.kills, gold:chap.accum.gold, time:chap.accum.time, level:chap.accum.level, lord:{name:names.join('・')}});
  chap=null;
  onEnd(merged);
}

// ── HUD ────────────────────────────────────
let lastWsig='';
function updateHud(){
  const d=G.hudData(); if(!d)return;
  $('#xpbar').style.width=(d.xp/d.xpNext*100)+'%';
  const hpp=Math.max(0,d.hp/d.maxHp*100);
  $('#hpbar').style.width=hpp+'%';
  $('#hptxt').textContent=Math.ceil(d.hp)+' / '+d.maxHp;
  $('#topinfo').innerHTML=fmtT(d.t)+'<small>'+esc(d.sceneName||d.stage.name)+'</small>';
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
      ico=faceEl(c.gen,52,'ci');
      inner=`<div class="crow"><span class="tag txt-r${c.gen.rarity}">${RAR[c.gen.rarity].name}新武将</span><span class="cnm">${c.gen.name}</span></div>
        <div class="ct">${c.gen.weaponName}（${window.WTYPE[c.gen.weapon].jp}）</div>
        <div class="cd">${c.gen.skillDesc}</div>${evoHint(c.gen)}`;
    } else if(c.type==='wup'){
      ico=faceEl(c.gen,52,'ci');
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
  S.meta=S.meta||{gold:0,upg:{}}; S.meta.gold=(S.meta.gold||0)+(res.gold||0);   // 軍功は勝敗問わず永続貯蓄(死んでも積み上がる)
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
    <div class="gold-earn">軍功 <b>+${res.gold}</b> 獲得　<small>累計 ${S.meta.gold}・修練場で永続強化に使える</small></div>
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
  window.SFX&&(SFX.play('gacha'), drops.some(d=>d.g.rarity>=4)&&SFX.play('kizuna'));
  const fx=$('#gachabox'); fx.innerHTML='';
  const grid=el('div','pull-grid');
  drops.sort((a,b)=>b.g.rarity-a.g.rarity);
  drops.forEach((d,i)=>{
    const p=el('div','pull r'+d.g.rarity); p.style.animationDelay=(i*0.06)+'s';
    p.style.borderColor=RAR[d.g.rarity].color;
    p.appendChild(faceEl(d.g,64));
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
function renderPause(){
  const R=G.getR(); const d=G.hudData&&G.hudData(); if(!R||!d)return;
  const box=$('#pausebox'); if(!box)return; box.innerHTML='';
  const lord=genById(R.lord.id);
  const head=el('div','p-head');
  if(lord) head.appendChild(faceEl(lord,54,'big'));
  const dl={easy:'やさしい',normal:'ふつう',hard:'むずかしい'}[selDiff]||'';
  head.appendChild(el('div','p-hi',`<div class="p-role">操作中の主役</div><div class="p-name txt-r${lord?lord.rarity:1}">${R.lord.name}</div><div class="p-sub">${d.stage.name||''}　<span class="dchip">${dl}</span></div>`));
  box.appendChild(head);
  box.appendChild(el('div','p-stats',
    `<div><span>Lv</span><b>${d.level}</b></div><div><span>時間</span><b>${fmtT(d.t)}</b></div><div><span>撃破</span><b>${d.kills}</b></div><div><span>HP</span><b>${Math.ceil(d.hp)}/${d.maxHp}</b></div><div><span>軍功</span><b>${d.gold}</b></div>`));
  const wl=el('div','p-sect'); wl.appendChild(el('div','p-lbl','編成 ─ 装備中の武将（武器）'));
  const wg=el('div','p-team');
  for(const w of d.weapons){ const cell=el('div','p-wcell'+(w.gen.fused?' fused':'')+(w.evo?' evo':''));
    cell.appendChild(faceEl(w.gen,38));
    cell.appendChild(el('div','p-wn',w.gen.name));
    cell.appendChild(el('div','p-wlv',w.gen.fused?'⚔合体':('Lv'+w.level+(w.evo?' ⚡':''))));
    wg.appendChild(cell); }
  wl.appendChild(wg); box.appendChild(wl);
  const ps=Object.keys(d.passives||{}).filter(id=>d.passives[id]>0);
  if(ps.length){ const pe=el('div','p-sect'); pe.appendChild(el('div','p-lbl','兵法'));
    pe.appendChild(el('div','p-tags',ps.map(id=>{const p=window.PASSIVE_BY_ID[id];return '<span class="ptag">'+(p?p.name:id)+' Lv'+d.passives[id]+'</span>';}).join(''))); box.appendChild(pe); }
  const kz=(G.kizunaActiveList&&G.kizunaActiveList())||[];
  if(kz.length){ const ke=el('div','p-sect'); ke.appendChild(el('div','p-lbl','発動中の縁'));
    ke.appendChild(el('div','p-tags',kz.map(k=>'<span class="ptag kz">'+(k.name||k.fusedName||'')+'</span>').join(''))); box.appendChild(ke); }
  const mt=el('button','lvbtn'); mt.style.marginTop='12px';
  const setMt=()=>mt.textContent='効果音 '+(window.SFX&&SFX.isMuted()?'🔇 OFF':'🔊 ON');
  setMt(); mt.onclick=()=>{ const m=window.SFX&&SFX.toggle(); const S=window.Save.get(); S.opts=S.opts||{}; S.opts.muted=m; window.Save.save(); setMt(); };
  box.appendChild(mt);
}
function togglePause(){
  const R=G.getR(); if(!R||R.over)return;
  if($('#pause').classList.contains('show')){ $('#pause').classList.remove('show'); G.pauseToggle(false); }
  else { G.pauseToggle(true); renderPause(); $('#pause').classList.add('show'); }
}

// ── 修練場(恒久メタ進行・軍功で全武将共通の永続強化) ──
const UPGRADES=[
 {key:'hp',name:'最大HP',icon:'❤',desc:'最大HP +8% / Lv',max:8,base:80},
 {key:'dmg',name:'与ダメージ',icon:'⚔',desc:'全武器の与ダメ +6% / Lv',max:8,base:120},
 {key:'move',name:'移動速度',icon:'🏃',desc:'移動速度 +4% / Lv',max:5,base:100},
 {key:'magnet',name:'拾える範囲',icon:'🧲',desc:'経験値の吸引 +12% / Lv',max:5,base:70},
 {key:'xp',name:'経験値',icon:'📈',desc:'獲得経験値 +7% / Lv',max:6,base:110},
 {key:'cd',name:'攻撃速度',icon:'⏱',desc:'攻撃間隔 短縮 +4% / Lv',max:5,base:130},
 {key:'crit',name:'会心率',icon:'✨',desc:'会心率 +3% / Lv',max:5,base:120},
 {key:'initlv',name:'初期武器Lv',icon:'🗡',desc:'開幕の武器Lv +1 / Lv',max:3,base:220},
 {key:'gold',name:'軍功獲得',icon:'💰',desc:'獲得軍功 +8% / Lv',max:6,base:90},
 {key:'revive',name:'復活',icon:'🕊',desc:'戦闘中に復活(HP50%) +1回 / Lv',max:2,base:400},
];
function upgCost(u,rank){ return Math.round(u.base*(rank+1)); }
function renderBarracks(){
  const S=window.Save.get(); S.meta=S.meta||{gold:0,upg:{}}; S.meta.upg=S.meta.upg||{};
  const c=$('#s-barracks .content');
  function draw(){
    let h=`<div class="topbar"><h2 class="sec" style="margin:0;border:none;">修練場 ─ 軍功で永続強化</h2></div>
      <div class="bank">所持軍功 <b>${S.meta.gold}</b><small>勝っても負けても貯まる。死んでも積み上がる全武将共通の強化。</small></div>
      <div class="upg-grid">`;
    for(const u of UPGRADES){ const rank=S.meta.upg[u.key]||0, maxed=rank>=u.max, cost=upgCost(u,rank), can=!maxed&&S.meta.gold>=cost;
      h+=`<div class="ucard ${maxed?'maxed':''}">
        <div class="uh"><span class="uic">${u.icon}</span><span class="unm">${u.name}</span><span class="urank">${rank}/${u.max}</span></div>
        <div class="udesc">${u.desc}</div>
        <button class="ubuy ${can?'':'dis'}" data-k="${u.key}" ${can?'':'disabled'}>${maxed?'MAX':'＋ '+cost+' 軍功'}</button>
      </div>`; }
    h+=`</div><button class="btn" id="b-refund" style="margin-top:18px;opacity:.7;font-size:13px;padding:10px;">強化をリセット（軍功を全額払い戻す）</button>`;
    c.innerHTML=h;
    c.querySelectorAll('.ubuy').forEach(b=>{ if(b.disabled)return; b.onclick=()=>{ const u=UPGRADES.find(x=>x.key===b.dataset.k); const rank=S.meta.upg[u.key]||0; if(rank>=u.max)return; const cost=upgCost(u,rank); if(S.meta.gold<cost)return; S.meta.gold-=cost; S.meta.upg[u.key]=rank+1; window.Save.save(); window.SFX&&SFX.play('evolve'); draw(); }; });
    $('#b-refund').onclick=()=>{ if(!confirm('全ての永続強化をリセットして軍功を全額払い戻しますか？'))return; let ref=0; for(const u of UPGRADES){ const r=S.meta.upg[u.key]||0; for(let i=0;i<r;i++)ref+=upgCost(u,i); } S.meta.gold+=ref; S.meta.upg={}; window.Save.save(); draw(); };
  }
  draw();
}

// ── 演義を読む(クリアした回の物語) ──────────
const NOTE_ORDER=[['一行','この一回'],['流れ','▶ 流れ'],['名場面','◆ みどころ'],['故事成語','故事成語'],['初登場','初登場の英雄'],['史実メモ','演義こぼれ話 ─ 正史では？']];
function renderRead(){
  const S=window.Save.get();
  const c=$('#s-read .content');
  const clearedN=Object.keys(S.cleared).length;
  let rows='';
  for(const st of window.STAGES){
    const cleared=!!S.cleared[st.id];
    rows+=`<div class="rcard ${cleared?'':'locked'}" ${cleared?`data-no="${st.no}"`:''}>
      <span class="rno">第${st.no}回</span>
      <span class="rnm">${cleared?st.name:'？？？'}</span>
      <span class="rgo">${cleared?'読む ▶':'🔒'}</span>
    </div>`;
  }
  c.innerHTML=`<button class="btn back" id="rd-back" style="position:static;width:auto;display:inline-block;margin:0 0 8px;">← 戻る</button>
    <div class="topbar"><h2 class="sec" style="margin:0;border:none;">演義を読む</h2></div>
    <div class="note">クリアした戦いの物語を、流れがわかるダイジェスト＋現代語訳で読める。<b>${clearedN}/120</b> 開放中。${clearedN===0?'':'未クリアの回は伏せられている。'}</div>
    ${clearedN===0?'<div class="read-empty">まだ物語が開いていない。<br>戦いに勝つと、その回がここで読めるようになる。</div>':''}
    <div class="read-list">${rows}</div>`;
  $('#rd-back').onclick=()=>{ renderTitle(); show('s-title'); };
  c.querySelectorAll('.rcard[data-no]').forEach(card=>{ card.onclick=()=>loadChapter(+card.dataset.no); });
}
async function loadChapter(no){
  const c=$('#s-read .content');
  c.innerHTML=`<div class="read-loading">第${no}回を開いている…</div>`;
  let data;
  try{ const r=await fetch(`data/yanyi/ch${no}.json`); if(!r.ok)throw 0; data=await r.json(); }
  catch(e){ c.innerHTML=`<div class="read-loading">物語を読み込めなかった。<br><button class="btn" id="rd-retry" style="margin-top:12px">← 一覧へ</button></div>`; $('#rd-retry').onclick=renderRead; return; }
  renderChapter(data);
}
function renderChapter(data){
  const c=$('#s-read .content');
  const fz=localStorage.getItem('engi-readfont')||'m';
  let nh='';
  for(const [key,label] of NOTE_ORDER){
    const v=data.note&&data.note[key]; if(!v)continue;
    if(key==='一行'){ nh+=`<div class="nblock n-lead">${esc(v)}</div>`; }
    else if(key==='流れ'){ nh+=`<div class="nblock n-flow"><div class="nlab">${label}</div><div class="ntext">${esc(v)}</div></div>`; }
    else { nh+=`<div class="nblock"><div class="nlab">${label}</div><div class="ntext">${esc(v)}</div></div>`; }
  }
  const bodyH=(data.body||[]).map(p=>`<p>${esc(p)}</p>`).join('');
  const cleanTitle=esc(data.title||'').replace(/^第[一二三四五六七八九十百零〇0-9]+回\s*/,'');
  c.innerHTML=`<button class="btn back" id="rd-list" style="position:static;width:auto;display:inline-block;margin:0 0 8px;">← 一覧へ</button>
    <div class="ch-head"><div class="ch-no">第${data.no}回</div><h2 class="ch-title">${cleanTitle}</h2></div>
    <div class="ch-note">${nh}</div>
    <div class="read-toolbar"><span>文字サイズ</span><button data-fz="s">小</button><button data-fz="m">中</button><button data-fz="l">大</button></div>
    <div class="ch-divider">― 本文 ―</div>
    <div class="ch-body fz-${fz}">${bodyH}</div>
    <button class="btn" id="rd-list2" style="margin:22px auto 8px;display:block;max-width:240px;">← 一覧へ戻る</button>`;
  const setFz=v=>{ localStorage.setItem('engi-readfont',v); const b=c.querySelector('.ch-body'); if(b)b.className='ch-body fz-'+v; c.querySelectorAll('[data-fz]').forEach(x=>x.classList.toggle('on',x.dataset.fz===v)); };
  c.querySelectorAll('[data-fz]').forEach(b=>b.onclick=()=>setFz(b.dataset.fz));
  setFz(fz);
  const back=()=>{ renderRead(); const s=$('#s-read'); if(s)s.scrollTop=0; };
  $('#rd-list').onclick=back; $('#rd-list2').onclick=back;
  const s=$('#s-read'); if(s)s.scrollTop=0;
}

// ── 図鑑(検索・絞り込み) ────────────────────
const WORDER=['spear','sword','podao','halberd','twin','bow','crossbow','chakram','mace','axe','charge','summon','fire','array'];
function renderCodex(){
  const S=window.Save.get();
  const c=$('#s-codex .content');
  const ownedN=Object.keys(S.owned).length;
  const facTabs=[['all','全'],['0','蜀'],['1','魏'],['2','呉'],['3','群']];
  c.innerHTML=`<div class="dex-bar">
    <div class="dex-top"><button class="btn back" id="dx-back">← 戻る</button><div class="dex-title">英雄図鑑</div><span class="dex-prog">所持 <b id="dxShown">0</b>／390</span></div>
    <div class="dex-tabs" id="dexTabs">${facTabs.map(t=>`<button class="dtab ${t[0]==='all'?'on':''}" data-fac="${t[0]}">${t[1]}</button>`).join('')}</div>
    <div class="dex-row2"><input class="dex-search" id="dexSearch" type="search" placeholder="名前で検索（例: 劉 / 関羽）" autocomplete="off"></div>
    <div class="dex-chips" id="dexRar">${[5,4,3,2,1].map(r=>`<button class="chip rch r${r}" data-rar="${r}">${RAR[r].name}</button>`).join('')}</div>
    <div class="dex-chips wpn" id="dexWpn">${WORDER.map(w=>`<button class="chip wch" data-wpn="${w}">${window.WTYPE[w].jp}</button>`).join('')}</div>
    <div class="dex-row3">
      <select class="dex-sort" id="dexSort"><option value="rar">レア順</option><option value="name">名前順</option><option value="chap">登場回数順</option><option value="fac">勢力順</option></select>
      <label class="dex-toggle"><input type="checkbox" id="dexHide"> 未所持を隠す</label>
    </div>
  </div>
  <div class="dex" id="dexGrid"></div>`;
  const grid=$('#dexGrid');
  // 全390cellを一度だけ生成(顔は1回描画)。絞り込みは表示/非表示＋並べ替えのみで再生成しない＝スマホでも軽い
  const cells=[];
  for(const g of window.GENERALS){
    const owned=S.owned[g.id]||0, avail=owned>0;
    const cell=el('div','cell r'+g.rarity+(avail?'':' locked'));
    cell.dataset.id=g.id; cell.dataset.fac=g.faction; cell.dataset.rar=g.rarity; cell.dataset.wpn=g.weapon; cell.dataset.name=g.name; cell.dataset.owned=owned; cell.dataset.chap=g.chapN||0;
    if(owned>1) cell.appendChild(el('span','dup','+'+(owned-1)));
    const av=el('div','av'); av.appendChild(faceEl(g,50)); cell.appendChild(av);
    cell.appendChild(el('div','cn txt-r'+g.rarity, avail?g.name:'？？'));
    cell.appendChild(el('div','stars txt-r'+g.rarity, stars(g.rarity)));
    cell.onclick=()=>{ if(avail)openDetail(g); };
    cells.push(cell); grid.appendChild(cell);
  }
  const st={fac:'all',q:'',rar:new Set(),wpn:new Set(),sort:'rar',hide:false};
  function applyFilter(){
    let shownOwned=0;
    for(const cell of cells){
      let ok=true;
      if(st.fac!=='all' && cell.dataset.fac!==st.fac) ok=false;
      if(ok && st.rar.size && !st.rar.has(+cell.dataset.rar)) ok=false;
      if(ok && st.wpn.size && !st.wpn.has(cell.dataset.wpn)) ok=false;
      if(ok && st.q && cell.dataset.name.indexOf(st.q)<0) ok=false;
      if(ok && st.hide && +cell.dataset.owned===0) ok=false;
      cell.style.display=ok?'':'none';
      if(ok && +cell.dataset.owned>0) shownOwned++;
    }
    const vis=cells.filter(c=>c.style.display!=='none');
    vis.sort((a,b)=>{
      const ao=(+a.dataset.owned>0)?0:1, bo=(+b.dataset.owned>0)?0:1; if(ao!==bo)return ao-bo;  // 未所持は常に後ろ
      if(st.sort==='name') return a.dataset.name.localeCompare(b.dataset.name,'ja');
      if(st.sort==='chap') return (+b.dataset.chap)-(+a.dataset.chap) || (+b.dataset.rar)-(+a.dataset.rar);
      if(st.sort==='fac') return (+a.dataset.fac)-(+b.dataset.fac) || (+b.dataset.rar)-(+a.dataset.rar);
      return (+b.dataset.rar)-(+a.dataset.rar) || (+b.dataset.chap)-(+a.dataset.chap);
    });
    vis.forEach(c=>grid.appendChild(c));
    const sn=$('#dxShown'); if(sn) sn.textContent=shownOwned;
  }
  $('#dx-back').onclick=()=>{ renderTitle(); show('s-title'); };
  $('#dexTabs').querySelectorAll('.dtab').forEach(b=>b.onclick=()=>{ st.fac=b.dataset.fac; $('#dexTabs').querySelectorAll('.dtab').forEach(x=>x.classList.toggle('on',x===b)); applyFilter(); });
  $('#dexSearch').oninput=e=>{ st.q=e.target.value.trim(); applyFilter(); };
  $('#dexRar').querySelectorAll('.rch').forEach(b=>b.onclick=()=>{ const r=+b.dataset.rar; if(st.rar.has(r))st.rar.delete(r); else st.rar.add(r); b.classList.toggle('on'); applyFilter(); });
  $('#dexWpn').querySelectorAll('.wch').forEach(b=>b.onclick=()=>{ const w=b.dataset.wpn; if(st.wpn.has(w))st.wpn.delete(w); else st.wpn.add(w); b.classList.toggle('on'); applyFilter(); });
  $('#dexSort').onchange=e=>{ st.sort=e.target.value; applyFilter(); };
  $('#dexHide').onchange=e=>{ st.hide=e.target.checked; applyFilter(); };
  applyFilter();
}
const DLAB=['実証','武名','膂力','恐怖','戦術','戦略','統率'];
function openDetail(g){
  const owned=window.Save.get().owned[g.id]||0;
  let bars='';
  for(let i=0;i<7;i++) bars+=`<span>${DLAB[i]}</span><div class="dbar"><i style="width:${g.d[i]*10}%"></i></div><b>${g.d[i]}</b>`;
  $('#modalbox').innerHTML=`
    <div style="display:flex;gap:14px;align-items:center;">
      <div class="dface" data-fid="${g.id}" style="width:88px;height:88px;flex:0 0 88px;border:2px solid var(--${['n','r','sr','ssr','ur'][g.rarity-1]||'n'});border-radius:10px;overflow:hidden;background:#0c0a10;"></div>
      <div>
        <h3 class="txt-r${g.rarity}">${g.name}</h3>
        <div style="color:var(--txt2);font-size:13px;">【${g.title}】 <span class="fac-chip f${g.faction}">${FAC[g.faction].name}</span> ${stars(g.rarity)}</div>
        <div style="margin-top:4px;font-size:13px;">武器：<b>${g.weaponName}</b>（${window.WTYPE[g.weapon].jp}）${owned>1?` ・ <span style="color:var(--gold2)">+${owned-1}凸</span>`:''}</div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:13px;"><b style="color:var(--gold2)">${g.skill}</b> ─ ${g.skillDesc}</div>
    ${g.bio?`<div class="bio-tag">${g.bio}</div>`:''}
    ${g.chapN?`<div style="font-size:12px;color:var(--txt2);margin:6px 0;line-height:1.55;">演義での登場：全 <b style="color:var(--gold2)">${g.chapN}</b> 回　主な舞台 ${(g.chapters||[]).map(n=>'第'+n+'回').join('・')}</div>`:''}
    ${g.profile?`<div class="profile">${esc(g.profile).split(/\n\s*\n/).map(p=>'<p>'+p.replace(/\n/g,'<br>')+'</p>').join('')}</div>`:''}
    <div class="dscore">${bars}</div>
    <div style="font-size:12px;color:var(--txt2)">演義評価：腕W <b>${g.scores.W}</b> / 戦場B <b>${g.scores.B}</b> / 戦略S <b>${g.scores.S}</b>${g.scores.G?` / 政G <b>${g.scores.G}</b>`:''}</div>
    ${g.voice?`<div class="voice">「${g.voice}」</div>`:''}
    <button class="btn" id="m-close" style="margin-top:16px">閉じる</button>`;
  $('#modal').classList.add('show');
  $('#modalbox').scrollTop=0;   // 別の武将を開いたら必ず先頭から表示(前のスクロール位置を持ち越さない)
  const _df=$('#modalbox .dface'); if(_df) _df.appendChild(faceEl(g,84));
  $('#m-close').onclick=()=>$('#modal').classList.remove('show');
}

// ── 初期化 ─────────────────────────────────
function init(){
  G.onHud=updateHud; G.onLevelUp=onLevelUp; G.onGameOver=onEnd; G.onVictory=onEnd; G.onBossIntro=onBossIntro; G.onSceneEnd=onSceneEnd;
  window.SFX&&SFX.setMuted(!!(window.Save.get().opts&&window.Save.get().opts.muted));
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
