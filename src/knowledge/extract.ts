import { strFromU8, unzipSync } from 'fflate';
import { posix } from 'node:path';
import { extractText } from 'unpdf';

export const FORMATS = ['text', 'html', 'pdf', 'epub'] as const;
export type Format = (typeof FORMATS)[number];

/** The format of a file name or web address. Web pages are HTML whatever their path. */
export function formatOf(input: string): Format {
  if (/^https?:\/\//i.test(input)) return 'html';
  const extension = posix.extname(input.replaceAll('\\', '/')).toLowerCase();
  const format = (
    {
      '.txt': 'text',
      '.md': 'text',
      '.html': 'html',
      '.htm': 'html',
      '.pdf': 'pdf',
      '.epub': 'epub',
    } as const
  )[extension];
  if (!format) {
    throw new Error(
      `Cannot ingest "${extension || input}": use a .txt, .md, .html, .pdf or .epub file, or a web address`,
    );
  }
  return format;
}

/** Plain text of a document, with blank lines between paragraphs. */
export async function extract(data: Uint8Array, format: Format) {
  switch (format) {
    case 'text':
      return new TextDecoder().decode(data);
    case 'html':
      return htmlToText(new TextDecoder().decode(data));
    case 'pdf': {
      const { text } = await extractText(data);
      return text.join('\n\n');
    }
    case 'epub':
      return epubToText(data);
  }
}

const SKIPPED =
  'script|style|noscript|template|svg|head|nav|header|footer|aside|form';
const BLOCK =
  'p|div|section|article|main|h[1-6]|li|ul|ol|tr|table|blockquote|pre|figure|figcaption|dd|dt|br|hr';
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

/**
 * The readable text of an HTML page: no scripts, styles or site navigation,
 * and a blank line wherever a block element starts or ends.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(new RegExp(`<(${SKIPPED})\\b[\\s\\S]*?</\\1\\s*>`, 'gi'), '')
    .replace(new RegExp(`</?(?:${BLOCK})\\b[^>]*>`, 'gi'), '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? entity;
      const code =
        name[1].toLowerCase() === 'x'
          ? parseInt(name.slice(2), 16)
          : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The chapters of an EPUB in reading order: the package file's spine, not the zip's order. */
function epubToText(data: Uint8Array): string {
  const files = unzipSync(data);
  const read = (path: string) => {
    const file = files[path];
    if (!file) throw new Error(`This EPUB is missing ${path}`);
    return strFromU8(file);
  };
  const packagePath = attribute(
    read('META-INF/container.xml').match(/<rootfile\b[^>]*>/i)?.[0],
    'full-path',
  );
  if (!packagePath) throw new Error('This EPUB does not name its package file');
  const opf = read(packagePath);

  const hrefs = new Map<string, string>();
  for (const [item] of opf.matchAll(/<item\b[^>]*>/gi)) {
    const id = attribute(item, 'id');
    const href = attribute(item, 'href');
    if (id && href) hrefs.set(id, href);
  }
  const folder = posix.dirname(packagePath);
  return [...opf.matchAll(/<itemref\b[^>]*>/gi)]
    .map(([ref]) => hrefs.get(attribute(ref, 'idref') ?? ''))
    .filter((href) => href !== undefined)
    .map((href) =>
      htmlToText(read(posix.join(folder, decodeURIComponent(href)))),
    )
    .join('\n\n');
}

function attribute(tag: string | undefined, name: string) {
  return tag?.match(
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'),
  )?.[1];
}
