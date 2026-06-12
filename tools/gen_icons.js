// tools/gen_icons.js
// Playwrightで朱印「演」アイコンを生成する。実行は人間側:
// node tools/gen_icons.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function makeIcon(page, size){
  const dataUrl = await page.evaluate((s) => {
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#0b0907';
    x.fillRect(0,0,s,s);
    const pad = Math.round(s*0.13);
    const r = Math.round(s*0.07);
    x.fillStyle = '#8f2419';
    x.fillRect(pad+r,pad,s-pad*2-r*2,s-pad*2);
    x.fillRect(pad,pad+r,s-pad*2,s-pad*2-r*2);
    x.fillRect(pad+r,pad+r,r,r);
    x.fillRect(s-pad-r*2,pad+r,r,r);
    x.fillRect(pad+r,s-pad-r*2,r,r);
    x.fillRect(s-pad-r*2,s-pad-r*2,r,r);
    x.strokeStyle = '#e8c060';
    x.lineWidth = Math.max(4,Math.round(s*0.025));
    x.strokeRect(pad,pad,s-pad*2,s-pad*2);
    x.fillStyle = '#f0e7d6';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `900 ${Math.round(s*0.58)}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
    x.fillText('演',s/2,s*0.54);
    x.globalAlpha = 0.24;
    x.fillStyle = '#f3d68a';
    for(let i=0;i<Math.max(20,s/8);i++){
      const xx=(i*37)%s, yy=(i*91)%s;
      x.fillRect(xx,yy,Math.max(1,s/96),Math.max(1,s/96));
    }
    return c.toDataURL('image/png');
  }, size);
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(path.join(process.cwd(), `icon-${size}.png`), Buffer.from(b64, 'base64'));
}

(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await makeIcon(page, 192);
  await makeIcon(page, 512);
  await browser.close();
  console.log('generated icon-192.png and icon-512.png');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
