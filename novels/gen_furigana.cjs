// One-off: regenerate furiganaParagraphs (and paragraphs where missing) for all
// 100 Japanese days using deterministic kuroshiro, so EVERY kanji gets a reading.
// Preserves grammar/vocabulary from existing GLM enrich; only (re)writes the
// paragraph segmentation + furigana. Run: node novels/gen_furigana.cjs
const fs = require("fs");
const { toFurigana } = require("./kuroshiro_helper.cjs");

const RAW = "/home/jack/french-shadowing/novels/_raw";
const chunks = JSON.parse(fs.readFileSync(`${RAW}/jp_chunks.json`, "utf-8")).chunks;
let enrich = fs.existsSync(`${RAW}/jp_enrich.json`) ? JSON.parse(fs.readFileSync(`${RAW}/jp_enrich.json`, "utf-8")) : {};

function splitParagraphs(text) {
  // Group sentences (~2 per paragraph) for readable structure.
  const parts = text.split(/(?<=[。！？」』])/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i += 2) out.push(parts.slice(i, i + 2).join(""));
  return out.length ? out : [text];
}

(async () => {
  await toFurigana("初期化"); // warm up kuroshiro
  let done = 0;
  for (const c of chunks) {
    const key = String(c.day);
    const cur = enrich[key] || { day: c.day };
    const paragraphs = Array.isArray(cur.paragraphs) && cur.paragraphs.length ? cur.paragraphs : splitParagraphs(c.text);
    const furiganaParagraphs = [];
    for (const p of paragraphs) furiganaParagraphs.push(await toFurigana(p));
    enrich[key] = { ...cur, day: c.day, paragraphs, furiganaParagraphs };
    done++;
    if (done % 20 === 0) { fs.writeFileSync(`${RAW}/jp_enrich.json`, JSON.stringify(enrich, null, 1)); console.log(`furigana ${done}/100`); }
  }
  fs.writeFileSync(`${RAW}/jp_enrich.json`, JSON.stringify(enrich, null, 1));
  console.log(`DONE — furigana regenerated for ${done} JP days (every kanji annotated).`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
