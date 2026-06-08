// passives.js — 兵法(VS流パッシブ)。レベルアップで武将と並んで3択に出る。max5。
// effect は run の buff スタックに反映される。kindキーは engine 側で解釈。
window.PASSIVES = [
  {id:'might',  name:'虎符',     icon:'🐅', hue:0,   max:5, desc:'全武将の与ダメージ +8%/Lv',
    eff:l=>({dmg:0.08*l})},
  {id:'swift',  name:'神速',     icon:'💨', hue:190, max:5, desc:'攻撃間隔 -6%/Lv（手数増）',
    eff:l=>({cd:0.06*l})},
  {id:'horse',  name:'戦馬',     icon:'🐎', hue:30,  max:5, desc:'移動速度 +10%/Lv',
    eff:l=>({move:0.10*l})},
  {id:'ration', name:'兵糧',     icon:'🍙', hue:45,  max:5, desc:'最大HP +12%/Lv',
    eff:l=>({hp:0.12*l})},
  {id:'salve',  name:'金創薬',   icon:'🧪', hue:120, max:5, desc:'毎秒HP回復 +0.7/Lv',
    eff:l=>({regen:0.7*l})},
  {id:'volley', name:'連弩',     icon:'🎯', hue:55,  max:3, desc:'弾/兵/刃の数 +1（最大+3）',
    eff:l=>({amount:l})},
  {id:'farsight',name:'千里眼',  icon:'👁', hue:265, max:5, desc:'効果範囲 +8%/Lv',
    eff:l=>({area:0.08*l})},
  {id:'armor',  name:'鋼甲',     icon:'🛡', hue:210, max:5, desc:'被ダメージ -6%/Lv',
    eff:l=>({dr:0.06*l})},
  {id:'seal',   name:'玉璽',     icon:'📜', hue:50,  max:5, desc:'経験値 +12%/Lv・軍功 +8%/Lv',
    eff:l=>({xp:0.12*l, gold:0.08*l})},
  {id:'fury',   name:'怒髪',     icon:'🔥', hue:355, max:5, desc:'会心率 +5%/Lv・会心ダメ +15%',
    eff:l=>({crit:0.05*l, critDmg:0.15*(l>0?1:0)})},
  {id:'chain',  name:'連環',     icon:'⛓', hue:175, max:5, desc:'貫通 +1/Lv・効果持続 +10%/Lv',
    eff:l=>({pierce:l, duration:0.10*l})},
  {id:'banner', name:'軍旗',     icon:'🚩', hue:340, max:5, desc:'拾える範囲 +20%/Lv・移動 +3%/Lv',
    eff:l=>({magnet:0.20*l, move:0.03*l})},
];
window.PASSIVE_BY_ID = Object.fromEntries(window.PASSIVES.map(p=>[p.id,p]));
