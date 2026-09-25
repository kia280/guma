export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'br' }
  | { type: 'code'; value: string }
  | { type: 'bold' | 'italic' | 'underline' | 'strike' | 'spoiler'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] };

export interface ListItem {
  children: InlineNode[];
  sublist?: ListBlock;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  start: number;
  items: ListItem[];
}

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'subtext'; children: InlineNode[] }
  | { type: 'quote'; children: BlockNode[] }
  | { type: 'codeBlock'; language: string; value: string }
  | ListBlock;

const FENCE = '```';
const HEADING = /^(#{1,3}) +(\S.*)$/;
const SUBTEXT = /^-# +(\S.*)$/;
const QUOTE = /^> (.*)$/;
const MULTILINE_QUOTE = /^>>> ?(.*)$/;
const LIST_ITEM = /^( *)([-*]|\d{1,9}\.) +(\S.*)$/;
const LANGUAGE = /^[A-Za-z0-9_+#.-]+$/;
const ESCAPABLE = /[\\`*_~|[\]()<>#>.-]/;
const MASKED_LINK = /^\[([^\]\n]+)\]\(<?(https?:\/\/[^\s<>()]+)>?\)/;
const AUTO_LINK = /^<?(https?:\/\/[^\s<>]*[^\s<>.,:;"')\]!?])>?/;
const WORD_CHAR = /[\p{L}\p{N}]/u;

export function parseDiscordMarkdown(source: string): BlockNode[] {
  return parseBlocks(source.replace(/\r\n?/g, '\n').split('\n'), true);
}

function parseBlocks(lines: string[], allowQuotes: boolean): BlockNode[] {
  const blocks: BlockNode[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith(FENCE)) {
      const fence = readCodeFence(lines, i);
      if (fence) {
        flushParagraph();
        blocks.push(fence.block);
        i = fence.end;
        continue;
      }
    }

    const multiQuote = allowQuotes ? MULTILINE_QUOTE.exec(line) : null;
    if (multiQuote) {
      flushParagraph();
      blocks.push({ type: 'quote', children: parseBlocks([multiQuote[1], ...lines.slice(i + 1)], false) });
      break;
    }

    if (allowQuotes && QUOTE.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]) && !MULTILINE_QUOTE.test(lines[i])) {
        quoted.push(lines[i].slice(2));
        i++;
      }
      i--;
      blocks.push({ type: 'quote', children: parseBlocks(quoted, false) });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, children: parseInline(heading[2]) });
      continue;
    }

    const subtext = SUBTEXT.exec(line);
    if (subtext) {
      flushParagraph();
      blocks.push({ type: 'subtext', children: parseInline(subtext[1]) });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        items.push(lines[i]);
        i++;
      }
      i--;
      blocks.push(...parseList(items));
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

function readCodeFence(lines: string[], start: number): { block: BlockNode; end: number } | null {
  const opening = lines[start].trimStart().slice(FENCE.length);
  const sameLineClose = opening.indexOf(FENCE);
  if (sameLineClose > 0) {
    return { block: { type: 'codeBlock', language: '', value: opening.slice(0, sameLineClose) }, end: start };
  }

  for (let end = start + 1; end < lines.length; end++) {
    const close = lines[end].indexOf(FENCE);
    if (close === -1) continue;

    const body = [...lines.slice(start + 1, end), lines[end].slice(0, close)];
    if (body[body.length - 1] === '') body.pop();
    const language = LANGUAGE.test(opening) ? opening : '';
    if (!language && opening !== '') body.unshift(opening);
    return { block: { type: 'codeBlock', language, value: body.join('\n') }, end };
  }
  return null;
}

function parseList(lines: string[]): ListBlock[] {
  const entries = lines.map(line => {
    const [, indent, marker, text] = LIST_ITEM.exec(line)!;
    return { indent: indent.length, marker, text };
  });

  const build = (from: number, to: number): ListBlock[] => {
    const lists: ListBlock[] = [];
    const baseIndent = entries[from].indent;
    let i = from;
    while (i < to) {
      const entry = entries[i];
      const ordered = entry.marker !== '-' && entry.marker !== '*';
      let current = lists[lists.length - 1];
      if (!current || current.ordered !== ordered) {
        current = { type: 'list', ordered, start: ordered ? Number.parseInt(entry.marker, 10) : 1, items: [] };
        lists.push(current);
      }

      let next = i + 1;
      while (next < to && entries[next].indent > baseIndent) next++;
      const item: ListItem = { children: parseInline(entry.text) };
      if (next > i + 1) {
        const [sublist] = build(i + 1, next);
        item.sublist = sublist;
      }
      current.items.push(item);
      i = next;
    }
    return lists;
  };

  return build(0, entries.length);
}

type Delimited = 'bold' | 'italic' | 'underline' | 'strike' | 'spoiler';

const DELIMITERS: Array<{ token: string; type: Delimited | 'boldItalic' }> = [
  { token: '***', type: 'boldItalic' },
  { token: '**', type: 'bold' },
  { token: '__', type: 'underline' },
  { token: '~~', type: 'strike' },
  { token: '||', type: 'spoiler' },
  { token: '*', type: 'italic' },
  { token: '_', type: 'italic' },
];

export function parseInline(source: string, allowLinks = true): InlineNode[] {
  const nodes: InlineNode[] = [];
  let text = '';

  const pushText = (value: string) => {
    text += value;
  };
  const flushText = () => {
    if (text) nodes.push({ type: 'text', value: text });
    text = '';
  };
  const push = (node: InlineNode) => {
    flushText();
    nodes.push(node);
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const rest = source.slice(i);

    if (ch === '\\' && i + 1 < source.length && ESCAPABLE.test(source[i + 1])) {
      pushText(source[i + 1]);
      i += 2;
      continue;
    }

    if (ch === '\n') {
      push({ type: 'br' });
      i++;
      continue;
    }

    if (ch === '`') {
      const ticks = rest.startsWith('``') ? '``' : '`';
      const close = source.indexOf(ticks, i + ticks.length);
      if (close > i + ticks.length) {
        push({ type: 'code', value: source.slice(i + ticks.length, close) });
        i = close + ticks.length;
        continue;
      }
    }

    if (allowLinks && ch === '[') {
      const match = MASKED_LINK.exec(rest);
      if (match) {
        push({ type: 'link', href: match[2], children: parseInline(match[1], false) });
        i += match[0].length;
        continue;
      }
    }

    if (allowLinks && (ch === 'h' || ch === '<') && (i === 0 || !WORD_CHAR.test(source[i - 1]))) {
      const match = AUTO_LINK.exec(rest);
      if (match) {
        push({ type: 'link', href: match[1], children: [{ type: 'text', value: match[1] }] });
        i += match[0].length;
        continue;
      }
    }

    const delimited = matchDelimiter(source, i, allowLinks);
    if (delimited) {
      push(delimited.node);
      i = delimited.end;
      continue;
    }

    pushText(ch);
    i++;
  }

  flushText();
  return nodes;
}

function matchDelimiter(source: string, start: number, allowLinks: boolean): { node: InlineNode; end: number } | null {
  for (const { token, type } of DELIMITERS) {
    if (!source.startsWith(token, start)) continue;
    if (token === '_' && start > 0 && WORD_CHAR.test(source[start - 1])) return null;
    if (token.length === 1 && /\s/.test(source[start + 1] ?? ' ')) continue;

    const contentStart = start + token.length;
    const close = findClosing(source, token, contentStart);
    if (close === -1) continue;
    if (token === '_' && close + 1 < source.length && WORD_CHAR.test(source[close + 1])) continue;

    const children = parseInline(source.slice(contentStart, close), allowLinks);
    const node: InlineNode = type === 'boldItalic'
      ? { type: 'bold', children: [{ type: 'italic', children }] }
      : { type, children };
    return { node, end: close + token.length };
  }
  return null;
}

function findClosing(source: string, token: string, from: number): number {
  const single = token.length === 1;
  for (let i = from; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '`') {
      const close = source.indexOf('`', i + 1);
      if (close !== -1) {
        i = close;
        continue;
      }
    }
    if (!source.startsWith(token, i)) continue;
    if (i === from) return -1;
    if (token === '**' && source[i + 2] === '*') return i + 1;
    if (single && ch === '*') {
      if (source[i + 1] === '*') {
        const pair = source.indexOf('**', i + 2);
        if (pair !== -1) {
          i = pair + 1;
          continue;
        }
      }
      if (/\s/.test(source[i - 1])) continue;
    }
    return i;
  }
  return -1;
}
