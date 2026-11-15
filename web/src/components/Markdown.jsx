// Mini rendu Markdown sûr (aucun HTML injecté) : titres, listes, gras, italique, code, liens.
// Les termes du jeu sont soulignés (définition / infobulle au survol) quand un TermsProvider est présent.
import { useTerms } from './Terms.jsx';

function inline(text, keyBase, terms) {
  const out = [];
  const plain = (s, k) => (terms ? terms.linkify(s, k) : s);
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(plain(text.slice(last, m.index), `${keyBase}p${k++}`));
    const t = m[0];
    const key = `${keyBase}${k++}`;
    if (t.startsWith('**')) out.push(<strong key={key}>{plain(t.slice(2, -2), key)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={key}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) {
      const label = t.slice(1, t.indexOf(']'));
      out.push(
        <a key={key} href={m[2]} target="_blank" rel="noreferrer">
          {label}
        </a>,
      );
    } else out.push(<em key={key}>{plain(t.slice(1, -1), key)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(plain(text.slice(last), `${keyBase}e`));
  return out;
}

export default function Markdown({ text, plain = false }) {
  const ctx = useTerms();
  const terms = plain ? null : ctx;
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(' '), `p${blocks.length}`, terms)}</p>);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul';
      const n = blocks.length;
      blocks.push(
        <Tag key={`l${n}`}>
          {list.items.map((it, i) => (
            <li key={i}>{inline(it, `l${n}i${i}`, terms)}</li>
          ))}
        </Tag>,
      );
    }
    list = null;
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if (!l.trim()) {
      flushPara();
      flushList();
    } else if ((m = l.match(/^(#{1,3})\s+(.*)/))) {
      flushPara();
      flushList();
      const H = `h${m[1].length}`;
      blocks.push(<H key={`h${blocks.length}`}>{inline(m[2], `h${blocks.length}`, terms)}</H>);
    } else if ((m = l.match(/^\s*[-*]\s+(.*)/))) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(m[1]);
    } else {
      flushList();
      para.push(l.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="markdown">{blocks}</div>;
}
