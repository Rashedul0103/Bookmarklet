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
  let hashStr = null;
  const trackers = [];
  try {
    const hashLabels = [
      "Info Hash:", "Hash:", "Infohash:", "Info hash:", "info_hash:"
    ].map(l => `normalize-space(.)='${l}'`).join(' or ');

    const hn = xpNode(`//*[${hashLabels}]`);
    if (hn) {
      let H = hn.nextElementSibling?.textContent?.trim();
      if (H && !/^[a-f0-9]{40}$/i.test(H)) H = null;
      if (!H) {
        const pt = hn.parentNode?.textContent?.split(hn.textContent)[1]?.trim();
        if (pt && /^[a-f0-9]{40}$/i.test(pt)) H = pt;
      }

      // Also try finding hash inline in same element
      if (!H) {
        const m = hn.parentNode?.textContent?.match(/\b([a-f0-9]{40})\b/i);
        if (m) H = m[1];
      }

      if (H && /^[a-f0-9]{40}$/i.test(H)) {
        hashStr = H;

        // Collect trackers from page
        const trackerLabels = [
          "Tracker:", "Trackers:", "Announce URL:", "Announce:"
        ].map(l => `normalize-space(.)='${l}'`).join(' or ');

        const trIter = xpIter(`//*[${trackerLabels}]`);
        let tn;
        if (trIter) {
          while ((tn = trIter.iterateNext())) {
            const ts = tn.nextElementSibling?.textContent?.trim();
            if (ts) trackers.push(ts);
          }
        }

        // Build magnet
        let mu = `magnet:?xt=urn:btih:${H}`;
        if (TG) mu += `&dn=${encodeURIComponent(TG)}`;
        trackers.forEach(t => { if (t && t.includes(':')) mu += `&tr=${encodeURIComponent(t)}`; });

        if (!seen.has(mu)) {
          seen.add(mu);
          links.push({ label: `Magnet — ${T(TG || H, 36)}`, url: mu, type: 'magnet' });
        }
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
      display: flex; align-items: center; gap: 8px;
    }
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

  // Narrator / preview bar (audiobooks)
  if (ct === 'ab' && TG) {
    const kw = encodeURIComponent((TG + (NR ? ' ' + NR : '')).slice(0, 70));
    const pvBar = C('div');
    pvBar.id = '_tpv';
    if (NR) {
      const nrSpan = C('span');
      nrSpan.style.cssText = `font-size:10px;color:${STXT};font-weight:600`;
      nrSpan.textContent = '👤 ' + NR.split(' ').slice(0, 3).join(' ');
      pvBar.append(nrSpan);
    }
    const audBtn = C('a');
    audBtn.href = 'https://www.audible.com/search?keywords=' + kw;
    audBtn.target = '_blank';
    audBtn.style.cssText = 'padding:3px 9px;background:#e67e22;color:#fff;border-radius:4px;font-size:11px;font-weight:600;text-decoration:none';
    audBtn.textContent = '📖 Audible';
    const gbBtn = C('a');
    gbBtn.href = 'https://www.goodreads.com/search?q=' + kw;
    gbBtn.target = '_blank';
    gbBtn.style.cssText = 'padding:3px 9px;background:#553b08;color:#fff;border-radius:4px;font-size:11px;font-weight:600;text-decoration:none';
    gbBtn.textContent = '📚 Goodreads';
    pvBar.append(audBtn, gbBtn);
    pop.append(pvBar);
  }

  // Movie preview bar
  if (ct === 'mv' && TG) {
    const kw = encodeURIComponent(TG.slice(0, 70));
    const pvBar = C('div');
    pvBar.id = '_tpv';
    const imdbBtn = C('a');
    imdbBtn.href = 'https://www.imdb.com/find?q=' + kw;
    imdbBtn.target = '_blank';
    imdbBtn.style.cssText = 'padding:3px 9px;background:#f5c518;color:#000;border-radius:4px;font-size:11px;font-weight:600;text-decoration:none';
    imdbBtn.textContent = '🎬 IMDb';
    const ytBtn = C('a');
    ytBtn.href = 'https://www.youtube.com/results?search_query=' + kw + '+trailer';
    ytBtn.target = '_blank';
    ytBtn.style.cssText = 'padding:3px 9px;background:#c0392b;color:#fff;border-radius:4px;font-size:11px;font-weight:600;text-decoration:none';
    ytBtn.textContent = '▶ Trailer';
    pvBar.append(imdbBtn, ytBtn);
    pop.append(pvBar);
  }

  pop.append(bd);
  d.body.append(pop);

  // ─── BUTTON FACTORY ───────────────────────────────────────────────────────
  const mkBtn = (label, color, fn) => {
    const b = C('button');
    b.className = 'Zb';
    b.style.background = color;
    b.textContent = label;
    b.onclick = fn;
    return b;
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

  // Android Share
  const shareItem = item => {
    buzz();
    if (nav.share) {
      nav.share({ title: item.label, text: item.url, url: item.url })
        .catch(() => {});
    } else {
      copy(item.url, () => alert('Copied (Share not available on this browser)'));
    }
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
        copy(item.url, () => { buzz(); alert('Copied!'); });
      }));

      // Share (Android native share sheet)
      bw.append(mkBtn('Share', '#16a085', () => shareItem(item)));

      // Seedr
      bw.append(mkBtn('Seedr', '#e67e22', () => {
        copy(item.url, () => { buzz(); w.open(SEEDR, '_blank'); });
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
      const abbBtn = C('a');
      abbBtn.href = 'https://audiobookbay.lu/?s=' + searchTitle;
      abbBtn.target = '_blank';
      abbBtn.style.cssText = 'padding:5px 10px;background:#e67e22;color:#fff;border-radius:5px;font-size:11px;font-weight:600;text-decoration:none';
      abbBtn.textContent = '🔍 ABB';
      const t1337 = C('a');
      t1337.href = 'https://1337x.to/search/' + searchTitle + '/1/';
      t1337.target = '_blank';
      t1337.style.cssText = 'padding:5px 10px;background:#2980b9;color:#fff;border-radius:5px;font-size:11px;font-weight:600;text-decoration:none';
      t1337.textContent = '🔍 1337x';
      const tpbBtn = C('a');
      tpbBtn.href = 'https://thepiratebay.org/search.php?q=' + searchTitle;
      tpbBtn.target = '_blank';
      tpbBtn.style.cssText = 'padding:5px 10px;background:#27ae60;color:#fff;border-radius:5px;font-size:11px;font-weight:600;text-decoration:none';
      tpbBtn.textContent = '🔍 TPB';
      sRow.append(abbBtn, t1337, tpbBtn);
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
