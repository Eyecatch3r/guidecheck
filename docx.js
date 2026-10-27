// Guidecheck .docx export. Builds a Word file from Markdown in the browser. No dependencies except marked's lexer.
// A comment's passage is marked in the Markdown with DOCX.wrap(text, id); DOCX.build turns the marks into Word comment ranges.
window.DOCX = (() => {
  const OPEN = '', CLOSE = '', END = '';
  const MARK = /([])(\d+)/;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  const x = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const unescape = (s) => String(s ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);

  // Marks go after block syntax (heading hashes, list bullets, a table row's first pipe) and before a row's last pipe,
  // so the Markdown keeps its structure.
  function wrap(text, id) {
    const lead = text.match(/^(\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+|\|\s*)*)/)[1];
    const tail = text.slice(lead.length).match(/(\s*\|?\s*)$/)[1];
    const body = text.slice(lead.length, text.length - tail.length);
    return lead + OPEN + id + END + body + CLOSE + id + END + tail;
  }

  // ---------- Images: PNG and JPEG sizes from the file header ----------
  function size(b) {
    if (b[0] === 0x89 && b[1] === 0x50) { const v = new DataView(b.buffer, b.byteOffset); return [v.getUint32(16), v.getUint32(20), 'png']; }
    if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i + 9 < b.length;) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6], 'jpeg'];
        i += 2 + len;
      }
    }
    return null;
  }

  // ---------- Document body ----------
  function body(markdown, ctx) {
    const out = [];
    const open = new Set();
    const rPr = (f) => {
      const p = [f.style && `<w:rStyle w:val="${f.style}"/>`, f.b && '<w:b/>', f.i && '<w:i/>', f.strike && '<w:strike/>',
        f.code && '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/>'].filter(Boolean).join('');
      return p ? `<w:rPr>${p}</w:rPr>` : '';
    };
    const run = (t, f) => (t ? `<w:r>${rPr(f)}<w:t xml:space="preserve">${x(t)}</w:t></w:r>` : '');
    // Text with comment marks becomes runs with comment range starts and ends between them.
    function text(s, f) {
      const parts = s.replace(/[\r\n]+/g, ' ').split(MARK); // text, kind, id, text, kind, id, …, text
      let xml = run(parts[0], f);
      for (let k = 1; k < parts.length; k += 3) {
        const kind = parts[k], id = Number(parts[k + 1]);
        if (kind === OPEN && !open.has(id) && !ctx.done.has(id)) { open.add(id); xml += `<w:commentRangeStart w:id="${id}"/>`; }
        if (kind === CLOSE && open.has(id)) { open.delete(id); ctx.done.add(id); xml += endComment(id); }
        xml += run(parts[k + 2], f);
      }
      return xml;
    }
    const endComment = (id) => `<w:commentRangeEnd w:id="${id}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`;

    function inline(tokens = [], f = {}) {
      return tokens.map((t) => {
        switch (t.type) {
          case 'strong': return inline(t.tokens, { ...f, b: true });
          case 'em': return inline(t.tokens, { ...f, i: true });
          case 'del': return inline(t.tokens, { ...f, strike: true });
          case 'codespan': return text(unescape(t.text), { ...f, code: true });
          case 'br': return '<w:r><w:br/></w:r>';
          case 'link': {
            const id = ctx.rel('hyperlink', t.href, true);
            return `<w:hyperlink r:id="${id}">${inline(t.tokens, { ...f, style: 'Hyperlink' })}</w:hyperlink>`;
          }
          case 'image': return picture(t) || text(t.text || '', { ...f, i: true });
          default: return t.tokens ? inline(t.tokens, f) : text(unescape(t.text ?? t.raw ?? ''), f);
        }
      }).join('');
    }
    function picture(t) {
      const img = ctx.images.get(t.href); if (!img) return '';
      const n = ++ctx.pics, rid = ctx.rel('image', `media/image${n}.${img.ext}`);
      ctx.media.push({ name: `word/media/image${n}.${img.ext}`, data: img.data });
      const scale = Math.min(1, 6 * 914400 / (img.w * 9525)), cx = Math.round(img.w * 9525 * scale), cy = Math.round(img.h * 9525 * scale);
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${x(t.text)}"/>`
        + `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
        + `<pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="image${n}.${img.ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }
    const para = (content, pPr = '') => out.push(`<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${content}</w:p>`);
    const style = (s) => `<w:pStyle w:val="${s}"/>`;

    function blocks(tokens, level = { list: null, depth: -1, quote: false }) {
      for (const t of tokens) {
        const q = level.quote ? style('Quote') : '';
        const num = level.list ? `${style('ListParagraph')}<w:numPr><w:ilvl w:val="${level.depth}"/><w:numId w:val="${level.list}"/></w:numPr>` : '';
        switch (t.type) {
          case 'heading': para(inline(t.tokens), style(`Heading${Math.min(t.depth, 6)}`)); break;
          case 'paragraph': case 'text': para(t.tokens ? inline(t.tokens) : text(unescape(t.text), {}), num || q); break;
          case 'blockquote': blocks(t.tokens, { ...level, quote: true }); break;
          case 'code': for (const line of t.text.split('\n')) para(text(line, { code: true }), style('Code')); break;
          case 'hr': para('', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C5CCD4"/></w:pBdr>'); break;
          case 'html': para(text(t.text, {}), q); break;
          case 'list': {
            const id = ctx.lists.push({ ordered: t.ordered, start: Number(t.start) || 1 });
            for (const item of t.items) {
              // A list item's first block carries the number; later blocks of the same item continue without one.
              const first = { list: id, depth: Math.min(level.depth + 1, 8), quote: level.quote };
              let k = 0;
              for (const b of item.tokens) {
                if (b.type === 'space') continue;
                if (b.type === 'list') blocks([b], first);
                else if (k++ === 0) blocks([b], first);
                else blocks([b], { list: null, depth: first.depth, quote: level.quote });
              }
            }
            break;
          }
          case 'table': {
            const cell = (c, head) => `<w:tc><w:p>${inline(c.tokens, head ? { b: true } : {})}</w:p></w:tc>`;
            const col = Math.floor(9026 / t.header.length);
            out.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>`
              + `<w:tblGrid>${t.header.map(() => `<w:gridCol w:w="${col}"/>`).join('')}</w:tblGrid>`
              + `<w:tr><w:trPr><w:tblHeader/></w:trPr>${t.header.map((c) => cell(c, true)).join('')}</w:tr>`
              + t.rows.map((r) => `<w:tr>${r.map((c) => cell(c)).join('')}</w:tr>`).join('') + '</w:tbl>');
            out.push('<w:p/>');
            break;
          }
          default: break;
        }
      }
    }
    blocks(window.marked.lexer(markdown));
    // A comment whose end mark was lost still needs an end: close it after the last paragraph.
    if (open.size) out.push(`<w:p>${[...open].map((id) => { ctx.done.add(id); return endComment(id); }).join('')}</w:p>`);
    return out.join('');
  }

  // ---------- Fixed parts ----------
  const styles = () => `${HEAD}<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${[[1, 32], [2, 28], [3, 24], [4, 22], [5, 22], [6, 22]].map(([n, sz]) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n < 3 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`).join('\n')}
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CommentText"><w:name w:val="annotation text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>
<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:color w:val="1D58C0"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr><w:tblPr><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="C5CCD4"/>`).join('')}</w:tblBorders></w:tblPr></w:style>
</w:styles>`;

  function numbering(lists) {
    const lvl = (k, ordered) => {
      const fmt = ordered ? ['decimal', 'lowerLetter', 'lowerRoman'][k % 3] : 'bullet';
      const txt = ordered ? `%${k + 1}.` : ['•', '◦', '▪'][k % 3];
      return `<w:lvl w:ilvl="${k}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${txt}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${360 * (k + 2)}" w:hanging="360"/></w:pPr></w:lvl>`;
    };
    const abs = [0, 1].map((o) => `<w:abstractNum w:abstractNumId="${o}"><w:multiLevelType w:val="hybridMultilevel"/>${Array.from({ length: 9 }, (_, k) => lvl(k, !!o)).join('')}</w:abstractNum>`).join('');
    const nums = lists.map((l, i) => `<w:num w:numId="${i + 1}"><w:abstractNumId w:val="${l.ordered ? 1 : 0}"/>${l.ordered ? `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${l.start}"/></w:lvlOverride>` : ''}</w:num>`).join('');
    return `${HEAD}<w:numbering ${NS}>${abs}${nums}</w:numbering>`;
  }

  // Each comment: paragraphs of plain text; the first paragraph carries Word's comment mark.
  const commentsXml = (comments) => `${HEAD}<w:comments ${NS}>${comments.map((c) => `<w:comment w:id="${c.id}" w:author="${x(c.author)}" w:date="${x(c.date)}" w:initials="${x(c.initials)}">${
    c.paragraphs.map((p, k) => `<w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr>${k ? '' : '<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>'}<w:r>${p.bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${x(p.text)}</w:t></w:r></w:p>`).join('')
  }</w:comment>`).join('')}</w:comments>`;

  // ---------- Zip (stored, no compression) ----------
  const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (b) => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], dir = [];
    let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30)), cen = new DataView(new ArrayBuffer(46));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(12, 0x21, true); local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, name.length, true);
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
      cen.setUint16(14, 0x21, true); cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true); cen.setUint16(28, name.length, true); cen.setUint32(42, off, true);
      parts.push(new Uint8Array(local.buffer), name, data);
      dir.push(new Uint8Array(cen.buffer), name);
      off += 30 + name.length + data.length;
    }
    const size = dir.reduce((n, p) => n + p.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...dir, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ---------- Build ----------
  // markdown: guide text with DOCX.wrap marks. comments: [{id, author, initials, date, paragraphs: [{text, bold}]}].
  // base: folder that relative image paths resolve against.
  async function build({ markdown, comments, base = '', title = '' }) {
    const images = new Map();
    for (const [, href] of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
      if (images.has(href)) continue;
      try {
        const r = await fetch(new URL(href, new URL(base, location.href)), { cache: 'no-store' });
        if (!r.ok) continue;
        const data = new Uint8Array(await r.arrayBuffer()), s = size(data);
        if (s) images.set(href, { data, w: s[0], h: s[1], ext: s[2] });
      } catch { /* image left out: its alt text stands in */ }
    }
    const rels = [], ctx = {
      images, media: [], pics: 0, lists: [], done: new Set(),
      rel(type, target, external) { rels.push({ id: `rId${rels.length + 10}`, type, target, external }); return rels.at(-1).id; },
    };
    const xmlBody = body(markdown, ctx);
    const used = comments.filter((c) => ctx.done.has(c.id));
    const doc = `${HEAD}<w:document ${NS}><w:body>${xmlBody}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const docRels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="${REL}/comments" Target="comments.xml"/>`
      + rels.map((r) => `<Relationship Id="${r.id}" Type="${REL}/${r.type}" Target="${x(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`).join('') + '</Relationships>';
    const files = [
      { name: '[Content_Types].xml', data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>`
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
      { name: 'docProps/core.xml', data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dc:creator>Guidecheck</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>` },
      { name: 'word/document.xml', data: doc },
      { name: 'word/_rels/document.xml.rels', data: docRels },
      { name: 'word/styles.xml', data: styles() },
      { name: 'word/numbering.xml', data: numbering(ctx.lists) },
      { name: 'word/comments.xml', data: commentsXml(used) },
      ...ctx.media,
    ];
    return { blob: zip(files), comments: used.length };
  }

  return { wrap, build };
})();
