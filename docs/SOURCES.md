# Knowledge sources

The only material Capsule may add to its knowledge base. `npm run ingest` takes a source's name,
licence and publication date; each approved row below gives them. A source not listed here, or
listed but not approved, is not ingested.

Rules for adding a row:

- **Approved** means the owner holds written permission for Capsule to store and quote the
  material, or the licence allows it (for example Creative Commons or public domain). Record when
  and how permission was given.
- **Pending** means the source is wanted but permission or details are missing. Do not ingest it.
- The published date is the date the author gives the material. Retrieval ranks passages by it,
  so never use the day of ingestion.
- Material sent by people stays out of git: this repository is public. It lives in
  `docs/from_stylist/`, which git ignores. Name people by role here, never by name or contact.

## Sources

| Name               | Status  | Owner             | Licence       | Published | Ingest from                               |
| ------------------ | ------- | ----------------- | ------------- | --------- | ----------------------------------------- |
| Style fundamentals | Pending | Capsule's stylist | Not yet given | Unknown   | `docs/from_stylist/Style fundamentals.md` |

### Style fundamentals

The stylist's own notes on colour, proportion and silhouette, fabric and texture, pattern mixing,
shoes and accessories, and care. Item 1 of "What Capsule needs from a stylist". Received
2026-11-24 as a PDF exported from Google Docs.

- Ingest the Markdown file, not the PDF. The PDF holds its 11 tables as images, which the
  ingest command cannot read; the Markdown file is a word-for-word transcription with the tables
  as text.
- Needed before it can be approved:
  - the stylist's written permission for Capsule to store and quote it;
  - the date the stylist wrote it, for `--published`;
  - the end of one table cell cut off in the PDF (care table, Silk, "Watch out for"). Fix it
    before the first ingest: re-running the command adds new passages but does not remove the
    old one.

## Named but not ingested

Works the stylist refers to. Capsule may name them in advice. Their text is not ingested and
their licences have not been checked.

| Work                                             | Author         | Named in           |
| ------------------------------------------------ | -------------- | ------------------ |
| The Art of Color                                 | Johannes Itten | Style fundamentals |
| The Color Star                                   | Johannes Itten | Style fundamentals |
| A Dictionary of Color Combinations, vol. 1 and 2 | Sanzo Wada     | Style fundamentals |
| Natural World Color Combinations                 | Tim EP         | Style fundamentals |
