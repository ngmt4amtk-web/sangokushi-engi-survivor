// music.js — ZzFXM風プレイヤー用BGMデータ。
// 各曲のbpm/音名コメントは音楽監修が後で耳調整するために残す。
(function(){
  'use strict';

  const R=null;
  const n=(note,d,g,w)=>({n:note,d,g,w});
  const rest=(count)=>Array.from({length:count},()=>R);
  const fill=(len,fn)=>Array.from({length:len},(_,i)=>fn(i)||R);

  // title「悠久」60bpm 角調(E-G-A-B-D)。宮音Eドローン持続＋笛風旋律、ゆったり8小節ループ。
  const titleMel=[
    n('E5',4,.72),R,R,R, n('G5',4,.56),R,R,R, n('A5',6,.62),R,R,R,R,R, n('G5',2,.45),R,
    n('E5',4,.58),R,R,R, n('B5',4,.48),R,R,R, n('D6',6,.42),R,R,R,R,R, n('B5',2,.42),R,
    n('A5',4,.55),R,R,R, n('G5',4,.48),R,R,R, n('E5',8,.58),R,R,R,R,R,R,R,
    n('G5',4,.45),R,R,R, n('A5',4,.48),R,R,R, n('B5',8,.38),R,R,R,R,R,R,R
  ];

  // battle「疾風」132bpm 羽調(A-C-D-E-G)。低音A-A-G-A四分＋三角波2小節応答、ハット16分、スネア2/4拍。
  const battleBass=fill(32,i=>({0:'A2',4:'A2',8:'G2',12:'A2',16:'A2',20:'A2',24:'G2',28:'A2'}[i]?n({0:'A2',4:'A2',8:'G2',12:'A2',16:'A2',20:'A2',24:'G2',28:'A2'}[i],3,.95):R));
  const battleLead=[
    R,R,n('A4',2,.45),R, n('C5',2,.48),R,n('D5',2,.48),R, n('E5',3,.54),R,R,n('D5',1,.42), n('C5',2,.42),R,R,R,
    R,n('E5',2,.45),R,n('G5',2,.50), R,n('E5',2,.45),R,n('D5',2,.45), n('C5',3,.42),R,R,n('A4',1,.42), n('A4',2,.40),R,R,R
  ];
  const battleHat=fill(32,i=>n('C6',1,i%4===0?.24:.13,'hat'));
  const battleSnare=fill(32,i=>(i===4||i===12||i===20||i===28)?n('C4',1,.55,'snare'):R);

  // boss「決戦」145bpm 宮調(C-D-E-G-A)。ベース8分駆動、1拍目に銅鑼、ブリッジ後半は半音上昇。
  const bossBass=fill(64,i=>{
    const a=['C2','C2','D2','E2','G2','E2','D2','C2'];
    const b=['C#2','C#2','D#2','F2','G#2','F2','D#2','C#2'];
    return n((i>=48?b:a)[i%8],1,.78,'sawtooth');
  });
  const bossLead=fill(64,i=>{
    const map={
      0:'C4',4:'D4',8:'E4',12:'G4',16:'A4',20:'G4',24:'E4',28:'D4',
      32:'C5',36:'A4',40:'G4',44:'E4',
      48:'C#5',52:'D#5',56:'F5',60:'G#5'
    };
    return map[i]?n(map[i],3,.48):R;
  });
  const bossGong=fill(64,i=>(i%16===0)?n('C2',3,.75,'gong'):R);
  const bossHat=fill(64,i=>i%2===0?n('C6',1,.11,'hat'):R);

  // doom「挽歌」72bpm 商調。ラメントバスA-G-F-E全音符、長音旋律、薄いA/Eドローン。
  const doomBass=[n('A2',8,.72),...rest(7),n('G2',8,.65),...rest(7),n('F2',8,.62),...rest(7),n('E2',8,.68),...rest(7)];
  const doomMel=[R,R,n('A4',6,.35),...rest(5),R,n('G4',7,.35),...rest(6),R,n('F4',8,.34),...rest(7),R,n('E4',7,.36),...rest(6)];

  // victory「凱歌」126bpm 徵調(G-A-C-D-E)。2小節上行ファンファーレ、ジングル、ループなし。
  const victoryLead=[
    n('G4',2,.72),R,n('A4',2,.72),R,n('C5',2,.80),R,n('D5',2,.82),R,
    n('E5',3,.9),R,R,n('G5',3,.82),R,R,n('E5',2,.70),R,
    n('D5',2,.75),R,n('E5',2,.85),R,n('G5',4,.92),R,R,R,
    n('A5',6,1.0),R,R,R,R,R
  ];

  window.MUSIC={
    title:{id:'title',name:'悠久',bpm:60,stepsPerBeat:2,loop:true,
      note:'60bpm 角調 E-G-A-B-D。宮音Eドローン＋笛風三角波、8小節ループ、音量控えめ。',
      tracks:[
        {wave:'sine',gain:.030,a:.60,r:1.60,hold:1.00,seq:[n('E2',64,1),...rest(63)]},
        {wave:'sine',gain:.017,a:.55,r:1.40,hold:1.00,seq:[n('B2',64,1),...rest(63)]},
        {wave:'triangle',gain:.065,a:.035,r:.48,hold:.96,seq:titleMel}
      ]},
    battle:{id:'battle',name:'疾風',bpm:132,stepsPerBeat:4,loop:true,
      note:'132bpm 羽調 A-C-D-E-G。低音A-A-G-A四分、三角波2小節応答、ハット16分、スネア2/4拍。',
      tracks:[
        {wave:'square',gain:.075,a:.006,r:.09,hold:.62,filter:{type:'lowpass',freq:720,q:.8},seq:battleBass},
        {wave:'triangle',gain:.058,a:.015,r:.12,hold:.78,seq:battleLead},
        {wave:'hat',gain:.043,a:.002,r:.035,noiseDur:.045,seq:battleHat},
        {wave:'snare',gain:.118,a:.002,r:.090,noiseDur:.11,seq:battleSnare}
      ]},
    boss:{id:'boss',name:'決戦',bpm:145,stepsPerBeat:4,loop:true,
      note:'145bpm 宮調 C-D-E-G-A。ベース8分駆動、1拍目に銅鑼、終盤ブリッジで半音上昇。',
      tracks:[
        {wave:'sawtooth',gain:.066,a:.004,r:.055,hold:.72,filter:{type:'lowpass',freq:780,q:.8},seq:bossBass},
        {wave:'triangle',gain:.060,a:.010,r:.090,hold:.70,seq:bossLead},
        {wave:'gong',gain:.100,a:.003,r:.45,noiseDur:.24,seq:bossGong},
        {wave:'hat',gain:.030,a:.002,r:.028,noiseDur:.036,seq:bossHat}
      ]},
    doom:{id:'doom',name:'挽歌',bpm:72,stepsPerBeat:2,loop:true,
      note:'72bpm 商調。A-G-F-E全音符ラメントバス、長音旋律、薄いA/Eドローン。doom幕固定。',
      tracks:[
        {wave:'sine',gain:.038,a:.80,r:1.60,hold:1.00,seq:[n('A2',32,1),...rest(31)]},
        {wave:'sine',gain:.018,a:.80,r:1.60,hold:1.00,seq:[n('E3',32,1),...rest(31)]},
        {wave:'triangle',gain:.064,a:.05,r:.95,hold:.96,seq:doomBass},
        {wave:'triangle',gain:.045,a:.10,r:1.10,hold:.96,seq:doomMel}
      ]},
    victory:{id:'victory',name:'凱歌',bpm:126,stepsPerBeat:4,loop:false,
      note:'126bpm 徵調 G-A-C-D-E。2小節上行ファンファーレ、ジングル、ループなし。',
      tracks:[
        {wave:'square',gain:.080,a:.006,r:.10,hold:.72,filter:{type:'lowpass',freq:1600,q:.6},seq:victoryLead},
        {wave:'triangle',gain:.050,a:.010,r:.18,hold:.76,seq:victoryLead.map(c=>c&&c.n?n(c.n.replace(/(\d)$/,m=>String(Math.max(1,+m-1))),c.d||1,.55):R)},
        {wave:'gong',gain:.065,a:.003,r:.32,noiseDur:.18,seq:[n('G2',2,1,'gong'),...rest(31)]}
      ]}
  };
})();
