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

  // ── 武将アバター(バスト, 28x28)。UI用。weaponで兜/学者帽/王冠を出し分け。
  function general(g){
    const key='g'+g.id;
    if(cache[key]) return cache[key];
    const S=28, {c,x}=mk(S,S);
    const seed=hash(g.name+g.weapon);
    const fac=FAC[g.faction];
    const skin=SKIN[seed%3];
    const px=(px_,py,col)=>{x.fillStyle=col;x.fillRect(px_,py,1,1);};
    const rect=(a,b,w2,h2,col)=>{x.fillStyle=col;x.fillRect(a,b,w2,h2);};
    // 背景(勢力の暗色グラデ風)
    rect(0,0,S,S,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]-14));
    // 肩・胴(鎧)
    rect(5,20,18,8,hsl(fac.armor[0],fac.armor[1],fac.armor[2]));
    rect(5,20,18,2,hsl(fac.trim[0],fac.trim[1],fac.trim[2]));
    rect(7,24,2,4,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]));
    rect(19,24,2,4,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]));
    // 首・顔
    rect(11,17,6,4,hsl(skin[0],skin[1],skin[2]-8));
    rect(9,8,10,11,hsl(skin[0],skin[1],skin[2]));        // 顔
    rect(9,8,10,2,hsl(skin[0],skin[1],skin[2]+8));
    // 目
    rect(11,12,2,2,'#23170f'); rect(15,12,2,2,'#23170f');
    // 髭(weaponや種別で出し分け)
    const beard=seed%4;
    const beardCol=hsl(20,30,18+(seed%3)*4);
    if(g.weapon==='podao'||beard===0){ rect(9,16,10,3,beardCol); rect(11,19,6,3,beardCol); } // 長髯(関羽系)
    else if(beard===1){ rect(10,16,8,2,beardCol); }
    else if(beard===2){ rect(12,16,4,2,beardCol); }
    // 頭装備: 系統で出し分け
    const cls=classOf(g.weapon);
    if(cls==='lord'){ // 王冠
      rect(8,4,12,4,hsl(45,80,52)); rect(10,2,2,2,hsl(48,85,60)); rect(13,1,2,3,hsl(48,90,66)); rect(16,2,2,2,hsl(48,85,60));
      rect(8,7,12,2,hsl(45,70,40));
    } else if(cls==='scholar'){ // 綸巾(学者) + 羽扇の色味
      rect(7,3,14,6,hsl(220,12,88)); rect(7,3,14,2,hsl(220,10,96)); rect(7,8,14,1,hsl(220,12,70));
    } else if(cls==='archer'){ // 軽い頭巾
      rect(8,5,12,5,hsl(fac.trim[0],40,40)); rect(8,5,12,2,hsl(fac.trim[0],45,55));
    } else { // 兜(武人)+前立て
      rect(7,4,14,6,hsl(fac.armor[0],fac.armor[1],fac.armor[2]-6));
      rect(7,4,14,2,hsl(fac.trim[0],fac.trim[1],fac.trim[2]));
      rect(13,1,2,4,hsl(fac.trim[0],85,62));   // 前立て
      rect(6,9,2,3,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2])); // 吹返し
      rect(20,9,2,3,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]));
    }
    // 武器グリフ(右肩越し)
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
    const set=(a,b,col)=>{x.fillStyle=col;x.fillRect(ox+a,oy+b,1,1);};
    const line=(pts,col)=>pts.forEach(p=>set(p[0],p[1],col));
    const steel='#cdd6e0', wood='#7a4a22', gold='#ffcf57', fire='#ff7a2a', purp='#b07 aff';
    switch(w){
      case 'podao': line([[0,0],[1,1],[2,2],[3,3],[4,4],[5,5]],wood); line([[0,0],[ -0,1],[1,0]],steel); set(0,0,'#d6ff8a'); set(1,1,'#a8e060'); break;
      case 'spear': line([[5,0],[4,1],[3,2],[2,3],[1,4],[0,5]],wood); set(5,0,steel); set(4,1,steel); break;
      case 'halberd': line([[5,0],[4,1],[3,2],[2,3],[1,4],[0,5]],wood); set(4,0,steel); set(5,1,steel); break;
      case 'bow': line([[0,0],[1,1],[1,2],[1,3],[0,4]],'#caa050'); line([[0,0],[0,4]],'#eee'); break;
      case 'crossbow': line([[0,1],[1,1],[2,1],[3,1],[4,1]],wood); set(2,0,steel); set(2,2,steel); break;
      case 'twin': line([[0,0],[1,1],[2,2]],steel); line([[3,0],[4,1],[5,2]],steel); break;
      case 'mace': line([[3,3],[4,4],[5,5]],wood); set(2,2,'#9aa'); set(1,1,'#9aa'); set(2,1,'#cdd'); set(1,2,'#cdd'); break;
      case 'axe': line([[3,2],[3,3],[3,4],[3,5]],wood); line([[0,1],[1,0],[2,1],[1,2],[0,2]],steel); break;
      case 'charge': line([[0,3],[1,3],[2,2],[3,2],[4,1],[5,1]],'#e0556a'); break;
      case 'summon': set(1,1,'#8d6'); set(3,1,'#8d6'); set(2,3,'#8d6'); line([[1,1],[1,2]],'#6a4'); break;
      case 'fire': line([[2,0],[1,2],[3,2],[2,4],[1,3],[3,3]],fire); set(2,2,'#ffd24a'); break;
      case 'array': line([[0,0],[2,0],[4,0],[0,2],[2,2],[4,2],[0,4],[2,4],[4,4]],'#b388ff'); break;
      case 'aura': line([[2,0],[2,4],[0,2],[4,2]],gold); set(2,2,'#fff2a8'); break;
      case 'chakram': line([[1,0],[3,0],[0,1],[4,1],[0,3],[4,3],[1,4],[3,4]],steel); break;
      default: set(2,2,steel);
    }
  }

  // ── トップダウン本体(君主)。向きで体を反転。
  function lordSprite(lord){
    const key='lord'+lord.id;
    if(cache[key]) return cache[key];
    const S=20,{c,x}=mk(S,S);
    const fac=FAC[lord.faction];
    const rect=(a,b,w2,h2,col)=>{x.fillStyle=col;x.fillRect(a,b,w2,h2);};
    rect(6,3,8,8,hsl(fac.armor[0],fac.armor[1],fac.armor[2]));    // 胴(上から)
    rect(6,3,8,2,hsl(fac.trim[0],fac.trim[1],fac.trim[2]));
    rect(8,11,4,6,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]));// 脚
    rect(8,0,4,4,hsl(45,55,40));                                  // 兜/頭
    rect(9,0,2,2,hsl(48,80,60));
    rect(4,5,2,5,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2])); // 腕
    rect(14,5,2,5,hsl(fac.armorD[0],fac.armorD[1],fac.armorD[2]));
    cache[key]=c; return c;
  }

  // ── 敵スプライト(shape,hue,scale)でキャッシュ
  function enemy(shape, hue, big){
    const key='e'+shape+'_'+hue+'_'+(big||0);
    if(cache[key]) return cache[key];
    const S = big?28:18, {c,x}=mk(S,S);
    const rect=(a,b,w2,h2,col)=>{x.fillStyle=col;x.fillRect(a,b,w2,h2);};
    const body=hsl(hue,45,45), dark=hsl(hue,45,30), light=hsl(hue,40,60), skin='hsl(28,40,70)';
    const cx=S/2;
    function torso(w2,h2,col){rect(Math.floor(cx-w2/2),Math.floor(S*0.35),w2,h2,col);}
    if(shape==='foot'){ rect(cx-3,4,6,5,skin); rect(cx-4,9,8,6,body); rect(cx-4,9,8,1,light); rect(cx-3,15,2,3,dark); rect(cx+1,15,2,3,dark); }
    else if(shape==='light'){ rect(cx-2,4,4,4,skin); rect(cx-3,8,6,5,body); rect(cx-2,13,2,4,dark); rect(cx,13,2,4,dark); }
    else if(shape==='heavy'){ const o=big?2:0; rect(cx-4-o,4,8+2*o,6,skin); rect(cx-6-o,10,12+2*o,8,body); rect(cx-6-o,10,12+2*o,2,light); rect(cx-5-o,18,4,3,dark); rect(cx+1,18,4,3,dark); }
    else if(shape==='shield'){ rect(cx-3,4,6,5,skin); rect(cx-4,9,8,7,body); rect(cx-7,8,4,9,light); rect(cx-7,8,4,1,'#fff'); rect(cx-7,8,1,9,'#fff'); }
    else if(shape==='archer'){ rect(cx-2,4,5,4,skin); rect(cx-3,8,7,6,body); rect(cx+3,6,1,8,light); rect(cx+4,6,1,2,'#eee'); rect(cx+4,12,1,2,'#eee'); }
    else if(shape==='mage'){ rect(cx-3,3,6,3,hsl(hue,50,55)); rect(cx-2,6,4,3,skin); rect(cx-5,9,10,9,hsl(hue,50,40)); rect(cx-5,9,10,2,hsl(hue,55,58)); rect(cx-1,12,2,4,hsl(hue,70,70)); }
    else if(shape==='horse'){ rect(cx-7,9,12,6,hsl(28,35,32)); rect(cx-7,13,2,4,'#241a12'); rect(cx+3,13,2,4,'#241a12'); rect(cx+4,6,4,5,hsl(28,35,38)); rect(cx-3,2,5,7,body); rect(cx-2,1,3,3,skin); }
    else if(shape==='bomb'){ rect(cx-4,7,8,8,hsl(hue,40,35)); rect(cx-3,7,6,2,hsl(hue,45,55)); rect(cx-1,4,2,3,'#555'); rect(cx,3,1,1,'#ff7'); }
    else { torso(8,8,body); }
    cache[key]=c; return c;
  }

  // ── ボス(将官の大型トップダウン)
  function bossSprite(shape, hue){
    const key='boss'+shape+'_'+hue;
    if(cache[key]) return cache[key];
    const S=44,{c,x}=mk(S,S);
    const rect=(a,b,w2,h2,col)=>{x.fillStyle=col;x.fillRect(a,b,w2,h2);};
    const cx=S/2, body=hsl(hue,55,46), dark=hsl(hue,55,30), light=hsl(hue,50,62), gold='hsl(45,80,55)';
    rect(cx-3,30,6,10,hsl(28,30,28));         // マント裾
    rect(cx-9,12,18,18,body); rect(cx-9,12,18,3,light);  // 胴
    rect(cx-9,12,3,18,dark); rect(cx+6,12,3,18,dark);
    rect(cx-5,5,10,9,'hsl(28,40,68)');         // 顔
    rect(cx-3,9,2,2,'#1a120a'); rect(cx+1,9,2,2,'#1a120a');
    rect(cx-3,12,6,2,hsl(20,30,20));           // 髭
    if(shape==='lord'){ rect(cx-6,1,12,5,gold); rect(cx-1,-1,2,3,'hsl(48,90,66)'); rect(cx-4,0,2,2,gold); rect(cx+2,0,2,2,gold); }
    else if(shape==='mage'){ rect(cx-6,0,12,6,hsl(hue,40,55)); rect(cx-1,-2,2,4,hsl(hue,70,70)); }
    else { rect(cx-7,3,14,5,dark); rect(cx-1,-1,2,5,hsl(hue,80,62)); rect(cx-8,7,3,5,dark); rect(cx+5,7,3,5,dark); }
    cache[key]=c; return c;
  }

  function minionSprite(faction){
    const key='min'+faction; if(cache[key])return cache[key];
    const S=14,{c,x}=mk(S,S); const fac=FAC[faction]; const rect=(a,b,w2,h2,col)=>{x.fillStyle=col;x.fillRect(a,b,w2,h2);};
    rect(5,2,4,4,'hsl(28,40,70)'); rect(4,6,6,5,hsl(fac.armor[0],fac.armor[1],fac.armor[2])); rect(4,6,6,1,hsl(fac.trim[0],fac.trim[1],fac.trim[2])); rect(5,11,1,3,'#333'); rect(8,11,1,3,'#333');
    cache[key]=c; return c;
  }

  // ── 壺(ピックアップ): heal/vacuum/clear ───────
  function jar(type){
    const key='jar'+type; if(cache[key])return cache[key];
    const S=18,{c,x}=mk(S,S); const rect=(a,b,w2,h2,col)=>{x.fillStyle=col;x.fillRect(a,b,w2,h2);};
    const lit = type==='heal'?'#7CFC8A': type==='clear'?'#ff9a5a':'#86c5ff';
    const dk  = type==='heal'?'#2e7d4a': type==='clear'?'#9a3a18':'#2a5f9a';
    // 壺本体(陶器)
    rect(4,7,10,9,'#9a6a3a'); rect(4,7,10,2,'#b88a55'); rect(4,15,10,1,'#6a4626');
    rect(3,9,1,5,'#6a4626'); rect(14,9,1,5,'#6a4626');
    rect(6,4,6,3,'#7a5230'); rect(5,6,8,2,'#8a5f38'); // 口
    // 中身の光
    rect(7,9,4,5,lit); rect(7,9,4,1,'#fff');
    // シンボル
    if(type==='heal'){ rect(9,10,1,3,'#ffffff'); rect(8,11,3,1,'#ffffff'); }      // 十字
    else if(type==='clear'){ rect(8,9,1,1,'#fff'); rect(7,11,1,1,'#fff'); rect(10,11,1,1,'#fff'); rect(9,12,1,1,'#fff'); } // 爆
    else { rect(7,11,4,1,'#fff'); rect(9,9,1,4,'#fff'); }                          // 集
    rect(0,0,1,1,dk);
    cache[key]=c; return c;
  }

  return {general, lordSprite, enemy, bossSprite, minionSprite, jar, classOf, hash};
})();
