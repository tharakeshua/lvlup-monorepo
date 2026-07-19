import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; // CRITICAL: Must import KaTeX CSS

interface MarkdownWithMathProps {
  text: string;
  inline?: boolean;
  className?: string;
  components?: Partial<Components>;
}

// Known LaTeX commands recognized by the preprocessor. Used to (a) collapse
// accidental double-escapes "\\frac" -> "\frac" left over from older prompt
// versions, and (b) auto-wrap commands left outside math mode by the LLM.
const LATEX_CMD_LIST = [
  "frac",
  "sqrt",
  "sum",
  "int",
  "iint",
  "iiint",
  "oint",
  "prod",
  "lim",
  "limsup",
  "liminf",
  "binom",
  "choose",
  "over",
  "cfrac",
  "dfrac",
  "tfrac",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "varepsilon",
  "zeta",
  "eta",
  "theta",
  "vartheta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "omicron",
  "pi",
  "varpi",
  "rho",
  "varrho",
  "sigma",
  "varsigma",
  "tau",
  "upsilon",
  "phi",
  "varphi",
  "chi",
  "psi",
  "omega",
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  "Zeta",
  "Eta",
  "Theta",
  "Iota",
  "Kappa",
  "Lambda",
  "Mu",
  "Nu",
  "Xi",
  "Pi",
  "Rho",
  "Sigma",
  "Tau",
  "Upsilon",
  "Phi",
  "Chi",
  "Psi",
  "Omega",
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "coth",
  "log",
  "ln",
  "lg",
  "exp",
  "max",
  "min",
  "det",
  "deg",
  "gcd",
  "lcm",
  "mod",
  "pmod",
  "leq",
  "geq",
  "neq",
  "le",
  "ge",
  "ne",
  "approx",
  "equiv",
  "sim",
  "simeq",
  "cong",
  "propto",
  "in",
  "notin",
  "subset",
  "subseteq",
  "supset",
  "supseteq",
  "cap",
  "cup",
  "cdot",
  "cdots",
  "ldots",
  "dots",
  "vdots",
  "ddots",
  "times",
  "div",
  "pm",
  "mp",
  "oplus",
  "otimes",
  "odot",
  "star",
  "ast",
  "circ",
  "bullet",
  "infty",
  "partial",
  "nabla",
  "forall",
  "exists",
  "nexists",
  "emptyset",
  "varnothing",
  "implies",
  "iff",
  "to",
  "leftarrow",
  "rightarrow",
  "leftrightarrow",
  "longrightarrow",
  "longleftarrow",
  "mapsto",
  "Rightarrow",
  "Leftarrow",
  "Leftrightarrow",
  "mathbb",
  "mathcal",
  "mathbf",
  "mathrm",
  "mathit",
  "mathfrak",
  "mathsf",
  "mathtt",
  "text",
  "boldsymbol",
  "operatorname",
  "hat",
  "widehat",
  "bar",
  "overline",
  "underline",
  "vec",
  "tilde",
  "widetilde",
  "dot",
  "ddot",
  "underbrace",
  "overbrace",
  "left",
  "right",
  "big",
  "Big",
  "bigg",
  "Bigg",
  "begin",
  "end",
];
const LATEX_CMD_ALT = LATEX_CMD_LIST.join("|");
// Boundary that disallows a continuing letter (so we don't match \sumthing) but
// allows _, ^, {, [, digits, whitespace, end-of-string — all of which are
// legitimate continuations of a LaTeX command (e.g. \sum_{i=1}^n).
const CMD_BOUNDARY = "(?![A-Za-z])";
const DOUBLE_BACKSLASH_CMD_RE = new RegExp(`\\\\\\\\(${LATEX_CMD_ALT})${CMD_BOUNDARY}`, "g");
const BARE_LATEX_CMD_RE = new RegExp(`\\\\(${LATEX_CMD_ALT})${CMD_BOUNDARY}`);

// Walk the text and apply `transform` only to segments OUTSIDE math mode
// (i.e. not between matched $...$ or $$...$$). Lets us patch missing wrappers
// without corrupting already-correct math.
function transformOutsideMath(text: string, transform: (segment: string) => string): string {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "$" && text[i + 1] === "$") {
      const end = text.indexOf("$$", i + 2);
      if (end === -1) {
        out.push(transform(text.slice(i)));
        return out.join("");
      }
      out.push(text.slice(i, end + 2));
      i = end + 2;
    } else if (text[i] === "$") {
      const end = text.indexOf("$", i + 1);
      if (end === -1) {
        out.push(transform(text.slice(i)));
        return out.join("");
      }
      out.push(text.slice(i, end + 1));
      i = end + 1;
    } else {
      let next = text.length;
      for (let j = i; j < text.length; j++) {
        if (text[j] === "$") {
          next = j;
          break;
        }
      }
      out.push(transform(text.slice(i, next)));
      i = next;
    }
  }
  return out.join("");
}

// Auto-wrap a single LaTeX command (with optional sub/sup and brace/bracket
// argument groups) in inline math. Called only on plain segments.
function autoWrapBareCommands(segment: string): string {
  if (!BARE_LATEX_CMD_RE.test(segment)) return segment;
  const re = new RegExp(
    `\\\\(?:${LATEX_CMD_ALT})${CMD_BOUNDARY}` +
      `(?:_\\{[^{}]*\\}|_[A-Za-z0-9]|\\^\\{[^{}]*\\}|\\^[A-Za-z0-9])*` +
      `(?:\\s*(?:\\{[^{}]*\\}|\\[[^\\[\\]]*\\]))*`,
    "g"
  );
  return segment.replace(re, (m) => `$${m}$`);
}

/**
 * Preprocessing Strategy
 *
 * To ensure robustness against various data formats (especially from generated
 * content or different database seeds), this function normalizes the input
 * string before it reaches the Markdown parser.
 */
function preprocessMath(text: string): string {
  let processed = text;

  // 0. Convert LaTeX tabular to array (KaTeX equivalent) and wrap in display math
  // This allows tables to be rendered properly by KaTeX
  processed = processed.replace(
    /\\begin\{tabular\}(.*?)\\end\{tabular\}/gs,
    (_match, content) => `$$\\begin{array}${content}\\end{array}$$`
  );

  // 1. Newline Normalization: Convert literal \n sequences to actual newlines
  processed = processed.replace(/\\n/g, "\n");

  // 2. Dollar Sign Unescaping: Fix \$ and \$$ that might have been escaped
  processed = processed.replace(/\\\$/g, "$");

  // 3. Bracket Normalization: Heuristically detect LaTeX within bare brackets [...]
  //    (using keywords like \frac, \sum) and convert to $$ ... $$
  //    BUT: Skip brackets that are part of LaTeX commands like \left[ or \right]
  //    Also skip brackets that are already inside math mode (between $ or $$)
  processed = processed.replace(
    /(?<!\\left|\\right|\\big|\\Big|\\bigg|\\Bigg|\$)\[([^\]]*(?:\\frac|\\sum|\\int|\\sqrt|\\alpha|\\beta|\\gamma|\\delta|\\theta|\\lambda|\\pi|\\sigma|\\omega|\\Delta|\\Sigma|\\Omega|=|\\cdot|\\times|\\div|\+|-|\^|_)[^\]]*)\](?!\^)/g,
    (match, inner, offset, string) => {
      // Additional check: don't replace if we're inside existing math delimiters
      const beforeMatch = string.substring(0, offset);
      const dollarCount = (beforeMatch.match(/\$/g) || []).length;
      const doubleDollarCount = (beforeMatch.match(/\$\$/g) || []).length;

      // If odd number of single $ (we're inside inline math), skip
      // Account for double $$ which should be counted as pairs
      const inMath = (dollarCount - doubleDollarCount * 2) % 2 === 1;

      return inMath ? match : `$$${inner}$$`;
    }
  );

  // 4. Delimiter Standardization: Convert \[ ... \] to $$ ... $$
  processed = processed.replace(/\\\[/g, "$$").replace(/\\\]/g, "$$");

  // 5. Delimiter Standardization: Convert \( ... \) to $ ... $
  processed = processed.replace(/\\\(/g, "$").replace(/\\\)/g, "$");

  // 6. Collapse accidental double-escaped LaTeX commands. An older prompt
  //    asked the LLM to emit "\\\\frac" which decodes to "\\frac" — KaTeX
  //    reads that as line-break + "frac". Drop one backslash so legacy data
  //    still renders.
  processed = processed.replace(DOUBLE_BACKSLASH_CMD_RE, "\\$1");

  // 7. Auto-wrap loose LaTeX commands left outside math mode. Only applied
  //    to plain (non-math) segments so existing math is never corrupted.
  processed = transformOutsideMath(processed, autoWrapBareCommands);

  return processed;
}

export function MarkdownWithMath({
  text,
  inline = false,
  className = "",
  components = {},
}: MarkdownWithMathProps) {
  // Safety check: handle undefined/null text
  if (!text) {
    return inline ? <span className={className}></span> : <div className={className}></div>;
  }

  const processedText = preprocessMath(text);

  if (inline) {
    return (
      <span className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({ children }) => <>{children}</>,
            ...components,
          }}
        >
          {processedText}
        </ReactMarkdown>
      </span>
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code(props: any) {
            const { inline, className: _className, children, ...rest } = props;
            return inline ? (
              <code
                className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-800"
                {...rest}
              >
                {children}
              </code>
            ) : (
              <code
                className="block overflow-x-auto rounded-lg bg-gray-100 p-3 font-mono text-sm text-gray-800"
                {...rest}
              >
                {children}
              </code>
            );
          },
          p({ children, ...props }) {
            // Prevent invalid nesting and add proper spacing
            return (
              <p className="my-2 leading-relaxed" {...props}>
                {children}
              </p>
            );
          },
          ul({ children, ...props }) {
            return (
              <ul className="my-2 list-inside list-disc space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="my-2 list-inside list-decimal space-y-1" {...props}>
                {children}
              </ol>
            );
          },
          ...components,
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
