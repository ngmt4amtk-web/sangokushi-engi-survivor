// weapon_icons.js — 14武器キーごとの UI 用 SVGイラスト。
// 暗背景前提・金色系。viewBox 0 0 48 48。戦闘中の手続きドット絵とは別物(UIアイコン専用)。
// 使い方: WEAPON_ICONS[gen.weapon] で svg文字列を取得し innerHTML へ。
(function(){
  // 共通パレット
  const G='#e8c060', GL='#ffe9a8', GD='#b8893a', ST='#2a2118', WD='#7a5a38', RED='#e06a4a', BL='#7fb0e0', PUR='#b07fd0', GRN='#6fc06f', FIRE='#ff8a3a';
  // shorthand: wrapに金フィルタ系の defs を入れず軽量に。strokeは暗色で縁取り。
  function svg(inner){
    return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block">${inner}</svg>`;
  }

  const ICONS = {
    // 剣 — まっすぐな両刃の直刀＋十字鍔
    sword: svg(`
      <line x1="24" y1="6" x2="24" y2="33" stroke="${ST}" stroke-width="6" stroke-linecap="round"/>
      <line x1="24" y1="6" x2="24" y2="33" stroke="${G}" stroke-width="3.4" stroke-linecap="round"/>
      <line x1="24" y1="7" x2="24" y2="30" stroke="${GL}" stroke-width="1.1"/>
      <rect x="15" y="31" width="18" height="3.6" rx="1.6" fill="${ST}"/>
      <rect x="15.5" y="31.4" width="17" height="2.8" rx="1.4" fill="${GD}"/>
      <rect x="22" y="34" width="4" height="8" rx="1.4" fill="${WD}"/>
      <circle cx="24" cy="43" r="2.4" fill="${G}"/>`),

    // 槍 — 長い柄＋菱形穂先
    spear: svg(`
      <line x1="11" y1="40" x2="34" y2="10" stroke="${WD}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M36 4 L40 14 L34 16 L31 9 Z" fill="${ST}"/>
      <path d="M36 5.6 L38.6 13 L33.6 14.6 L31.6 9.4 Z" fill="${G}"/>
      <path d="M35.4 6.2 L37.4 11.6 L34.4 12.6 Z" fill="${GL}"/>
      <circle cx="33" cy="16.5" r="2.2" fill="${RED}"/>`),

    // 戟 — 槍＋横刃(月牙)
    halberd: svg(`
      <line x1="13" y1="42" x2="33" y2="8" stroke="${WD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M34 4 L37 12 L32 13.5 L30 7 Z" fill="${G}" stroke="${ST}" stroke-width="0.8"/>
      <path d="M31 14 Q44 12 41 24 Q38 19 31 19 Z" fill="${G}" stroke="${ST}" stroke-width="0.8"/>
      <path d="M31 14 Q40 13 39 21" fill="none" stroke="${GL}" stroke-width="1"/>`),

    // 大刀(青龍偃月刀) — 反りのある幅広刀身
    podao: svg(`
      <line x1="14" y1="42" x2="28" y2="16" stroke="${WD}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M28 16 Q30 6 40 6 Q42 16 33 22 Q30 20 28 16 Z" fill="${ST}"/>
      <path d="M28.6 16 Q30.6 8 38.6 7.6 Q40 15.4 32.6 20.6 Q30.4 18.4 28.6 16 Z" fill="${G}"/>
      <path d="M30 13 Q33 9 38 8.6" fill="none" stroke="${GL}" stroke-width="1.1"/>
      <circle cx="27" cy="18.5" r="2.4" fill="${RED}"/>`),

    // 双 — 交差した2本の短剣
    twin: svg(`
      <g stroke="${ST}" stroke-width="5" stroke-linecap="round"><line x1="13" y1="38" x2="34" y2="11"/><line x1="35" y1="38" x2="14" y2="11"/></g>
      <g stroke="${G}" stroke-width="2.8" stroke-linecap="round"><line x1="13" y1="38" x2="34" y2="11"/><line x1="35" y1="38" x2="14" y2="11"/></g>
      <g stroke="${GL}" stroke-width="0.9"><line x1="14" y1="37" x2="33" y2="12"/><line x1="34" y1="37" x2="15" y2="12"/></g>
      <circle cx="13" cy="39" r="2.2" fill="${GD}"/><circle cx="35" cy="39" r="2.2" fill="${GD}"/>`),

    // 弓 — 湾曲した弓＋弦＋矢
    bow: svg(`
      <path d="M16 6 Q34 24 16 42" fill="none" stroke="${ST}" stroke-width="5" stroke-linecap="round"/>
      <path d="M16 6 Q34 24 16 42" fill="none" stroke="${G}" stroke-width="3" stroke-linecap="round"/>
      <line x1="16" y1="6" x2="16" y2="42" stroke="${GL}" stroke-width="1.1"/>
      <line x1="16" y1="24" x2="40" y2="24" stroke="${WD}" stroke-width="2"/>
      <path d="M40 24 L34 21 L34 27 Z" fill="${G}"/>`),

    // 弩 — 横木＋本体＋装填された矢
    crossbow: svg(`
      <line x1="8" y1="18" x2="40" y2="18" stroke="${ST}" stroke-width="5" stroke-linecap="round"/>
      <line x1="8" y1="18" x2="40" y2="18" stroke="${G}" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="20" y="16" width="20" height="5" rx="1.5" fill="${WD}"/>
      <line x1="22" y1="18.5" x2="44" y2="18.5" stroke="${GL}" stroke-width="1.6"/>
      <path d="M44 18.5 L39 15.5 L39 21.5 Z" fill="${G}"/>
      <rect x="24" y="21" width="4" height="14" rx="1.5" fill="${WD}"/>`),

    // 戦輪(チャクラム) — 環状の刃
    chakram: svg(`
      <circle cx="24" cy="24" r="15" fill="none" stroke="${ST}" stroke-width="6"/>
      <circle cx="24" cy="24" r="15" fill="none" stroke="${G}" stroke-width="3.4"/>
      <circle cx="24" cy="24" r="9" fill="none" stroke="${GD}" stroke-width="2"/>
      <g fill="${GL}"><circle cx="24" cy="9" r="2"/><circle cx="39" cy="24" r="2"/><circle cx="24" cy="39" r="2"/><circle cx="9" cy="24" r="2"/></g>`),

    // 剛(鞭・鎚) — 連節鞭/メイス。節のある棒
    mace: svg(`
      <line x1="12" y1="40" x2="26" y2="20" stroke="${WD}" stroke-width="3.4" stroke-linecap="round"/>
      <g fill="${G}" stroke="${ST}" stroke-width="0.8">
        <rect x="24" y="14" width="6" height="6" rx="1.5"/>
        <rect x="27" y="9" width="6" height="6" rx="1.5"/>
        <rect x="30" y="4" width="7" height="7" rx="2"/></g>
      <circle cx="33.5" cy="7.5" r="1.6" fill="${GL}"/>`),

    // 斧 — 重い斧頭＋柄
    axe: svg(`
      <line x1="20" y1="42" x2="26" y2="8" stroke="${WD}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M24 8 Q40 8 40 22 Q30 22 24 18 Z" fill="${ST}"/>
      <path d="M24.6 9 Q38 9.4 38 20.6 Q30 20.6 24.6 17 Z" fill="${G}"/>
      <path d="M27 11 Q35 11 36.6 18" fill="none" stroke="${GL}" stroke-width="1.1"/>
      <path d="M24 8 Q12 9 10 21 Q19 20 24 17 Z" fill="${GD}" stroke="${ST}" stroke-width="0.8"/>`),

    // 突撃(騎) — 疾走する馬と槍突進
    charge: svg(`
      <path d="M10 36 Q16 22 28 22 L36 22 Q40 22 40 28 L36 30 L30 30 Q24 34 18 36 Z" fill="${ST}"/>
      <path d="M11 35 Q17 24 28 24 L35 24 Q38 24 38 27.5 L35 28.6 L30 28.6 Q24 32.4 18 34.6 Z" fill="${G}"/>
      <path d="M36 22 Q40 16 38 12" fill="none" stroke="${GL}" stroke-width="2" stroke-linecap="round"/>
      <g stroke="${BL}" stroke-width="2.2" stroke-linecap="round" opacity="0.85"><line x1="4" y1="20" x2="13" y2="20"/><line x1="3" y1="26" x2="11" y2="26"/><line x1="5" y1="32" x2="12" y2="32"/></g>
      <g stroke="${WD}" stroke-width="2.2" stroke-linecap="round"><line x1="16" y1="36" x2="16" y2="44"/><line x1="30" y1="34" x2="30" y2="44"/></g>`),

    // 伏兵(旗) — 軍旗
    summon: svg(`
      <line x1="14" y1="4" x2="14" y2="44" stroke="${WD}" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="14" cy="4.5" r="2.6" fill="${G}"/>
      <path d="M14 7 L40 9 L34 16 L40 23 L14 25 Z" fill="${ST}"/>
      <path d="M14 8.4 L37.4 10.2 L32.4 16 L37.4 21.8 L14 23.6 Z" fill="${RED}"/>
      <text x="24" y="19.5" font-size="9" font-weight="900" fill="${GL}" text-anchor="middle" font-family="serif">兵</text>`),

    // 火計(炎) — 燃え上がる炎
    fire: svg(`
      <path d="M24 6 C30 14 34 16 33 26 C40 22 38 34 30 40 C34 34 30 32 27 34 C30 28 24 28 25 22 C22 26 18 24 19 30 C16 24 18 18 22 16 C21 22 26 20 24 6 Z" fill="${ST}"/>
      <path d="M24 9 C29 16 32 18 31 26 C36 23 35 32 29 37 C32 32 28 31 26 33 C28 27 23 28 24 22 C21 25 19 24 19 28 C17 24 19 19 22 18 C22 22 26 21 24 9 Z" fill="${FIRE}"/>
      <path d="M24 16 C27 21 28 23 27 28 C30 26 29 31 26 34 C28 30 25 30 24 31 C25 27 22 28 23 24 C24 21 25 20 24 16 Z" fill="${GL}"/>`),

    // 陣(array) — 八卦/陣形の幾何紋
    array: svg(`
      <circle cx="24" cy="24" r="16" fill="none" stroke="${ST}" stroke-width="5"/>
      <circle cx="24" cy="24" r="16" fill="none" stroke="${G}" stroke-width="2.4"/>
      <rect x="14.5" y="14.5" width="19" height="19" fill="none" stroke="${GD}" stroke-width="2" transform="rotate(45 24 24)"/>
      <line x1="24" y1="8" x2="24" y2="40" stroke="${G}" stroke-width="1.4"/>
      <line x1="8" y1="24" x2="40" y2="24" stroke="${G}" stroke-width="1.4"/>
      <circle cx="24" cy="24" r="3.4" fill="${GL}"/>`),
  };

  // 戟以外の保険: 未知キーは剣を返す
  window.WEAPON_ICONS = ICONS;
  window.weaponIconSvg = function(key){ return ICONS[key] || ICONS.sword; };
})();
