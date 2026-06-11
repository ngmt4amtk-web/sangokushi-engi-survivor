// 戦闘画面スクショ生成。事前に `python3 -m http.server 8771` などでルートを配信して実行する。
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8771/';

function bootScript(stageNo, protoName, sceneKind){
  return ({stageNo, protoName, sceneKind})=>{
    const gen=window.GENERALS.find(g=>g.name===protoName);
    const stage=Object.assign({},window.STAGES.find(s=>s.no===stageNo));
    const sc=(window.CHAPTER_SCENES[stageNo]||[]).find(s=>s.kind===sceneKind&&s.proto===protoName);
    if(sc){
      stage.dur=sc.dur;
      stage.protagonist=[gen.id];
      stage.boss=null;
      stage.elites=[];
      if(sc.recolor)stage.recolor=sc.recolor;
      if(sc.pool)stage.pool=sc.pool;
    }
    const lord={
      id:gen.id,name:gen.name,faction:gen.faction,start:gen.name,startExtra:null,
      baseHp:125,baseMove:1,baseMagnet:1,buff:{},sig:null,
      passiveName:gen.title,passiveDesc:gen.skillDesc
    };
    const save={owned:{},meta:{gold:0,upg:{}}};
    document.querySelectorAll('.screen,.over').forEach(e=>e.classList.remove('show'));
    document.getElementById('hud').classList.add('show');
    window.G.startRun({lord,stage,owned:save.owned,save,difficulty:'normal',curse:0,
      scene:sc?{kind:sc.kind,dur:sc.dur,last:false,deathLine:sc.deathLine,epitaph:sc.epitaph}:null});
    return sc?sc.dur:stage.dur;
  };
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome', args:['--use-gl=swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error')errors.push('CONSOLE: '+m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));

  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.waitForSelector('#b-play',{timeout:8000});
  await page.evaluate(bootScript(),{stageNo:1,protoName:'劉備',sceneKind:null});
  await page.waitForTimeout(2600);
  await page.screenshot({path:'/tmp/engi_shot1.png'});

  await page.reload({waitUntil:'networkidle'});
  await page.waitForSelector('#b-play',{timeout:8000});
  const dur=await page.evaluate(bootScript(),{stageNo:7,protoName:'孫堅',sceneKind:'doom'});
  await page.evaluate((dur)=>{ const R=window.G.getR(); if(R)R.t=dur-1.45; },dur);
  await page.waitForTimeout(900);
  await page.screenshot({path:'/tmp/engi_doom.png'});

  await browser.close();
  if(errors.length){
    console.log('ERRORS('+errors.length+')');
    errors.forEach(e=>console.log(e));
    process.exit(2);
  }
  console.log('saved /tmp/engi_shot1.png and /tmp/engi_doom.png');
})();
