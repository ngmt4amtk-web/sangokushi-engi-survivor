// narration.js — 全120回ノベルゲーム式ナレーション(自動生成: tools/merge_narr.js)。
// scenes.js の後に読み込み、各幕の pre/quote/post を上書きする。第3回は scenes.js 内の原器を使うため含めない。
window.CHAPTER_NARR = window.CHAPTER_NARR || {};
(function(){
  const N=window.CHAPTER_NARR, S=window.CHAPTER_SCENES||{};
  for(const no in N){
    const arr=S[no]; if(!arr) continue;
    (N[no].scenes||[]).forEach((n,i)=>{
      const sc=arr[i]; if(!sc||!n) return;
      if(n.pre) sc.pre=n.pre;
      if(n.quote) sc.quote=n.quote;
      if(n.post) sc.post=n.post;
    });
  }
})();
