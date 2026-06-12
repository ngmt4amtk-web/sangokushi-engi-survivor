// achievements.js — 実績データと解除判定。
(function(){
  'use strict';

  const DEFS=[
    {id:'taoyuan',name:'桃園結義',hint:'第1回をクリア',trivia:'桃園の誓いは正史に無い演義の創作。'},
    {id:'warm_wine',name:'温酒斬華雄',hint:'第5回の華雄またはボスを短時間で討つ',trivia:'関羽は酒が冷める前に戻った。'},
    {id:'three_brothers_lubu',name:'三英戦呂布',hint:'第5回を劉備・関羽・張飛の3人装備でクリア',trivia:'虎牢関でも呂布は討てなかった。'},
    {id:'baima_flash',name:'白馬の一閃',hint:'第25回ボスを15秒以内に討つ',trivia:'顔良は名乗る間もなく斬られた。'},
    {id:'qianli_solo',name:'千里走単騎',hint:'第27回をノーダメージでクリア',trivia:'五関六将。'},
    {id:'save_lord',name:'単騎救主',hint:'第41回で2000撃破',trivia:'趙雲は阿斗を抱いて七進七出。'},
    {id:'changban_roar',name:'大喝長坂橋',hint:'第42回で張飛の必殺を発動',trivia:'夏侯傑は喝で落馬死。'},
    {id:'straw_arrows',name:'草船借箭',hint:'第46回をクリア',trivia:'霧で十万本の矢を得た。'},
    {id:'huarong_mercy',name:'華容道の恩義',hint:'第50回をクリア',trivia:'関羽は軍令状を覚悟で見逃した。'},
    {id:'jin_machao',name:'錦馬超',hint:'馬超を装備して1幕800撃破',trivia:'曹操は髭を切り袍を捨てた。'},
    {id:'old_strong',name:'老当益壮',hint:'第71回ボスを黄忠装備で討つ',trivia:'七十歳で夏侯淵を斬った。'},
    {id:'flood_seven',name:'水淹七軍',hint:'第74回をクリア',trivia:'霖雨を読み于禁を沈めた。'},
    {id:'scrape_bone',name:'刮骨療毒',hint:'第75回を被弾30以上でクリア',trivia:'碁を打ちながら骨を削らせた。'},
    {id:'empty_city',name:'空城計',hint:'第95回をキル20以下でクリア',trivia:'戦わずして退ける。'},
    {id:'memorial',name:'出師の表',hint:'第91回をクリア',trivia:'読んで泣かぬ者は忠臣にあらず。'},
    {id:'wuzhang_star',name:'星落五丈原',hint:'第104回をクリア',trivia:'巨星墜ちて三軍慟哭。'},
    {id:'dead_kongming',name:'死諸葛走生仲達',hint:'第105回をクリア',trivia:'木像で司馬懿を退けた。'},
    {id:'unification',name:'三分帰一統',hint:'全120回をクリア',trivia:'分久必合、合久必分。'},
    {id:'five_tigers',name:'五虎大将',hint:'関羽・張飛・趙雲・馬超・黄忠を英雄録で解禁',trivia:'漢中王が封じた。'},
    {id:'dragon_phoenix',name:'臥龍鳳雛',hint:'諸葛亮と龐統を同時装備',trivia:'一人得れば天下安し。'},
    {id:'ikkitousen',name:'一騎当千',hint:'1幕で1000撃破',trivia:'一人で千人に当たる豪勇。'},
    {id:'kizuna_first',name:'連環の縁',hint:'縁合体を初めて発動',trivia:'連環は火計を呼ぶ鎖となった。'},
    {id:'hundred_flowers',name:'百花繚乱',hint:'英雄録で武将100人を解禁',trivia:'演義には名も無き端役まで乱世を彩る。'},
    {id:'reader',name:'読書人',hint:'演義を読むモードを開く',trivia:'原文百二十回。'}
  ];
  const DEF_BY_ID=Object.fromEntries(DEFS.map(d=>[d.id,d]));

  function saveObj(){ const S=window.Save&&window.Save.get(); if(!S)return null; S.achievements=S.achievements||{}; return S; }
  function unlocked(id){ const S=saveObj(); return !!(S&&S.achievements&&S.achievements[id]); }
  function unlock(id,data){
    const S=saveObj(); if(!S||!DEF_BY_ID[id]||S.achievements[id])return false;
    S.achievements[id]={at:Date.now(),data:data||{}};
    window.Save.save();
    toast(DEF_BY_ID[id]);
    return true;
  }
  function toast(def){
    let el=document.getElementById('achtoast');
    if(!el){ el=document.createElement('div'); el.id='achtoast'; document.body.appendChild(el); }
    el.innerHTML='<div class="ach-pop-k">実績解除</div><div class="ach-pop-n">'+esc(def.name)+'</div>';
    el.classList.add('show');
    clearTimeout(el._tm);
    el._tm=setTimeout(()=>el.classList.remove('show'),3200);
    window.SFX&&SFX.play('evolve');
  }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function stageByNo(no){ return (window.STAGES||[]).find(s=>s.no===no); }
  function isCleared(no){ const S=saveObj(), st=stageByNo(no); return !!(S&&st&&S.cleared&&S.cleared[st.id]); }
  function clearedCount(){ const S=saveObj(); return S?Object.keys(S.cleared||{}).length:0; }
  function genByName(name){ return (window.GENERALS||[]).find(g=>g.name===name); }
  function unlockedHeroIds(){
    const S=saveObj(); if(!S)return new Set();
    const out=new Set(), cleared=S.cleared||{};
    for(const st of (window.STAGES||[])){
      if(!cleared[st.id])continue;
      for(const gid of (st.roster||[])) out.add(gid);
    }
    return out;
  }
  function hasUnlockedHero(name){
    const g=genByName(name); return !!(g&&unlockedHeroIds().has(g.id));
  }
  function namesInRun(res){
    const set=new Set();
    if(res&&res.lord&&res.lord.name) String(res.lord.name).split('・').forEach(n=>set.add(n));
    for(const w of ((res&&res.weapons)||[])){ if(w.name)set.add(w.name); }
    return set;
  }
  function hasAll(set,names){ return names.every(n=>set.has(n)); }
  function onRunEnd(res){
    if(!res||!res.win)return;
    const no=res.stage&&res.stage.no, names=namesInRun(res);
    const named=res.namedKillSec||{};
    if(no===1) unlock('taoyuan',{stage:no});
    if(no===5&&((named['華雄']!=null&&named['華雄']<=40)||(res.bossKillSec!=null&&res.bossKillSec<=40))) unlock('warm_wine',{sec:named['華雄']||res.bossKillSec});
    if(no===5&&hasAll(names,['劉備','関羽','張飛'])) unlock('three_brothers_lubu',{stage:no});
    if(no===25&&res.bossKillSec!=null&&res.bossKillSec<=15) unlock('baima_flash',{sec:res.bossKillSec});
    if(no===27&&(res.hits||0)===0) unlock('qianli_solo',{stage:no});
    if(no===41&&(res.kills||0)>=2000) unlock('save_lord',{kills:res.kills});
    if(no===42&&(res.ultNames||[]).includes('張飛')) unlock('changban_roar',{stage:no});
    if(no===46) unlock('straw_arrows',{stage:no});
    if(no===50) unlock('huarong_mercy',{stage:no});
    if(names.has('馬超')&&(res.kills||0)>=800) unlock('jin_machao',{kills:res.kills});
    if(no===71&&names.has('黄忠')) unlock('old_strong',{stage:no});
    if(no===74) unlock('flood_seven',{stage:no});
    if(no===75&&(res.hits||0)>=30) unlock('scrape_bone',{hits:res.hits});
    if(no===95&&(res.kills||0)<=20) unlock('empty_city',{kills:res.kills});
    if(no===91) unlock('memorial',{stage:no});
    if(no===104) unlock('wuzhang_star',{stage:no});
    if(no===105) unlock('dead_kongming',{stage:no});
    if(no===120&&clearedCount()>=120) unlock('unification',{stages:clearedCount()});
    if(hasAll(names,['諸葛亮','龐統'])) unlock('dragon_phoenix',{stage:no});
    if((res.kills||0)>=1000) unlock('ikkitousen',{kills:res.kills});
    checkCollection();
  }
  function checkCollection(){
    if(['関羽','張飛','趙雲','馬超','黄忠'].every(hasUnlockedHero)) unlock('five_tigers',{});
    const n=unlockedHeroIds().size;
    if(n>=100) unlock('hundred_flowers',{count:n});
  }
  function event(type,data){
    if(type==='kizunaFuse') unlock('kizuna_first',data||{});
    else if(type==='readerOpen') unlock('reader',data||{});
    checkCollection();
  }
  function all(){
    const S=saveObj();
    return DEFS.map(d=>Object.assign({},d,{unlocked:!!(S&&S.achievements&&S.achievements[d.id]),state:S&&S.achievements&&S.achievements[d.id]}));
  }

  window.ACH={defs:DEFS,byId:DEF_BY_ID,all,unlock,unlocked,event,onRunEnd,clearedCount,unlockedHeroIds,checkCollection};
})();
