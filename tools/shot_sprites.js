// スプライトプレビューのスクショ。NODE_PATH=playwrightキャッシュで実行
const { chromium } = require('playwright');
const path = require('path');
(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport:{width:1100,height:1300}});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('file://'+path.resolve(__dirname,'sprite_preview.html'));
  await page.waitForTimeout(400);
  await page.screenshot({path:'/tmp/sprites_preview.png',fullPage:true});
  await browser.close();
  if(errors.length){ console.log('ERRORS:'); errors.forEach(e=>console.log(e)); process.exit(2); }
  console.log('saved /tmp/sprites_preview.png');
})();
