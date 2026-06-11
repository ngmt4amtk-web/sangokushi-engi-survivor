#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = {
  generals: 'js/data/generals.js',
  stages: 'js/data/stages.js',
  scenes: 'js/data/scenes.js',
};

const sandbox = { window: {}, console };
vm.createContext(sandbox);

const errors = [];
const warnings = [];

function runDataFile(file) {
  const full = path.join(ROOT, file);
  try {
    const code = fs.readFileSync(full, 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
    return true;
  } catch (err) {
    errors.push(`${file}: parse/eval failed: ${err.message}`);
    return false;
  }
}

for (const file of [FILES.generals, FILES.stages, FILES.scenes]) {
  runDataFile(file);
}

const generals = sandbox.window.GENERALS || [];
const stages = sandbox.window.STAGES || [];
const scenes = sandbox.window.CHAPTER_SCENES || {};

if (!Array.isArray(generals) || !generals.length) errors.push(`${FILES.generals}: window.GENERALS not loaded`);
if (!Array.isArray(stages) || stages.length !== 120) errors.push(`${FILES.stages}: window.STAGES must contain 120 stages`);
if (!scenes || typeof scenes !== 'object') errors.push(`${FILES.scenes}: window.CHAPTER_SCENES not loaded`);

const nameToGeneral = new Map(generals.map(g => [g.name, g]));
const idToName = new Map(generals.map(g => [g.id, g.name]));
const stageByNo = new Map(stages.map(s => [s.no, s]));
const allowedKinds = new Set(['sweep', 'survive', 'doom']);
const ranges = {
  sweep: [40, 70],
  survive: [25, 45],
  doom: [20, 30],
};

let chapterCount = 0;
let sceneCount = 0;
let doomCount = 0;
let totalDurAll = 0;
const kindCounts = { sweep: 0, survive: 0, doom: 0 };

for (let no = 1; no <= 120; no++) {
  const list = scenes[no];
  const stage = stageByNo.get(no);
  const stageNames = new Set(
    ((stage && [...(stage.roster || []), ...(stage.protagonist || [])]) || [])
      .map(id => idToName.get(id))
      .filter(Boolean)
  );

  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`第${no}回: scene entry missing or empty`);
    continue;
  }

  chapterCount++;
  let total = 0;

  list.forEach((sc, idx) => {
    const label = `第${no}回/${idx + 1}幕`;
    sceneCount++;

    if (!allowedKinds.has(sc.kind)) {
      errors.push(`${label}: invalid kind '${sc.kind}'`);
    } else {
      kindCounts[sc.kind]++;
      const [min, max] = ranges[sc.kind];
      if (typeof sc.dur !== 'number' || !Number.isFinite(sc.dur) || sc.dur < min || sc.dur > max) {
        errors.push(`${label}: ${sc.kind} dur ${sc.dur} outside ${min}-${max}`);
      }
      if (sc.kind === 'doom') {
        doomCount++;
        if (!sc.deathLine || typeof sc.deathLine !== 'string') errors.push(`${label}: doom missing deathLine`);
        if (!sc.epitaph || typeof sc.epitaph !== 'string') errors.push(`${label}: doom missing epitaph`);
      }
    }

    total += typeof sc.dur === 'number' ? sc.dur : 0;

    if (typeof sc.proto !== 'string' || !sc.proto) {
      errors.push(`${label}: proto must be a general name string`);
    } else if (!nameToGeneral.has(sc.proto)) {
      errors.push(`${label}: proto '${sc.proto}' not found in generals.js`);
    } else if (stage && !stageNames.has(sc.proto)) {
      warnings.push(`${label}: proto '${sc.proto}' is not in stage ${no} roster/protagonist`);
    }
  });

  if (total < 50 || total > 150) {
    errors.push(`第${no}回: total duration ${total} outside 50-150`);
  }
  totalDurAll += total;
}

if (errors.length) {
  console.error('Scene verification failed');
  for (const err of errors) console.error(`- ${err}`);
  if (warnings.length) {
    console.error('\nWarnings');
    for (const warn of warnings) console.error(`- ${warn}`);
  }
  process.exit(1);
}

console.log('Scene verification passed');
if (warnings.length) {
  console.log('\nWarnings');
  for (const warn of warnings) console.log(`- ${warn}`);
}
console.log('\nChanged files');
console.log(`- ${FILES.scenes}`);
console.log('- tools/verify_scenes.js');
console.log('\nStats');
const avgDur = chapterCount > 0 ? (totalDurAll / chapterCount).toFixed(1) : 0;
console.log(`- chapters: ${chapterCount}`);
console.log(`- scenes: ${sceneCount}`);
console.log(`- doom: ${doomCount}`);
console.log(`- sweep: ${kindCounts.sweep}`);
console.log(`- survive: ${kindCounts.survive}`);
console.log(`- avg chapter duration: ${avgDur}s`);
