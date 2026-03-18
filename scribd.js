(() => {
  // ─── SCRIBD UNIFIED BOOKMARKLET ────────────────────────────────────────────
  // Works in two modes:
  //   1. ON a Scribd page  → extracts doc ID, offers all bypass methods
  //   2. ANY other page    → finds all Scribd links, lets you pick one to bypass
  // ─────────────────────────────────────────────────────────────────────────────

  const d   = document;
  const w   = window;
  const nav = navigator;
  const C   = tag => d.createElement(tag);
  const $   = id  => d.getElementById(id);

  const POP_ID = '_scr_pop';
  const STY_ID = '_scr_sty';

  // ─── THEME ─────────────────────────────────────────────────────────────────
  const isDark = () => {
    const bg = getComputedStyle(d.body).backgroundColor;
    const m  = bg.match(/\d+/g);
    if (!m) return false;
    const [r, g, b] = m.map(Number);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  };

  const dark   = isDark();
  const BG     = dark ? '#1a1a2e' : '#ffffff';
  const HDR    = dark ? '#16213e' : '#3f51b5'; // Scribd-ish indigo
  const CARD   = dark ? '#16213e' : '#f9f9f9';
  const BORDER = dark ? '#2a2a4a' : '#e0e0e0';
  const TXT    = dark ? '#e0e0e0' : '#2d3436';
  const STXT   = dark ? '#aaa'    : '#666';

  // ─── HELPERS ───────────────────────────────────────────────────────────────
  const buzz = () => nav.vibrate?.(40);

  const showToast = msg => {
    $('_scr_tst')?.remove();
    const t = C('div');
    t.id = '_scr_tst';
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.85);color:#fff;padding:7px 18px;border-radius:20px;
      font-size:12px;z-index:2147483647;pointer-events:none;white-space:nowrap;
      animation:_sfade 2.4s ease forwards`;
    if (!$('_scr_kf')) {
      const ks = C('style'); ks.id = '_scr_kf';
      ks.textContent = '@keyframes _sfade{0%{opacity:0;transform:translateX(-50%) translateY(8px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}75%{opacity:1}100%{opacity:0}}';
      d.head.append(ks);
    }
    d.body.append(t);
    setTimeout(() => t.remove(), 2500);
  };

  const copyText = (txt, label) => {
    buzz();
    nav.clipboard
      ? nav.clipboard.writeText(txt).then(() => showToast(`📋 ${label} copied!`)).catch(() => showToast(`📋 ${label} copied!`))
      : showToast(`📋 ${label} copied!`);
  };

  // ─── SCRIBD URL PARSING ────────────────────────────────────────────────────
  // Handles formats:
  //   scribd.com/document/123456/title
  //   scribd.com/doc/123456/title
  //   scribd.com/presentation/123456/title
  //   scribd.com/book/123456/title
  const parseScribdURL = url => {
    const m = url.match(/scribd\.com\/(document|doc|presentation|book|embeds?)\/(\d+)/i);
    return m ? m[2] : null;
  };

  // Extract title from page or URL
  const getTitle = url => {
    if (w.location.href === url) {
      // On the actual page
      const h1 = d.querySelector('h1');
      if (h1?.textContent?.trim()) return h1.textContent.trim();
      return d.title.replace(' | Scribd', '').replace(' - Scribd', '').trim();
    }
    // From URL slug
    const m = url.match(/scribd\.com\/(?:document|doc|presentation|book)\/\d+\/([^?#]+)/i);
    if (m) return m[1].replace(/-/g, ' ').replace(/_/g, ' ').trim();
    return 'Document';
  };

  // ─── BYPASS METHODS ────────────────────────────────────────────────────────
  // Each method takes a doc ID and returns a ready-to-use URL
  const methods = [
    {
      id:    'embed',
      label: '📄 Embed view',
      color: '#3f51b5',
      desc:  'Open full document in Scribd\'s own embed viewer — no subscription needed',
      url:   id => `https://www.scribd.com/embeds/${id}/content?start_page=1&view_mode=scroll&access_key=key-fFexxf7r1bzEfWu3HKwf`,
    },
    {
      id:    'ilide',
      label: '🔓 iLide',
      color: '#e74c3c',
      desc:  'View & download via ilide.info bypass service',
      url:   id => `https://ilide.info/docdownloadv2?url=https://www.scribd.com/document/${id}/x`,
    },
    {
      id:    'docdown',
      label: '⬇ DocDownloader',
      color: '#27ae60',
      desc:  'Download as PDF via docdownloader.com',
      url:   id => `https://docdownloader.com/scribd?url=https://scribd.com/document/${id}`,
    },
    {
      id:    'dlscrib',
      label: '⬇ DLScrib',
      color: '#8e44ad',
      desc:  'Download PDF directly via dlscrib.pro',
      url:   id => `https://dlscrib.pro/download?url=https://scribd.com/document/${id}`,
    },
    {
      id:    'archive',
      label: '🕰 Wayback',
      color: '#e67e22',
      desc:  'Try Internet Archive Wayback Machine cached version',
      url:   id => `https://web.archive.org/web/*/https://www.scribd.com/document/${id}`,
    },
  ];

  // ─── POPUP BUILDER ─────────────────────────────────────────────────────────
  const buildPopup = (docId, title, sourceURL) => {
    $(STY_ID)?.remove();
    const style = C('style');
    style.id = STY_ID;
    style.textContent = `
      #${POP_ID} {
        position: fixed; top: 8px; right: 8px;
        width: 340px; max-height: 540px;
        background: ${BG}; color: ${TXT};
        border-radius: 12px; z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        display: flex; flex-direction: column; overflow: hidden;
      }
      #_scr_hdr {
        background: ${HDR}; color: #fff;
        padding: 10px 14px;
        display: flex; justify-content: space-between; align-items: flex-start;
      }
      #_scr_hdr b { font-size: 13px; line-height: 1.4; }
      #_scr_hdr small { font-size: 10px; opacity: 0.75; display: block; margin-top: 2px; }
      #_scr_cx {
        background: 0; border: 0; color: rgba(255,255,255,0.6);
        font-size: 22px; cursor: pointer; line-height: 1;
        padding: 0 2px; flex-shrink: 0;
        transition: color 0.15s;
      }
      #_scr_cx:hover { color: #fff; }
      #_scr_info {
        padding: 7px 14px;
        background: ${dark ? '#0d0d1a' : '#f0f4ff'};
        border-bottom: 1px solid ${BORDER};
        font-size: 11px; color: ${STXT};
        display: flex; gap: 8px; align-items: center;
        flex-wrap: wrap;
      }
      #_scr_bd { overflow-y: auto; flex-grow: 1; }
      .Sm {
        padding: 10px 14px;
        border-bottom: 1px solid ${BORDER};
        background: ${CARD};
        display: flex; align-items: center; gap: 10px;
        cursor: pointer; transition: filter 0.15s;
      }
      .Sm:last-child { border-bottom: 0; }
      .Sm:active { filter: brightness(0.9); }
      .Smb {
        flex-shrink: 0; padding: 5px 10px;
        border: 0; border-radius: 5px;
        color: #fff; font-size: 11px; font-weight: 600;
        cursor: pointer; white-space: nowrap;
        transition: filter 0.15s, transform 0.1s;
      }
      .Smb:active { transform: scale(0.95); filter: brightness(0.85); }
      .Smd { font-size: 10px; color: ${STXT}; line-height: 1.4; }
      #_scr_nf {
        padding: 18px 14px; text-align: center; color: ${STXT};
        font-size: 12px; line-height: 1.6;
      }
    `;
    d.head.append(style);

    $(POP_ID)?.remove();
    const pop = C('div');
    pop.id = POP_ID;

    // Header
    const hdr = C('div');
    hdr.id = '_scr_hdr';
    const hdrTxt = C('div');
    hdrTxt.innerHTML = `<b>📜 Scribd Bypass</b><small>${title.slice(0, 48)}${title.length > 48 ? '…' : ''}</small>`;
    const cx = C('button');
    cx.id = '_scr_cx';
    cx.textContent = '×';
    cx.onclick = () => pop.remove();
    hdr.append(hdrTxt, cx);

    // Info bar
    const info = C('div');
    info.id = '_scr_info';
    info.innerHTML = `🆔 ID: <b>${docId}</b>`;

    // Copy URL button in info bar
    const cpUrl = C('button');
    cpUrl.style.cssText = `padding:2px 8px;background:${HDR};color:#fff;border:0;border-radius:3px;font-size:10px;cursor:pointer;margin-left:auto`;
    cpUrl.textContent = '📋 Copy URL';
    cpUrl.onclick = () => copyText(sourceURL, 'URL');
    info.append(cpUrl);

    // Body
    const bd = C('div');
    bd.id = '_scr_bd';

    methods.forEach(m => {
      const row = C('div');
      row.className = 'Sm';

      const btn = C('button');
      btn.className = 'Smb';
      btn.style.background = m.color;
      btn.textContent = m.label;
      btn.onclick = () => { buzz(); w.open(m.url(docId), '_blank'); };

      const desc = C('div');
      desc.className = 'Smd';
      desc.textContent = m.desc;

      row.append(btn, desc);
      bd.append(row);
    });

    pop.append(hdr, info, bd);
    d.body.append(pop);

    // Esc to close
    d.addEventListener('keydown', e => e.key === 'Escape' && pop.remove(), { once: true });
  };

  // ─── LINK LIST MODE ────────────────────────────────────────────────────────
  // When not on a Scribd page — find all Scribd links on current page
  const buildLinkList = links => {
    $(STY_ID)?.remove();
    const style = C('style');
    style.id = STY_ID;
    style.textContent = `
      #${POP_ID} {
        position: fixed; top: 8px; right: 8px;
        width: 340px; max-height: 500px;
        background: ${BG}; color: ${TXT};
        border-radius: 12px; z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        display: flex; flex-direction: column; overflow: hidden;
      }
      #_scr_hdr {
        background: ${HDR}; color: #fff; padding: 10px 14px;
        display: flex; justify-content: space-between; align-items: center;
      }
      #_scr_hdr b { font-size: 13px; }
      #_scr_cx {
        background: 0; border: 0; color: rgba(255,255,255,0.6);
        font-size: 22px; cursor: pointer; line-height: 1;
      }
      #_scr_bd { overflow-y: auto; flex-grow: 1; }
      .Sl {
        padding: 9px 14px; border-bottom: 1px solid ${BORDER};
        background: ${CARD};
      }
      .Sl:last-child { border-bottom: 0; }
      .Slt {
        font-size: 11.5px; color: ${TXT};
        margin-bottom: 6px; word-break: break-word; line-height: 1.4;
      }
      .Slw { display: flex; gap: 5px; flex-wrap: wrap; }
      .Slb {
        padding: 4px 9px; border: 0; border-radius: 4px;
        color: #fff; font-size: 11px; font-weight: 600;
        cursor: pointer; white-space: nowrap;
        transition: filter 0.15s, transform 0.1s;
      }
      .Slb:active { transform: scale(0.95); }
      #_scr_nf { padding: 20px 14px; text-align: center; color: ${STXT}; }
    `;
    d.head.append(style);

    $(POP_ID)?.remove();
    const pop = C('div');
    pop.id = POP_ID;

    const hdr = C('div');
    hdr.id = '_scr_hdr';
    const hdrB = C('b');
    hdrB.textContent = `📜 ${links.length} Scribd link${links.length !== 1 ? 's' : ''} found`;
    const cx = C('button');
    cx.id = '_scr_cx';
    cx.textContent = '×';
    cx.onclick = () => pop.remove();
    hdr.append(hdrB, cx);

    const bd = C('div');
    bd.id = '_scr_bd';

    if (links.length === 0) {
      const nf = C('div');
      nf.id = '_scr_nf';
      nf.innerHTML = `No Scribd links found on this page.<br><br>
        <a href="https://www.scribd.com" target="_blank"
           style="color:${HDR};text-decoration:none;font-weight:600">Open Scribd →</a>`;
      bd.append(nf);
    } else {
      links.forEach(({ docId, title, href }) => {
        const row = C('div');
        row.className = 'Sl';

        const lbl = C('div');
        lbl.className = 'Slt';
        lbl.textContent = title;
        lbl.title = href;

        const bw = C('div');
        bw.className = 'Slw';

        // Embed view button — most reliable
        const embedBtn = C('button');
        embedBtn.className = 'Slb';
        embedBtn.style.background = '#3f51b5';
        embedBtn.textContent = '📄 View';
        embedBtn.onclick = () => {
          buzz();
          w.open(`https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=key-fFexxf7r1bzEfWu3HKwf`, '_blank');
        };

        // Download button — docdownloader
        const dlBtn = C('button');
        dlBtn.className = 'Slb';
        dlBtn.style.background = '#27ae60';
        dlBtn.textContent = '⬇ Download';
        dlBtn.onclick = () => {
          buzz();
          w.open(`https://docdownloader.com/scribd?url=https://scribd.com/document/${docId}`, '_blank');
        };

        // More options — opens full popup for this doc
        const moreBtn = C('button');
        moreBtn.className = 'Slb';
        moreBtn.style.background = '#636e72';
        moreBtn.textContent = '⋯ More';
        moreBtn.onclick = () => buildPopup(docId, title, href);

        bw.append(embedBtn, dlBtn, moreBtn);
        row.append(lbl, bw);
        bd.append(row);
      });
    }

    pop.append(hdr, bd);
    d.body.append(pop);
    d.addEventListener('keydown', e => e.key === 'Escape' && pop.remove(), { once: true });
  };

  // ─── MAIN LOGIC ────────────────────────────────────────────────────────────
  const currentURL = w.location.href;
  const currentId  = parseScribdURL(currentURL);

  if (currentId) {
    // Mode 1: We are ON a Scribd document page
    const title = getTitle(currentURL);
    buildPopup(currentId, title, currentURL);
  } else {
    // Mode 2: Scan current page for Scribd links
    const found = [];
    const seenIds = new Set();

    d.querySelectorAll('a[href]').forEach(a => {
      const href = a.href || '';
      const docId = parseScribdURL(href);
      if (docId && !seenIds.has(docId)) {
        seenIds.add(docId);
        const rawTitle = (a.textContent || a.title || '').trim();
        const title    = rawTitle.length > 2
          ? rawTitle.slice(0, 60) + (rawTitle.length > 60 ? '…' : '')
          : getTitle(href);
        found.push({ docId, title, href });
      }
    });

    buildLinkList(found);
  }

})();
