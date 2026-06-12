// sprites.js — 手続き生成のドット絵。オフスクリーンcanvasにピクセルで描いてキャッシュ→拡大blit。
window.Sprites = (function(){
  const cache = {};
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0);}
  function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return {c,x};}
  function hsl(h,s,l){return `hsl(${h},${s}%,${l}%)`;}

  const FAC = [ // 0蜀 1魏 2呉 3群
    {armor:[0,72,42], armorD:[0,70,28], trim:[45,80,55]},
    {armor:[212,55,46], armorD:[212,55,30], trim:[210,20,80]},
    {armor:[140,55,40], armorD:[140,55,26], trim:[48,75,55]},
    {armor:[35,25,42], armorD:[35,25,28], trim:[40,30,62]},
  ];
  const SKIN=[[28,40,78],[28,45,70],[24,38,64]];
  const OUT='#16100d', INK='#24170f', STEEL='#cdd6e0', STEEL_D='#71808c', WOOD='#7a4a22', GOLD='#f2c14f';

  const LOOKS = {
    '関羽':{h:140,b:2,m:1,hat:'turban',hc:8,longBeard:1,weaponLarge:1},
    '張飛':{h:260,b:1,m:1},
    '劉備':{h:120,b:1,hat:'crown'},
    '趙雲':{h:200,b:0,m:1,hc:'white'},
    '諸葛亮':{h:'white',b:1,hat:'scholar'},
    '黄忠':{h:140,b:3,m:1},
    '馬超':{h:'silver',b:0,m:1,hc:'white'},
    '魏延':{h:150,b:1,m:1},
    '姜維':{h:140,b:0,m:1},
    '龐統':{h:'gray',b:1,hat:'scholar'},
    '曹操':{h:215,b:1,hat:'crown'},
    '夏侯惇':{h:215,b:1,m:1,eyepatch:1},
    '夏侯淵':{h:215,b:1,m:1},
    '張遼':{h:205,b:1,m:1},
    '許褚':{h:30,b:1,fat:1},
    '典韋':{h:'blackiron',b:1},
    '司馬懿':{h:275,b:1,hat:'scholar'},
    '孫堅':{h:0,b:1,m:1,hat:'turban',turbanHue:0},
    '孫策':{h:0,b:0,m:1},
    '孫権':{h:280,b:2,hat:'crown',beardHue:165},
    '周瑜':{h:355,b:0,hat:'scholar',scholarHue:355},
    '太史慈':{h:0,b:1,m:1},
    '甘寧':{h:5,b:1,bell:1},
    '呂蒙':{h:0,b:1},
    '陸遜':{h:350,b:0,hat:'scholar'},
    '黄蓋':{h:10,b:3},
    '呂布':{h:'goldblack',b:1,m:1,hat:'helm',plume:1,hc:8},
    '董卓':{h:35,b:2,fat:1},
    '袁紹':{h:48,b:2,hat:'crown'},
    '華雄':{h:15,b:1,m:1},
    '顔良':{h:40,b:1,m:1},
    '文醜':{h:40,b:1,m:1},
    '孟獲':{h:25,b:1,hat:'none',barbarian:1},
    '鄧艾':{h:215,b:1},
    '鍾会':{h:275,b:0},
    '文鴦':{h:215,b:0,m:1},
    '貂蝉':{h:330,b:0,hat:'none',female:1},
  };

  function rect(x,a,b,w,h,col){x.fillStyle=col;x.fillRect(a,b,w,h);}
  function px(x,a,b,col){x.fillStyle=col;x.fillRect(a,b,1,1);}
  function linePx(x,pts,col){for(const p of pts)px(x,p[0],p[1],col);}
  function colorForHue(h, fallback){
    if(h==='white') return {base:'#e6e8df',dark:'#8b9698',light:'#ffffff'};
    if(h==='silver') return {base:'#c9d2d9',dark:'#68747d',light:'#f4fbff'};
    if(h==='gray') return {base:'#8d8a80',dark:'#4d4a45',light:'#c8c1b1'};
    if(h==='blackiron') return {base:'#343840',dark:'#151820',light:'#727985'};
    if(h==='goldblack') return {base:'#2d261d',dark:'#11100e',light:'#e6b84d',gold:'#f1c24d'};
    if(typeof h!=='number') h=fallback||0;
    return {base:hsl(h,55,42),dark:hsl(h,56,25),light:hsl(h,70,62),gold:GOLD,hue:h};
  }
  function horseColor(hc){
    if(hc==='white'||hc===0) return {base:'#dbe1dc',dark:'#7d8585',light:'#fff9e8',mane:'#b8b8b2'};
    if(hc===8) return {base:'#8d2f22',dark:'#351515',light:'#cc5a3e',mane:'#1b1110'};
    const h=typeof hc==='number'?hc:28;
    return {base:hsl(h,42,34),dark:hsl(h,45,18),light:hsl(h,45,50),mane:'#24160f'};
  }
  function lookFor(g){
    const seed=hash((g&&g.name||'')+(g&&g.weapon||''));
    const src=LOOKS[g&&g.name]||{};
    const fallbackH=FAC[(g&&g.faction)||0] ? FAC[(g&&g.faction)||0].armor[0] : (seed%12)*30;
    const out=Object.assign({
      h:fallbackH,
      b:(seed>>>3)%4,
      m:((seed>>>8)%5)===0?1:0,
      hat:'helm',
      helmVar:(seed>>>5)%3,
      hc:28+((seed>>>10)%3)*6
    },src);
    return out;
  }

  // ── 手描きグリッドテンプレート（シルエットの核。文字=パレットキー） ──
  const PAL_KEYS={K:'out',S:'skin',s:'skinD',H:'hair',A:'base',a:'dark',L:'light',T:'trim',t:'trimD',B:'boot',M:'hbase',m:'hdark',N:'mane',G:'gold'};
  function stamp(x,grid,colors,ox,oy){
    for(let r=0;r<grid.length;r++){const row=grid[r];
      for(let i=0;i<row.length;i++){const ch=row[i]; if(ch==='.')continue;
        x.fillStyle=colors[PAL_KEYS[ch]]||colors.out; x.fillRect(ox+i,oy+r,1,1);}}
  }
  const HERO_BODY=[ // 16幅×14行。帽子(rows0-4)/髭/武器は既存オーバーレイが上書き
    '....KKKKKK......',
    '...KHHHHHHK.....',
    '..KHHHHHHHHK....',
    '..KSSSSSSSSK....',
    '..KSKSSSSKSK....',
    '..KSSSSSSSSK....',
    '..KsSSSSSSsK....',
    '...KsSSSSsK.....',
    '....KKKKKK......',
    '...KLLAAAAK.....',
    '..KSKLAAAAKSK...',
    '..KKKAAAAAKKK...',
    '....KAAAAaK.....',
    '....KTTTTTK.....',
  ];
  const HERO_LEGS=[ // 2フレーム
    ['....KaK.KaK.....','....KBK.KBK.....'],
    ['...KaK...KaK....','...KBK...KBK....'],
  ];
  const SOLDIER_BODY=[ // 12幅×11行(兜込み)
    '...KKKKKK...',
    '..KTTTTTTK..',
    '..KttttttK..',
    '..KSSSSSSK..',
    '..KSKSSKSK..',
    '..KsSSSSsK..',
    '...KKKKKK...',
    '..KLAAAAaK..',
    '.KSKAAAAKSK.',
    '..KKAAAAKK..',
    '...KAAAaK...',
  ];
  const SOLDIER_LEGS=[
    ['...KaK.KaK..','...KBK.KBK..'],
    ['..KaK...KaK.','..KBK...KBK.'],
  ];
  const HORSE_BODY=[ // 20幅×10行(右向き・首は太く、頭は前方やや下へ)
    '..............KKK...',
    '.............KMMMK..',
    '..NN.......KKMMmMK..',
    '.KNNK......KMMMmK...',
    '.KNMK..KKKKNMMMK....',
    '..KMKKMMMMMNMMK.....',
    '..KMMMMMMMMMMMK.....',
    '..KMMMMMMMMMMMK.....',
    '...KMMMMMMMMMK......',
    '...KmMMMMMMmK.......',
  ];
  const HORSE_LEGS=[
    ['....KmK..KmK.KmK....','....KBK..KBK.KBK....'],
    ['...KmK...KmK...KmK..','...KBK...KBK...KBK..'],
  ];
  function heroColors(pal,skin,trim){
    return {out:OUT, skin:hsl(skin[0],skin[1]+5,skin[2]+4), skinD:hsl(Math.max(0,skin[0]-10),skin[1],skin[2]-12),
      hair:'#2a1a12', base:pal.base, dark:pal.dark, light:pal.light||trim, trim:pal.gold||GOLD, trimD:hsl(40,60,38),
      boot:'#2c1c12', gold:GOLD};
  }

  // UI用バスト。既存画面互換のため残す。
  function general(g){
    const key='g'+g.id;
    if(cache[key]) return cache[key];
    const S=28, {c,x}=mk(S,S);
    const seed=hash(g.name+g.weapon);
    const fac=FAC[g.faction];
    const skin=SKIN[seed%3];
    // フィールドスプライトと同じ lookFor パレットで描く(色一致)
    const look=lookFor(g);
    const pal=colorForHue(look.h, fac.armor[0]);
    rect(x,0,0,S,S,hsl(fac.armorD[0],fac.armorD[1],Math.max(8,fac.armorD[2]-14)));
    rect(x,5,20,18,8,pal.base);
    rect(x,5,20,18,2,pal.light||hsl(fac.trim[0],fac.trim[1],fac.trim[2]));
    rect(x,7,24,2,4,pal.dark);
    rect(x,19,24,2,4,pal.dark);
    rect(x,11,17,6,4,hsl(skin[0],skin[1],skin[2]-8));
    rect(x,9,8,10,11,hsl(skin[0],skin[1],skin[2]));
    rect(x,9,8,10,2,hsl(skin[0],skin[1],skin[2]+8));
    rect(x,11,12,2,2,'#23170f'); rect(x,15,12,2,2,'#23170f');
    const beardCol=look.b===3?'#e7e0cf':(look.beardHue!=null?hsl(look.beardHue,45,24):hsl(20,30,18+(seed%3)*4));
    if(look.b===2&&look.longBeard){ rect(x,9,16,10,3,beardCol); rect(x,11,19,6,4,beardCol); rect(x,13,23,2,2,beardCol); }
    else if(look.b===2||look.b===3){ rect(x,9,16,10,3,beardCol); rect(x,11,19,6,3,beardCol); }
    else if(look.b===1){ rect(x,10,16,8,2,beardCol); }
    const cls=(look.hat==='crown')?'lord':(look.hat==='scholar')?'scholar':classOf(g.weapon);
    if(cls==='lord'){
      rect(x,8,4,12,4,hsl(45,80,52)); rect(x,10,2,2,2,hsl(48,85,60)); rect(x,13,1,2,3,hsl(48,90,66)); rect(x,16,2,2,2,hsl(48,85,60));
      rect(x,8,7,12,2,hsl(45,70,40));
    } else if(cls==='scholar'){
      rect(x,7,3,14,6,hsl(220,12,88)); rect(x,7,3,14,2,hsl(220,10,96)); rect(x,7,8,14,1,hsl(220,12,70));
    } else if(cls==='archer'){
      rect(x,8,5,12,5,hsl(fac.trim[0],40,40)); rect(x,8,5,12,2,hsl(fac.trim[0],45,55));
    } else if(look.hat==='turban'){
      const tb=look.turbanHue!=null?hsl(look.turbanHue,80,46):(pal.light||GOLD);
      rect(x,7,4,14,6,tb); rect(x,7,8,14,2,pal.dark); rect(x,5,6,2,3,tb);
    } else {
      rect(x,7,4,14,6,pal.dark);
      rect(x,7,4,14,2,pal.light||hsl(fac.trim[0],fac.trim[1],fac.trim[2]));
      rect(x,13,1,2,4,look.plume?'#d8192c':(pal.light||hsl(fac.trim[0],85,62)));
      rect(x,6,9,2,3,pal.dark);
      rect(x,20,9,2,3,pal.dark);
    }
    drawWeaponGlyph(x, g.weapon, 22, 6);
    cache[key]=c; return c;
  }

  function classOf(w){
    if(w==='aura') return 'lord';
    if(w==='array'||w==='fire') return 'scholar';
    if(w==='bow'||w==='crossbow') return 'archer';
    return 'warrior';
  }
  function drawWeaponGlyph(x, w, ox, oy){
    const set=(a,b,col)=>px(x,ox+a,oy+b,col);
    const line=(pts,col)=>pts.forEach(p=>set(p[0],p[1],col));
    const fire='#ff7a2a';
    switch(w){
      case 'podao': line([[0,0],[1,1],[2,2],[3,3],[4,4],[5,5]],WOOD); set(0,0,STEEL); set(1,0,'#d6ff8a'); break;
      case 'spear': line([[5,0],[4,1],[3,2],[2,3],[1,4],[0,5]],WOOD); set(5,0,STEEL); set(4,1,STEEL); break;
      case 'halberd': line([[5,0],[4,1],[3,2],[2,3],[1,4],[0,5]],WOOD); set(4,0,STEEL); set(5,1,STEEL); break;
      case 'bow': line([[0,0],[1,1],[1,2],[1,3],[0,4]],'#caa050'); line([[0,0],[0,4]],'#eee'); break;
      case 'crossbow': line([[0,1],[1,1],[2,1],[3,1],[4,1]],WOOD); set(2,0,STEEL); set(2,2,STEEL); break;
      case 'twin': line([[0,0],[1,1],[2,2]],STEEL); line([[3,0],[4,1],[5,2]],STEEL); break;
      case 'mace': line([[3,3],[4,4],[5,5]],WOOD); set(2,2,'#9aa'); set(1,1,'#9aa'); set(2,1,'#cdd'); set(1,2,'#cdd'); break;
      case 'axe': line([[3,2],[3,3],[3,4],[3,5]],WOOD); line([[0,1],[1,0],[2,1],[1,2],[0,2]],STEEL); break;
      case 'fire': line([[2,0],[1,2],[3,2],[2,4],[1,3],[3,3]],fire); set(2,2,'#ffd24a'); break;
      case 'array': line([[0,0],[2,0],[4,0],[0,2],[2,2],[4,2],[0,4],[2,4],[4,4]],'#b388ff'); break;
      case 'aura': line([[2,0],[2,4],[0,2],[4,2]],GOLD); set(2,2,'#fff2a8'); break;
      case 'chakram': line([[1,0],[3,0],[0,1],[4,1],[0,3],[4,3],[1,4],[3,4]],STEEL); break;
      default: set(2,2,STEEL);
    }
  }

  function drawHat(x, look, y, pal){
    const hat=look.hat||'helm', trim=look.turbanHue!=null?hsl(look.turbanHue,80,46):pal.light;
    if(hat==='crown'){
      rect(x,4,y+0,8,2,OUT); rect(x,5,y-2,2,3,OUT); rect(x,9,y-2,2,3,OUT);
      rect(x,5,y+0,6,2,GOLD); px(x,6,y-1,'#ffe38a'); px(x,10,y-1,'#ffe38a'); px(x,8,y-2,'#fff0a8');
    } else if(hat==='scholar'){
      const h=look.scholarHue!=null?look.scholarHue:210;
      rect(x,3,y,10,4,OUT); rect(x,4,y,8,3,hsl(h,18,84)); rect(x,5,y,6,1,'#ffffff');
      rect(x,11,y+2,2,5,OUT); rect(x,11,y+2,1,4,hsl(h,20,70));
    } else if(hat==='turban'){
      rect(x,3,y+1,10,4,OUT); rect(x,4,y+1,8,3,trim); rect(x,4,y+3,8,1,pal.dark);
      rect(x,2,y+2,2,2,OUT); rect(x,2,y+2,1,1,trim);
    } else if(hat==='none'){
      const hair=look.female?'#2c1524':(look.barbarian?'#332014':'#2a1a12');
      rect(x,4,y+0,8,3,OUT); rect(x,5,y+0,6,2,hair);
      if(look.female){ px(x,3,y+4,hair); px(x,12,y+4,hair); }
      if(look.barbarian){ px(x,4,y-1,'#e8d35d'); px(x,11,y-1,'#e8d35d'); }
    } else {
      const v=look.helmVar||0;
      rect(x,3,y,10,5,OUT); rect(x,4,y+1,8,3,pal.dark); rect(x,4,y,8,1,pal.light);
      if(v===1){ rect(x,7,y-2,2,3,OUT); rect(x,7,y-2,2,2,pal.light); }
      else if(v===2){ px(x,5,y-1,pal.light); px(x,10,y-1,pal.light); }
      else { rect(x,7,y-2,2,3,pal.light); }
      if(look.plume){
        rect(x,6,y-5,1,5,'#8b101c'); rect(x,5,y-6,1,4,'#d8192c');
        rect(x,10,y-5,1,5,'#8b101c'); rect(x,11,y-6,1,4,'#ffcf3a');
      }
    }
  }
  function drawBeard(x, look, y){
    if(!look.b)return;
    const col=look.b===3?'#e7e0cf':(look.beardHue!=null?hsl(look.beardHue,45,24):'#2b1a12');
    if(look.b===1){ rect(x,6,y,4,1,col); }
    else if(look.b===2){
      rect(x,5,y,6,1,col); rect(x,6,y+1,4,2,col); rect(x,7,y+3,2,1,col);
      if(look.longBeard){ rect(x,7,y+4,2,2,col); px(x,8,y+6,col); }
    }
    else if(look.b===3){ rect(x,5,y,6,1,col); rect(x,6,y+1,4,3,col); rect(x,7,y+4,2,2,col); }
  }
  function drawHorse(x, look, f, y0, ox){
    ox=ox||0;
    const hc=horseColor(look.hc);
    const cols={out:OUT, hbase:hc.base, hdark:hc.dark, mane:hc.mane, boot:hc.dark};
    stamp(x,HORSE_BODY,cols,ox,y0);
    stamp(x,HORSE_LEGS[f?1:0],cols,ox,y0+10);
    // 目・たてがみハイライト・鞍
    px(x,ox+15,y0+2,INK);
    px(x,ox+14,y0+1,hc.light); px(x,ox+8,y0+6,hc.light); px(x,ox+4,y0+7,hc.light);
    rect(x,ox+5,y0+5,5,2,'#5f3526'); rect(x,ox+6,y0+5,3,1,GOLD);
  }
  function drawHeroWeapon(x, w, oy, attack, look){
    oy=oy||0; const push=attack?2:0, big=look&&look.weaponLarge;
    if(w==='spear'||w==='charge'){
      linePx(x,[[12+push,2+oy],[12+push,3+oy],[11+push,4+oy],[11+push,5+oy],[10+push,6+oy],[10+push,7+oy],[9+push,8+oy],[9+push,9+oy]],WOOD);
      px(x,13+push,1+oy,STEEL); px(x,14+push,0+oy,STEEL); px(x,14+push,1+oy,'#f4fbff');
    } else if(w==='halberd'){
      linePx(x,[[12+push,1+oy],[12+push,2+oy],[11+push,3+oy],[11+push,4+oy],[10+push,5+oy],[10+push,6+oy],[9+push,7+oy],[9+push,8+oy],[8+push,9+oy]],WOOD);
      rect(x,13+push,0+oy,2,3,OUT); px(x,13+push,0+oy,STEEL); px(x,14+push,1+oy,STEEL); px(x,13+push,2+oy,STEEL);
      px(x,12+push,1+oy,STEEL_D); px(x,14+push,0+oy,'#ffffff');
    } else if(w==='bow'||w==='crossbow'){
      rect(x,12+push,3+oy,1,8,OUT); rect(x,13+push,4+oy,1,6,'#b78344'); px(x,12+push,3+oy,'#eee'); px(x,12+push,10+oy,'#eee');
      rect(x,10+push,7+oy,5,1,'#f0d58a'); px(x,15+push,7+oy,STEEL);
      if(w==='crossbow'){ rect(x,10+push,6+oy,5,3,OUT); rect(x,10+push,7+oy,4,1,WOOD); }
    } else if(w==='array'||w==='fire'||w==='aura'){
      rect(x,11+push,7+oy,5,4,OUT);
      if(w==='fire'){ rect(x,12+push,8+oy,2,2,'#ff9440'); px(x,14+push,7+oy,'#ffd15a'); px(x,15+push,9+oy,'#fff2a8'); }
      else { px(x,12+push,8+oy,'#ffffff'); px(x,13+push,7+oy,'#e8edf4'); px(x,14+push,8+oy,'#d9e2ff'); px(x,15+push,9+oy,'#b7c7ff'); }
    } else if(w==='podao'){
      linePx(x,[[11+push,2+oy],[11+push,3+oy],[10+push,4+oy],[10+push,5+oy],[9+push,6+oy],[9+push,7+oy],[8+push,8+oy]],WOOD);
      rect(x,12+push,0+oy,3,big?7:6,OUT); rect(x,12+push,1+oy,2,big?5:4,GOLD); px(x,14+push,2+oy,'#fff2a8'); px(x,13+push,0+oy,'#fff2a8');
    } else if(w==='axe'){
      rect(x,11+push,5+oy,1,6,WOOD); rect(x,9+push,4+oy,4,3,OUT); rect(x,9+push,4+oy,3,2,STEEL);
    } else if(w==='mace'){
      rect(x,11+push,5+oy,1,6,WOOD); rect(x,9+push,3+oy,4,4,OUT); rect(x,10+push,4+oy,2,2,'#aeb7be'); px(x,9+push,5+oy,'#e2e8ef');
    } else if(w==='chakram'){
      rect(x,11+push,5+oy,4,4,OUT); px(x,12+push,5+oy,STEEL); px(x,14+push,6+oy,STEEL); px(x,12+push,8+oy,STEEL); px(x,11+push,6+oy,STEEL);
    } else if(w==='twin'){
      linePx(x,[[10+push,4+oy],[11+push,3+oy],[12+push,2+oy]],STEEL); px(x,12+push,2+oy,'#ffffff');
      linePx(x,[[9+push,8+oy],[10+push,9+oy],[11+push,10+oy]],STEEL); px(x,11+push,10+oy,'#ffffff');
    } else {
      linePx(x,[[11+push,4+oy],[10+push,5+oy],[9+push,6+oy],[8+push,7+oy]],STEEL); px(x,11+push,4+oy,'#ffffff');
    }
  }

  function hero(g, frame, attack){
    g=g||{id:'lord',name:'武将',weapon:'sword',faction:0};
    const f=(frame||0)&1, atk=attack?1:0, look=lookFor(g), mounted=!!look.m;
    const key='hero_'+(g.id!=null?g.id:g.name)+'_'+g.name+'_'+g.weapon+'_'+f+'_'+atk;
    if(cache[key]) return cache[key];
    // 上に雉羽/冠の余白(P)を確保。馬上は馬の上に騎手を重ねる
    const P=5, W=mounted?22:18, H=mounted?28:22, {c,x}=mk(W,H);
    const seed=hash(g.name+g.weapon), skin=SKIN[seed%SKIN.length], fac=FAC[g.faction]||FAC[0];
    const pal=colorForHue(look.h, fac.armor[0]);
    const trim=hsl(fac.trim[0],fac.trim[1],fac.trim[2]);
    const bounce=f?1:0, y=mounted?P-1:P+bounce, ox=mounted?3:1;
    if(mounted) drawHorse(x,look,f,15,2);
    drawHeroWeapon(x,g.weapon,mounted?4:5,atk,look);
    const cols=heroColors(pal,skin,trim);
    stamp(x,HERO_BODY,cols,ox,y);
    if(!mounted) stamp(x,HERO_LEGS[f?1:0],cols,ox,P+14);
    if(mounted){ rect(x,ox+4,20,3,4,OUT); rect(x,ox+5,20,1,3,'#2c1c12'); } // 鞍上のブーツ
    if(look.fat){ rect(x,ox+2,y+10,1,3,pal.base); rect(x,ox+11,y+10,1,3,pal.base); }
    if(look.eyepatch){ rect(x,ox+3,y+4,4,1,INK); px(x,ox+7,y+5,INK); }
    drawBeard(x,look,y+7);
    drawHat(x,look,y,pal);
    if(look.bell){ px(x,ox+11,y+7,GOLD); px(x,ox+12,y+8,'#ffec9c'); }
    cache[key]=c; return c;
  }

  // 旧API互換。戦闘本体は runtime 側で hero() に差し替える。
  function lordSprite(lord){
    const g=(window.GENERALS&&window.GENERALS.find(x=>x.name===lord.start))||{id:lord.id,name:lord.name,weapon:'sword',faction:lord.faction};
    return hero(g,0);
  }

  function enemy(shape, hue, big, frame){
    const f=(frame||0)&1, key='e_'+shape+'_'+hue+'_'+(big||0)+'_'+f;
    if(cache[key]) return cache[key];
    const h=typeof hue==='number'?hue:0;
    const S=shape==='horse'?26:16, {c,x}=mk(S,S);
    // 兜の巻布=その勢力の色相そのもの(黄巾は黄色)。鎧は彩度を落として兜を立てる
    const body=hsl(h,30,36), dark=hsl((h+352)%360,34,21), light=hsl((h+8)%360,40,48);
    const trim=hsl(h,78,55), trimD=hsl(h,72,33), skin=hsl(28,42,72);
    const cols={out:OUT, base:body, dark, light, trim, trimD, skin, skinD:hsl(18,38,58),
      hair:'#241710', boot:'#241710', gold:GOLD, hbase:hsl(26,40,32), hdark:hsl(22,42,16), mane:'#1f1209'};
    function weapon(kind,bx,by,w,h){
      if(kind==='sword'){
        linePx(x,[[bx+w+1,by+2],[bx+w+2,by+1],[bx+w+3,by],[bx+w+4,by-1]],STEEL);
        px(x,bx+w+4,by-1,'#ffffff'); px(x,bx+w,by+3,GOLD);
      } else if(kind==='spear'){
        linePx(x,[[bx+w,by+4],[bx+w+1,by+3],[bx+w+2,by+2],[bx+w+3,by+1],[bx+w+4,by]],WOOD);
        px(x,bx+w+5,by-1,STEEL); px(x,bx+w+5,by,STEEL); px(x,bx+w+4,by,'#ffffff');
      } else if(kind==='bow'){
        rect(x,bx+w+1,by-2,1,h+5,OUT); rect(x,bx+w+2,by-1,1,h+3,'#b78344');
        px(x,bx+w+1,by-2,'#f4f0dc'); px(x,bx+w+1,by+h+2,'#f4f0dc');
        rect(x,bx+w-2,by+3,5,1,'#f0d58a'); px(x,bx+w+3,by+3,STEEL);
      } else if(kind==='shield'){
        rect(x,bx-5,by+1,5,9,OUT); rect(x,bx-4,by+2,3,7,'#9ca7ad'); rect(x,bx-4,by+2,3,1,'#ffffff'); px(x,bx-2,by+5,trim);
        linePx(x,[[bx+w,by+3],[bx+w+1,by+2],[bx+w+2,by+1]],STEEL);
      } else if(kind==='fan'){
        rect(x,bx+w+1,by+2,5,4,OUT); px(x,bx+w+2,by+4,'#ffffff'); px(x,bx+w+3,by+3,'#e8edf4'); px(x,bx+w+4,by+4,'#b7c7ff'); px(x,bx+w+5,by+5,'#d7dcff');
      } else if(kind==='bomb'){
        rect(x,bx+w+1,by+2,4,4,OUT); rect(x,bx+w+2,by+3,2,2,'#3b3330'); px(x,bx+w+4,by+1,'#ffeb7a');
      }
    }
    if(shape==='horse'){
      // 騎兵: 馬グリッド+騎手上半身+槍
      stamp(x,HORSE_BODY,cols,3,11);
      stamp(x,HORSE_LEGS[f],cols,3,21);
      for(let r=0;r<9;r++) stamp(x,[SOLDIER_BODY[r]],cols,5,6+r);
      rect(x,8,16,5,2,'#5f3526'); rect(x,9,16,3,1,trim); // 鞍
      linePx(x,[[14,12],[16,10],[18,8],[20,6]],WOOD); px(x,21,5,STEEL); px(x,21,4,'#ffffff');
      cache[key]=c; return c;
    }
    stamp(x,SOLDIER_BODY,cols,2,0);
    stamp(x,SOLDIER_LEGS[f],cols,2,11);
    if(shape==='heavy'){ rect(x,3,7,1,4,dark); rect(x,12,7,1,4,dark); rect(x,4,0,8,1,dark); } // 重装: 肩当て+兜濃
    if(shape==='mage'){ rect(x,4,0,8,3,'#3d3a45'); rect(x,5,0,6,1,'#8e889c'); } // 方士: 頭巾
    const bx=5, bodyY=7, w=6;
    if(shape==='light') weapon('spear',bx,bodyY,w,4);
    else if(shape==='shield') weapon('shield',bx,bodyY,w,4);
    else if(shape==='archer') weapon('bow',bx,bodyY,w,4);
    else if(shape==='mage') weapon('fan',bx,bodyY,w,4);
    else if(shape==='bomb') weapon('bomb',bx,bodyY,w,4);
    else weapon('sword',bx,bodyY,w,4);
    if(big){ const {c:c2,x:x2}=mk(S*2,S*2); x2.imageSmoothingEnabled=false; x2.drawImage(c,0,0,S*2,S*2); cache[key]=c2; return c2; }
    cache[key]=c; return c;
  }

  function bossSprite(shape, hue, frame){
    const f=(frame||0)&1, key='boss_'+(shape||'war')+'_'+hue+'_'+f;
    if(cache[key]) return cache[key];
    const pal=colorForHue(hue, hue);
    const S=19,{c,x}=mk(S,S);
    const cols={out:OUT, base:pal.base, dark:pal.dark, light:pal.light, trim:hsl(hue,80,55), trimD:hsl(hue,72,33),
      skin:hsl(28,45,72), skinD:hsl(18,38,58), hair:'#241710', boot:'#241710', gold:GOLD};
    stamp(x,SOLDIER_BODY,cols,2,2);
    stamp(x,SOLDIER_LEGS[f],cols,2,13);
    rect(x,3,9,1,4,pal.dark); rect(x,12,9,1,4,pal.dark); // 肩当て
    if(shape==='mage'){ rect(x,4,2,8,3,'#3d3a45'); rect(x,5,2,6,1,'#8e889c'); }
    else if(shape==='lord'){ rect(x,5,1,6,2,GOLD); px(x,6,0,'#ffe38a'); px(x,8,0,'#fff0a8'); px(x,10,0,'#ffe38a'); }
    else { rect(x,7,0,2,3,GOLD); px(x,7,0,'#fff2a8'); } // 立物
    linePx(x,[[13,9],[14,8],[15,7],[16,6]],WOOD); rect(x,15,2,3,5,OUT); rect(x,16,3,1,3,STEEL); px(x,16,2,'#ffffff'); // 大刀
    const Z=3,{c:c2,x:x2}=mk(S*Z,S*Z); x2.imageSmoothingEnabled=false; x2.drawImage(c,0,0,S*Z,S*Z);
    cache[key]=c2; return c2;
  }

  function minionSprite(faction, frame){
    const f=(frame||0)&1, key='min_'+faction+'_'+f; if(cache[key])return cache[key];
    const S=14,{c,x}=mk(S,S); const fac=FAC[faction]||FAC[0];
    const body=hsl(fac.armor[0],fac.armor[1],fac.armor[2]), dark=hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]);
    rect(x,4,1,6,5,OUT); rect(x,5,2,4,3,'hsl(28,40%,70%)');
    rect(x,3,6,8,5,OUT); rect(x,4,7,6,4,body); rect(x,4,7,6,1,hsl(fac.trim[0],fac.trim[1],fac.trim[2]));
    px(x,5+f,12,dark); px(x,8-f,12,dark);
    cache[key]=c; return c;
  }

  function jar(type){
    const key='jar'+type; if(cache[key])return cache[key];
    const S=18,{c,x}=mk(S,S);
    const lit = type==='heal'?'#7CFC8A': type==='clear'?'#ff9a5a':'#86c5ff';
    const dk  = type==='heal'?'#2e7d4a': type==='clear'?'#9a3a18':'#2a5f9a';
    rect(x,4,7,10,9,'#9a6a3a'); rect(x,4,7,10,2,'#b88a55'); rect(x,4,15,10,1,'#6a4626');
    rect(x,3,9,1,5,'#6a4626'); rect(x,14,9,1,5,'#6a4626');
    rect(x,6,4,6,3,'#7a5230'); rect(x,5,6,8,2,'#8a5f38');
    rect(x,7,9,4,5,lit); rect(x,7,9,4,1,'#fff');
    if(type==='heal'){ rect(x,9,10,1,3,'#ffffff'); rect(x,8,11,3,1,'#ffffff'); }
    else if(type==='clear'){ px(x,8,9,'#fff'); px(x,7,11,'#fff'); px(x,10,11,'#fff'); px(x,9,12,'#fff'); }
    else { rect(x,7,11,4,1,'#fff'); rect(x,9,9,1,4,'#fff'); }
    px(x,0,0,dk);
    cache[key]=c; return c;
  }

  function baseProj(type, hue, frame){
    const key='proj_base_'+type+'_'+hue+'_'+((frame||0)&1);
    if(cache[key]) return cache[key];
    let W=14,H=14;
    if(type==='arrow'){W=18;H=8;}
    if(type==='spear'){W=22;H=8;}
    if(type==='podao'){W=18;H=10;}
    if(type==='halberd'){W=20;H=12;}
    if(type==='fire'){W=12;H=12;}
    if(type==='rock'){W=10;H=10;}
    if(type==='blade'){W=14;H=14;}
    const {c,x}=mk(W,H), cy=Math.floor(H/2), h=typeof hue==='number'?hue:40, f=(frame||0)&1;
    if(type==='arrow'){
      const ally=h>=42&&h<=75, feather=ally?'#ffd44f':'#dc3f32', shaft=ally?'#c9973a':'#b77735';
      rect(x,1,cy-2,3,2,OUT); rect(x,1,cy,3,2,OUT);
      rect(x,2,cy-2,2,1,'#ffffff'); rect(x,2,cy+1,2,1,feather);
      rect(x,3,cy-1,12,3,OUT); rect(x,4,cy,11,1,shaft);
      rect(x,14,cy-2,4,5,OUT); rect(x,15,cy-1,2,3,STEEL); px(x,17,cy,STEEL); px(x,15,cy-1,'#ffffff');
    } else if(type==='spear'){
      rect(x,1,cy-1,15,3,OUT); rect(x,2,cy,14,1,WOOD);
      rect(x,15,cy-2,6,5,OUT); rect(x,16,cy-1,4,3,STEEL); px(x,21,cy,STEEL); px(x,17,cy-1,'#ffffff');
    } else if(type==='podao'){
      rect(x,1,cy-1,10,3,OUT); rect(x,2,cy,9,1,WOOD);
      rect(x,10,1,6,8,OUT); rect(x,11,2,4,6,GOLD); px(x,15,3,'#fff2a8'); px(x,12,1,'#fff2a8');
    } else if(type==='halberd'){
      rect(x,2,cy-1,12,3,OUT); rect(x,3,cy,11,1,WOOD);
      rect(x,13,2,5,8,OUT); px(x,15,1,STEEL); rect(x,14,3,3,5,STEEL); px(x,18,cy,STEEL); px(x,14,3,'#ffffff');
      rect(x,11,cy-4,4,3,OUT); px(x,12,cy-3,STEEL_D); px(x,13,cy-2,STEEL);
    } else if(type==='blade'){
      const col=hsl(h,78,62), hi=hsl(h,80,78);
      rect(x,2,2,10,10,OUT);
      if(f){ px(x,4,1,hi); rect(x,5,2,4,2,col); rect(x,8,4,2,5,col); px(x,9,10,hi); }
      else { rect(x,2,6,10,2,col); rect(x,6,2,2,10,col); px(x,10,3,hi); px(x,3,10,hi); }
      px(x,6,6,'#ffffff');
    } else if(type==='fire'){
      const a=f?1:0;
      rect(x,4,1+a,3,8,OUT); rect(x,2,5,7,5,OUT);
      rect(x,4,2+a,2,7,'#ff6a22'); rect(x,3,6,5,3,'#ff8f2a'); rect(x,5,5,2,3,'#ffd55a'); px(x,6,3+a,'#fff2a8');
    } else if(type==='rock'){
      rect(x,2,2,6,6,OUT); rect(x,3,3,4,4,hsl(h,15,45)); px(x,4,2,hsl(h,18,65)); px(x,7,5,hsl(h,18,28));
    }
    cache[key]=c; return c;
  }
  function rotated(src, dir){
    const S=Math.ceil(Math.max(src.width,src.height)*1.6), {c,x}=mk(S,S);
    x.translate(S/2,S/2); x.rotate(dir*Math.PI*2/16); x.drawImage(src,-src.width/2,-src.height/2);
    return c;
  }
  function proj(type, hue, angle, frame){
    const dir=((Math.round((((angle||0)%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*16))%16);
    const f=(frame||0)&1, key='proj_set_'+type+'_'+hue+'_'+f;
    if(!cache[key]){
      const src=baseProj(type,hue,f), arr=[];
      for(let i=0;i<16;i++)arr[i]=rotated(src,i);
      cache[key]=arr;
    }
    return cache[key][dir];
  }
  function projType(w){
    if(w==='bow'||w==='crossbow') return 'arrow';
    if(w==='spear'||w==='charge') return 'spear';
    if(w==='chakram'||w==='twin') return 'blade';
    if(w==='fire'||w==='array'||w==='aura') return 'fire';
    if(w==='mace'||w==='axe') return 'rock';
    return 'blade';
  }

  function weaponTip(w, hue, frame){
    const t=(w==='podao')?'podao':(w==='halberd')?'halberd':(w==='spear'||w==='charge')?'spear':(w==='bow'||w==='crossbow')?'arrow':'blade';
    return proj(t,hue||44,0,frame||0);
  }

  function hexToRgb(hex){
    if(!hex||hex[0]!=='#')return [32,28,32];
    const v=parseInt(hex.slice(1),16);
    return [(v>>16)&255,(v>>8)&255,v&255];
  }
  function rgbToHex(r,g,b){return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v|0)).toString(16).padStart(2,'0')).join('');}
  function mix(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
  function floorTile(bg, biome){
    const bm=biome||'plain';
    const key='floor_'+bg.ground+'_'+bg.grid+'_'+bm;
    if(cache[key]) return cache[key];
    const {c,x}=mk(64,64), g=hexToRgb(bg.ground), gr=hexToRgb(bg.grid);
    let seed=hash(key);
    function rnd(){seed=Math.imul(seed^seed>>>15,2246822519);seed=Math.imul(seed^seed>>>13,3266489917);return ((seed^seed>>>16)>>>0)/4294967296;}

    if(bm==='water'){
      // 水上: 暗い水色の地面 + 横板張り帯 + 波頭の白点
      const waterBase=rgbToHex(...mix(g,[30,70,110],0.55));
      const waterMid =rgbToHex(...mix(g,[40,85,125],0.45));
      const plankCol =rgbToHex(...mix(g,[90,60,30],0.32));
      const plankDk  =rgbToHex(...mix(g,[50,35,15],0.28));
      const waveCol  ='#c8dde8';
      rect(x,0,0,64,64,waterBase);
      // 横板張り帯(8px間隔)
      for(let py=0;py<64;py+=8){
        rect(x,0,py,64,1,plankCol);
        rect(x,0,py+7,64,1,plankDk);
      }
      // 波頭の白点(散在)
      for(let i=0;i<14;i++){
        const wx=(rnd()*64)|0, wy=(rnd()*64)|0;
        if((rnd()*3)|0===0){ rect(x,wx,wy,3,1,waveCol); rect(x,wx+1,wy+1,2,1,waterMid); }
        else px(x,wx,wy,waveCol);
      }
      // 目地ライン(列)
      rect(x,0,0,1,64,plankDk);
      rect(x,0,0,64,1,plankDk);
    } else if(bm==='snow'){
      // 雪原: 明るい青白い地面 + 白斑 + 足跡
      const snowBase=rgbToHex(...mix(g,[200,215,230],0.65));
      const snowHi  =rgbToHex(...mix(g,[240,248,255],0.70));
      const snowDk  =rgbToHex(...mix(g,[140,165,195],0.45));
      const trackCol=rgbToHex(...mix(g,[120,145,175],0.40));
      rect(x,0,0,64,64,snowBase);
      // 雪の白斑
      for(let i=0;i<20;i++){
        const sx=(rnd()*62)|0, sy=(rnd()*62)|0, sw=1+((rnd()*3)|0);
        rect(x,sx,sy,sw,1,snowHi);
        if(sw>1) rect(x,sx+1,sy+1,sw-1,1,snowDk);
      }
      // 足跡ペア(2点組)
      for(let i=0;i<5;i++){
        const fx=(rnd()*58)|0, fy=(rnd()*58)|0;
        px(x,fx,fy,trackCol); px(x,fx+2,fy+2,trackCol);
        px(x,fx+1,fy+1,snowDk);
      }
      rect(x,0,0,64,1,snowDk);
      rect(x,0,0,1,64,snowDk);
    } else if(bm==='city'){
      // 石畳: 目地+石の光沢
      const stoneBase=rgbToHex(...mix(g,[85,80,80],0.35));
      const stoneLi  =rgbToHex(...mix(g,[140,135,130],0.28));
      const stoneDk  =rgbToHex(...mix(g,[30,28,28],0.30));
      const grout    =rgbToHex(...mix(g,[20,20,22],0.55));
      const debris   =rgbToHex(...mix(g,[100,88,70],0.30));
      rect(x,0,0,64,64,stoneBase);
      // 石畳の目地(16x16グリッド)
      for(let gy=0;gy<64;gy+=16) rect(x,0,gy,64,1,grout);
      for(let gx=0;gx<64;gx+=16) rect(x,gx,0,1,64,grout);
      // 半ブロックずらしのオフセット目地(煉瓦状)
      for(let gy=8;gy<64;gy+=32) rect(x,8,gy,56,1,grout);
      for(let gy=24;gy<64;gy+=32) rect(x,0,gy,56,1,grout);
      // 石面のハイライト・影
      for(let i=0;i<14;i++){
        const sx=(rnd()*62)|0, sy=(rnd()*62)|0;
        px(x,sx,sy,stoneLi); px(x,sx+1,sy+1,stoneDk);
      }
      // 瓦礫・轍の跡
      for(let i=0;i<6;i++){
        const dx=(rnd()*60)|0, dy=(rnd()*60)|0;
        rect(x,dx,dy,2,1,debris); rect(x,dx+1,dy+1,1,1,stoneDk);
      }
    } else if(bm==='jungle'){
      // 南蛮: 湿地の暗緑 + 蔓 + 草叢の斑
      const mudBase =rgbToHex(...mix(g,[28,55,22],0.50));
      const grassLi =rgbToHex(...mix(g,[55,110,35],0.45));
      const grassDk =rgbToHex(...mix(g,[18,40,12],0.55));
      const vineCol =rgbToHex(...mix(g,[38,80,20],0.52));
      const mudDk   =rgbToHex(...mix(g,[15,30,10],0.58));
      rect(x,0,0,64,64,mudBase);
      // 草叢の斑(不規則)
      for(let i=0;i<18;i++){
        const jx=(rnd()*62)|0, jy=(rnd()*62)|0, jw=1+((rnd()*3)|0);
        const col=(rnd()*2)|0===0?grassLi:grassDk;
        rect(x,jx,jy,jw,1,col);
        if((rnd()*2)|0===0) rect(x,jx+1,jy+1,Math.max(1,jw-1),1,mudDk);
      }
      // 蔓(斜め1px線)
      for(let i=0;i<5;i++){
        let vx=(rnd()*56)|0, vy=(rnd()*56)|0;
        for(let s=0;s<5;s++){ px(x,vx+s,vy+s,vineCol); if((rnd()*2)|0===0) px(x,vx+s,vy+s+1,mudDk); }
      }
      rect(x,0,0,64,1,mudDk);
      rect(x,0,0,1,64,mudDk);
    } else {
      // plain(既定): 元のロジック
      const dark=mix(g,[0,0,0],0.18), light=mix(g,[255,255,255],0.10), low=mix(g,gr,0.42);
      rect(x,0,0,64,64,bg.ground);
      for(let i=0;i<22;i++){
        const px0=(rnd()*64)|0, py0=(rnd()*64)|0, kind=(rnd()*4)|0;
        if(kind===0){ rect(x,px0,py0,2,1,rgbToHex(...light)); rect(x,px0+2,py0+1,1,1,rgbToHex(...low)); }
        else if(kind===1){ rect(x,px0,py0,1,1,rgbToHex(...dark)); rect(x,px0+1,py0,1,1,rgbToHex(...low)); }
        else if(kind===2){ rect(x,px0,py0,5,1,rgbToHex(...low)); rect(x,px0+2,py0+1,4,1,rgbToHex(...dark)); }
        else { rect(x,px0,py0,3,1,rgbToHex(...mix(light,[230,220,180],0.25))); px(x,px0+1,py0+1,rgbToHex(...low)); }
      }
      rect(x,0,0,64,1,rgbToHex(...mix(g,gr,0.25)));
      rect(x,0,0,1,64,rgbToHex(...mix(g,gr,0.25)));
    }
    cache[key]=c; return c;
  }

  return {
    general, lordSprite, hero, enemy, bossSprite, minionSprite, jar,
    proj, projType, weaponTip, floorTile,
    classOf, hash
  };
})();
