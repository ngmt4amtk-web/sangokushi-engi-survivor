// enemy_arch.js — 敵アーキタイプ定義。
// 演義版 stages.js は自動生成で ENEMY_ARCH の定義を含まないため、ここで復活させる。
// stages.js の pool/recolor/elites は ここで定義した arch キー(grunt/rusher/...)を参照する。
window.ENEMY_ARCH = {
  grunt:   {hp:22,  dmg:8,  speed:52, r:13, xp:2, gold:1, behavior:'chase',  shape:'foot'},
  rusher:  {hp:14,  dmg:7,  speed:96, r:11, xp:2, gold:1, behavior:'chase',  shape:'light'},
  brute:   {hp:120, dmg:16, speed:30, r:22, xp:5, gold:4, behavior:'chase',  shape:'heavy',  knockRes:0.6},
  shield:  {hp:80,  dmg:10, speed:34, r:17, xp:3, gold:3, behavior:'chase',  shape:'shield', dr:0.4},
  archer:  {hp:18,  dmg:9,  speed:40, r:12, xp:2, gold:2, behavior:'ranged', shape:'archer', shootCd:2.2, shotSpeed:230, range:340},
  cavalry: {hp:34,  dmg:12, speed:70, r:15, xp:3, gold:2, behavior:'dasher', shape:'horse',  dashCd:3},
  shaman:  {hp:30,  dmg:8,  speed:36, r:13, xp:3, gold:3, behavior:'ranged', shape:'mage',   shootCd:2.6, shotSpeed:200, range:320, magic:true},
  bomber:  {hp:20,  dmg:6,  speed:64, r:13, xp:2, gold:2, behavior:'chase',  shape:'bomb',   explode:34},
  // ── 脅威系(避け必須・後半/高難易度で増える) ──
  beamer:  {hp:42,  dmg:17, speed:26, r:14, xp:4, gold:4, behavior:'beamer', shape:'mage',   shootCd:3.4, shotSpeed:560, range:540, magic:true}, // 予告→消せない色付き貫通ビーム
  lancer:  {hp:52,  dmg:18, speed:60, r:15, xp:3, gold:3, behavior:'lancer', shape:'horse',  dashCd:3.2}, // 予告→直線を貫通突進
};
