// vn.js — ノベルゲーム式「会話劇」レンダラ
// window.VN.play(script, opts, onEnd)
//
// script: 行の配列。各行は以下3形式のいずれか。
//   {"n":"地の文"}          → 中央白文字・タイプライター
//   {"s":"話者名","t":"セリフ"} → 画面下部会話ウィンドウ(墨半透明・金縁)
//   {"h":"◆ 場面見出し"}   → 金色センタリング見出し
//
// opts: { skipKey: true }  ← 現在未使用(将来拡張用)
// onEnd: 全行終了後に呼ばれるコールバック
//
// 既読ログ: 左上「ログ」ボタン or 戻るタップ=1行戻る(ウィンドウ上半のタップ)
// 肖像優先度: Sprites.face(g) → Sprites.general(g) バスト → なし
'use strict';
(function(){

  // ── DOM ─────────────────────────────────────
  let _ov = null;    // #vn-ov
  let _script = [];
  let _idx = 0;
  let _onEnd = null;
  let _tyTid = null;   // タイプライタータイマー
  let _tyDone = false; // 現在行のタイプが完了したか
  let _logOpen = false;

  // ── ユーティリティ ────────────────────────────
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── オーバーレイ構築(1回のみ) ─────────────────
  function buildOverlay(){
    if(document.getElementById('vn-ov')) return;
    const div = document.createElement('div');
    div.id = 'vn-ov';
    div.innerHTML = `
      <div id="vn-bg-tap-top"  class="vn-tap-zone vn-tap-top"></div>
      <div id="vn-bg-tap-bot"  class="vn-tap-zone vn-tap-bot"></div>
      <div id="vn-narrator" class="vn-narrator"></div>
      <div id="vn-heading"  class="vn-heading"></div>
      <div id="vn-dlg" class="vn-dlg">
        <div id="vn-portrait" class="vn-portrait"></div>
        <div id="vn-talk-area">
          <div id="vn-speaker" class="vn-speaker"></div>
          <div id="vn-text"    class="vn-text"></div>
        </div>
      </div>
      <div id="vn-log-btn"  class="vn-log-btn">📜 ログ</div>
      <div id="vn-log" class="vn-log">
        <div class="vn-log-hd">
          <span>ログ</span>
          <button id="vn-log-close" class="vn-log-close">✕</button>
        </div>
        <div id="vn-log-body" class="vn-log-body"></div>
      </div>
    `;
    document.body.appendChild(div);
    _ov = div;

    // タップゾーン: 上半=1行戻る / 下半=進む
    document.getElementById('vn-bg-tap-top').addEventListener('click', function(e){
      e.stopPropagation();
      if(_logOpen) return;
      stepBack();
    });
    document.getElementById('vn-bg-tap-bot').addEventListener('click', function(e){
      e.stopPropagation();
      if(_logOpen) return;
      advance();
    });
    document.getElementById('vn-log-btn').addEventListener('click', function(e){
      e.stopPropagation();
      openLog();
    });
    document.getElementById('vn-log-close').addEventListener('click', function(e){
      e.stopPropagation();
      closeLog();
    });
  }

  // ── スプライト取得ヘルパー ────────────────────
  function getPortraitCanvas(name){
    if(!name) return null;
    // 1) Sprites.face(g) が返すImg/Canvas → そのまま使う
    const g = (window.GENERALS||[]).find(x=>x.name===name);
    if(!g) return null;
    if(window.Sprites && window.Sprites.face){
      const fi = window.Sprites.face(g);
      if(fi) return fi; // img or canvas
    }
    // 2) Sprites.general(g) のドット絵バスト(canvas)
    if(window.Sprites && window.Sprites.general){
      try{ return window.Sprites.general(g); }catch(e){}
    }
    return null;
  }

  // ── 行レンダリング ────────────────────────────
  function renderLine(idx){
    if(idx < 0 || idx >= _script.length) return;
    _idx = idx;
    _tyDone = false;
    clearInterval(_tyTid);

    const row = _script[idx];
    const narEl  = document.getElementById('vn-narrator');
    const hdEl   = document.getElementById('vn-heading');
    const dlgEl  = document.getElementById('vn-dlg');
    const portEl = document.getElementById('vn-portrait');
    const spkEl  = document.getElementById('vn-speaker');
    const txtEl  = document.getElementById('vn-text');
    if(!narEl) return;

    // 全要素を一旦隠す
    narEl.style.display  = 'none';
    hdEl.style.display   = 'none';
    dlgEl.style.display  = 'none';

    if(row.h !== undefined){
      // ── 見出し行 ──────────────────────────────
      hdEl.textContent = row.h;
      hdEl.style.display = 'flex';
      _tyDone = true; // 見出しは即完了
    } else if(row.n !== undefined){
      // ── 地の文 ──────────────────────────────
      narEl.style.display = 'flex';
      narEl.textContent = '';
      const full = String(row.n);
      let i = 0;
      _tyTid = setInterval(function(){
        i++;
        narEl.textContent = full.slice(0, i);
        if(i >= full.length){ clearInterval(_tyTid); _tyDone = true; }
      }, 8);
    } else if(row.s !== undefined){
      // ── セリフ行 ──────────────────────────────
      dlgEl.style.display = 'flex';

      // 話者名プレート
      spkEl.textContent = row.s || '';

      // 肖像
      portEl.innerHTML = '';
      portEl.style.display = 'none';
      const portraitEl = getPortraitCanvas(row.s);
      if(portraitEl){
        portEl.style.display = 'block';
        if(portraitEl.tagName === 'CANVAS'){
          const img = document.createElement('img');
          img.src = portraitEl.toDataURL();
          img.className = 'vn-port-img';
          portEl.appendChild(img);
        } else {
          // HTMLImageElement
          const im = document.createElement('img');
          im.src = portraitEl.src;
          im.className = 'vn-port-img';
          portEl.appendChild(im);
        }
      }

      // セリフ タイプライター
      txtEl.textContent = '';
      const full = String(row.t || '');
      let i = 0;
      _tyTid = setInterval(function(){
        i++;
        txtEl.textContent = full.slice(0, i);
        if(i >= full.length){ clearInterval(_tyTid); _tyDone = true; }
      }, 8);
    }
  }

  // ── 進む ────────────────────────────────────
  function advance(){
    if(!_tyDone){
      // タイプ中 → 全文一括表示
      clearInterval(_tyTid);
      _tyDone = true;
      const row = _script[_idx];
      if(row.n !== undefined) document.getElementById('vn-narrator').textContent = row.n;
      else if(row.s !== undefined) document.getElementById('vn-text').textContent = row.t||'';
      return;
    }
    // 次の行へ
    const next = _idx + 1;
    if(next < _script.length){
      renderLine(next);
    } else {
      // 終了
      end();
    }
  }

  // ── 1行戻る ──────────────────────────────────
  function stepBack(){
    if(_idx <= 0) return;
    clearInterval(_tyTid);
    renderLine(_idx - 1);
    // 戻り時は全文即表示
    clearInterval(_tyTid);
    _tyDone = true;
    const row = _script[_idx];
    if(row.n !== undefined) document.getElementById('vn-narrator').textContent = row.n;
    else if(row.s !== undefined) document.getElementById('vn-text').textContent = row.t||'';
  }

  // ── ログ ────────────────────────────────────
  function openLog(){
    _logOpen = true;
    const body = document.getElementById('vn-log-body');
    if(!body) return;
    let html = '';
    for(let i=0; i<=_idx; i++){
      const row = _script[i];
      if(row.h !== undefined){
        html += `<div class="vn-log-h" data-i="${i}">${esc(row.h)}</div>`;
      } else if(row.n !== undefined){
        html += `<div class="vn-log-n" data-i="${i}">${esc(row.n)}</div>`;
      } else if(row.s !== undefined){
        html += `<div class="vn-log-s" data-i="${i}"><span class="vn-log-spk">${esc(row.s)}</span>${esc(row.t||'')}</div>`;
      }
    }
    body.innerHTML = html;
    // タップでジャンプ
    body.querySelectorAll('[data-i]').forEach(function(el){
      el.addEventListener('click', function(){
        const i = parseInt(el.dataset.i, 10);
        closeLog();
        clearInterval(_tyTid);
        renderLine(i);
        clearInterval(_tyTid);
        _tyDone = true;
        const row = _script[i];
        if(row.n !== undefined) document.getElementById('vn-narrator').textContent = row.n;
        else if(row.s !== undefined) document.getElementById('vn-text').textContent = row.t||'';
      });
    });
    const log = document.getElementById('vn-log');
    if(log){ log.classList.add('show'); requestAnimationFrame(function(){ body.scrollTop = body.scrollHeight; }); }
  }
  function closeLog(){
    _logOpen = false;
    const log = document.getElementById('vn-log');
    if(log) log.classList.remove('show');
  }

  // ── 終了 ────────────────────────────────────
  function end(){
    clearInterval(_tyTid);
    close();
    if(typeof _onEnd === 'function') _onEnd();
  }

  // ── close ────────────────────────────────────
  function close(){
    clearInterval(_tyTid);
    if(_ov) _ov.classList.remove('show');
    _logOpen = false;
    const log = document.getElementById('vn-log');
    if(log) log.classList.remove('show');
  }

  // ── 公開API ──────────────────────────────────
  // play(script, opts, onEnd)
  // script: 行配列。空・null・undefinedのいずれかならフォールバック(即onEnd呼び出し)
  function play(script, opts, onEnd){
    if(!Array.isArray(script) || script.length === 0){
      if(typeof onEnd === 'function') onEnd();
      return;
    }
    buildOverlay();
    _script = script;
    _idx = 0;
    _onEnd = onEnd || null;
    _logOpen = false;
    closeLog();
    if(!_ov) _ov = document.getElementById('vn-ov');
    _ov.classList.add('show');
    renderLine(0);
  }

  // 全行スキップ(既読飛ばし/テスト用)
  function skipAll(){ if(!_script) return; end(); }
  window.VN = { play: play, close: close, skip: skipAll };
})();
