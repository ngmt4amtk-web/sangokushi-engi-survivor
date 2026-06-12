// boss_mechs.js — ボス個性機構テーブル
// spawnBoss() で名前一致時に mech を上書きする。flee は絶対に消さない(runtime.js 側で保護済み)。
// 機構一覧:
//   既存: charge / spin / volley / summon / blink / fireboss / buffAdds / heal / counter / enrage / flee
//   追加: trishot / hexring / rush3 / arrowrain / firetrap / guard
window.BOSS_MECHS = {
  // ── 呂布 ── 最強の個人武勇。三叉戟弾 + 三連突進
  '呂布':        ['trishot','rush3'],

  // ── 黄巾 三兄弟 ── 張角は妖術使い / 張寶も術師 / 張梁は武将
  '張角':        ['hexring','summon'],
  '張寶':        ['hexring','summon'],
  '張梁':        ['rush3','summon'],

  // ── 董卓陣営 ──
  '董卓':        ['summon','guard'],
  '華雄':        ['rush3','charge'],
  '李傕':        ['rush3','volley'],
  '郭汜':        ['rush3','volley'],

  // ── 袁紹陣営 ──
  '顔良':        ['rush3','guard'],
  '文醜':        ['rush3','charge'],
  '袁紹':        ['summon','guard'],

  // ── 曹操陣営 ──
  '曹操':        ['summon','charge'],
  '夏侯惇':      ['rush3','charge'],
  '夏侯淵':      ['arrowrain','volley'],
  '曹仁':        ['guard','summon'],
  '典韋':        ['rush3','guard'],
  '許褚':        ['rush3','charge'],
  '張遼':        ['rush3','volley'],
  '徐晃':        ['arrowrain','charge'],
  '司馬懿':      ['hexring','firetrap'],

  // ── 孫権陣営 ──
  '孫策':        ['rush3','charge'],
  '孫権':        ['summon','guard'],
  '周瑜':        ['firetrap','hexring'],
  '陸遜':        ['firetrap','hexring'],
  '甘寧':        ['rush3','volley'],
  '太史慈':      ['arrowrain','rush3'],
  '呂蒙':        ['firetrap','summon'],

  // ── 劉備陣営(蜀将がbossになる章もあるため割当) ──
  '関羽':        ['trishot','rush3'],
  '張飛':        ['rush3','charge'],
  '趙雲':        ['trishot','rush3'],
  '諸葛亮':      ['hexring','firetrap'],
  '馬超':        ['rush3','trishot'],
  '黄忠':        ['arrowrain','volley'],
  '魏延':        ['rush3','charge'],
  '姜維':        ['trishot','arrowrain'],

  // ── 魏の後期 ──
  '鄧艾':        ['rush3','arrowrain'],
  '鍾会':        ['summon','firetrap'],

  // ── その他の有名武将 ──
  '呂布(大)':    ['trishot','rush3'],
  '孟獲':        ['summon','rush3'],
  '兀突骨':      ['guard','rush3'],
  '孫堅':        ['rush3','charge'],
  '袁術':        ['summon','fireboss'],
  '劉表':        ['guard','summon'],
  '劉璋':        ['guard','summon'],
  '張魯':        ['hexring','summon'],
};
