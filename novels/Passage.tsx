import React, { useMemo } from "react";
import { NovelDay } from "./novelData";

interface PassageProps {
  day: NovelDay;
  isJapanese: boolean;
  furigana: boolean;
  highlight: boolean;
}

const KANJI = /[一-龯]/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface KwTool {
  regex: RegExp | null;
  isKw: (s: string) => boolean;     // exact match (for plain text segments)
  hitsKw: (s: string) => boolean;   // substring match either way (for ruby bases)
}

function makeKwTool(keywords: string[], isJp: boolean): KwTool {
  const clean = [...new Set((keywords || []).map((k) => k.trim()).filter(Boolean))];
  if (!clean.length) return { regex: null, isKw: () => false, hitsKw: () => false };
  const norm = (k: string) => (isJp ? k : k.toLowerCase());
  const set = new Set(clean.map(norm));
  const alt = clean.sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
  const regex = new RegExp(`(${alt})`, isJp ? "g" : "gi");
  const isKw = (s: string) => set.has(norm(s));
  const hitsKw = (s: string) => clean.some((k) => s.includes(k) || k.includes(s));
  return { regex, isKw, hitsKw };
}

/** Split plain text on keyword matches; wrap matches in <mark>. */
function highlightNodes(text: string, tool: KwTool, keyBase: string): React.ReactNode[] {
  if (!tool.regex) return [text];
  const parts = text.split(tool.regex);
  return parts.map((p, i) => {
    if (!p) return null;
    return tool.isKw(p) ? (
      <mark key={`${keyBase}-h${i}`} className="bg-amber-200/80 text-slate-900 rounded px-0.5">{p}</mark>
    ) : (
      <span key={`${keyBase}-t${i}`}>{p}</span>
    );
  });
}

/**
 * Render a paragraph that may contain furigana markup (漢字[かんじ]).
 * The ruby BASE is split at its first kanji: any preceding kana is rendered as
 * plain text, so the reading sits exactly over the kanji (not the kana before it).
 * Keyword highlighting: exact on plain text, substring on ruby bases.
 */
function renderAnnotated(src: string, tool: KwTool, furigana: boolean, keyBase: string): React.ReactNode[] {
  const hasRuby = furigana && src.indexOf("[") !== -1;
  if (!hasRuby) return highlightNodes(src, tool, keyBase);
  const nodes: React.ReactNode[] = [];
  const re = /([^\[\]]+?)\[([^\[\]]+?)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  const pushText = (text: string, kb: string) => {
    if (text) nodes.push(...highlightNodes(text, tool, kb));
  };
  while ((m = re.exec(src)) !== null) {
    pushText(src.slice(last, m.index), `${keyBase}-p${k}`);
    let base = m[1];
    const reading = m[2];
    // split off any leading non-kanji (e.g. the お/ご honorific) so the ruby
    // base is exactly the kanji token the reading applies to.
    const km = base.match(KANJI);
    if (km && km.index && km.index > 0) {
      pushText(base.slice(0, km.index), `${keyBase}-k${k}`);
      base = base.slice(km.index);
    }
    const hl = tool.hitsKw(base);
    nodes.push(
      <ruby key={`${keyBase}-r${k}`} className={hl ? "bg-amber-200/70 rounded px-0.5" : undefined}>
        {base}
        <rt>{reading}</rt>
      </ruby>
    );
    last = m.index + m[0].length;
    k++;
  }
  pushText(src.slice(last), `${keyBase}-e`);
  return nodes;
}

const Passage: React.FC<PassageProps> = ({ day, isJapanese, furigana, highlight }) => {
  const tool = useMemo(
    () => makeKwTool(highlight ? day.keywords || [] : [], isJapanese),
    [day.keywords, highlight, isJapanese]
  );

  const sources = useMemo(() => {
    const plain = day.paragraphs && day.paragraphs.length ? day.paragraphs : [day.text];
    const furi = day.furiganaParagraphs && day.furiganaParagraphs.length ? day.furiganaParagraphs : null;
    return plain.map((p, i) => (furigana && isJapanese && furi && furi[i] != null ? furi[i] : p));
  }, [day, isJapanese, furigana]);

  return (
    <div className="space-y-4">
      {sources.map((src, i) => (
        <p
          key={i}
          className={`text-xl md:text-2xl leading-loose text-slate-800 ${isJapanese ? "font-jp font-medium" : "font-serif"}`}
        >
          {renderAnnotated(src, tool, furigana && isJapanese, `p${i}`)}
        </p>
      ))}
    </div>
  );
};

export default Passage;
