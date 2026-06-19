// Deterministic Japanese furigana via kuroshiro + kuromoji. Outputs text where
// every kanji is annotated as 漢字[かんじ] (matching the Passage.tsx parser).
// Used by gen_furigana.cjs (one-off) and enrich_meta.mjs (ongoing).
const Kuroshiro = require("kuroshiro").default;
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");
const path = require("path");

let kuro = null;
let ready = null;

async function init() {
  if (kuro) return kuro;
  if (!ready) {
    ready = (async () => {
      kuro = new Kuroshiro();
      await kuro.init(new KuromojiAnalyzer({
        dictPath: path.join(__dirname, "..", "node_modules", "kuromoji", "dict"),
      }));
      return kuro;
    })();
  }
  return ready;
}

const RUBY_RE = /<ruby>([\s\S]*?)<rp>[\s\S]*?<\/rp><rt>([\s\S]*?)<\/rt>[\s\S]*?<\/ruby>/g;

/** Convert text to furigana-marked form: 漢字[かんじ] over every kanji. */
async function toFurigana(text) {
  await init();
  const html = await kuro.convert(text, { to: "hiragana", mode: "furigana" });
  return html.replace(RUBY_RE, (_m, base, reading) => `${base}[${reading}]`);
}

module.exports = { init, toFurigana };
