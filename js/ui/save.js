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
    opts:{muted:false,autoUlt:false,bgmVolume:55,sfxVolume:80,shake:true,damageNumbers:true,lightMode:false},
    achievements:{},     // {achievementId:{at, data}}
    meta:{gold:0, upg:{}},   // 恒久メタ進行: gold=貯蓄軍功, upg={key:rank}
  };
  let S=load();
  function cloneDefault(){ return JSON.parse(JSON.stringify(DEFAULT)); }
  function normalize(r){
    const s=Object.assign({},cloneDefault(),r||{});
    s.owned=Object.assign({},(r&&r.owned)||{});
    s.cleared=Object.assign({},(r&&r.cleared)||{});
    s.best=Object.assign({},(r&&r.best)||{});
    s.stats=Object.assign({},DEFAULT.stats,(r&&r.stats)||{});
    s.opts=Object.assign({},DEFAULT.opts,(r&&r.opts)||{});
    s.achievements=Object.assign({},(r&&r.achievements)||{});
    s.meta=Object.assign({},DEFAULT.meta,(r&&r.meta)||{});
    s.meta.upg=Object.assign({},DEFAULT.meta.upg,(r&&r.meta&&r.meta.upg)||{});
    return s;
  }
  function load(){ try{const r=JSON.parse(localStorage.getItem(KEY)); if(r&&r.v)return normalize(r); }catch(e){} return cloneDefault(); }
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){} }
  function get(){return S;}
  function reset(){ S=cloneDefault(); save(); }
  function own(genId){ S.owned[genId]=(S.owned[genId]||0)+1; save(); }
  function ownedCount(genId){return S.owned[genId]||0;}
  function setDifficulty(d){ S.difficulty=d; save(); }
  function rankScore(r){ return r==='S'?3:(r==='A'?2:(r==='B'?1:0)); }
  function clearStage(stageId,res){ const first=!S.cleared[stageId]; S.cleared[stageId]=true;
    const b=S.best[stageId]||{time:0,kills:0};
    const nr=res&&res.rank;
    const br=b.rank;
    S.best[stageId]=Object.assign({},b,{
      time:Math.max(b.time||0,res.time|0),
      kills:Math.max(b.kills||0,res.kills|0),
    });
    if(nr==='天命') S.best[stageId].rank='天命';
    else if(nr && rankScore(nr)>rankScore(br)) S.best[stageId].rank=nr;
    if(typeof res.hits==='number') S.best[stageId].hits=(typeof b.hits==='number')?Math.min(b.hits,res.hits):res.hits;
    save(); return first; }
  function stageUnlocked(stage){
    if(stage.no===1) return true;
    const prev=window.STAGES.find(s=>s.no===stage.no-1);
    return prev? !!S.cleared[prev.id] : true;
  }
  function exportJson(){ return JSON.stringify(S,null,2); }
  function importJson(text){
    const r=JSON.parse(text);
    if(!r||typeof r!=='object'||!r.v) throw new Error('セーブJSONとして読めません');
    S=normalize(r);
    save();
    return S;
  }
  return {get,save,reset,own,ownedCount,setDifficulty,clearStage,stageUnlocked,exportJson,importJson};
})();
