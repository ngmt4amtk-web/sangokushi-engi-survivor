// evolutions.js — 武器EVO(進化)。武将名 → 条件と効果。
// 条件: その武将の武器がLv MAX(8) かつ needPassive をneedLv以上で所持。
// mul: 進化後の倍率/加算(engine が effective stat 計算後に適用)。
window.EVOLUTIONS = {
  関羽:   {need:'might',  needLv:3, name:'青龍偃月斬', desc:'前方360°の全方位薙ぎに進化。一閃が群を断つ',
           mul:{dmg:1.6, area:1.25, arcDeg:360}},
  呂布:   {need:'horse',  needLv:3, name:'無双乱舞',   desc:'画戟の旋回が二重化、半径と威力が跳ね上がる',
           mul:{dmg:1.5, amount:2, orbitR:1.4}},
  典韋:   {need:'fury',   needLv:3, name:'古之悪来',   desc:'双戟の連撃が倍化。当たるほど削れる',
           mul:{dmg:1.4, amount:2, area:1.2}},
  許褚:   {need:'ration', needLv:3, name:'裸衣の闘',   desc:'衝撃波が巨大化、敵を遠くへ吹き飛ばす',
           mul:{dmg:1.45, area:1.4, knock:1.6}},
  徐晃:   {need:'might',  needLv:3, name:'長駆直入',   desc:'大斧の間合いが伸び、陣を一刀両断',
           mul:{dmg:1.4, area:1.5, reach:1.5}},
  張遼:   {need:'swift',  needLv:3, name:'逍遥津',     desc:'突進が連続発動、軌跡に火がつく',
           mul:{dmg:1.4, cd:0.6, trail:1}},
  馬超:   {need:'horse',  needLv:3, name:'西涼鉄騎',   desc:'鉄騎が二段突進、貫いた敵を磨り潰す',
           mul:{dmg:1.35, amount:1, len:1.4}},
  黄忠:   {need:'fury',   needLv:3, name:'定軍神射',   desc:'一矢が必ず急所を貫く神域の狙撃',
           mul:{dmg:1.6, crit:0.3, pierce:3}},
  太史慈: {need:'volley', needLv:2, name:'神亭双射',   desc:'弓と手戟を同時に放つ二連射',
           mul:{dmg:1.3, amount:2}},
  甘寧:   {need:'swift',  needLv:3, name:'百騎劫営',   desc:'錦帆の双刀が嵐の連撃に。手数が倍化',
           mul:{dmg:1.3, amount:2, cd:0.7}},
  周瑜:   {need:'farsight',needLv:3,name:'赤壁業火',   desc:'炎の陣が巨大化し燃え続ける。大軍を呑む',
           mul:{dmg:1.5, area:1.5, life:2.0}},
  陸遜:   {need:'chain',  needLv:3, name:'夷陵連火',   desc:'炎が連鎖し、長蛇の陣を端から焼く',
           mul:{dmg:1.4, amount:2, area:1.3}},
  諸葛亮: {need:'farsight',needLv:3,name:'八陣図・完成',desc:'陣が大きく広がり、捕えた敵を強く縛り削る',
           mul:{dmg:1.5, area:1.6, slowAdd:0.2}},
  司馬懿: {need:'armor',  needLv:3, name:'堅守反撃',   desc:'守りの陣が敵の攻めを跳ね返す反撃陣に',
           mul:{dmg:1.5, area:1.3, slowAdd:0.15}},
  呂蒙:   {need:'banner', needLv:3, name:'白衣渡江',   desc:'伏兵が精鋭化、数を増し背後を突く',
           mul:{dmg:1.4, amount:2, life:1.4}},
  曹操:   {need:'might',  needLv:3, name:'魏武号令',   desc:'号令の効果が倍化。全武将が一段強くなる',
           mul:{buffDmg:2.0, buffArea:2.0, buffCd:2.0}},
};

// ── 汎用進化(二層制・第2層) ───────────────────────────────
// 固有進化(上)を持たない武将のフォールバック。武器系統(kind)→必要兵法と倍率を決定論で対応。
// 条件は固有と同じく武器Lv MAX(8)だが、needLvは一律2と低め、倍率も固有(1.4〜1.6)より弱い1.2前後。
// 演出も控えめ(checkEvolveで generic フラグを見てフラッシュなし)にして固有の特別感を死守する。
window.EVO_GENERIC = {
  arc:    {need:'might',    needLv:2, name:'薙ぎ強化', generic:true, mul:{dmg:1.25, area:1.15}},
  proj:   {need:'volley',   needLv:2, name:'弾幕強化', generic:true, mul:{dmg:1.2,  amount:1, pierce:1}},
  summon: {need:'banner',   needLv:2, name:'伏兵強化', generic:true, mul:{dmg:1.2,  amount:1, life:1.3}},
  dash:   {need:'swift',    needLv:2, name:'突進強化', generic:true, mul:{dmg:1.2,  cd:0.75, len:1.3}},
  buff:   {need:'might',    needLv:2, name:'号令強化', generic:true, mul:{buffDmg:1.5, buffArea:1.4, buffCd:1.4}},
  field:  {need:'farsight', needLv:2, name:'陣強化',   generic:true, mul:{dmg:1.2,  area:1.3, slowAdd:0.1}},
  zone:   {need:'chain',    needLv:2, name:'火計強化', generic:true, mul:{dmg:1.2,  area:1.2, life:1.4}},
  nova:   {need:'fury',     needLv:2, name:'衝撃強化', generic:true, mul:{dmg:1.25, area:1.25, knock:1.3}},
  orbit:  {need:'horse',    needLv:2, name:'旋回強化', generic:true, mul:{dmg:1.2,  amount:1, orbitR:1.25}},
};
// 武将名→進化(固有優先・無ければ武器系統の汎用)を引く共通ヘルパ。UI/engine 双方で使う。
window.evoFor = function(gen){
  return window.EVOLUTIONS[gen.name] || (window.WBASE && window.EVO_GENERIC[window.WBASE[gen.weapon].kind]) || null;
};
