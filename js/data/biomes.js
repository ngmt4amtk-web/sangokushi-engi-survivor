// biomes.js — 章番号→バイオーム系統マッピング
// 系統: plain(平原・既定) / city(城内・市街) / water(水上・川辺) / snow(雪原) / jungle(南蛮)
window.BIOMES = (function(){
  // --- 割当根拠 ---
  // water: 長江・赤壁・水戦・川渡り系
  //   7=磐河(河), 38=三顧前後の長江, 45=三江口/群英会, 46=草船借箭/苦肉,
  //   47=偽降/連環, 48=横槊賦詩(長江), 49=七星壇/三江口の火, 50=華容道(水辺),
  //   55=劉郎浦追撃(水路), 61=趙雲江截, 66=単刀赴会(呉の船上),
  //   67=逍遥津(川), 68=甘寧百騎, 74=水淹七軍,
  //   75=白衣渡江(長江), 82=呉征戦(水路), 83=猇亭(長江岸), 84=連営七百里(夷陵・川辺)
  //
  // snow: 冬戦・雪中奇襲系
  //   94=雪に乗じて羌兵を破る, 108=丁奉・雪中短兵
  //
  // jungle: 南蛮・瀘水・熱帯系
  //   87=南征/孟獲初擒, 88=瀘水再渡/再擒, 89=四度五度捕縛, 90=藤甲焼/七擒, 91=瀘水祭り出師
  //
  // city: 宮廷・洛陽/許都・城内の変・都市攻防
  //   3=温明園廃立(洛陽宮), 4=孟徳献刀(相国府), 9=朝門一突き(都城内),
  //   13=帝車救え弘農(落ち), 20=許田の狩り/玉帯密詔(宮廷),
  //   21=煮酒論英雄(曹邸), 23=裸衣罵賊/吉平毒(宮中),
  //   29=于吉斬り(城内), 63=厳顔捕縛(涪城内), 79=七歩の詩(宮廷),
  //   80=曹丕簒奪/漢中王即位(都城), 105=錦囊の計魏延誅殺(陣中城),
  //   107=魏政司馬帰す(洛陽), 114=曹髦南闕に死す(宮廷内),
  //   119=偽降の計(成都城), 120=三分一統(建業)
  //
  // 残余はすべて plain

  const byNo = {};

  // water
  [7,38,45,46,47,48,49,50,55,61,66,67,68,74,75,82,83,84].forEach(n=>{ byNo[n]='water'; });
  [39,40,90,103].forEach(n=>{ byNo[n]='scorched'; }); // 火計の章=焦土

  // snow
  [94,108].forEach(n=>{ byNo[n]='snow'; });

  // jungle
  [87,88,89,90,91].forEach(n=>{ byNo[n]='jungle'; });

  // city
  [3,4,9,13,20,21,23,29,63,79,80,105,107,114,119,120].forEach(n=>{ byNo[n]='city'; });

  // ── 環境粒子設定 ──────────────────────────────────────────────────
  // cap: 通常時の最大粒子数 / capLow: 軽量化時(半減)
  // spawn: 1フレームに生成する割合(0〜1, dt×rateで補正)
  // 各粒子オブジェクト: { x, y, vx, vy, r, alpha, life, maxLife, col, blink?, kind }
  const ENVI_CFG = {
    snow: {
      cap: 36, capLow: 18,
      spawn(dt, cam, CW, CH, rnd) {
        const x = cam.x + rnd(-CW * 0.55, CW * 0.55);
        const y = cam.y - CH * 0.55;
        const sz = Math.random() < 0.38 ? 2.5 : 1.5;
        return { x, y, vx: rnd(14, 28), vy: rnd(22, 44), r: sz,
          life: rnd(3.5, 6.5), maxLife: 6.5, col: '#ffffff', blink: false, kind: 'snow' };
      },
    },
    water: {
      cap: 28, capLow: 14,
      spawn(dt, cam, CW, CH, rnd) {
        const x = cam.x + rnd(-CW * 0.52, CW * 0.52);
        const y = cam.y + rnd(-CH * 0.50, CH * 0.50);
        return { x, y, vx: rnd(8, 18), vy: rnd(-4, 4), r: 1.5,
          life: rnd(0.4, 1.0), maxLife: 1.0, col: '#e8f4ff', blink: true, kind: 'water' };
      },
    },
    jungle: {
      cap: 30, capLow: 15,
      spawn(dt, cam, CW, CH, rnd) {
        const x = cam.x + rnd(-CW * 0.52, CW * 0.52);
        const y = cam.y + rnd(-CH * 0.52, CH * 0.52);
        return { x, y, vx: rnd(-12, 12), vy: rnd(-14, 14), r: rnd(2, 3.5),
          life: rnd(2.8, 5.5), maxLife: 5.5, col: Math.random() < 0.5 ? '#7ec850' : '#b2e480', blink: false, kind: 'jungle' };
      },
    },
    city: {
      cap: 24, capLow: 12,
      spawn(dt, cam, CW, CH, rnd) {
        const isSpark = Math.random() < 0.06;
        const x = cam.x + rnd(-CW * 0.52, CW * 0.52);
        const y = cam.y + rnd(-CH * 0.52, CH * 0.52);
        if (isSpark) {
          return { x, y, vx: rnd(-30, 30), vy: rnd(-60, -20), r: 1.8,
            life: rnd(0.6, 1.1), maxLife: 1.1, col: '#ffaa44', blink: true, kind: 'spark' };
        }
        return { x, y, vx: rnd(5, 16), vy: rnd(-6, 6), r: 1.2,
          life: rnd(1.8, 3.8), maxLife: 3.8, col: '#d4c8b0', blink: false, kind: 'dust' };
      },
    },
    scorched: { // 焦土: 火の粉が多く舞い、灰が漂う
      cap: 30, capLow: 14,
      spawn(dt, cam, CW, CH, rnd) {
        const isSpark = Math.random() < 0.45;
        const x = cam.x + rnd(-CW * 0.52, CW * 0.52);
        const y = cam.y + rnd(-CH * 0.52, CH * 0.52);
        if (isSpark) {
          return { x, y, vx: rnd(-24, 24), vy: rnd(-70, -28), r: rnd(1.4, 2.2),
            life: rnd(0.7, 1.4), maxLife: 1.4, col: '#ff8833', blink: true, kind: 'spark' };
        }
        return { x, y, vx: rnd(-10, 10), vy: rnd(-14, -4), r: 1.4,
          life: rnd(2.0, 4.0), maxLife: 4.0, col: '#8a837c', blink: false, kind: 'ash' };
      },
    },
    plain: {
      cap: 20, capLow: 10,
      spawn(dt, cam, CW, CH, rnd) {
        const x = cam.x + rnd(-CW * 0.55, CW * 0.55);
        const y = cam.y + rnd(-CH * 0.52, CH * 0.52);
        return { x, y, vx: rnd(18, 34), vy: rnd(-4, 4), r: 1.2,
          life: rnd(1.5, 3.5), maxLife: 3.5, col: '#c8b870', blink: false, kind: 'sand' };
      },
    },
  };

  return { byNo, def: 'plain', ENVI_CFG };
})();
