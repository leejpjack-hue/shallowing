import React, { useMemo } from "react";
import { NovelDay } from "./novelData";

interface PassageProps {
  day: NovelDay;
  isJapanese: boolean;
  furigana: boolean;
  highlight: boolean;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface KwTool {
  regex: RegExp | null;
  isKw: (s: string) => boolean;
}

function makeKwTool(keywords: string[], isJp: boolean): KwTool {
  const clean = [...new Set((keywords || []).map((k) => k.trim()).filter(Boolean))];
  if (!clean.length) return { regex: null, isKw: () => false };
  const set = new Set(clean.map((k) => (isJp ? k : k.toLowerCase())));
  const alt = clean.sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
  const regex = new RegExp(`(${alt})`, isJp ? "g" : "gi");
  const isKw = (s: string) => set.has(isJp ? s : s.toLowerCase());
  return { regex, isKw };
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
 * Render a paragraph that may contain furigana markup (漢字[かんじ]). Parses the
 * markup into <ruby>, applies keyword highlighting to plain text and to ruby
 * bases, and is plain+highlight when no markup is present.
 */
function renderAnnotated(src: string, tool: KwTool, furigana: boolean, keyBase: string): React.ReactNode[] {
  const hasRuby = furigana && src.indexOf("[") !== -1;
  if (!hasRuby) return highlightNodes(src, tool, keyBase);
  const nodes: React.ReactNode[] = [];
  const re = /([^\[\]]+?)\[([^\[\]]+?)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) nodes.push(...highlightNodes(src.slice(last, m.index), tool, `${keyBase}-p${k}`));
    const base = m[1];
    const reading = m[2];
    const hl = tool.isKw(base);
    nodes.push(
      <ruby key={`${keyBase}-r${k}`} className={hl ? "bg-amber-200/80 rounded px-0.5" : undefined}>
        {base}
        <rt>{reading}</rt>
      </ruby>
    );
    last = m.index + m[0].length;
    k++;
  }
  if (last < src.length) nodes.push(...highlightNodes(src.slice(last), tool, `${keyBase}-e`));
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
