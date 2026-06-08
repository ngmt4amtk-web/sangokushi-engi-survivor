// main.js — 起動。キャンバス初期化 → UI起動。
window.addEventListener('DOMContentLoaded',()=>{
  const cv=document.getElementById('game');
  window.G.setupCanvas(cv);
  window.UI.init();
  // タッチ操作のスクロール抑止
  document.addEventListener('touchmove',e=>{ if(document.getElementById('hud').classList.contains('show'))e.preventDefault(); },{passive:false});
});
