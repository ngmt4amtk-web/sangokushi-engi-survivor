// tools/narr/batch_*.json を js/data/narration.js に統合し、構造を検証する
const fs=require('fs'), path=require('path');
global.window={};
eval(fs.readFileSync(path.join(__dirname,'../js/data/scenes.js'),'utf8'));
const SCENES=window.CHAPTER_SCENES;
const dir=path.join(__dirname,'narr');
const out={}, errs=[], warns=[];
for(const f of fs.readdirSync(dir).filter(f=>/^batch_.*\.json$/.test(f)).sort()){
  const data=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
  for(const no in data){
    if(out[no]) errs.push(`${f}: 第${no}回が重複`);
    if(!SCENES[no]){ errs.push(`${f}: 第${no}回はscenesに存在しない`); continue; }
    const sc=data[no].scenes||[];
    if(sc.length>SCENES[no].length) errs.push(`${f}: 第${no}回 幕数過多 ${sc.length}>${SCENES[no].length}`);
    else if(sc.length<SCENES[no].length) warnings_count=0; // 後続幕はscenes.js側のpreを使う(正常)
    sc.forEach((n,i)=>{
      // preScript(VN配列)があればpre文字列は省略可能
      const hasPreScript = Array.isArray(n.preScript) && n.preScript.length > 0;
      if(!n.pre && !hasPreScript) errs.push(`第${no}回 幕${i+1}: pre無し(preScriptも無し)`);
      else if(n.pre){
        const pg=n.pre.split(/\n\n+/).filter(s=>s.trim()).length;
        if(i===0 && (pg<4||pg>9)) warns.push(`第${no}回 幕1: preページ数${pg}(目安5-8)`);
        if(i>0 && pg>5) warns.push(`第${no}回 幕${i+1}: 幕間preページ数${pg}(目安2-4)`);
      }
    });
    const last=sc[sc.length-1];
    if(last && !last.post) warns.push(`第${no}回: 最終幕にpost無し`);
    out[no]=data[no];
  }
}
const missing=[]; for(const no in SCENES){ if(no!=='3' && !out[no]) missing.push(no); }
if(missing.length) warns.push('未収録章: '+missing.join(','));
const body='// narration.js — 全120回ノベルゲーム式ナレーション(自動生成: tools/merge_narr.js)。\n'+
'// scenes.js の後に読み込み、各幕の pre/preScript/quote/post/postScript を上書きする。第3回は scenes.js 内の原器を使う。\n'+
'window.CHAPTER_NARR = '+JSON.stringify(out)+';\n'+
'(function(){\n  const N=window.CHAPTER_NARR, S=window.CHAPTER_SCENES||{};\n  for(const no in N){\n    const arr=S[no]; if(!arr) continue;\n    (N[no].scenes||[]).forEach((n,i)=>{\n      const sc=arr[i]; if(!sc||!n) return;\n      if(n.pre) sc.pre=n.pre;\n      if(n.preScript) sc.preScript=n.preScript;\n      if(n.quote) sc.quote=n.quote;\n      if(n.post) sc.post=n.post;\n      if(n.postScript) sc.postScript=n.postScript;\n    });\n  }\n})();\n';
if(errs.length){ console.error('ERRORS:'); errs.forEach(e=>console.error(' - '+e)); process.exit(1); }
fs.writeFileSync(path.join(__dirname,'../js/data/narration.js'), body);
console.log(`OK: ${Object.keys(out).length}章を narration.js に統合 (${(body.length/1024).toFixed(0)}KB)`);
if(warns.length){ console.log('WARNINGS:'); warns.forEach(w=>console.log(' - '+w)); }
