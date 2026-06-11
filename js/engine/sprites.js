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

  // UI用バスト。既存画面互換のため残す。
  function general(g){
    const key='g'+g.id;
    if(cache[key]) return cache[key];
    const S=28, {c,x}=mk(S,S);
    const seed=hash(g.name+g.weapon);
    const fac=FAC[g.faction];
    const skin=SKIN[seed%3];
    rect(x,0,0,S,S,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]-14));
    rect(x,5,20,18,8,hsl(fac.armor[0],fac.armor[1],fac.armor[2]));
    rect(x,5,20,18,2,hsl(fac.trim[0],fac.trim[1],fac.trim[2]));
    rect(x,7,24,2,4,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]));
    rect(x,19,24,2,4,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]));
    rect(x,11,17,6,4,hsl(skin[0],skin[1],skin[2]-8));
    rect(x,9,8,10,11,hsl(skin[0],skin[1],skin[2]));
    rect(x,9,8,10,2,hsl(skin[0],skin[1],skin[2]+8));
    rect(x,11,12,2,2,'#23170f'); rect(x,15,12,2,2,'#23170f');
    const beard=seed%4, beardCol=hsl(20,30,18+(seed%3)*4);
    if(g.weapon==='podao'||beard===0){ rect(x,9,16,10,3,beardCol); rect(x,11,19,6,3,beardCol); }
    else if(beard===1){ rect(x,10,16,8,2,beardCol); }
    else if(beard===2){ rect(x,12,16,4,2,beardCol); }
    const cls=classOf(g.weapon);
    if(cls==='lord'){
      rect(x,8,4,12,4,hsl(45,80,52)); rect(x,10,2,2,2,hsl(48,85,60)); rect(x,13,1,2,3,hsl(48,90,66)); rect(x,16,2,2,2,hsl(48,85,60));
      rect(x,8,7,12,2,hsl(45,70,40));
    } else if(cls==='scholar'){
      rect(x,7,3,14,6,hsl(220,12,88)); rect(x,7,3,14,2,hsl(220,10,96)); rect(x,7,8,14,1,hsl(220,12,70));
    } else if(cls==='archer'){
      rect(x,8,5,12,5,hsl(fac.trim[0],40,40)); rect(x,8,5,12,2,hsl(fac.trim[0],45,55));
    } else {
      rect(x,7,4,14,6,hsl(fac.armor[0],fac.armor[1],fac.armor[2]-6));
      rect(x,7,4,14,2,hsl(fac.trim[0],fac.trim[1],fac.trim[2]));
      rect(x,13,1,2,4,hsl(fac.trim[0],85,62));
      rect(x,6,9,2,3,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]));
      rect(x,20,9,2,3,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]));
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
  function drawHorse(x, look, f, y0){
    const hc=horseColor(look.hc), leg=f?1:0;
    rect(x,1,y0+5,12,6,OUT); rect(x,2,y0+6,10,4,hc.base); rect(x,3,y0+6,8,1,hc.light);
    rect(x,10,y0+2,5,5,OUT); rect(x,11,y0+3,3,4,hc.base); px(x,14,y0+4,INK);
    px(x,12,y0+2,hc.mane); px(x,13,y0+1,hc.mane);
    rect(x,4,y0+3,5,3,hc.mane); rect(x,5,y0+4,6,2,'#5f3526'); rect(x,6,y0+4,4,1,GOLD);
    rect(x,2,y0+10,2,4,OUT); rect(x,6,y0+10,2,4,OUT); rect(x,9,y0+10,2,4,OUT); rect(x,12,y0+9,2,4,OUT);
    rect(x,2+leg,y0+10,1,4,hc.dark); rect(x,6-leg,y0+10,1,4,hc.dark);
    rect(x,9+leg,y0+10,1,4,hc.dark); rect(x,12-leg,y0+9,1,4,hc.dark);
    rect(x,0,y0+6,3,1,hc.mane); px(x,0,y0+7,hc.mane); px(x,1,y0+8,hc.mane);
  }
  function drawHeroWeapon(x, w, mounted, attack, look){
    const oy=mounted?4:0, push=attack?2:0, big=look&&look.weaponLarge;
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
    const W=18,H=mounted?22:16,{c,x}=mk(W,H);
    const seed=hash(g.name+g.weapon), skin=SKIN[seed%SKIN.length], fac=FAC[g.faction]||FAC[0];
    const pal=colorForHue(look.h, fac.armor[0]);
    const trim=hsl(fac.trim[0],fac.trim[1],fac.trim[2]);
    const bounce=f?1:0, y=mounted?0:bounce;
    if(mounted) drawHorse(x,look,f,9);
    drawHeroWeapon(x,g.weapon,mounted,atk,look);
    const headY=mounted?1+y:1+y, bodyY=mounted?8+y:8+y;
    const bodyW=look.fat?8:6, bx=Math.floor((16-bodyW)/2);
    rect(x,bx-1,bodyY,bodyW+2,6,OUT); rect(x,bx,bodyY+1,bodyW,4,pal.base); rect(x,bx,bodyY+1,bodyW,1,pal.light||trim);
    rect(x,4,bodyY+2,2,4,OUT); rect(x,10+atk,bodyY+2,2,4,OUT);
    rect(x,5,bodyY+2,1,3,pal.dark); rect(x,10+atk,bodyY+2,1,3,pal.dark);
    if(!mounted){
      rect(x,5+(f?1:0),14,2,2,OUT); rect(x,9-(f?1:0),14,2,2,OUT);
      px(x,5+(f?1:0),14,pal.dark); px(x,9-(f?1:0),14,pal.dark);
    }
    rect(x,4,headY+2,8,7,OUT); rect(x,5,headY+3,6,5,hsl(skin[0],skin[1],skin[2]));
    rect(x,5,headY+3,6,1,hsl(skin[0],skin[1],Math.min(90,skin[2]+8)));
    px(x,6,headY+5,INK); px(x,10,headY+5,INK);
    if(look.eyepatch){ rect(x,5,headY+5,3,1,INK); px(x,7,headY+6,INK); }
    drawBeard(x,look,headY+8);
    drawHat(x,look,headY,pal);
    if(look.bell){ px(x,12,headY+7,GOLD); px(x,13,headY+8,'#ffec9c'); }
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
    const S=shape==='horse'?(big?32:28):(big?30:22), {c,x}=mk(S,S);
    const cx=Math.floor(S/2), body=hsl(h,48,big?42:38), dark=hsl(h,50,20), light=hsl(h,58,58);
    const trim=hsl((h+42)%360,78,58), trimD=hsl((h+42)%360,70,36), skin=hsl(28,42,70);
    const foot=f?1:0;
    function helmet(hx,hy,hw){
      rect(x,hx-1,hy-1,hw+2,4,OUT); rect(x,hx,hy,hw,2,trim); rect(x,hx,hy+2,hw,1,trimD);
      px(x,hx+Math.floor(hw/2),hy-2,trim);
    }
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
    function soldier(kind,w,hgt,headW){
      const headY=big?5:4, faceY=headY+3, bodyY=big?13:10;
      const hx=Math.floor(cx-headW/2), bx=Math.floor(cx-w/2);
      helmet(hx,headY,headW);
      rect(x,hx,faceY,headW,2,skin); px(x,cx-2,faceY+1,INK); px(x,cx+2,faceY+1,INK);
      rect(x,bx-1,bodyY-1,w+2,hgt+2,OUT); rect(x,bx,bodyY,w,hgt,body); rect(x,bx,bodyY,w,1,light); rect(x,bx,bodyY+2,w,1,trimD);
      rect(x,bx-2,bodyY+1,2,5,OUT); rect(x,bx+w,bodyY+1,2,5,OUT);
      rect(x,bx-1,bodyY+2,1,3,dark); rect(x,bx+w,bodyY+2,1,3,dark);
      const ly=bodyY+hgt+1;
      rect(x,cx-5+foot,ly,2,3,OUT); rect(x,cx+3-foot,ly,2,3,OUT);
      rect(x,cx-5+foot,ly,1,2,dark); rect(x,cx+3-foot,ly,1,2,dark);
      weapon(kind,bx,bodyY,w,hgt);
    }
    function enemyHorse(){
      const hc=horseColor(28), y=big?14:12;
      rect(x,cx-11,y,18,7,OUT); rect(x,cx-10,y+1,16,5,hc.base); rect(x,cx-8,y+1,12,1,hc.light);
      rect(x,cx+5,y-5,6,7,OUT); rect(x,cx+6,y-4,4,5,hc.base); px(x,cx+9,y-3,INK);
      rect(x,cx+4,y-5,2,5,hc.mane); px(x,cx+8,y-6,hc.mane); px(x,cx+10,y-5,hc.mane);
      rect(x,cx-12,y+1,4,1,hc.mane); px(x,cx-13,y+2,hc.mane); px(x,cx-12,y+3,hc.mane);
      rect(x,cx-7,y+6,2,5,OUT); rect(x,cx-2,y+6,2,5,OUT); rect(x,cx+3,y+6,2,5,OUT); rect(x,cx+7,y+5,2,5,OUT);
      rect(x,cx-7+foot,y+6,1,4,hc.dark); rect(x,cx-2-foot,y+6,1,4,hc.dark);
      rect(x,cx+3+foot,y+6,1,4,hc.dark); rect(x,cx+7-foot,y+5,1,4,hc.dark);
      rect(x,cx-5,y-1,8,4,OUT); rect(x,cx-4,y,6,2,trim); rect(x,cx-4,y+2,6,1,trimD);
      rect(x,cx-3,y-8,6,8,OUT); rect(x,cx-2,y-7,4,6,body); rect(x,cx-3,y-10,6,4,OUT);
      helmet(cx-3,y-11,6); rect(x,cx-2,y-8,4,2,skin); px(x,cx-1,y-7,INK);
      linePx(x,[[cx+3,y-7],[cx+5,y-8],[cx+7,y-9],[cx+9,y-10],[cx+11,y-11]],WOOD);
      px(x,cx+12,y-12,STEEL); px(x,cx+12,y-11,'#ffffff');
    }
    if(shape==='horse') enemyHorse();
    else if(shape==='light') soldier('spear',7,7,6);
    else if(shape==='heavy') soldier('sword',big?14:11,big?11:9,big?10:7);
    else if(shape==='shield') soldier('shield',9,9,7);
    else if(shape==='archer') soldier('bow',8,8,6);
    else if(shape==='mage') soldier('fan',9,9,6);
    else if(shape==='bomb') soldier('bomb',8,8,6);
    else soldier('sword',8,8,6);
    cache[key]=c; return c;
  }

  function bossSprite(shape, hue, frame){
    const f=(frame||0)&1, key='boss_'+(shape||'war')+'_'+hue+'_'+f;
    if(cache[key]) return cache[key];
    const S=44,{c,x}=mk(S,S), cx=22, pal=colorForHue(hue, hue), skin='#d2a06f';
    const y=f?1:0;
    rect(x,11,21+y,22,18,OUT); rect(x,13,23+y,18,14,pal.base); rect(x,13,23+y,18,3,pal.light);
    rect(x,8,24+y,7,12,OUT); rect(x,29,24+y,7,12,OUT); rect(x,10,25+y,4,9,pal.dark); rect(x,30,25+y,4,9,pal.dark);
    rect(x,16,9+y,12,13,OUT); rect(x,17,10+y,10,10,skin); rect(x,17,10+y,10,2,'#efc38d');
    px(x,19,15+y,INK); px(x,24,15+y,INK); rect(x,19,19+y,6,2,'#2b1a12'); rect(x,20,21+y,4,3,'#2b1a12');
    if(shape==='mage'){
      rect(x,14,5+y,16,6,OUT); rect(x,15,6+y,14,4,hsl(hue,35,60)); rect(x,21,2+y,2,5,hsl(hue,75,72));
    } else if(shape==='lord'){
      rect(x,14,5+y,16,6,OUT); rect(x,15,6+y,14,4,GOLD); px(x,18,4+y,'#ffe38a'); px(x,22,3+y,'#fff0a8'); px(x,26,4+y,'#ffe38a');
    } else {
      rect(x,13,6+y,18,6,OUT); rect(x,15,7+y,14,4,pal.dark); rect(x,21,2+y,2,6,pal.light);
    }
    linePx(x,[[33,13+y],[32,15+y],[31,17+y],[30,19+y],[29,21+y]],WOOD);
    px(x,34,11+y,STEEL); px(x,35,10+y,STEEL); px(x,35,12+y,STEEL);
    cache[key]=c; return c;
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
  function floorTile(bg){
    const key='floor_'+bg.ground+'_'+bg.grid;
    if(cache[key]) return cache[key];
    const {c,x}=mk(64,64), g=hexToRgb(bg.ground), gr=hexToRgb(bg.grid);
    const dark=mix(g,[0,0,0],0.18), light=mix(g,[255,255,255],0.10), low=mix(g,gr,0.42);
    rect(x,0,0,64,64,bg.ground);
    let seed=hash(key);
    function rnd(){seed=Math.imul(seed^seed>>>15,2246822519);seed=Math.imul(seed^seed>>>13,3266489917);return ((seed^seed>>>16)>>>0)/4294967296;}
    for(let i=0;i<22;i++){
      const px0=(rnd()*64)|0, py0=(rnd()*64)|0, kind=(rnd()*4)|0;
      if(kind===0){ rect(x,px0,py0,2,1,rgbToHex(...light)); rect(x,px0+2,py0+1,1,1,rgbToHex(...low)); }
      else if(kind===1){ rect(x,px0,py0,1,1,rgbToHex(...dark)); rect(x,px0+1,py0,1,1,rgbToHex(...low)); }
      else if(kind===2){ rect(x,px0,py0,5,1,rgbToHex(...low)); rect(x,px0+2,py0+1,4,1,rgbToHex(...dark)); }
      else { rect(x,px0,py0,3,1,rgbToHex(...mix(light,[230,220,180],0.25))); px(x,px0+1,py0+1,rgbToHex(...low)); }
    }
    rect(x,0,0,64,1,rgbToHex(...mix(g,gr,0.25)));
    rect(x,0,0,1,64,rgbToHex(...mix(g,gr,0.25)));
    cache[key]=c; return c;
  }

  return {
    general, lordSprite, hero, enemy, bossSprite, minionSprite, jar,
    proj, projType, weaponTip, floorTile,
    classOf, hash
  };
})();
