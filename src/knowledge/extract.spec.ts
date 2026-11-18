import { strToU8, zipSync } from 'fflate';
import { extract, formatOf, htmlToText } from './extract.js';

// Every text here was written for these tests; none is copied from a source.

/** A one-page PDF showing each line of text, with a correct cross-reference table. */
function pdf(lines: string[]): Uint8Array {
  const content = lines
    .map((line, i) => `BT /F1 12 Tf 72 ${720 - i * 20} Td (${line}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return strToU8(body);
}

/** An EPUB whose zip order differs from its reading order. */
function epub(): Uint8Array {
  const page = (body: string) => strToU8(`<html><body>${body}</body></html>`);
  return zipSync({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(
      '<container><rootfiles><rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
    'OEBPS/text/second.xhtml': page('<p>Then add a belt.</p>'),
    'OEBPS/text/first%20one.xhtml': page(
      '<h1>Fit</h1><p>Start with the shoulders.</p>',
    ),
    'OEBPS/book.opf': strToU8(`<package><manifest>
      <item href="text/second.xhtml" id="b" media-type="application/xhtml+xml"/>
      <item id="a" href="text/first%2520one.xhtml" media-type="application/xhtml+xml"/>
    </manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`),
  });
}

describe('formatOf', () => {
  it('reads the format from the extension, and treats web addresses as HTML', () => {
    expect(formatOf('notes/fit.TXT')).toBe('text');
    expect(formatOf('C:\\books\\guide.epub')).toBe('epub');
    expect(formatOf('report.pdf')).toBe('pdf');
    expect(formatOf('https://example.test/article')).toBe('html');
  });

  it('refuses a format it cannot read', () => {
    expect(() => formatOf('photo.jpg')).toThrow('Cannot ingest ".jpg"');
  });
});

describe('htmlToText', () => {
  it('drops scripts, styles, navigation and comments', () => {
    const html = `<html><head><title>T</title><style>p{}</style></head><body>
      <nav>Menu</nav><header>Site</header><script>var x = "<p>";</script>
      <!-- note --><p>Kept.</p><footer>Legal</footer></body></html>`;
    expect(htmlToText(html)).toBe('Kept.');
  });

  it('puts a blank line between blocks and joins inline text', () => {
    expect(
      htmlToText(
        '<h2>Colour</h2><p>Navy <em>goes</em>\n  with grey.</p><ul><li>One</li><li>Two</li></ul>',
      ),
    ).toBe('Colour\n\nNavy goes\nwith grey.\n\nOne\n\nTwo');
  });

  it('decodes named and numeric entities and leaves unknown ones alone', () => {
    expect(
      htmlToText(
        '<p>Fish &amp; chips&nbsp;&#8212; &#x2019;s &rsquo; &bogus;</p>',
      ),
    ).toBe('Fish & chips \u2014 \u2019s \u2019 &bogus;');
  });
});

describe('extract', () => {
  it('reads text files as they are', async () => {
    expect(await extract(strToU8('Plain notes.'), 'text')).toBe('Plain notes.');
  });

  it('reads the text of a PDF', async () => {
    const text = await extract(
      pdf(['Tweed suits the country.', 'Silk suits the city.']),
      'pdf',
    );
    expect(text).toContain('Tweed suits the country.');
    expect(text).toContain('Silk suits the city.');
  });

  it('reads EPUB chapters in spine order', async () => {
    expect(await extract(epub(), 'epub')).toBe(
      'Fit\n\nStart with the shoulders.\n\nThen add a belt.',
    );
  });
});
