// screens.js — UIコントローラ(演義版)。
// フロー: タイトル→[章選択]→出陣準備(主役選択+難易度)→章タイトルカード→幕preタイプライター→戦闘→結果→後半ストーリー→ガチャ→タイトル
window.UI = (function(){
const $=s=>document.querySelector(s);
const G=window.G;
const RAR=window.RARITY_INFO, FAC=window.FACTION_INFO;
let selStage=null, selProto=null, selDiff='normal', selCurse=0, lastResult=null;

// ── 英雄録: genId→登場stageId配列のキャッシュ ───────────────────
let _genStageMap = null;
function buildGenStageMap(){
  if(_genStageMap) return _genStageMap;
  _genStageMap = {};
  for(const st of window.STAGES){
    for(const gid of (st.roster||[])){
      if(!_genStageMap[gid]) _genStageMap[gid] = [];
      _genStageMap[gid].push(st.id);
    }
  }
  return _genStageMap;
}

// cleared に含まれるstageIdのセットを返す(毎回Saveから引く)
function clearedSet(){ return new Set(Object.keys(window.Save.get().cleared)); }

// 制覇数 n: この武将が登場するstageIdのうち cleared にあるものの数
function genClearedCount(gid, cleared){
  const map = buildGenStageMap();
  const stages = map[gid] || [];
  return stages.filter(sid => cleared.has(sid)).length;
}

// 総登場数 totalN
function genTotalN(gid){
  const map = buildGenStageMap();
  return (map[gid] || []).length;
}

// 解禁レベル計算 (0=未解禁, 1〜4)
function unlockLevel(gid, cleared){
  const n = genClearedCount(gid, cleared);
  if(n === 0) return 0;
  const totalN = genTotalN(gid);
  const lv1 = 1;
  const lv2 = 2;
  const lv3 = Math.min(10, Math.max(3, Math.ceil(totalN * 0.25)));
  const lv4 = Math.min(20, Math.max(4, Math.ceil(totalN * 0.5)));
  // clamp: totalNが閾値より小さい場合は全閾値をtotalNに下げる
  const cLv4 = Math.min(lv4, totalN);
  const cLv3 = Math.min(lv3, cLv4);
  const cLv2 = Math.min(lv2, cLv3);
  if(n >= cLv4) return 4;
  if(n >= cLv3) return 3;
  if(n >= cLv2) return 2;
  if(n >= lv1) return 1;
  return 0;
}

// この武将のdoom epitaphを scenes.js から取得
function genEpitaph(gid){
  const g = genById(gid);
  if(!g) return null;
  for(const no in (window.CHAPTER_SCENES||{})){
    for(const sc of window.CHAPTER_SCENES[no]){
      if(sc.kind === 'doom'){
        const protoId = typeof sc.proto === 'number' ? sc.proto : genByName(sc.proto);
        if(protoId === gid && sc.epitaph) return sc.epitaph;
      }
    }
  }
  return null;
}

// bio の前半/後半を「。」区切りで二分
function splitBio(bio){
  if(!bio) return ['',''];
  const parts = bio.split('。').filter(Boolean);
  if(parts.length <= 1) return [bio, ''];
  const half = Math.ceil(parts.length / 2);
  const front = parts.slice(0, half).map(s=>s+'。').join('');
  const back = parts.slice(half).map(s=>s+'。').join('');
  return [front, back];
}

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
  if(id){ const ub=$('#ultbtn'); if(ub)ub.style.display='none'; const lv=$('#lowhpvignette'); if(lv)lv.className=''; const s=$('#'+id); s.classList.add('show'); s.scrollTop=0; }   // 遷移先は必ず先頭から(前画面のスクロール位置を持ち越さない)
}

function showChapterTitle(stage,next){
  const ov=$('#chaptercard'); if(!ov){ next(); return; }
  const sub=stage.sub||stage.name||'乱世、また一幕';
  ov.innerHTML=`<div class="cc-panel">
    <div class="cc-no">第${stage.no}回</div>
    <div class="cc-name">${esc(stage.name||'')}</div>
    <div class="cc-sub">${esc(sub)}</div>
    <div class="cc-seal">演</div>
  </div>`;
  let done=false;
  const finish=()=>{ if(done)return; done=true; clearTimeout(ov._tm); ov.classList.remove('show'); ov.onclick=null; next(); };
  ov.onclick=finish;
  ov.classList.add('show');
  ov._tm=setTimeout(finish,1600);
}

// ── タイトル(新デザイン) ────────────────────
function renderTitle(){
  const S=window.Save.get();
  const clearedN=Object.keys(S.cleared).length;
  // 次の未クリア章を探す
  function findNextStage(){
    for(const st of window.STAGES){
      if(!S.cleared[st.id] && window.Save.stageUnlocked(st)) return st;
    }
    return window.STAGES[0];
  }
  const c=$('#s-title .content');
  c.innerHTML=`
    <div class="tl-logo-wrap">
      <div class="tl-seal">演</div>
      <h1 class="tl-logo">三国志演義<br>survivor</h1>
    </div>
    <button class="btn primary tl-sortie" id="b-play">出陣</button>
    <div class="tl-menu">
      <button class="btn tl-menu-btn" id="b-stage">章選択</button>
      <button class="btn tl-menu-btn" id="b-codex">英雄図鑑</button>
      <button class="btn tl-menu-btn" id="b-barracks">修練場</button>
      <button class="btn tl-menu-btn" id="b-read">演義を読む</button>
    </div>
    <div class="tl-progress">${clearedN}/120回 踏破</div>
    <button class="btn tl-reset" id="b-reset">セーブをリセット</button>
  `;
  $('#b-play').onclick=()=>{
    const next=findNextStage();
    selStage=next; selProto=null; selDiff=window.Save.get().difficulty||'normal';
    renderPrep(); show('s-lord');
  };
  $('#b-stage').onclick=()=>{renderStage();show('s-stage');};
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
    card.onclick=()=>{ selStage=window.STAGE_BY_ID[card.dataset.st]; selProto=null; selDiff=window.Save.get().difficulty||'normal'; renderPrep(); show('s-lord'); };
  });
}

// ── 出陣準備画面(新デザイン) ─────────────────
// 主役ドット絵を4倍拡大・歩行アニメ・タップ選択・難易度pill・出陣ボタン
function renderPrep(){
  const st=selStage;
  const _scn=chapterScenesFor(st);
  // 主役candidates: stage.protagonist(選べる主役) ∪ 各幕の主役。選んだ主役は第1幕(非doom)に適用
  const seen=new Set(), ids=[];
  for(const pid of (st.protagonist||[])){ if(!seen.has(pid)){seen.add(pid);ids.push(pid);} }
  if(_scn && _scn.length){
    for(const sc of _scn){ if(sc.proto!=null && !seen.has(sc.proto)){seen.add(sc.proto);ids.push(sc.proto);} }
  }
  let protoCands=ids.map(id=>genById(id)).filter(Boolean);
  if(!selProto || !protoCands.find(g=>g.id===selProto.id)) selProto=protoCands[0]||null;

  const c=$('#s-lord .content');

  // 章ヘッダー
  let h=`<div class="prep-head">
    <button class="btn prep-back" id="prep-back">← 戻る</button>
    <div class="prep-title"><span class="prep-no">第${st.no}回</span><span class="prep-name">${esc(st.name||'')}</span></div>
  </div>`;

  // 主役ドット絵セクション
  h+=`<div class="prep-heroes" id="prepHeroes">`;
  for(const g of protoCands){
    const ult=window.ULTS ? window.ULTS.forGeneral(g) : null;
    const ultName = ult ? ult.name : (g.weaponName||'');
    h+=`<div class="prep-hero ${g.id===selProto.id?'sel':''}" data-id="${g.id}">
      <div class="prep-sprite-wrap">
        <canvas class="prep-sprite" data-gid="${g.id}" width="1" height="1"></canvas>
      </div>
      <div class="prep-hero-name txt-r${g.rarity}">${g.name}</div>
      <div class="prep-hero-rar">${'★'.repeat(g.rarity)}</div>
      <div class="prep-hero-ult">${esc(ultName)}</div>
    </div>`;
  }
  h+=`</div>`;

  // 難易度pill
  h+=`<div class="prep-diff" id="diffRow">
    <button class="prep-pill" data-d="easy">やさしい</button>
    <button class="prep-pill" data-d="normal">ふつう</button>
    <button class="prep-pill" data-d="hard">むずかしい</button>
  </div>`;

  // 出陣ボタン
  h+=`<button class="btn primary prep-sortie" id="b-start">出陣</button>`;

  c.innerHTML=h;

  // 戻るボタン
  c.querySelector('#prep-back').onclick=()=>{ renderStage(); show('s-stage'); };

  // ドット絵描画 + 歩行アニメ(2フレーム/300ms)
  const animHandles=[];
  c.querySelectorAll('.prep-sprite').forEach(cv=>{
    const gid=+cv.dataset.gid;
    const g=genById(gid); if(!g)return;
    // hero()のサイズ取得(18×22 or 22×28)
    const src0=window.Sprites.hero(g,0);
    const src1=window.Sprites.hero(g,1);
    const SCALE=4;
    cv.width=src0.width*SCALE; cv.height=src0.height*SCALE;
    cv.style.width=cv.width+'px'; cv.style.height=cv.height+'px';
    const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
    let frame=0;
    function draw(){ const src=frame?src1:src0; ctx.clearRect(0,0,cv.width,cv.height); ctx.drawImage(src,0,0,cv.width,cv.height); }
    draw();
    const tid=setInterval(()=>{ frame^=1; draw(); },300);
    animHandles.push(tid);
  });
  // 画面離脱時にアニメ停止(show()でscreen.show外れる前のcleanup)
  const origShow=c._cleanupAnim;
  if(origShow) origShow();
  c._cleanupAnim=()=>animHandles.forEach(t=>clearInterval(t));

  // 主役選択
  function refreshProto(){
    c.querySelectorAll('.prep-hero').forEach(p=>p.classList.toggle('sel', +p.dataset.id===selProto.id));
  }
  c.querySelectorAll('.prep-hero').forEach(p=>{
    p.onclick=()=>{ selProto=genById(+p.dataset.id); refreshProto(); };
  });
  refreshProto();

  // 難易度pill
  function refreshDiff(){ c.querySelectorAll('#diffRow .prep-pill').forEach(b=>b.classList.toggle('sel',b.dataset.d===selDiff)); }
  c.querySelectorAll('#diffRow .prep-pill').forEach(b=>{ b.onclick=()=>{ selDiff=b.dataset.d; window.Save.setDifficulty(selDiff); refreshDiff(); }; });
  refreshDiff();

  c.querySelector('#b-start').onclick=()=>{ if(c._cleanupAnim){c._cleanupAnim();c._cleanupAnim=null;} startGame(); };
}
// 旧名エイリアス(念のため残す)
function renderPreStory(){ renderPrep(); }

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

// ── 黒地白文字タイプライター(storyPre/幕pre共通) ─
// text表示→タップで全文→再タップで next()
function showScenePre(sc, next){
  const ov=$('#sceneov');
  const box=$('#scenebox'); box.className='sb-typewriter';
  const chapIdx = chap ? chap.idx : 0;
  const chapTotal = chap ? chap.scenes.length : 1;
  const markHtml = sc.markText
    ? `<div class="tw-mark">${esc(sc.markText)}</div>`
    : (chap
    ? `<div class="tw-mark">第${chapIdx+1}幕 ／ ${chapTotal}　${esc(sc.name||'')}</div>`
    : '');
  const text = sc.pre || (sc.storyPre) || '';
  // 空行(\n\n)区切りでノベルゲーム式のページ送りにする
  const pages = text.split(/\n\n+/).map(s=>s.trim()).filter(Boolean);
  if(!pages.length) pages.push('');
  box.innerHTML=`${markHtml}<pre class="tw-text"></pre><div class="tw-next"></div>`;
  const pre=box.querySelector('.tw-text'), nextEl=box.querySelector('.tw-next');
  let pg=0, i=0, done=false, tid=null;
  function finishPage(){ if(done)return; done=true; clearInterval(tid); pre.textContent=pages[pg]; nextEl.style.visibility='visible'; }
  function startPage(){
    done=false; i=0; pre.textContent='';
    nextEl.style.visibility='hidden';
    nextEl.textContent=(pg<pages.length-1)?'▼ タップで進む':(sc.lastLabel||'▼ タップで開戦');
    clearInterval(tid);
    tid=setInterval(()=>{ i++; pre.textContent=pages[pg].slice(0,i); if(i>=pages[pg].length)finishPage(); },8);
  }
  function advance(){
    if(!done){ finishPage(); return; }
    if(pg<pages.length-1){ pg++; startPage(); return; }
    clearInterval(tid); ov.onclick=null;
    ov.classList.remove('show'); ov.classList.remove('tw-bg');
    next();
  }
  ov.onclick=advance;
  ov.classList.add('show');
  ov.classList.add('tw-bg');
  startPage();
}

// ── ゲーム開始 ─────────────────────────────
function startGame(){
  const S=window.Save.get(); S.stats.runs++; window.Save.save();
  const stage=selStage;
  const _scenes=chapterScenesFor(stage);
  if(_scenes && _scenes.length){   // 章=シーン連結(複数幕の連続)
    chap={stage, scenes:_scenes, idx:0, titleShown:false, accum:{kills:0,gold:0,level:1,time:0}};
    // 章タイトルカード → 第1幕pre → 戦闘
    showChapterTitle(stage,()=>{
      chap.titleShown=true;
      // 第1幕preがあれば表示してから戦闘へ
      const sc0=_scenes[0];
      if(sc0.pre){
        showScenePre(sc0, ()=>playScene());
      } else {
        playScene();
      }
    });
    return;
  }
  chap=null;
  // 単一幕: 章タイトルカード → stage.storyPreタイプライター(あれば) → 戦闘
  showChapterTitle(stage,()=>{
    const doStart=()=>{
      const lord=buildLord(selProto);
      show(null); $('#hud').classList.add('show'); $('#pausebtn').style.display='block'; lastWsig='';
      G.startRun({lord, stage, owned:S.owned, save:S, difficulty:selDiff, curse:selCurse});
      maybeOnboard(S);
    };
    if(stage.storyPre){
      showScenePre({pre:stage.storyPre}, doStart);
    } else {
      doStart();
    }
  });
}
function maybeOnboard(S){
  // 初回オンボーディング(最初の1ランだけ寄り添う)
  if(!S.seenIntro){ S.seenIntro=true; window.Save.save();
    const tips=['画面をドラッグで移動。攻撃は自動だ','緑の結晶＝経験値。集めてレベルアップ','赤い円や矢印＝危険。避けろ'];
    tips.forEach((tx,i)=>setTimeout(()=>{ const R=G.getR(); if(!R||R.over)return; const t=$('#bosstoast');
      t.innerHTML='<div style="font-size:18px;font-weight:800;color:var(--gold2);text-shadow:0 1px 3px #000">'+tx+'</div>';
      t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2700); }, 1100+i*3400)); }
  if(!S.seenUltIntro){ S.seenUltIntro=true; window.Save.save();
    setTimeout(()=>{ const R=G.getR(); if(!R||R.over)return; const t=$('#bosstoast');
      t.innerHTML='<div style="font-size:15px;font-weight:800;color:var(--gold2);text-shadow:0 1px 3px #000">撃破で必殺ゲージが溜まる。満タンで右下ボタンかSpace、一時停止で自動発動を切替。</div>';
      t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3600); }, 900); }
}

// ── 章シーケンサ(1回=複数シーンの連続。主役・型・秒数がシーンごとに変わる) ──
let chap=null;
function sceneStageOf(stage,sc){   // 章stageを土台に、そのシーンの主役/型/秒数/敵で上書き
  const st=Object.assign({},stage);
  st.name=sc.name||stage.name;
  st.chapterName=stage.name;
  st.dur=sc.dur;
  // 章の主役群は保持(restrict章のレベルアップ候補=主役全員。第1回=劉関張)。単独主役章は幕の主役
  st.protagonist=(stage.protagonist&&stage.protagonist.length>1)?stage.protagonist.slice():[sc.proto];
  // 幕ごとの味方上書き(名前で指定)。第3回=呂布の寝返り先(董卓側)が味方になる等
  if(sc.levelPool){
    st.levelPool=sc.levelPool.map(n=>{const g=(window.GENERALS||[]).find(x=>x.name===n);return g?g.id:null;}).filter(v=>v!=null);
    st.restrict=false;
  }
  if(sc.roster) st.roster=sc.roster;
  st.boss = (sc.kind==='sweep') ? (sc.boss||stage.boss) : null;   // sweepのみボス撃破で勝利。survive/doomはボス無し
  if(sc.recolor) st.recolor=sc.recolor;
  if(sc.pool) st.pool=sc.pool;
  st.elites = (sc.kind==='sweep') ? (sc.elites!==undefined?sc.elites:stage.elites) : [];
  st.endless=false;
  return st;
}
function playScene(){
  if(chap&&chap.idx===0&&!chap.titleShown){ showChapterTitle(chap.stage,()=>{ chap.titleShown=true; playScene(); }); return; }
  const S=window.Save.get();
  const sc=chap.scenes[chap.idx];
  // 第1幕(非doom)は出陣準備で選んだ主役を尊重。doomと第2幕以降は台本どおり主役交代
  const gen=(chap.idx===0 && sc.kind!=='doom' && selProto) ? selProto
    : (genById(sc.proto)||genById((chap.stage.protagonist||[])[0]));
  const lord=buildLord(gen);
  const last=chap.idx===chap.scenes.length-1;
  show(null); $('#hud').classList.add('show'); $('#pausebtn').style.display='block'; lastWsig='';
  G.startRun({lord, stage:sceneStageOf(chap.stage,sc), owned:S.owned, save:S, difficulty:selDiff, curse:selCurse,
    scene:{kind:sc.kind, dur:sc.dur, name:sc.name||'', last, deathLine:sc.deathLine, epitaph:sc.epitaph}});
  sceneIntro(sc,gen);
}
function sceneIntro(sc,gen){
  const t=$('#bosstoast');
  // 開戦前の一言(原文の名台詞)。quoteがあれば名乗りより優先
  if(sc.quote){
    t.innerHTML=`<div style="font-size:13px;color:var(--txt2)">${esc(sc.name||'')}</div>
      <div style="font-size:21px;font-weight:900;color:var(--gold2);margin-top:2px">${gen?gen.name:''}</div>
      <div class="voice" style="font-size:16px;color:#fff;margin-top:6px">「${esc(sc.quote)}」</div>`;
    t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 3200);
    return;
  }
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
  const box=$('#scenebox'); box.className='sb-epitaph';
  box.innerHTML=`<div class="ep-panel">
    <div class="ep-top">避けられぬ最期</div>
    <div class="ep-stone">
      <div class="ep-line">${sc.deathLine?('「'+esc(sc.deathLine)+'」'):''}</div>
      <div class="ep-text">${esc(sc.epitaph||'')}</div>
      <div class="ep-flowers"><i></i><i></i><i></i><i></i><i></i></div>
    </div>
    <button class="btn" id="doom-go">先へ</button>
  </div>`;
  $('#sceneov').classList.add('show');
  const panel=box.querySelector('.ep-panel'), btn=box.querySelector('#doom-go');
  panel.style.opacity=0; btn.style.opacity=0;
  setTimeout(()=>panel&&(panel.style.opacity=1),220);
  setTimeout(()=>btn&&(btn.style.opacity=1),1250);
  window.SFX&&SFX.play('bossDead');
  $('#doom-go').onclick=()=>{ $('#sceneov').classList.remove('show'); next(); };
}
function interlude(next){
  const sc=chap.scenes[chap.idx];   // idxは進めた後＝これが次の幕
  showScenePre(sc, next);
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
  const lvig=$('#lowhpvignette');
  if(lvig){ lvig.className=hpp<15?'show critical':(hpp<30?'show':''); }
  $('#topinfo').innerHTML=fmtT(d.t)+'<small>'+esc(d.sceneName||d.stage.name)+'</small>';
  $('#lvline').innerHTML='Lv <b>'+d.level+'</b>';
  $('#statline').innerHTML='☠ '+d.kills+'　軍功 <b>'+d.gold+'</b>';
  // 武器アイコン(SVG)。変化時のみ再構築
  const sig=d.weapons.map(w=>w.gen.id+':'+w.level+':'+(w.evo?'e':'')+(w.gen.fused?'f':'')).join(',');
  if(sig!==lastWsig){ lastWsig=sig; const wl=$('#wlist'); wl.innerHTML='';
    for(const w of d.weapons){ const div=el('div','wico'+(w.evo?' evo':'')+(w.gen.fused?' fused':'')); div.appendChild(wiconEl(w.gen.weapon)); div.appendChild(el('span','lv',w.gen.fused?'⚔':'L'+w.level)); wl.appendChild(div); }
    $('#kizunaline').innerHTML=''; }
  const ub=$('#ultbtn');
  if(ub&&d.ult){
    const pct=Math.max(0,Math.min(1,(d.ult.gauge||0)/(d.ult.max||70)));
    ub.style.display='flex'; ub.style.setProperty('--ultpct',(pct*100)+'%');
    ub.classList.toggle('ready',pct>=1);
    ub.classList.toggle('auto',!!d.ult.auto);
    const nm=ub.querySelector('.ult-name'), gg=ub.querySelector('.ult-gauge');
    if(nm)nm.textContent=(d.ult.def&&d.ult.def.name)||'必殺';
    if(gg)gg.textContent=Math.floor(pct*100)+'%'+(d.ult.auto?' 自動':'');
  } else if(ub) ub.style.display='none';
  // ボスバー
  const bb=$('#bossbar');
  if(d.boss && !d.boss.dead){ bb.classList.add('show'); $('#bossname').textContent=((d.boss.title||'')?((d.boss.title||'')+' '):'')+d.boss.name; $('#bosshp').style.width=Math.max(0,d.boss.hp/d.boss.maxHp*100)+'%'; }
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
  const t=$('#bosstoast'); t.innerHTML=`<div class="boss-warn">強敵現る</div><div style="font-size:26px;font-weight:900;color:var(--redL)">${esc(title||'')} ${esc(name||'')}</div><div class="voice">「${esc(line||'')}」</div>`;
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600);
}

// ── 結果 → 後半ストーリーへ ────────────────
function onEnd(res){
  $('#pausebtn').style.display='none';
  const ub=$('#ultbtn'); if(ub)ub.style.display='none';
  const lv=$('#lowhpvignette'); if(lv)lv.className='';
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
  $('#r-next').onclick=()=>{ $('#result').classList.remove('show'); renderPostStory(res); };
}

// ── 後半ストーリー → ガチャ ────────────────
function renderPostStory(res){
  // 結末も冒頭と同じノベルゲーム式ページ送りで読ませてから、褒賞画面へ
  const st=res.stage;
  const _post=((((window.CHAPTER_SCENES||{})[st.no])||[]).map(s=>s&&s.post).filter(Boolean).pop())||st.storyPost||'';
  const go=()=>{ renderHeroRecord(res); show('s-story'); };
  if(_post){ showScenePre({pre:_post, markText:`第${st.no}回 『${st.name}』 ─ 結末`, lastLabel:'▼ 褒賞へ'}, go); }
  else go();
}
// ── 英雄録(段階解禁式の英雄図鑑) ─────────────────
function renderHeroRecord(res){
  const st = res.stage;
  const cleared = clearedSet();
  const roster = st.roster || [];

  // 今回の制覇で「初めて出会った英雄」= n がちょうど1になった武将
  const newHeroes = roster.map(gid=>genById(gid)).filter(g=>{
    if(!g) return false;
    return genClearedCount(g.id, cleared) === 1;
  });
  // 「列伝が進んだ英雄」= 解禁レベルが上がった武将(新出会い以外で lv > 以前のlv)
  // 以前のlvを「cleared から今のステージを除いたセット」で計算して比較
  const prevCleared = new Set([...cleared].filter(sid=>sid!==st.id));
  const levelUpHeroes = roster.map(gid=>genById(gid)).filter(g=>{
    if(!g) return false;
    if(newHeroes.find(x=>x.id===g.id)) return false; // 初出会いは別枠
    const prevLv = unlockLevel(g.id, prevCleared);
    const nowLv = unlockLevel(g.id, cleared);
    return nowLv > prevLv;
  });

  const S = window.Save.get();
  const c = $('#s-story .content');
  c.innerHTML = `
    <div class="hr-head">
      <div class="hr-title">英雄録 ─ 第${st.no}回</div>
      <div class="hr-gold">軍功 <b>+${res.gold||0}</b></div>
    </div>
    ${newHeroes.length ? `
    <div class="hr-section">
      <div class="hr-sec-label">初めて出会った英雄</div>
      <div class="hr-new-grid" id="hrNewGrid"></div>
    </div>` : ''}
    ${levelUpHeroes.length ? `
    <div class="hr-section">
      <div class="hr-sec-label">列伝が進んだ英雄</div>
      <div class="hr-up-grid" id="hrUpGrid"></div>
    </div>` : ''}
    ${(!newHeroes.length && !levelUpHeroes.length) ? `
    <div class="hr-empty">この回の英雄はすでに十分に記録されている</div>` : ''}
    <button class="btn primary hr-next" id="hr-next">次へ ▶</button>
  `;

  // 初出会いカード
  const newGrid = c.querySelector('#hrNewGrid');
  if(newGrid){
    newHeroes.forEach((g,i)=>{
      const lv = unlockLevel(g.id, cleared);
      const card = el('div','hr-new-card');
      card.style.animationDelay = (i*0.07)+'s';
      card.innerHTML = `
        <div class="hr-new-face" data-fid="${g.id}"></div>
        <div class="hr-new-name txt-r${g.rarity}">${g.name}</div>
        <div class="hr-new-rar">${'★'.repeat(g.rarity)}</div>
        <div class="hr-pips">${[1,2,3,4].map(k=>`<span class="pip ${k<=lv?'on':''}" title="解禁Lv${k}"></span>`).join('')}</div>
      `;
      card.onclick = ()=>openDetailLv(g, lv);
      newGrid.appendChild(card);
      // 顔描画
      const face = card.querySelector('.hr-new-face');
      if(face) face.appendChild(faceEl(g, 72));
    });
  }

  // 列伝進展カード
  const upGrid = c.querySelector('#hrUpGrid');
  if(upGrid){
    levelUpHeroes.forEach(g=>{
      const lv = unlockLevel(g.id, cleared);
      const card = el('div','hr-up-card');
      card.innerHTML = `
        <div class="hr-up-face" data-fid="${g.id}"></div>
        <div class="hr-up-info">
          <span class="hr-up-name txt-r${g.rarity}">${g.name}</span>
          <span class="hr-up-badge">列伝 進展</span>
        </div>
        <div class="hr-pips small">${[1,2,3,4].map(k=>`<span class="pip ${k<=lv?'on':''}" title="解禁Lv${k}"></span>`).join('')}</div>
      `;
      card.onclick = ()=>openDetailLv(g, lv);
      upGrid.appendChild(card);
      const face = card.querySelector('.hr-up-face');
      if(face) face.appendChild(faceEl(g, 44));
    });
  }

  c.querySelector('#hr-next').onclick = ()=>{ renderStage(); show('s-stage'); };
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
  const au=el('button','lvbtn'); au.style.marginTop='8px';
  const setAu=()=>{ const S=window.Save.get(); au.textContent='必殺技 自動発動 '+(S.opts&&S.opts.autoUlt?'ON':'OFF'); };
  setAu(); au.onclick=()=>{ const S=window.Save.get(); S.opts=S.opts||{}; S.opts.autoUlt=!S.opts.autoUlt; window.Save.save(); G.setAutoUlt&&G.setAutoUlt(S.opts.autoUlt); setAu(); updateHud(); };
  box.appendChild(au);
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
  c.querySelectorAll('.rcard[data-no]').forEach(card=>{ card.onclick=()=>window.Reader.open(+card.dataset.no); });
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
    const cleared = clearedSet();
    const lv = unlockLevel(g.id, cleared);
    const avail = lv >= 1;
    const cell=el('div','cell r'+g.rarity+(avail?'':' locked'));
    cell.dataset.id=g.id; cell.dataset.fac=g.faction; cell.dataset.rar=g.rarity; cell.dataset.wpn=g.weapon; cell.dataset.name=g.name; cell.dataset.owned=(S.owned[g.id]||0); cell.dataset.chap=g.chapN||0; cell.dataset.lv=lv;
    if(avail){
      const pipEl=el('span','cell-pips');
      pipEl.innerHTML=[1,2,3,4].map(k=>`<span class="pip ${k<=lv?'on':''} sm"></span>`).join('');
      cell.appendChild(pipEl);
    }
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
      if(ok && st.hide && +cell.dataset.lv===0) ok=false;
      cell.style.display=ok?'':'none';
      if(ok && +cell.dataset.lv>0) shownOwned++;
    }
    const vis=cells.filter(c=>c.style.display!=='none');
    vis.sort((a,b)=>{
      const ao=(+a.dataset.lv>0)?0:1, bo=(+b.dataset.lv>0)?0:1; if(ao!==bo)return ao-bo;  // 未解禁は常に後ろ
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
  const cleared = clearedSet();
  const lv = unlockLevel(g.id, cleared);
  openDetailLv(g, lv);
}

// 英雄録の解禁レベルゲート付き詳細
function openDetailLv(g, lv){
  if(lv === undefined){
    const cleared = clearedSet();
    lv = unlockLevel(g.id, cleared);
  }
  const kizunaNames = (window.KIZUNA||[]).filter(k=>k.members.includes(g.id)).map(k=>k.name);
  const [bioFront, bioBack] = splitBio(g.bio);
  const epitaph = genEpitaph(g.id);
  const ult = window.ULTS ? window.ULTS.forGeneral(g) : null;
  const map = buildGenStageMap();
  const stageIds = map[g.id] || [];
  const stageNos = stageIds.map(sid=>{ const s=window.STAGES.find(x=>x.id===sid); return s?s.no:null; }).filter(Boolean).sort((a,b)=>a-b);
  const totalN = genTotalN(g.id);
  const cleared = clearedSet();
  const n = genClearedCount(g.id, cleared);

  // 次のレベルまでの残り数
  function nextLvInfo(lvN){
    const lv1=1, lv2=2;
    const lv3=Math.min(10,Math.max(3,Math.ceil(totalN*0.25)));
    const lv4=Math.min(20,Math.max(4,Math.ceil(totalN*0.5)));
    const cLv4=Math.min(lv4,totalN), cLv3=Math.min(lv3,cLv4), cLv2=Math.min(lv2,cLv3);
    const thresholds=[cLv4,cLv3,cLv2,lv1];
    for(const t of thresholds){ if(n<t) return t-n; }
    return 0;
  }

  let html = `<div class="dl-head">`;
  // lv1以上: 肖像+名前+読み/字+勢力+武器+title
  if(lv>=1){
    html+=`<div class="dl-face" data-fid="${g.id}" style="width:88px;height:88px;flex:0 0 88px;border:2px solid var(--${['n','r','sr','ssr','ur'][g.rarity-1]||'n'});border-radius:10px;overflow:hidden;background:#0c0a10;"></div>
    <div>
      <h3 class="txt-r${g.rarity}">${g.name}</h3>
      <div style="color:var(--txt2);font-size:13px;">【${esc(g.title||'')}】 <span class="fac-chip f${g.faction}">${FAC[g.faction].name}</span> ${'★'.repeat(g.rarity)}</div>
      <div style="margin-top:4px;font-size:13px;">武器：<b>${esc(g.weaponName||'')}</b>（${window.WTYPE[g.weapon].jp}）</div>
    </div>`;
  } else {
    // 未解禁
    html+=`<div style="width:88px;height:88px;flex:0 0 88px;border:2px solid var(--line);border-radius:10px;background:#0c0a10;display:flex;align-items:center;justify-content:center;filter:brightness(.18) contrast(.6)"></div>
    <div><h3 style="color:var(--txt2)">???</h3><div style="font-size:12px;color:var(--txt2)">未解禁の英雄</div></div>`;
  }
  html+=`</div>`;

  // lv2以上: bio前半
  if(lv>=1 && bioFront){
    html+=`<div class="bio-tag">${esc(bioFront)}</div>`;
  } else if(lv<2 && (bioFront||bioBack)){
    const rem=nextLvInfo(2);
    html+=`<div class="dl-locked">??? ─ この英雄が登場する章をあと${rem}章制覇で解禁</div>`;
  }

  // lv2: +bioFull(bio後半)
  if(lv>=2 && bioBack){
    html+=`<div class="bio-tag">${esc(bioBack)}</div>`;
  } else if(lv>=1 && lv<3 && (bioBack||kizunaNames.length)){
    const rem=nextLvInfo(3);
    html+=`<div class="dl-locked">??? ─ この英雄が登場する章をあと${rem}章制覇で解禁</div>`;
  }

  // lv3: +bio全文+縁
  if(lv>=3){
    if(g.profile){
      html+=`<div class="profile">${esc(g.profile).split(/\n\s*\n/).map(p=>'<p>'+p.replace(/\n/g,'<br>')+'</p>').join('')}</div>`;
    }
    if(kizunaNames.length){
      html+=`<div style="font-size:12px;color:var(--gold2);margin:7px 0;"><b>縁：</b>${kizunaNames.map(n=>esc(n)).join('　')}</div>`;
    }
  } else if(lv>=2 && (g.profile||kizunaNames.length)){
    const rem=nextLvInfo(3);
    html+=`<div class="dl-locked">??? ─ この英雄が登場する章をあと${rem}章制覇で解禁</div>`;
  }

  // lv4: +固有技+登場章リスト+最期
  if(lv>=4){
    if(ult){
      html+=`<div style="margin-top:10px;font-size:13px;"><b style="color:var(--gold2)">${esc(ult.name||'')}</b>${ult.def&&ult.def.quote?` ─ <span class="voice">「${esc(ult.def.quote)}」</span>`:''}</div>`;
    }
    if(stageNos.length){
      html+=`<div style="font-size:12px;color:var(--txt2);margin:6px 0;line-height:1.55;">演義での登場：全 <b style="color:var(--gold2)">${totalN}</b> 回　${stageNos.map(n=>'第'+n+'回').join('・')}</div>`;
    }
    if(epitaph){
      html+=`<div class="dl-epitaph"><div class="dl-ep-label">最期</div><div class="dl-ep-text">${esc(epitaph)}</div></div>`;
    }
  } else if(lv>=3){
    const rem=nextLvInfo(4);
    html+=`<div class="dl-locked">??? ─ この英雄が登場する章をあと${rem}章制覇で解禁</div>`;
  }

  html+=`<div class="hr-pips" style="margin:12px 0 4px">${[1,2,3,4].map(k=>`<span class="pip ${k<=lv?'on':''}" title="解禁Lv${k}"></span>`).join('')} <span style="font-size:11px;color:var(--txt2);margin-left:6px;">Lv${lv}</span></div>`;
  html+=`<button class="btn" id="dl-close" style="margin-top:12px">閉じる</button>`;

  $('#modalbox').innerHTML = html;
  $('#modal').classList.add('show');
  $('#modalbox').scrollTop = 0;
  const _df=$('#modalbox .dl-face'); if(_df) _df.appendChild(faceEl(g,84));
  $('#dl-close').onclick=()=>$('#modal').classList.remove('show');
}

// ── 初期化 ─────────────────────────────────
function init(){
  G.onHud=updateHud; G.onLevelUp=onLevelUp; G.onGameOver=onEnd; G.onVictory=onEnd; G.onBossIntro=onBossIntro; G.onSceneEnd=onSceneEnd;
  window.SFX&&SFX.setMuted(!!(window.Save.get().opts&&window.Save.get().opts.muted));
  G.onAutoPause=()=>{ if(!$('#pause').classList.contains('show'))$('#pause').classList.add('show'); };
  $('#pausebtn').onclick=togglePause;
  const ub=$('#ultbtn'); if(ub)ub.onclick=()=>G.triggerUlt&&G.triggerUlt();
  $('#p-resume').onclick=togglePause;
  $('#p-quit').onclick=()=>{ $('#pause').classList.remove('show'); G.quitRun(); G.pauseToggle(false); renderStage(); show('s-stage'); };
  document.querySelectorAll('.screen > .back').forEach(b=>b.onclick=()=>{renderTitle();show('s-title');});
  addEventListener('keydown',e=>{ if((e.key==='Escape'||e.key.toLowerCase()==='p')){const R=G.getR();if(R&&!R.over)togglePause();}
    else if(e.key===' '){ const R=G.getR(); if(R&&!R.over&&G.triggerUlt)G.triggerUlt(); } });
  renderTitle(); show('s-title');
}
return {init,renderTitle,show};
})();
