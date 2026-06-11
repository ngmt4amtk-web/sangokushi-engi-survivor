// save.js — localStorage セーブ/ロード。演義版(主役制・難易度・ステージ報酬ガチャ)。
window.Save = (function(){
  const KEY='sangokushi-engi-v1';
  const DEFAULT={
    v:1,
    owned:{},            // {genId: count} ガチャで集めた図鑑/コレクション
    cleared:{}, best:{}, // {stageId:true}, {stageId:{time,kills}}
    difficulty:'normal', // 'easy'|'normal'|'hard'
    stats:{runs:0,kills:0,wins:0},
    seenIntro:false,
    seenUltIntro:false,
    opts:{muted:false,autoUlt:false},
    meta:{gold:0, upg:{}},   // 恒久メタ進行: gold=貯蓄軍功, upg={key:rank}
  };
  let S=load();
  function load(){ try{const r=JSON.parse(localStorage.getItem(KEY)); if(r&&r.v){ const s=Object.assign({},JSON.parse(JSON.stringify(DEFAULT)),r); s.opts=Object.assign({},DEFAULT.opts,r.opts||{}); s.meta=Object.assign({},DEFAULT.meta,r.meta||{}); s.meta.upg=Object.assign({},DEFAULT.meta.upg,(r.meta&&r.meta.upg)||{}); return s; }}catch(e){} return JSON.parse(JSON.stringify(DEFAULT)); }
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){} }
  function get(){return S;}
  function reset(){ S=JSON.parse(JSON.stringify(DEFAULT)); save(); }
  function own(genId){ S.owned[genId]=(S.owned[genId]||0)+1; save(); }
  function ownedCount(genId){return S.owned[genId]||0;}
  function setDifficulty(d){ S.difficulty=d; save(); }
  function clearStage(stageId,res){ const first=!S.cleared[stageId]; S.cleared[stageId]=true;
    const b=S.best[stageId]||{time:0,kills:0}; S.best[stageId]={time:Math.max(b.time,res.time|0),kills:Math.max(b.kills,res.kills|0)}; save(); return first; }
  function stageUnlocked(stage){
    if(stage.no===1) return true;
    const prev=window.STAGES.find(s=>s.no===stage.no-1);
    return prev? !!S.cleared[prev.id] : true;
  }
  return {get,save,reset,own,ownedCount,setDifficulty,clearStage,stageUnlocked};
})();
