(() => {
  // ─── CONSTANTS ────────────────────────────────────────────────────────────
  const SEEDR    = 'https://www.seedr.cc/';
  const PKG      = 'com.sirin.android';
  const POP_ID   = '_tdl';
  const STY_ID   = '_tdls';

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const d   = document;
  const w   = window;
  const nav = navigator;
  const $   = id  => d.getElementById(id);
  const C   = tag => d.createElement(tag);
  const T   = (s, l = 52) => {
    s = (s || '').trim();
    return s.length > l ? s.slice(0, l) + '…' : s;
  };

  // XPath helper — returns XPathResult or null
  const xp = (expr, type = 9, ctx = d) => {
    try { return d.evaluate(expr, ctx, null, type, null); } catch { return null; }
  };
  const xpStr  = expr => xp(expr, 2)?.stringValue?.trim() || '';
  const xpNode = expr => xp(expr, 9)?.singleNodeValue || null;
  const xpIter = expr => xp(expr, 5);

  // Clipboard copy → callback fires regardless of success/fail
  const copy = (text, cb) =>
    nav.clipboard
      ? nav.clipboard.writeText(text).then(cb).catch(cb)
      : cb();

  // Vibrate on Android (silent fail on desktop)
  const buzz = () => nav.vibrate?.(40);

  // Detect if page is dark-themed
  const isDark = () => {
    const bg = getComputedStyle(d.body).backgroundColor;
    const m  = bg.match(/\d+/g);
    if (!m) return false;
    const [r, g, b] = m.map(Number);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  };

  // Seed health colour
  const seedColour = n => {
    if (n === '?' || n === null) return '#888';
    if (n <  5)  return '#e74c3c'; // red
    if (n < 20)  return '#f39c12'; // amber
    return '#27ae60';               // green
  };

  // ─── PAGE DATA EXTRACTION ─────────────────────────────────────────────────
  const tx = d.body.innerText;

  // Seeds & leeches — CSS selectors first (fast), then page text regex
  const fromCSS = sel => {
    const el = d.querySelector(sel);
    const v  = el?.textContent?.trim();
    return v && /^\d+$/.test(v) ? +v : null;
  };

  let se = fromCSS('.seeds, .seeders, .seed')
        ?? fromCSS('td.green')
        ?? (() => { const m = tx.match(/\bseed(?:ers?)?[\s:–\-]*(\d+)|(\d+)\s*seed(?:ers?)?/i); return m ? +(m[1] || m[2]) : null; })()
        ?? '?';

  let le = fromCSS('.leeches, .leechers, .leech')
        ?? fromCSS('td.red')
        ?? (() => { const m = tx.match(/\bleech(?:ers?)?[\s:–\-]*(\d+)|(\d+)\s*leech(?:ers?)?/i); return m ? +(m[1] || m[2]) : null; })()
        ?? '?';

  // Size
  let sz = '?';
  try {
    const m = tx.match(/\bsize[\s:–\-]*([\d.,]+)\s*([TGMK])B/i);
    if (m) {
      const v  = +m[1].replace(/,/g, '');
      const mb = v * ({ T: 1e6, G: 1024, M: 1, K: 0.001 }[m[2].toUpperCase()] || 1);
      sz = mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB';
    }
  } catch {}

  // Format detection (audio & video)
  let fmt = '';
  const fmtPatterns = [
    [/\bm4b\b/i, 'M4B'], [/\bmp3\b/i, 'MP3'], [/\bflac\b/i, 'FLAC'],
    [/\bm4a\b/i, 'M4A'], [/\baac\b/i, 'AAC'],  [/\bopus\b/i, 'Opus'],
    [/\bmkv\b/i, 'MKV'], [/\bmp4\b/i, 'MP4'],  [/\bx265|hevc\b/i, 'x265'],
    [/\bx264\b/i, 'x264'], [/\bbluray|blu.ray\b/i, 'BluRay'],
    [/\bwebrip\b/i, 'WEBRip'], [/\b4k|2160p\b/i, '4K'], [/\b1080p\b/i, '1080p'],
    [/\b720p\b/i, '720p'],
  ];
  for (const [pat, label] of fmtPatterns) {
    if (pat.test(tx)) { fmt = label; break; }
  }

  // Title, narrator, content type
  let TG = '', NR = '', ct = '';
  try { TG = xpStr('//h1') || d.title || ''; } catch {}
  try {
    const m = tx.match(/(?:narrated\s+by|narrator|read\s+by)\s*[:\-]?\s*([A-Z][^\n,]{2,40})/i);
    NR = m ? m[1].trim() : '';
  } catch {}

  if (/m4b|mp3|flac|audiobook|narrator|narrated|unabridged/i.test(tx)) ct = 'ab';
  else if (/mkv|x26[45]|hevc|bluray|webrip|1080p|720p|4k/i.test(tx))   ct = 'mv';

  // ─── LINK SCANNING ────────────────────────────────────────────────────────
  const seen  = new Set();
  const links = [];

  // 1. Scan all <a href> for magnet / .torrent
  d.querySelectorAll('a[href]').forEach(a => {
    const raw = a.href;
    if (!raw || raw.length < 10 || raw.toLowerCase().startsWith('javascript:')) return;
    let url;
    try { url = new URL(raw).href; } catch { return; }
    if (seen.has(url)) return;

    const lw = url.toLowerCase();
    let type = null;
    if (lw.startsWith('magnet:?xt=urn:btih:')) type = 'magnet';
    else if (lw.includes('.torrent') && /\.torrent($|\?|#)/.test(lw)) type = 'torrent';

    if (type) {
      seen.add(url);
      links.push({ label: T(a.textContent || a.title || url), url, type });
    }
  });

  // 2. Keyword text-link scan
  const kwPatterns = ['download torrent', 'get torrent', 'torrent download', 'torrent file'];
  d.querySelectorAll('a[href]').forEach(a => {
    const txt = (a.textContent || '').trim().toLowerCase();
    if (!kwPatterns.some(kw => txt.includes(kw))) return;
    const h = a.getAttribute('href');
    if (!h || h.startsWith('#') || h.toLowerCase().startsWith('javascript:')) return;
    let url;
    try { url = new URL(h, d.baseURI).href; } catch { return; }
    if (!seen.has(url)) {
      seen.add(url);
      links.push({ label: T(a.textContent, 44), url, type: 'torrent' });
    }
  });

  // 3. Info hash → construct magnet
  // Uses 6 detection strategies in priority order, stops at first valid 40-char hex hash found
  let hashStr = null;
  const trackers = [];
  const HASH_RE = /\b([a-f0-9]{40})\b/i;
  const IS_HASH = h => /^[a-f0-9]{40}$/i.test(h);

  const findHash = () => {

    // ── Strategy A: XPath label → sibling element (original method) ──────────
    // Handles: <td>Info Hash:</td><td>a1b2c3...</td>
    try {
      const hashLabels = [
        'Info Hash:', 'Hash:', 'Infohash:', 'Info hash:',
        'info_hash:', 'Torrent Hash:', 'BTH:', 'SHA1:'
      ].map(l => `normalize-space(.)='${l}'`).join(' or ');
      const hn = xpNode(`//*[${hashLabels}]`);
      if (hn) {
        // next sibling element
        let H = hn.nextElementSibling?.textContent?.trim();
        if (!IS_HASH(H)) H = null;
        // text immediately after label in same parent
        if (!H) {
          const after = hn.parentNode?.textContent?.split(hn.textContent)[1]?.trim();
          if (IS_HASH(after)) H = after;
        }
        // any 40-char hex in parent text
        if (!H) {
          const m = hn.parentNode?.textContent?.match(HASH_RE);
          if (m) H = m[1];
        }
        if (H) return H;
      }
    } catch {}

    // ── Strategy B: <code> tags containing exactly a hash ────────────────────
    // Handles: <code>a1b2c3d4...</code>
    try {
      for (const el of d.querySelectorAll('code')) {
        const v = el.textContent?.trim();
        if (IS_HASH(v)) return v;
      }
    } catch {}

    // ── Strategy C: <span> or <div> with hash-related class/id ───────────────
    // Handles: <span class="info-hash">a1b2c3...</span>
    //          <span id="torrent-hash">a1b2c3...</span>
    try {
      const sel = [
        '[class*="hash"]', '[class*="infohash"]', '[class*="info-hash"]',
        '[id*="hash"]',    '[id*="infohash"]',
        '[class*="btih"]', '[id*="btih"]',
      ].join(',');
      for (const el of d.querySelectorAll(sel)) {
        const v = el.textContent?.trim();
        if (IS_HASH(v)) return v;
        // sometimes it's inside a nested span
        const inner = el.querySelector('span, code, b, strong');
        if (inner && IS_HASH(inner.textContent?.trim())) return inner.textContent.trim();
      }
    } catch {}

    // ── Strategy D: data-* attributes ────────────────────────────────────────
    // Handles: <button data-hash="a1b2c3..." data-clipboard-text="a1b2c3...">
    try {
      const dataAttrs = ['data-hash', 'data-infohash', 'data-btih',
                         'data-clipboard-text', 'data-value', 'data-copy'];
      for (const attr of dataAttrs) {
        const el = d.querySelector(`[${attr}]`);
        if (!el) continue;
        const v = el.getAttribute(attr)?.trim();
        if (IS_HASH(v)) return v;
      }
    } catch {}

    // ── Strategy E: <input> value fields ─────────────────────────────────────
    // Handles: <input type="text" value="a1b2c3..." readonly>  (copy-box pattern)
    try {
      for (const el of d.querySelectorAll('input[type="text"], input[readonly], input[value]')) {
        const v = el.value?.trim();
        if (IS_HASH(v)) return v;
      }
    } catch {}

    // ── Strategy F: last resort — scan all page text for standalone 40-char hex
    // Handles any plaintext display of hash, but only fires if surrounded by
    // a hash-related keyword within 120 chars (avoids false positives)
    try {
      const matches = [...tx.matchAll(/\b([a-f0-9]{40})\b/gi)];
      for (const m of matches) {
        const surrounding = tx.slice(Math.max(0, m.index - 120), m.index + 160).toLowerCase();
        if (/hash|btih|infohash|magnet|torrent/.test(surrounding)) {
          return m[1];
        }
      }
    } catch {}

    return null;
  };

  try {
    const H = findHash();
    if (H) {
      hashStr = H;

      // Collect trackers — sibling elements after tracker labels
      const trackerLabels = [
        'Tracker:', 'Trackers:', 'Announce URL:', 'Announce:', 'Tracker URL:'
      ].map(l => `normalize-space(.)='${l}'`).join(' or ');
      const trIter = xpIter(`//*[${trackerLabels}]`);
      let tn;
      if (trIter) {
        while ((tn = trIter.iterateNext())) {
          const ts = tn.nextElementSibling?.textContent?.trim();
          if (ts) trackers.push(ts);
        }
      }

      // Also grab trackers from any <a href="udp://..."> or <a href="http://...announce">
      d.querySelectorAll('a[href]').forEach(a => {
        const h = a.href || '';
        if (/^(udp|http|https):\/\/.+(announce|tracker)/i.test(h)) {
          if (!trackers.includes(h)) trackers.push(h);
        }
      });

      // Build magnet
      let mu = `magnet:?xt=urn:btih:${H}`;
      if (TG) mu += `&dn=${encodeURIComponent(TG)}`;
      [...new Set(trackers)].forEach(t => {
        if (t && (t.includes(':')) ) mu += `&tr=${encodeURIComponent(t)}`;
      });

      if (!seen.has(mu)) {
        seen.add(mu);
        links.push({ label: `Magnet — ${T(TG || H, 36)}`, url: mu, type: 'magnet' });
      }
    }
  } catch {}

  // ─── SORT (magnets first) ─────────────────────────────────────────────────
  links.sort((a, b) =>
    a.type === 'magnet' && b.type !== 'magnet' ? -1 :
    b.type === 'magnet' && a.type !== 'magnet' ?  1 : 0
  );

  const mc = links.filter(i => i.type === 'magnet').length;
  const tc = links.length - mc;

  // ─── THEME ────────────────────────────────────────────────────────────────
  const dark   = isDark();
  const BG     = dark ? '#1a1a2e'  : '#ffffff';
  const HDR    = dark ? '#0f3460'  : '#2c3e50';
  const CARD   = dark ? '#16213e'  : '#ffffff';
  const BORDER = dark ? '#2a2a4a'  : '#eee';
  const INFOBG = dark ? '#0d0d1a'  : '#f8f9fa';
  const PVBG   = dark ? '#0d1b2a'  : '#edf7ff';
  const TXT    = dark ? '#e0e0e0'  : '#2d3436';
  const STXT   = dark ? '#aaa'     : '#555';

  // ─── POPUP ────────────────────────────────────────────────────────────────
  $(STY_ID)?.remove();
  const style = C('style');
  style.id = STY_ID;
  style.textContent = `
    #${POP_ID} {
      position: fixed; top: 8px; right: 8px;
      width: 340px; max-height: 520px;
      background: ${BG};
      border-radius: 12px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      display: flex; flex-direction: column;
      overflow: hidden;
      color: ${TXT};
      transition: transform 0.15s ease;
    }
    #_tdh {
      background: ${HDR};
      color: #fff;
      padding: 10px 14px;
      display: flex; justify-content: space-between; align-items: center;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }
    #_tdh b { font-size: 13px; letter-spacing: 0.3px; }
    #_tcx {
      background: 0; border: 0; color: rgba(255,255,255,0.6);
      font-size: 22px; cursor: pointer; line-height: 1;
      padding: 0 2px; transition: color 0.15s;
    }
    #_tcx:hover { color: #fff; }
    #_tif {
      padding: 7px 14px;
      background: ${INFOBG};
      border-bottom: 1px solid ${BORDER};
      display: flex; gap: 12px; align-items: center;
      font-size: 11px; flex-wrap: wrap;
    }
    #_tpv {
      padding: 7px 14px;
      background: ${PVBG};
      border-bottom: 1px solid ${BORDER};
      font-size: 11px;
      display: flex; align-items: center; gap: 5px;
      flex-wrap: nowrap; overflow: hidden;
    }
    .Zpv {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 3px 8px; border-radius: 4px;
      font-size: 11px; font-weight: 600;
      text-decoration: none; white-space: nowrap;
      flex-shrink: 0;
    }
    .Zpvi { flex-shrink: 0; }
    .Zpvt { flex-shrink: 0; }
    #_tnf {
      padding: 7px 14px;
      background: ${PVBG};
      border-bottom: 1px solid ${BORDER};
      font-size: 11px;
      display: flex; align-items: center; gap: 8px;
    }
    #_tbd { overflow-y: auto; flex-grow: 1; }
    .Zr {
      padding: 9px 14px;
      border-bottom: 1px solid ${BORDER};
      background: ${CARD};
      transition: background 0.1s;
    }
    .Zr:last-child { border-bottom: 0; }
    .Zl {
      word-break: break-word;
      margin-bottom: 7px;
      color: ${TXT};
      font-size: 11.5px;
      line-height: 1.4;
    }
    .Ztag {
      display: inline-block;
      font-size: 9px; font-weight: bold;
      padding: 1px 5px; border-radius: 3px;
      color: #fff; margin-right: 5px;
      vertical-align: middle;
    }
    .Zw { display: flex; gap: 5px; flex-wrap: wrap; }
    .Zb {
      padding: 5px 10px;
      border: 0; border-radius: 5px;
      cursor: pointer; font-size: 11px;
      color: #fff; white-space: nowrap;
      transition: filter 0.15s, transform 0.1s;
      font-weight: 500;
    }
    .Zb:active { transform: scale(0.95); filter: brightness(0.85); }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
    .zpulse { animation: pulse 1.2s ease-in-out infinite; }
  `;
  d.head.append(style);

  // Remove old popup
  $(POP_ID)?.remove();

  const pop = C('div');
  pop.id = POP_ID;

  // Header
  const hdr = C('div');
  hdr.id = '_tdh';
  const title = C('b');
  title.textContent = `🧲 ${mc}M · ${tc}T`;
  const closeBtn = C('button');
  closeBtn.id = '_tcx';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => pop.remove();
  hdr.append(title, closeBtn);

  // Drag to reposition (touch)
  let dragging = false, ox = 0, oy = 0, sx = 0, sy = 0;
  hdr.addEventListener('touchstart', e => {
    dragging = true;
    const t = e.touches[0];
    const rect = pop.getBoundingClientRect();
    ox = rect.left; oy = rect.top;
    sx = t.clientX; sy = t.clientY;
    pop.style.right = 'auto';
    pop.style.left = ox + 'px';
    pop.style.top  = oy + 'px';
  }, { passive: true });
  d.addEventListener('touchmove', e => {
    if (!dragging) return;
    const t = e.touches[0];
    pop.style.left = (ox + t.clientX - sx) + 'px';
    pop.style.top  = (oy + t.clientY - sy) + 'px';
  }, { passive: true });
  d.addEventListener('touchend', () => dragging = false);
  d.addEventListener('keydown', e => e.key === 'Escape' && pop.remove(), { once: true });

  // Info bar — seeds, leeches, size, format
  const infoBar = C('div');
  infoBar.id = '_tif';

  const seEl = C('span');
  const seVal = C('b');
  seVal.id = '_tse';
  seVal.textContent = String(se);
  seVal.style.color = seedColour(se);
  seEl.append('🌱 Seeds: ', seVal);

  const leEl = C('span');
  const leVal = C('b');
  leVal.id = '_tle';
  leVal.textContent = String(le);
  leVal.style.color = '#e74c3c';
  leEl.append('🔻 Leeches: ', leVal);

  const szEl = C('span');
  szEl.innerHTML = `📦 <b style="color:#2980b9">${sz}</b>`;

  infoBar.append(seEl, leEl, szEl);

  if (fmt) {
    const fmEl = C('span');
    fmEl.innerHTML = `🎵 <b style="color:#8e44ad">${fmt}</b>`;
    infoBar.append(fmEl);
  }

  // Pulse seeds if unknown (tracker scrape will update it)
  if (se === '?') seVal.classList.add('zpulse');

  // Body
  const bd = C('div');
  bd.id = '_tbd';

  pop.append(hdr, infoBar);

  // Shared preview bar link factory
  // Each button has a fixed icon span + collapsible text span
  // After all bars are built, collapseIfOverflow() is called to hide
  // text spans on any bar whose buttons exceed its width
  const mkLink = (ico, lbl, bg, fg, url) => {
    const a = C('a');
    a.href = url; a.target = '_blank';
    a.className = 'Zpv';
    a.style.cssText = `background:${bg};color:${fg}`;
    const iEl = C('span'); iEl.className = 'Zpvi'; iEl.textContent = ico;
    const tEl = C('span'); tEl.className = 'Zpvt'; tEl.textContent = lbl;
    a.append(iEl, tEl);
    return a;
  };

  // Collapse preview bar text to icons if buttons don't fit on one line.
  // Temporarily sets overflow:visible to get accurate scrollWidth,
  // then restores overflow:hidden. Uses 80ms delay for mobile layout completion.
  const collapseIfOverflow = bar => {
    if (!bar) return;
    setTimeout(() => {
      bar.style.overflow = 'visible';
      const overflowing = bar.scrollWidth > bar.clientWidth + 2;
      bar.style.overflow = 'hidden';
      if (overflowing) {
        bar.querySelectorAll('.Zpvt').forEach(t => { t.style.display = 'none'; });
      }
    }, 80);
  };

  // Narrator / preview bar (audiobooks)
  if (ct === 'ab' && TG) {
    const kwAud = encodeURIComponent((TG + (NR ? ' ' + NR : '')).slice(0, 70));
    const cleanTitle    = TG.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
    const googleABQuery = encodeURIComponent(`"${cleanTitle}"${NR ? ` "${NR}"` : ''} audiobook`);
    const pvBar = C('div');
    pvBar.id = '_tpv';
    if (NR) {
      const nrSpan = C('span');
      nrSpan.style.cssText = `font-size:10px;color:${STXT};font-weight:600;flex-shrink:0;margin-right:2px`;
      nrSpan.textContent = '👤 ' + NR.split(' ').slice(0, 2).join(' ');
      pvBar.append(nrSpan);
    }
    pvBar.append(
      mkLink('📖', ' Audible',   '#e67e22', '#fff', 'https://www.audible.com/search?keywords=' + kwAud),
      mkLink('📚', ' Goodreads', '#553b08', '#fff', 'https://www.goodreads.com/search?q=' + kwAud),
      mkLink('🔍', ' Google',    '#4285f4', '#fff', 'https://www.google.com/search?q=' + googleABQuery)
    );
    pop.append(pvBar);
  }

  // Movie preview bar
  if (ct === 'mv' && TG) {
    const cleanTitle    = TG.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
    const kw            = encodeURIComponent(cleanTitle.slice(0, 70));
    const googleMVQuery = encodeURIComponent(`"${cleanTitle}" film`);
    const pvBar = C('div');
    pvBar.id = '_tpv';
    pvBar.append(
      mkLink('🎬', ' IMDb',    '#f5c518', '#000', 'https://www.imdb.com/find?q=' + kw),
      mkLink('▶',  ' Trailer', '#c0392b', '#fff', 'https://www.youtube.com/results?search_query=' + kw + '+official+trailer'),
      mkLink('🔍', ' Google',  '#4285f4', '#fff', 'https://www.google.com/search?q=' + googleMVQuery)
    );
    pop.append(pvBar);
  }

  pop.append(bd);
  d.body.append(pop);

  // Collapse preview bar buttons to icon-only if they don't fit
  collapseIfOverflow(d.getElementById('_tpv'));

  // ─── BUTTON FACTORY ───────────────────────────────────────────────────────
  const mkBtn = (label, color, fn) => {
    const b = C('button');
    b.className = 'Zb';
    b.style.background = color;
    b.textContent = label;
    b.onclick = fn;
    return b;
  };

  // Toast notification — brief non-blocking message at bottom of popup
  const showToast = msg => {
    const existing = $('_tst');
    if (existing) existing.remove();
    const t = C('div');
    t.id = '_tst';
    t.textContent = msg;
    t.style.cssText = `
      position:fixed;bottom:70px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.82);color:#fff;padding:7px 16px;
      border-radius:20px;font-size:12px;z-index:2147483647;
      pointer-events:none;white-space:nowrap;
      animation:_tfade 2.2s ease forwards;
    `;
    // Inject keyframe once
    if (!$('_tsta')) {
      const ks = C('style'); ks.id = '_tsta';
      ks.textContent = '@keyframes _tfade{0%{opacity:0;transform:translateX(-50%) translateY(6px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}75%{opacity:1}100%{opacity:0}}';
      d.head.append(ks);
    }
    d.body.append(t);
    setTimeout(() => t.remove(), 2300);
  };

  // Open Sirin
  const openSirin = item => {
    buzz();
    if (item.type === 'magnet') {
      w.location.href = item.url;
    } else {
      try {
        const pu = new URL(item.url);
        w.location.href = 'intent://' + pu.host + pu.pathname + pu.search
          + '#Intent;scheme=' + pu.protocol.slice(0, -1)
          + ';package=' + PKG
          + ';action=android.intent.action.VIEW;end';
      } catch { w.location.href = item.url; }
    }
  };

  // Android Share — navigator.share is blocked in bookmarklet context on Chrome
  // so we copy the URL and show a brief toast notification instead
  const shareItem = item => {
    buzz();
    copy(item.url, () => {
      // Try native share first (works in some browsers/versions)
      if (nav.share) {
        nav.share({ title: item.label, url: item.url }).catch(() => {});
      }
      // Always show toast so user knows it's been copied regardless
      showToast('📋 Copied! Paste in Sirin, Seedr or any app.');
    });
  };

  // ─── RENDER LINKS ─────────────────────────────────────────────────────────
  if (links.length > 0) {
    links.forEach(item => {
      const row  = C('div');
      row.className = 'Zr';

      // Type tag + label
      const lbl  = C('div');
      lbl.className = 'Zl';
      const tag = C('span');
      tag.className = 'Ztag';
      tag.style.background = item.type === 'magnet' ? '#8e44ad' : '#e67e22';
      tag.textContent = item.type === 'magnet' ? 'M' : 'T';
      lbl.append(tag, item.label);
      lbl.title = item.url;

      // Buttons row
      const bw = C('div');
      bw.className = 'Zw';

      // Copy
      bw.append(mkBtn('Copy', '#636e72', () => {
        copy(item.url, () => { buzz(); showToast('📋 Copied!'); });
      }));

      // Share (Android native share sheet)
      bw.append(mkBtn('Share', '#16a085', () => shareItem(item)));

      // Seedr
      bw.append(mkBtn('Seedr', '#e67e22', () => {
        copy(item.url, () => { buzz(); showToast('📋 Copied! Opening Seedr…'); w.open(SEEDR, '_blank'); });
      }));

      // Sirin
      bw.append(mkBtn('Sirin', '#8e44ad', () => openSirin(item)));

      // Save (torrent files only)
      if (item.type === 'torrent') {
        bw.append(mkBtn('⬇ Save', '#27ae60', () => {
          buzz();
          const a = C('a');
          a.href = item.url;
          a.download = '';
          d.body.append(a);
          a.click();
          a.remove();
        }));
      }

      row.append(lbl, bw);
      bd.append(row);
    });
  } else {
    // No links found — show search fallback
    const empty = C('div');
    empty.style.cssText = 'padding:20px 14px;text-align:center';

    const msg = C('p');
    msg.style.cssText = `color:${STXT};margin-bottom:12px;font-size:12px`;
    msg.textContent = 'No torrent or magnet links found on this page.';

    const searchTitle = encodeURIComponent((TG || d.title || '').slice(0, 60));
    empty.append(msg);

    if (searchTitle) {
      const sRow = C('div');
      sRow.style.cssText = 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap';

      // Smart Google query based on detected content type
      const rawTitle = (TG || d.title || '').slice(0, 60);
      const googleQ  = ct === 'ab'
        ? encodeURIComponent(`"${rawTitle}"${NR ? ` "${NR}"` : ''} audiobook`)
        : ct === 'mv'
          ? encodeURIComponent(`"${rawTitle}" film`)
          : encodeURIComponent(`"${rawTitle}" torrent`);

      const mkFallbackLink = (txt, bg, fg, url) => {
        const a = C('a');
        a.href = url; a.target = '_blank';
        a.style.cssText = `padding:5px 10px;background:${bg};color:${fg};border-radius:5px;font-size:11px;font-weight:600;text-decoration:none`;
        a.textContent = txt;
        return a;
      };
      sRow.append(
        mkFallbackLink('🔍 ABB',    '#e67e22', '#fff', 'https://audiobookbay.lu/?s=' + searchTitle),
        mkFallbackLink('🔍 1337x',  '#2980b9', '#fff', 'https://1337x.to/search/' + searchTitle + '/1/'),
        mkFallbackLink('🔍 TPB',    '#27ae60', '#fff', 'https://thepiratebay.org/search.php?q=' + searchTitle),
        mkFallbackLink('🔍 Google', '#4285f4', '#fff', 'https://www.google.com/search?q=' + googleQ)
      );
      empty.append(sRow);
    }

    bd.append(empty);
  }

  // ─── LIVE TRACKER SCRAPE ──────────────────────────────────────────────────
  if (hashStr && (se === '?' || le === '?')) {
    const encoded = hashStr.toLowerCase().match(/.{2}/g).map(b => '%' + b).join('');

    // Page trackers (HTTP only) + well-known public fallbacks
    const publicTrackers = [
      'https://tracker.openbt.com',
      'https://tracker.gbitt.info',
      'https://opentracker.i2p.rocks',
      'https://tracker.torrent.eu.org',
      'https://open.stealth.si',
    ];
    const tryTrackers = [
      ...trackers.filter(t => t.startsWith('http')),
      ...publicTrackers,
    ].slice(0, 6);

    let scraped = false;

    tryTrackers.forEach(t => {
      const scrapeURL = t.replace(/\/announce.*/, '/scrape') + '?info_hash=' + encoded;
      fetch(scrapeURL)
        .then(r => r.text())
        .then(body => {
          if (scraped) return;
          const ms = body.match(/completei(\d+)e/);
          const ml = body.match(/incompletei(\d+)e/);
          if (ms || ml) {
            scraped = true;
            const esEl = $('_tse');
            const elEl = $('_tle');
            if (ms && esEl && esEl.textContent === '?') {
              const val = +ms[1];
              esEl.textContent = val;
              esEl.style.color = seedColour(val);
              esEl.classList.remove('zpulse');
            }
            if (ml && elEl && elEl.textContent === '?') {
              elEl.textContent = +ml[1];
            }
          }
        })
        .catch(() => {});
    });

    // Stop pulse after 8s if no result
    setTimeout(() => $('_tse')?.classList.remove('zpulse'), 8000);
  }

})();
