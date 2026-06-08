// weapons.js — 無双Origins流 武器種のベース性能と系統(KIND)別パラメータ
// 武将(generals.js)の stat はこのベースに掛かる倍率。最終値 = base × general.stat × levelMul × playerBuff
// KIND: arc(扇/薙ぎ) proj(弾) orbit(旋回) nova(衝撃波) dash(突進) summon(召喚) zone(地面) field(自機オーラ) buff(味方強化)

window.WBASE = {
  // ── 近接アーク系 ───────────────────────────────
  sword:   {kind:'arc',  dmg:14, area:80,  cd:0.95, amount:1, knock:1.0, arcDeg:112, reach:82,  hue:200, life:0.16},
  podao:   {kind:'arc',  dmg:30, area:120, cd:1.55, amount:1, knock:1.7, arcDeg:160, reach:120, hue:140, life:0.22},
  twin:    {kind:'arc',  dmg:7,  area:58,  cd:0.52, amount:2, knock:0.7, arcDeg:120, reach:58,  hue:300, life:0.12},
  axe:     {kind:'arc',  dmg:42, area:104, cd:1.85, amount:1, knock:2.1, arcDeg:70,  reach:104, hue:30,  life:0.24},
  // ── 弾系 ───────────────────────────────────────
  spear:   {kind:'proj', dmg:17, area:24,  cd:1.05, amount:1, knock:1.0, speed:760, range:240, pierce:4, aim:'facing', hue:190},
  bow:     {kind:'proj', dmg:15, area:14,  cd:0.95, amount:1, knock:0.6, speed:620, range:560, pierce:1, aim:'nearest', hue:60},
  crossbow:{kind:'proj', dmg:8,  area:13,  cd:1.30, amount:5, knock:0.5, speed:660, range:520, pierce:1, aim:'facing', spreadDeg:46, hue:50},
  chakram: {kind:'proj', dmg:13, area:20,  cd:1.40, amount:1, knock:1.0, speed:500, range:300, pierce:99,aim:'facing', boomerang:true, hue:175},
  // ── 旋回 ───────────────────────────────────────
  halberd: {kind:'orbit',dmg:8,  area:72,  cd:0.40, amount:2, knock:1.0, orbitR:72,  spin:2.2, hue:0},
  // ── 衝撃波 ─────────────────────────────────────
  mace:    {kind:'nova', dmg:22, area:112, cd:1.20, amount:1, knock:2.3, hue:25},
  // ── 突進 ───────────────────────────────────────
  charge:  {kind:'dash', dmg:24, area:46,  cd:1.45, amount:1, knock:1.5, len:280, speed:900, pierce:99, hue:355},
  // ── 召喚 ───────────────────────────────────────
  summon:  {kind:'summon',dmg:15,area:30,  cd:3.6,  amount:2, knock:0.8, life:8.0, sAtkCd:0.55,sHp:3, sSpeed:128, hue:115},
  // ── 火計(地面) ─────────────────────────────────
  fire:    {kind:'zone', dmg:7,  area:88,  cd:2.6,  amount:1, knock:0,   life:3.2, tick:0.5, aim:'nearest', hue:18},
  // ── 軍略の陣(自機オーラ) ───────────────────────
  array:   {kind:'field',dmg:10, area:118, cd:0.5,  amount:1, knock:0,   tick:0.4, slow:0.4, hue:265},
  // ── 号令/鼓舞(味方強化・無攻撃) ─────────────────
  aura:    {kind:'buff', dmg:0,  area:0,   cd:1.0,  amount:1, knock:0,   buffDmg:0.10, buffArea:0.04, buffCd:0.03},
};

// 武器レベル(1..8)による成長
window.WLEVEL = {
  MAX: 8,
  dmgMul:  l => 1 + (l-1)*0.15,
  areaMul: l => 1 + (l-1)*0.045,
  cdMul:   l => Math.max(0.55, 1 - (l-1)*0.045),
  // amount(発射/兵/刃 数)の追加: 系統ごとに増え方が違う
  amountAdd: (l, kind) => {
    if (kind==='proj' || kind==='summon' || kind==='crossbow') return (l>=3?1:0)+(l>=5?1:0)+(l>=7?1:0)+(l>=8?1:0);
    if (kind==='orbit') return (l>=4?1:0)+(l>=7?1:0);
    if (kind==='arc')   return (l>=5?1:0)+(l>=8?1:0);
    return (l>=6?1:0);
  },
  pierceAdd: l => (l>=4?1:0)+(l>=7?2:0),
};

// レア度ごとの最大同時装備や排出は gacha.js / state 側で扱う
window.RARITY_INFO = {
  5:{name:'UR', color:'#ff4081', glow:'#ff80ab', stars:5},
  4:{name:'SSR',color:'#ffd54f', glow:'#ffe082', stars:4},
  3:{name:'SR', color:'#ba68c8', glow:'#ce93d8', stars:3},
  2:{name:'R',  color:'#4fc3f7', glow:'#81d4fa', stars:2},
  1:{name:'N',  color:'#b0bec5', glow:'#cfd8dc', stars:1},
};

window.FACTION_INFO = [
  {name:'蜀', color:'#e2403a', dark:'#7a1410'},
  {name:'魏', color:'#3f7fd0', dark:'#16315e'},
  {name:'呉', color:'#3aa856', dark:'#10401f'},
  {name:'群', color:'#9a8c7a', dark:'#4a4036'},
];
