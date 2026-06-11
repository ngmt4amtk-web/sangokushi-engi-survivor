// ults.js — 武将別必殺技データ。未定義武将は武器種から必ずフォールバックする。
(function(){
  const SPECIAL={
    '劉備':{name:'仁徳の号令',prim:'heal_rally',quote:'民を捨てては行けぬ!',params:{heal:0.34,shield:0.22,dur:4.2}},
    '関羽':{name:'青龍偃月・冷艶鋸',prim:'greatslash',quote:'酒の冷めぬ間に、戻る',params:{seconds:8.2,hits:4,arc:178,reach:245,knock:2.1}},
    '張飛':{name:'長坂橋の大喝',prim:'roar',quote:'燕人張飛ここに在り!',params:{seconds:4.0,stun:2.5,knock:2.8,radius:920}},
    '趙雲':{name:'七進七出',prim:'dashes',quote:'常山の趙子龍、ここに在り!',params:{seconds:8.0,count:7,width:42,len:180}},
    '諸葛亮':{name:'東南の風',prim:'firestorm',quote:'万事備わる、ただ東風を欠くのみ、今こそ!',params:{seconds:8.0,count:13,dur:3.6,radius:58}},
    '龐統':{name:'連環の計',prim:'roar',quote:'鎖もて繋げ、逃さぬ',params:{seconds:3.4,stun:3.4,knock:1.1,radius:960}},
    '黄忠':{name:'百歩穿楊',prim:'snipe',quote:'老黄忠の矢、見るがよい!',params:{seconds:8.4,count:3}},
    '馬超':{name:'西涼の錦旗',prim:'raid',quote:'父の仇、逃しはせぬ!',params:{seconds:8.0,count:7,dur:3.4}},
    '魏延':{name:'反骨の刃',prim:'greatslash',quote:'誰か敢えて我を殺さんや!',params:{seconds:8.0,hits:3,arc:190,reach:230,knock:1.8}},
    '姜維':{name:'九伐中原',prim:'dashes',quote:'丞相の遺志、ここに在り!',params:{seconds:8.8,count:9,width:40,len:170}},
    '曹操':{name:'乱世の奸雄',prim:'berserk',quote:'治世の能臣、乱世の奸雄、それが何か?',params:{dur:4.8,dmg:0.62,cd:0.72,move:0.20,lifesteal:0.018}},
    '夏侯惇':{name:'拔矢啖睛',prim:'berserk',quote:'父精母血、棄つべからず!',params:{dur:4.6,dmg:1.05,cd:0.62,move:0.18,lifesteal:0.02,hpCost:0.20}},
    '夏侯淵':{name:'神速',prim:'dashes',quote:'三日で五百里、六日で千里!',params:{seconds:7.4,count:6,width:38,len:205}},
    '張遼':{name:'遼来来',prim:'roar',quote:'泣く子も黙る張文遠とは俺のことよ!',params:{seconds:5.0,stun:2.0,knock:2.2,radius:900}},
    '許褚':{name:'裸衣の虎痴',prim:'berserk',quote:'虎痴を知らぬか!',params:{dur:5.0,dmg:0.72,cd:0.78,move:0.10,lifesteal:0.025}},
    '典韋':{name:'双鉄戟の門',prim:'spin',quote:'賊め、主公には近寄らせぬ!',params:{seconds:7.6,dur:4.2,radius:132,move:0.22,size:1.55}},
    '司馬懿':{name:'冢虎、動かず',prim:'timeslow',quote:'謀事は人に在り、成事は天に在り',params:{dur:4.4,slow:0.64}},
    '孫堅':{name:'江東の虎嘯',prim:'greatslash',quote:'江東の虎、見参!',params:{seconds:8.0,hits:3,arc:182,reach:230,knock:1.9}},
    '孫策':{name:'小覇王の突撃',prim:'dashes',quote:'天下は、駆けて取る!',params:{seconds:7.8,count:6,width:42,len:190}},
    '孫権':{name:'呉王の号令',prim:'heal_rally',quote:'全軍、川を背に戦え!',params:{heal:0.26,shield:0.28,dur:4.5}},
    '周瑜':{name:'赤壁の業火',prim:'firestorm',quote:'曹軍百万、この江で灰にせよ!',params:{seconds:8.4,count:14,dur:3.8,radius:60}},
    '陸遜':{name:'火焼連営七百里',prim:'firewall',quote:'白面書生と侮ったな',params:{seconds:8.2,dur:4.0,width:145,speed:155}},
    '太史慈':{name:'義士の強弓',prim:'volley',quote:'丈夫たる者、不世の功を立つべし!',params:{seconds:7.6,count:34,pierce:4}},
    '甘寧':{name:'百騎劫営',prim:'raid',quote:'鈴の音を聞いたら甘興覇と知れ!',params:{seconds:7.8,count:6,dur:3.0}},
    '呂蒙':{name:'白衣渡江',prim:'timeslow',quote:'呉下の阿蒙にあらず!',params:{dur:4.0,slow:0.58}},
    '黄蓋':{name:'苦肉の計',prim:'berserk',quote:'この老骨、まだ焼けておらぬわ!',params:{dur:5.0,dmg:0.42,cd:0.75,move:0.12,lifesteal:0.018,lostHpDmg:1.05}},
    '呂布':{name:'方天画戟・無双',prim:'spin',quote:'我が戟の前に立てる者なし!',params:{seconds:9.2,dur:4.8,radius:168,move:0.26,size:1.95}},
    '董卓':{name:'暴虐の相国',prim:'roar',quote:'天下は、わしのものよ',params:{seconds:4.8,stun:2.0,knock:2.4,radius:900}},
    '孟獲':{name:'七縦の蛮勇',prim:'berserk',quote:'何度でも来るわ!',params:{dur:4.8,dmg:0.55,cd:0.78,move:0.18,lifesteal:0.02,heal:0.12}},
  };

  const DEFAULT_BY_WEAPON={
    sword:{prim:'greatslash',params:{seconds:6.0,hits:2,arc:140,reach:168,knock:1.0},suffix:'奥義'},
    podao:{prim:'greatslash',params:{seconds:7.0,hits:3,arc:170,reach:215,knock:1.6},suffix:'奥義'},
    twin:{prim:'greatslash',params:{seconds:6.3,hits:4,arc:155,reach:165,knock:0.9},suffix:'奥義'},
    spear:{prim:'dashes',params:{seconds:6.6,count:5,width:36,len:170},suffix:'奥義'},
    charge:{prim:'dashes',params:{seconds:6.8,count:5,width:42,len:190},suffix:'奥義'},
    halberd:{prim:'spin',params:{seconds:6.8,dur:3.8,radius:126,move:0.18,size:1.45},suffix:'奥義'},
    bow:{prim:'volley',params:{seconds:6.4,count:26,pierce:3},suffix:'奥義'},
    crossbow:{prim:'volley',params:{seconds:6.5,count:30,pierce:2,fan:true},suffix:'奥義'},
    chakram:{prim:'berserk',params:{dur:4.0,dmg:0.46,cd:0.80,move:0.15,lifesteal:0.012},suffix:'奥義'},
    mace:{prim:'berserk',params:{dur:4.0,dmg:0.50,cd:0.84,move:0.08,lifesteal:0.016},suffix:'奥義'},
    axe:{prim:'berserk',params:{dur:4.0,dmg:0.52,cd:0.86,move:0.08,lifesteal:0.014},suffix:'奥義'},
    summon:{prim:'berserk',params:{dur:4.0,dmg:0.42,cd:0.82,move:0.12,lifesteal:0.012},suffix:'奥義'},
    fire:{prim:'firestorm',params:{seconds:6.8,count:10,dur:3.4,radius:54},suffix:'奥義'},
    array:{prim:'bolt',params:{seconds:6.6,count:8,radius:64},suffix:'奥義'},
    aura:{prim:'heal_rally',params:{heal:0.22,shield:0.18,dur:3.8},suffix:'奥義'},
  };
  for(const k of Object.keys(window.WBASE||{})){
    if(!DEFAULT_BY_WEAPON[k]) DEFAULT_BY_WEAPON[k]={prim:'berserk',params:{dur:4.0,dmg:0.45,cd:0.82,move:0.12,lifesteal:0.012},suffix:'奥義'};
  }

  function copy(o){ return JSON.parse(JSON.stringify(o)); }
  function forGeneral(g){
    g=g||{};
    const sp=SPECIAL[g.name];
    if(sp) return copy(sp);
    const base=copy(DEFAULT_BY_WEAPON[g.weapon]||{prim:'berserk',params:{dur:4.0,dmg:0.42,cd:0.82,move:0.12},suffix:'奥義'});
    const wname=g.weaponName || (window.WTYPE&&window.WTYPE[g.weapon]&&window.WTYPE[g.weapon].jp) || '武';
    base.name=wname+(base.suffix||'奥義');
    base.quote=(g.voice&&g.voice.trim()) || ((g.name||'武将')+'、推して参る!');
    delete base.suffix;
    return base;
  }

  window.ULTS={MAX:70,KILL:{grunt:1,elite:15,boss:40},SPECIAL,DEFAULT_BY_WEAPON,forGeneral};
})();
