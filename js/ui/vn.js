// vn.js — ノベルゲーム式「会話劇」レンダラ v2
// window.VN.play(script, opts, onEnd)
//
// script: 行の配列。各行は以下3形式のいずれか。
//   {"n":"地の文"}             → 中央白文字・タイプライター
//   {"s":"話者名","t":"セリフ"} → 下部固定会話ウィンドウ
//   {"h":"◆ 場面見出し"}      → 金文字見出し(左右細罫)
//
// opts:
//   context: 'reader'(デフォルト) | 'battle'
//     'reader' → ⌂ホームボタン/✕一覧へ を表示
//     'battle' → ⌂を出さない(戦闘フロー保護)
//
// onEnd: 全行終了後コールバック
//
// 肖像: Sprites.face(g) → Sprites.faceGeneric(name) → 肖像なし(名前プレートのみ)
//   Sprites.general のドット絵バストへのフォールバックは廃止
'use strict';
(function(){

  // ── DOM ─────────────────────────────────────
  let _ov = null;
  let _script = [];
  let _idx = 0;
  let _onEnd = null;
  let _tyTid = null;
  let _tyDone = false;
  let _logOpen = false;
  let _context = 'reader'; // 'reader' | 'battle'
  let _firstShow = false;  // トースト初回フラグ(セッション内)
  let _lastSpeaker = null; // 話者交代検出
  let _portAnimTid = null; // 肖像フェード/スライドタイマー

  // ── ユーティリティ ────────────────────────────
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── オーバーレイ構築(1回のみ) ─────────────────
  function buildOverlay(){
    if(document.getElementById('vn-ov')) return;
    const div = document.createElement('div');
    div.id = 'vn-ov';
    div.innerHTML = `
      <div id="vn-bg"></div>
      <div id="vn-bg-tap-left"  class="vn-tap-zone vn-tap-left"></div>
      <div id="vn-bg-tap-right" class="vn-tap-zone vn-tap-right"></div>
      <div id="vn-narrator" class="vn-narrator"></div>
      <div id="vn-heading"  class="vn-heading"></div>
      <div id="vn-dlg" class="vn-dlg">
        <div id="vn-portrait-wrap" class="vn-portrait-wrap"></div>
        <div id="vn-speaker-tab" class="vn-speaker-tab"></div>
        <div id="vn-dlg-inner">
          <div id="vn-text" class="vn-text"></div>
          <div class="vn-arrow">▼</div>
        </div>
      </div>
      <div id="vn-topbar" class="vn-topbar">
        <button id="vn-log-btn"  class="vn-tbtn">📜 ログ</button>
        <button id="vn-skip-btn" class="vn-tbtn">▸▸ スキップ</button>
        <button id="vn-home-btn" class="vn-tbtn vn-home-btn">⌂</button>
        <button id="vn-close-btn" class="vn-tbtn vn-close-btn">✕</button>
      </div>
      <div id="vn-toast" class="vn-toast">タップで進む ／ 左端タップで戻る</div>
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

    // タップゾーン: 右75%=進む / 左25%=戻る
    document.getElementById('vn-bg-tap-left').addEventListener('click', function(e){
      e.stopPropagation();
      if(_logOpen) return;
      stepBack();
    });
    document.getElementById('vn-bg-tap-right').addEventListener('click', function(e){
      e.stopPropagation();
      if(_logOpen) return;
      advance();
    });
    document.getElementById('vn-log-btn').addEventListener('click', function(e){
      e.stopPropagation();
      openLog();
    });
    document.getElementById('vn-skip-btn').addEventListener('click', function(e){
      e.stopPropagation();
      skipAll();
    });
    document.getElementById('vn-home-btn').addEventListener('click', function(e){
      e.stopPropagation();
      goHome();
    });
    document.getElementById('vn-close-btn').addEventListener('click', function(e){
      e.stopPropagation();
      closeToList();
    });
    document.getElementById('vn-log-close').addEventListener('click', function(e){
      e.stopPropagation();
      closeLog();
    });
  }

  // ── 肖像取得: face → faceGeneric → null ────────
  function getPortraitImg(name){
    if(!name) return null;
    // 1) 専用肖像が「存在する」ならsrc直指し(ロード競合で汎用顔に落ちるのを防ぐ)
    if(window.Sprites && window.Sprites.faceHas && window.Sprites.faceHas(name)){
      return { src: 'assets/face/'+name+'.png' };
    }
    // 2) 汎用pool(役職+名前ハッシュ)
    const g = (window.GENERALS||[]).find(x=>x.name===name);
    if(window.Sprites && window.Sprites.faceGeneric){
      const gi = window.Sprites.faceGeneric(name, g && g.role);
      if(gi) return gi;
    }
    // 3) null → 名前プレートのみ
    return null;
  }

  // ── 肖像カード表示 ────────────────────────────
  function showPortrait(name, animate){
    const wrap = document.getElementById('vn-portrait-wrap');
    if(!wrap) return;
    const img = getPortraitImg(name);
    if(!img){
      wrap.style.display = 'none';
      return;
    }
    // imgタグ生成
    const im = document.createElement('img');
    im.src = (img.src !== undefined) ? img.src : '';
    if(img.tagName === 'CANVAS') im.src = img.toDataURL();
    im.className = 'vn-port-img';
    wrap.innerHTML = '';
    wrap.appendChild(im);
    wrap.style.display = 'block';
    if(animate){
      wrap.classList.remove('vn-port-in');
      void wrap.offsetWidth;
      wrap.classList.add('vn-port-in');
    }
  }

  // ── 肖像減光(地の文) ─────────────────────────
  function dimPortrait(dim){
    const wrap = document.getElementById('vn-portrait-wrap');
    if(!wrap) return;
    wrap.classList.toggle('vn-port-dim', !!dim);
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
    const spkEl  = document.getElementById('vn-speaker-tab');
    const txtEl  = document.getElementById('vn-text');
    if(!narEl) return;

    // 全要素を一旦隠す
    narEl.style.display  = 'none';
    hdEl.style.display   = 'none';
    dlgEl.style.display  = 'none';

    if(row.h !== undefined){
      // ── 見出し行 ──────────────────────────────
      hdEl.textContent = row.h.replace(/^◆\s*/,'');
      hdEl.style.display = 'flex';
      _tyDone = true;
      dimPortrait(true);
    } else if(row.n !== undefined){
      // ── 地の文 ──────────────────────────────
      narEl.style.display = 'flex';
      narEl.textContent = '';
      dimPortrait(true);
      const full = String(row.n);
      let i = 0;
      _tyTid = setInterval(function(){
        i++;
        narEl.textContent = full.slice(0, i);
        if(i >= full.length){ clearInterval(_tyTid); _tyDone = true; }
      }, 8);
    } else if(row.s !== undefined){
      // ── セリフ行 ──────────────────────────────
      dlgEl.style.display = 'block';
      dimPortrait(false);

      // 話者名タブ
      spkEl.textContent = row.s || '';
      spkEl.style.display = row.s ? 'block' : 'none';

      // 肖像: 話者交代時にアニメ
      const speaker = row.s || '';
      const animate = (speaker !== _lastSpeaker);
      _lastSpeaker = speaker;
      showPortrait(speaker, animate);

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
    const next = _idx + 1;
    if(next < _script.length){
      renderLine(next);
    } else {
      end();
    }
  }

  // ── 1行戻る ──────────────────────────────────
  function stepBack(){
    if(_idx <= 0) return;
    clearInterval(_tyTid);
    _lastSpeaker = null; // 戻り時は話者比較をリセット(アニメなし)
    renderLine(_idx - 1);
    clearInterval(_tyTid);
    _tyDone = true;
    const row = _script[_idx];
    if(row.n !== undefined) document.getElementById('vn-narrator').textContent = row.n;
    else if(row.s !== undefined) document.getElementById('vn-text').textContent = row.t||'';
  }

  // ── スキップ(全行飛ばし) ─────────────────────
  function skipAll(){
    end();
  }

  // ── ホームへ ────────────────────────────────
  function goHome(){
    clearInterval(_tyTid);
    // しおりは呼び出し元(openVnMode)が保存済みなので追加保存は不要
    close();
    // フェードアウト後にタイトルへ
    setTimeout(function(){
      // UI.show / UI.renderTitle の存在チェック
      if(window.UI && typeof window.UI.showScreen === 'function'){
        window.UI.showScreen('s-title');
      } else if(window.UI && typeof window.UI.renderTitle === 'function'){
        window.UI.renderTitle();
      } else {
        // fallback: screens.js の show('s-title') 相当を試みる
        document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
        const t = document.getElementById('s-title');
        if(t) t.classList.add('show');
      }
    }, 200);
  }

  // ── 一覧へ戻る(✕) ──────────────────────────
  function closeToList(){
    clearInterval(_tyTid);
    close();
    if(typeof _onEnd === 'function') _onEnd();
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
    body.querySelectorAll('[data-i]').forEach(function(el){
      el.addEventListener('click', function(){
        const i = parseInt(el.dataset.i, 10);
        closeLog();
        clearInterval(_tyTid);
        _lastSpeaker = null;
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

  // ── トースト(初回のみ) ────────────────────────
  function showToast(){
    const el = document.getElementById('vn-toast');
    if(!el) return;
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); }, 3000);
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
    if(_ov){
      _ov.classList.add('vn-fadeout');
      setTimeout(function(){
        _ov.classList.remove('show','vn-fadeout');
      }, 260);
    }
    _logOpen = false;
    const log = document.getElementById('vn-log');
    if(log) log.classList.remove('show');
  }

  // ── 公開API ──────────────────────────────────
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
    _lastSpeaker = null;
    _context = (opts && opts.context) || 'reader';

    // ⌂ボタン: readerコンテキスト時のみ表示
    const homeBtn = document.getElementById('vn-home-btn');
    if(homeBtn) homeBtn.style.display = (_context === 'reader') ? '' : 'none';

    closeLog();
    if(!_ov) _ov = document.getElementById('vn-ov');
    _ov.classList.remove('vn-fadeout','vn-ctx-reader','vn-ctx-battle');
    _ov.classList.add('show', _context === 'reader' ? 'vn-ctx-reader' : 'vn-ctx-battle');

    // 初回トースト
    if(!_firstShow){
      _firstShow = true;
      setTimeout(showToast, 400);
    }

    renderLine(0);
  }

  window.VN = { play: play, close: close, skip: skipAll };
})();
