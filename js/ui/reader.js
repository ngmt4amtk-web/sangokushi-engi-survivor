// ══════════════════════════════════════════════════════
// reader.js  ── ノベルゲーム式 全文リーダー
// window.Reader.open(no) で任意の回を開く
// ══════════════════════════════════════════════════════
(function(){
  'use strict';

  // ── localStorage キー ────────────────────────────
  const POS_KEY  = 'engi-reader-pos';   // {no: pageIndex}
  const DONE_KEY = 'engi-reader-done';  // {no: true}

  // ── DOM ──────────────────────────────────────────
  let overlay = null;   // #readerov
  let curNo   = 0;
  let pages   = [];
  let pageIdx = 0;

  // ── ユーティリティ ────────────────────────────────
  function esc(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function toast(msg){
    let el = document.getElementById('reader-toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'reader-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(()=>el.classList.remove('show'), 2600);
  }

  // ── 保存 / 読込 ──────────────────────────────────
  function loadPos(){
    try{ return JSON.parse(localStorage.getItem(POS_KEY)||'{}'); }catch(e){ return {}; }
  }
  function savePos(no, idx){
    const obj = loadPos();
    obj[no] = idx;
    localStorage.setItem(POS_KEY, JSON.stringify(obj));
  }
  function loadDone(){
    try{ return JSON.parse(localStorage.getItem(DONE_KEY)||'{}'); }catch(e){ return {}; }
  }
  function markDone(no){
    const obj = loadDone();
    obj[no] = true;
    localStorage.setItem(DONE_KEY, JSON.stringify(obj));
  }
  function isDone(no){
    return !!loadDone()[no];
  }

  // ── オーバーレイ構築 ─────────────────────────────
  function buildOverlay(){
    if(document.getElementById('readerov')) return;
    const el = document.createElement('div');
    el.id = 'readerov';
    el.innerHTML = `
      <div id="rdr-header">
        <div id="rdr-title"></div>
        <div id="rdr-pager"></div>
        <button id="rdr-close" aria-label="閉じる">✕</button>
      </div>
      <div id="rdr-body">
        <div id="rdr-page"></div>
        <div id="rdr-next-arrow">▼</div>
      </div>
      <div id="rdr-tap-left"  aria-label="前のページ"></div>
      <div id="rdr-tap-right" aria-label="次のページ"></div>
      <div id="rdr-ctrl">
        <button id="rdr-btn-first" aria-label="最初へ">⏮<span>最初へ</span></button>
        <button id="rdr-btn-prev"  aria-label="前へ">◀<span>前へ</span></button>
        <button id="rdr-btn-next"  aria-label="次へ"><span>次へ</span>▶</button>
        <button id="rdr-btn-log"   aria-label="ログ">📜<span>ログ</span></button>
      </div>
      <div id="rdr-log">
        <div id="rdr-log-header">
          <span id="rdr-log-title">ログ</span>
          <button id="rdr-log-close" aria-label="ログを閉じる">✕</button>
        </div>
        <div id="rdr-log-body"></div>
      </div>
    `;
    document.body.appendChild(el);
    overlay = el;

    document.getElementById('rdr-close').addEventListener('click', close);
    document.getElementById('rdr-tap-right').addEventListener('click', nextPage);
    document.getElementById('rdr-tap-left').addEventListener('click', prevPage);

    // コントロールバー
    document.getElementById('rdr-btn-first').addEventListener('click', goFirst);
    document.getElementById('rdr-btn-prev').addEventListener('click', prevPage);
    document.getElementById('rdr-btn-next').addEventListener('click', nextPage);
    document.getElementById('rdr-btn-log').addEventListener('click', openLog);

    // ログオーバーレイ
    document.getElementById('rdr-log-close').addEventListener('click', closeLog);
  }

  // ── ページ描画 ────────────────────────────────────
  function renderPage(){
    const pageEl  = document.getElementById('rdr-page');
    const pagerEl = document.getElementById('rdr-pager');
    const arrowEl = document.getElementById('rdr-next-arrow');
    if(!pageEl) return;

    const raw = pages[pageIdx] || '';
    const isScene = raw.startsWith('◆ ');
    const isLast  = pageIdx === pages.length - 1;

    // ページャ
    pagerEl.textContent = `${pageIdx + 1} / ${pages.length}`;

    // ページ本文
    let html;
    if(isLast){
      // 最終ページ: 本文 + 読了メッセージ
      if(isScene){
        html = `<p class="rdr-scene">${esc(raw.slice(2))}</p>`;
      } else {
        html = `<p class="rdr-text">${esc(raw)}</p>`;
      }
      html += buildLastPageExtra();
    } else {
      if(isScene){
        html = `<p class="rdr-scene">${esc(raw.slice(2))}</p>`;
      } else {
        html = `<p class="rdr-text">${esc(raw)}</p>`;
      }
    }
    pageEl.innerHTML = html;

    // 「次の回を読む」ボタンのイベント登録
    const nextChBtn = pageEl.querySelector('#rdr-btn-nextch');
    if(nextChBtn){
      nextChBtn.addEventListener('click', ()=>{
        const nextNo = curNo + 1;
        close();
        // 少し待ってから次の回を開く（close のアニメーション後）
        setTimeout(()=>{ window.Reader.open(nextNo); }, 120);
      });
    }

    // 矢印と末尾表示
    if(isLast){
      arrowEl.style.visibility = 'hidden';
      arrowEl.classList.remove('rdr-arrow-blink');
      const done = pageEl.querySelector('.rdr-done-label');
      if(done) done.style.display = 'block';
    } else {
      arrowEl.style.visibility = 'visible';
      arrowEl.classList.add('rdr-arrow-blink');
    }

    // フェードイン
    pageEl.classList.remove('rdr-fadein');
    void pageEl.offsetWidth; // reflow
    pageEl.classList.add('rdr-fadein');

    savePos(curNo, pageIdx);
  }

  function buildLastPageExtra(){
    const done = isDone(curNo);
    // 次章が存在し・クリア済みかチェック
    const nextNo = curNo + 1;
    const hasNext = (typeof window.STAGES !== 'undefined')
      && window.STAGES.some(s => s.no === nextNo);
    const nextCleared = hasNext
      && (typeof window.Save !== 'undefined')
      && !!window.Save.get().cleared['s'+nextNo];

    let html = `<div class="rdr-done-label">— この回、読了 —</div>`;
    if(hasNext && nextCleared){
      html += `<button id="rdr-btn-nextch" class="rdr-nextch-btn">次の回を読む ▶</button>`;
    }
    return html;
  }

  // ── ページ送り ────────────────────────────────────
  function nextPage(){
    if(pageIdx < pages.length - 1){
      pageIdx++;
      renderPage();
    } else if(pageIdx === pages.length - 1){
      // 最終ページで右タップ → 読了処理してから一覧へ戻る
      onReadComplete();
    }
  }

  function prevPage(){
    if(pageIdx > 0){
      pageIdx--;
      renderPage();
    }
  }

  // ── 最初へジャンプ ──────────────────────────────
  function goFirst(){
    pageIdx = 0;
    savePos(curNo, 0);
    renderPage();
  }

  // ── ログ開く ─────────────────────────────────────
  function openLog(){
    const logEl = document.getElementById('rdr-log');
    const bodyEl = document.getElementById('rdr-log-body');
    const titleEl = document.getElementById('rdr-log-title');
    if(!logEl || !bodyEl) return;

    // ヘッダタイトル更新
    const chTitle = (document.getElementById('rdr-title')||{}).textContent || ('第'+curNo+'回');
    if(titleEl) titleEl.textContent = 'ログ ― ' + chTitle;

    // エントリ生成(0..pageIdx)
    let html = '';
    for(let i = 0; i <= pageIdx; i++){
      const raw = pages[i] || '';
      const isScene = raw.startsWith('◆ ');
      const pgLabel = `<span class="rdr-log-pgno">${i+1}</span>`;
      if(isScene){
        html += `<div class="rdr-log-entry rdr-log-scene" data-pg="${i}">${pgLabel}${esc(raw.slice(2))}</div>`;
      } else {
        html += `<div class="rdr-log-entry" data-pg="${i}">${pgLabel}${esc(raw)}</div>`;
      }
    }
    bodyEl.innerHTML = html;

    // エントリタップ→ジャンプ
    bodyEl.querySelectorAll('.rdr-log-entry').forEach(entry => {
      entry.addEventListener('click', () => {
        const pg = parseInt(entry.dataset.pg, 10);
        if(!isNaN(pg) && pg >= 0 && pg < pages.length){
          pageIdx = pg;
          renderPage();
          closeLog();
        }
      });
    });

    logEl.classList.add('show');
    // 最下部へスクロール(現在ページ=末尾)
    requestAnimationFrame(() => { bodyEl.scrollTop = bodyEl.scrollHeight; });
  }

  // ── ログ閉じる ───────────────────────────────────
  function closeLog(){
    const logEl = document.getElementById('rdr-log');
    if(logEl) logEl.classList.remove('show');
  }

  // ── 読了処理 ─────────────────────────────────────
  function onReadComplete(){
    markDone(curNo);
    close();
    // 一覧に読了バッジを反映 (screens.js の renderRead が管理するカード)
    refreshReadListBadge(curNo);
  }

  function refreshReadListBadge(no){
    // s-read 画面が表示中ならバッジを付ける
    const card = document.querySelector(`.rcard[data-no="${no}"]`);
    if(!card) return;
    const rgo = card.querySelector('.rgo');
    if(rgo && !rgo.classList.contains('rgo-done')){
      rgo.textContent = '✓ 読了';
      rgo.classList.add('rgo-done');
    }
  }

  // ── VNモード: data.script配列でVN.playを使う ─────────
  function openVnMode(no, data){
    // しおり: 行番号保存(VNモード専用)
    var VN_POS_KEY = 'engi-reader-vn-pos';
    function saveVnPos(n,i){ try{ var o=JSON.parse(localStorage.getItem(VN_POS_KEY)||'{}'); o[n]=i; localStorage.setItem(VN_POS_KEY,JSON.stringify(o)); }catch(e){} }

    var script = data.script;
    var onVnEnd = function(){
      markDone(no);
      refreshReadListBadge(no);
    };
    window.VN.play(script, {}, onVnEnd);
    // 最終行をしおりとして記録(読み始めを保存する用途)
    saveVnPos(no, script.length - 1);
    if(window.ACH) window.ACH.event('readerOpen',{no});
  }

  // ── 開く ─────────────────────────────────────────
  async function open(no){
    buildOverlay();
    curNo = no;
    pages = [];
    pageIdx = 0;

    // フェッチ
    const path = 'reader/ch' + String(no).padStart(3,'0') + '.json';
    let data;
    try{
      const r = await fetch(path);
      if(!r.ok) throw new Error('HTTP ' + r.status);
      data = await r.json();
    } catch(e){
      toast('この回の読み物は準備中です');
      return;
    }

    // ── script配列があればVNモード優先 ──────────────────
    if(Array.isArray(data.script) && data.script.length > 0 && window.VN){
      openVnMode(no, data);
      return;
    }

    // ── 通常 pages モード ──────────────────────────────
    if(Array.isArray(data.pages) && data.pages.length > 0){
      pages = data.pages;
    } else {
      toast('この回の読み物は準備中です');
      return;
    }

    // しおり復元
    const pos = loadPos();
    pageIdx = (typeof pos[no] === 'number' && pos[no] > 0 && pos[no] < pages.length)
      ? pos[no]
      : 0;

    // ヘッダタイトル
    const titleEl = document.getElementById('rdr-title');
    if(titleEl) titleEl.textContent = data.title || ('第' + no + '回');

    // 表示
    closeLog();
    overlay.classList.add('show');
    if(window.ACH) window.ACH.event('readerOpen',{no});
    renderPage();
  }

  // ── 閉じる ────────────────────────────────────────
  function close(){
    if(!overlay) return;
    overlay.classList.remove('show');
  }

  // ── 公開 API ─────────────────────────────────────
  window.Reader = { open, close, isDone };

  // ── 一覧バッジ初期化(renderRead 呼び出し後に一覧を装飾) ──
  // screens.js の renderRead が呼ばれた後でバッジを付けるため
  // MutationObserver で .rcard が追加された時に自動適用
  function applyBadges(){
    const done = loadDone();
    document.querySelectorAll('.rcard[data-no]').forEach(card=>{
      const no = +card.dataset.no;
      if(!done[no]) return;
      const rgo = card.querySelector('.rgo');
      if(rgo && !rgo.classList.contains('rgo-done')){
        rgo.textContent = '✓ 読了';
        rgo.classList.add('rgo-done');
      }
    });
  }

  // s-read コンテナを監視して .rcard が描画されたらバッジ適用
  document.addEventListener('DOMContentLoaded', ()=>{
    const readScreen = document.getElementById('s-read');
    if(!readScreen) return;
    const obs = new MutationObserver(applyBadges);
    obs.observe(readScreen, { childList: true, subtree: true });
  });

})();
