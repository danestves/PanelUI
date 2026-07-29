/**
 * A small syntax highlighter, sized for a phone.
 *
 * The web answer to this problem is a real tokenizer with a grammar per
 * language, which is megabytes of WASM and a worker. That is the wrong shape
 * here twice over: a chat renders short fragments rather than files, and the
 * fragments arrive a token at a time, so whatever runs has to run again on
 * every frame of a stream. This trades exactness for a single pass of regex
 * that costs nothing and never blocks.
 *
 * What it therefore does *not* do: nested languages, template-literal
 * interpolation, or anything requiring a parser to know it. What it does do is
 * make a keyword look like a keyword, which is the whole of the value in a
 * twelve-line snippet.
 *
 * Anything it does not recognise is returned as one plain token per line, so
 * an unknown language renders as clean monospace rather than as a guess.
 */

/** The kinds a token can be. Each maps to one theme colour. */
export type TokenKind =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'property'
  | 'punctuation'
  | 'inserted'
  | 'deleted';

export interface Token {
  text: string;
  kind: TokenKind;
}

/** The languages that get more than plain monospace. */
export type CodeLanguage =
  | 'ts'
  | 'tsx'
  | 'js'
  | 'jsx'
  | 'json'
  | 'bash'
  | 'python'
  | 'css'
  | 'html'
  | 'sql'
  | 'markdown'
  | 'diff'
  | 'text';

/** Spellings a caller is likely to pass, mapped onto the ones handled here. */
const ALIASES: Record<string, CodeLanguage> = {
  typescript: 'ts',
  ts: 'ts',
  tsx: 'tsx',
  javascript: 'js',
  js: 'js',
  jsx: 'jsx',
  mjs: 'js',
  cjs: 'js',
  json: 'json',
  json5: 'json',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  python: 'python',
  py: 'python',
  css: 'css',
  scss: 'css',
  html: 'html',
  xml: 'html',
  svg: 'html',
  sql: 'sql',
  markdown: 'markdown',
  md: 'markdown',
  mdx: 'markdown',
  diff: 'diff',
  patch: 'diff',
};

/** Resolves a caller's language string. Unknown spellings become `text`. */
export function resolveLanguage(language: string | undefined): CodeLanguage {
  if (!language) return 'text';
  return ALIASES[language.toLowerCase()] ?? 'text';
}

const JS_KEYWORDS =
  'as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|is|keyof|let|new|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|this|throw|try|type|typeof|var|void|while|yield';
const JS_LITERALS = 'true|false|null|undefined|NaN|Infinity';

const PYTHON_KEYWORDS =
  'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield';
const PYTHON_LITERALS = 'True|False|None|self';

const SQL_KEYWORDS =
  'ADD|ALL|ALTER|AND|AS|ASC|BETWEEN|BY|CASE|COLUMN|CREATE|CROSS|DELETE|DESC|DISTINCT|DROP|ELSE|END|EXISTS|FROM|FULL|GROUP|HAVING|IN|INDEX|INNER|INSERT|INTO|IS|JOIN|LEFT|LIKE|LIMIT|NOT|NULL|OFFSET|ON|OR|ORDER|OUTER|PRIMARY|RIGHT|SELECT|SET|TABLE|THEN|UNION|UPDATE|VALUES|WHEN|WHERE|WITH';

const BASH_KEYWORDS =
  'case|do|done|elif|else|esac|export|fi|for|function|if|in|local|return|source|then|until|while';

/**
 * One rule: a pattern, and the kind it produces.
 *
 * Order is the whole design. Comments and strings come first so that a keyword
 * inside either is left alone — the single most visible failure a highlighter
 * this size can have.
 */
interface Rule {
  pattern: RegExp;
  kind: TokenKind;
}

function wordsOf(list: string): RegExp {
  return new RegExp(`^(?:${list})\\b`);
}

const RULES: Record<CodeLanguage, Rule[]> = {
  ts: jsRules(),
  tsx: jsRules(),
  js: jsRules(),
  jsx: jsRules(),
  json: [
    { pattern: /^"(?:[^"\\]|\\.)*"\s*(?=:)/, kind: 'property' },
    { pattern: /^"(?:[^"\\]|\\.)*"/, kind: 'string' },
    { pattern: /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i, kind: 'number' },
    { pattern: /^(?:true|false|null)\b/, kind: 'keyword' },
    { pattern: /^[{}[\],:]/, kind: 'punctuation' },
  ],
  bash: [
    { pattern: /^#.*/, kind: 'comment' },
    { pattern: /^"(?:[^"\\]|\\.)*"/, kind: 'string' },
    { pattern: /^'(?:[^'\\]|\\.)*'/, kind: 'string' },
    { pattern: /^\$\{?[A-Za-z_][\w]*\}?/, kind: 'property' },
    { pattern: wordsOf(BASH_KEYWORDS), kind: 'keyword' },
    { pattern: /^-{1,2}[A-Za-z][\w-]*/, kind: 'property' },
    { pattern: /^[|&;<>()$]/, kind: 'punctuation' },
  ],
  python: [
    { pattern: /^#.*/, kind: 'comment' },
    { pattern: /^[rbf]?"""[\s\S]*?(?:"""|$)/, kind: 'string' },
    { pattern: /^[rbf]?"(?:[^"\\]|\\.)*"/, kind: 'string' },
    { pattern: /^[rbf]?'(?:[^'\\]|\\.)*'/, kind: 'string' },
    { pattern: wordsOf(PYTHON_KEYWORDS), kind: 'keyword' },
    { pattern: wordsOf(PYTHON_LITERALS), kind: 'keyword' },
    { pattern: /^[A-Za-z_]\w*(?=\s*\()/, kind: 'function' },
    { pattern: /^@[A-Za-z_]\w*/, kind: 'function' },
    { pattern: /^\d[\d_]*(?:\.\d+)?/, kind: 'number' },
    { pattern: /^[{}[\]().,:;]/, kind: 'punctuation' },
  ],
  css: [
    { pattern: /^\/\*[\s\S]*?(?:\*\/|$)/, kind: 'comment' },
    { pattern: /^"(?:[^"\\]|\\.)*"/, kind: 'string' },
    { pattern: /^'(?:[^'\\]|\\.)*'/, kind: 'string' },
    { pattern: /^--[\w-]+/, kind: 'property' },
    { pattern: /^@[\w-]+/, kind: 'keyword' },
    { pattern: /^[.#][\w-]+/, kind: 'function' },
    { pattern: /^[a-z-]+(?=\s*:)/i, kind: 'property' },
    { pattern: /^-?\d*\.?\d+(?:px|rem|em|%|vh|vw|s|ms|deg)?/, kind: 'number' },
    { pattern: /^[{}();:,]/, kind: 'punctuation' },
  ],
  html: [
    { pattern: /^<!--[\s\S]*?(?:-->|$)/, kind: 'comment' },
    { pattern: /^"(?:[^"\\]|\\.)*"/, kind: 'string' },
    { pattern: /^'(?:[^'\\]|\\.)*'/, kind: 'string' },
    { pattern: /^<\/?[\w-]+/, kind: 'keyword' },
    { pattern: /^[\w-]+(?==)/, kind: 'property' },
    { pattern: /^\/?>/, kind: 'keyword' },
    { pattern: /^[=]/, kind: 'punctuation' },
  ],
  sql: [
    { pattern: /^--.*/, kind: 'comment' },
    { pattern: /^'(?:[^'\\]|\\.)*'/, kind: 'string' },
    { pattern: new RegExp(`^(?:${SQL_KEYWORDS})\\b`, 'i'), kind: 'keyword' },
    { pattern: /^\d+(?:\.\d+)?/, kind: 'number' },
    { pattern: /^[(),;*.]/, kind: 'punctuation' },
  ],
  markdown: [
    { pattern: /^#{1,6}\s.*/, kind: 'keyword' },
    { pattern: /^`[^`]*`/, kind: 'string' },
    { pattern: /^\*\*[^*]+\*\*/, kind: 'function' },
    { pattern: /^\[[^\]]*\]\([^)]*\)/, kind: 'property' },
    { pattern: /^[>-]\s/, kind: 'punctuation' },
  ],
  diff: [],
  text: [],
};

function jsRules(): Rule[] {
  return [
    { pattern: /^\/\/.*/, kind: 'comment' },
    { pattern: /^\/\*[\s\S]*?(?:\*\/|$)/, kind: 'comment' },
    { pattern: /^`(?:[^`\\]|\\.)*`/, kind: 'string' },
    { pattern: /^"(?:[^"\\]|\\.)*"/, kind: 'string' },
    { pattern: /^'(?:[^'\\]|\\.)*'/, kind: 'string' },
    { pattern: wordsOf(JS_KEYWORDS), kind: 'keyword' },
    { pattern: wordsOf(JS_LITERALS), kind: 'keyword' },
    // A name followed by a paren reads as a call whether or not it is one,
    // which is exactly the reading a highlighter is meant to support.
    { pattern: /^[A-Za-z_$][\w$]*(?=\s*\()/, kind: 'function' },
    { pattern: /^0[xb][\da-f]+|^\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?/i, kind: 'number' },
    { pattern: /^[{}[\]().,;:?!<>=+\-*/%&|^~]/, kind: 'punctuation' },
  ];
}

/**
 * A diff is coloured by line, not by token — the leading `+` or `-` says
 * everything, and highlighting the code inside as well fights with it.
 */
function tokenizeDiffLine(line: string): Token[] {
  if (line.startsWith('+')) return [{ text: line, kind: 'inserted' }];
  if (line.startsWith('-')) return [{ text: line, kind: 'deleted' }];
  if (line.startsWith('@@') || line.startsWith('diff ')) {
    return [{ text: line, kind: 'comment' }];
  }
  return [{ text: line, kind: 'plain' }];
}

/** Runs the rules over one line, longest-first from wherever it has got to. */
function tokenizeLine(line: string, rules: Rule[]): Token[] {
  if (rules.length === 0) return line ? [{ text: line, kind: 'plain' }] : [];

  const tokens: Token[] = [];
  let rest = line;
  let plain = '';

  while (rest.length > 0) {
    let matched: { text: string; kind: TokenKind } | null = null;

    for (const rule of rules) {
      const found = rule.pattern.exec(rest);
      if (found && found[0].length > 0) {
        matched = { text: found[0], kind: rule.kind };
        break;
      }
    }

    if (matched) {
      // Whatever was skipped over to get here is one plain run, not one plain
      // token per character — a token per character is a view per character.
      if (plain) {
        tokens.push({ text: plain, kind: 'plain' });
        plain = '';
      }
      tokens.push(matched);
      rest = rest.slice(matched.text.length);
    } else {
      plain += rest[0];
      rest = rest.slice(1);
    }
  }

  if (plain) tokens.push({ text: plain, kind: 'plain' });
  return tokens;
}

/**
 * Splits code into lines of tokens.
 *
 * Line by line, so a stream that has just gained a character only makes the
 * work grow with the code and never with time. The cost of that choice is that
 * a block comment spanning several lines is only coloured on its first — an
 * acceptable trade for a snippet, and the reason this is not sold as a
 * highlighter for a file.
 */
export function highlight(code: string, language: string | undefined): Token[][] {
  const resolved = resolveLanguage(language);
  const lines = code.split('\n');

  if (resolved === 'diff') return lines.map(tokenizeDiffLine);

  const rules = RULES[resolved];
  return lines.map((line) => tokenizeLine(line, rules));
}
