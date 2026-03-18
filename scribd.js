(() => {
  // ═══════════════════════════════════════════════════════════════
  // SCRIBD + SLIDESHARE UNIFIED DOWNLOADER BOOKMARKLET
  // Auto-detects Scribd or SlideShare and shows the best methods.
  // Also scans any page for Scribd/SlideShare links.
  // ═══════════════════════════════════════════════════════════════

  const d   = document;
  const w   = window;
  const nav = navigator;
  const C   = tag => d.createElement(tag);
  const $   = id  => d.getElementById(id);
  const POP = '_sdl_pop';
  const STY = '_sdl_sty';

  // ─── THEME ─────────────────────────────────────────────────────
  const isDark = () => {
    const m = getComputedStyle(d.body).backgroundColor.match(/\d+/g);
    if (!m) return false;
    const [r,g,b] = m.map(Number);
    return (r*299 + g*587 + b*114)/1000 < 128;
  };
  const dk     = isDark();
  const BG     = dk ? '#1a1a2e' : '#fff';
  const TXT    = dk ? '#e0e0e0' : '#2d3436';
  const STXT   = dk ? '#aaa'    : '#636e72';
  const CARD   = dk ? '#16213e' : '#f9f9f9';
  const BORDER = dk ? '#2a2a4a' : '#e0e0e0';
  const INFOBG = dk ? '#0d0d1a' : '#f0f4ff';
  const SCRIBD_CLR = '#3f51b5';
  const SLIDES_CLR = '#0077b5';

  // ─── HELPERS ───────────────────────────────────────────────────
  const buzz = () => nav.vibrate?.(40);

  const toast = msg => {
    $('_sdl_t')?.remove();
    const t = C('div'); t.id = '_sdl_t';
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;padding:7px 18px;border-radius:20px;font-size:12px;z-index:2147483647;pointer-events:none;white-space:nowrap;animation:_sfade 2.4s ease forwards';
    if (!$('_sdl_kf')) {
      const s = C('style'); s.id = '_sdl_kf';
      s.textContent = '@keyframes _sfade{0%{opacity:0;transform:translateX(-50%) translateY(8px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}75%{opacity:1}100%{opacity:0}}';
      d.head.append(s);
    }
    d.body.append(t);
    setTimeout(() => t.remove(), 2500);
  };

  const openURL = url => { buzz(); w.open(url, '_blank'); };

  const truncate = (s, l=55) => {
    s = (s||'').trim();
    return s.length > l ? s.slice(0,l)+'…' : s;
  };

  // ─── FEATURE 1: AUTO-FIND ──────────────────────────────────────
  // Tries each method URL via fetch (no-cors), opens first that responds.
  // Shows a spinner toast while working.
  const autoFind = (methodURLs, label) => {
    buzz();
    toast('🔍 Trying methods… please wait');
    let found = false;
    const tries = methodURLs.map((url, i) =>
      new Promise(resolve => {
        setTimeout(() => {
          fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
            .then(() => resolve({ url, i }))
            .catch(() => resolve(null));
        }, i * 120); // stagger requests slightly
      })
    );
    Promise.race(tries).then(result => {
      if (found) return;
      if (result?.url) {
        found = true;
        toast(`✅ Opening best available method…`);
        setTimeout(() => { buzz(); w.open(result.url, '_blank'); }, 600);
      } else {
        toast('⚠️ All methods tried — opening first option');
        setTimeout(() => { buzz(); w.open(methodURLs[0], '_blank'); }, 600);
      }
    });
    // Fallback after 8s regardless
    setTimeout(() => {
      if (!found) { found = true; toast('⏱ Timeout — opening first option'); w.open(methodURLs[0], '_blank'); }
    }, 8000);
  };

  // (Direct save handled inline via anchor download attribute — no fetch needed)

  // ─── FEATURE 3: CHECK STATUS ───────────────────────────────────
  // Pings each service URL and updates badge next to each button.
  // Uses no-cors so we only detect network reachability, not content.
  const checkStatus = (methodEls, methodURLs) => {
    buzz();
    toast('🔍 Checking service status…');
    methodEls.forEach((el, i) => {
      const badge = el.querySelector('._sdl_badge');
      if (badge) badge.textContent = '⏳';
      fetch(methodURLs[i], { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
        .then(() => { if (badge) { badge.textContent = '✅'; badge.style.color = '#27ae60'; } })
        .catch(() => { if (badge) { badge.textContent = '❌'; badge.style.color = '#e74c3c'; } });
    });
  };

  // ─── FEATURE 5: READER MODE ────────────────────────────────────
  // Opens Scribd embed inside a clean reader HTML page (blob URL).
  // User clicks the button — not automatic.
  const openReaderMode = (embedURL, title) => {
    buzz();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${title}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#f4f1ea;font-family:Georgia,serif;display:flex;flex-direction:column;height:100vh}
      #toolbar{background:#2c3e50;color:#fff;padding:10px 16px;display:flex;align-items:center;
        gap:12px;font-size:13px;flex-shrink:0}
      #toolbar b{flex-grow:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #toolbar button{background:#3f51b5;border:0;color:#fff;padding:5px 12px;
        border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap}
      #toolbar button:hover{background:#303f9f}
      iframe{flex-grow:1;border:0;width:100%}
    </style></head><body>
    <div id="toolbar">
      <b>📖 ${title}</b>
      <button onclick="document.querySelector('iframe').requestFullscreen()">⛶ Fullscreen</button>
      <button onclick="window.print()">🖨 Print</button>
    </div>
    <iframe src="${embedURL}" allowfullscreen></iframe>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const bUrl = URL.createObjectURL(blob);
    w.open(bUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(bUrl), 30000);
  };

  // ─── URL DETECTION ─────────────────────────────────────────────
  const parseScribd = url => {
    const m = url.match(/scribd\.com\/(document|doc|presentation|book)\/(\d+)/i);
    return m ? { id: m[2], type: m[1] } : null;
  };

  const parseSlideShare = url => {
    const m = url.match(/slideshare\.net\/[^/]+\/([^/?#]+)/i);
    return m ? { slug: m[1] } : null;
  };

  const getPageTitle = () => {
    const h1 = d.querySelector('h1');
    if (h1?.textContent?.trim()) return h1.textContent.trim();
    return d.title.replace(/\s*[|\-–]\s*(Scribd|SlideShare|LinkedIn).*/i,'').trim();
  };

  // ─── SCRIBD METHODS ────────────────────────────────────────────
  const scribdMethods = [
    {
      label: '⚡ VDownloaders',
      color: '#e74c3c', direct: true,
      desc:  'Instant domain-swap — fastest, most reliable method',
      url:   (id, type) => `https://scribd.vdownloaders.com/${type||'document'}/${id}/x`,
    },
    {
      label: '📄 VPDFS',
      color: '#8e44ad', direct: true,
      desc:  'Clean PDF via scribd.vpdfs.com — no ads',
      url:   (id, type) => `https://scribd.vpdfs.com/${type||'document'}/${id}/x`,
    },
    {
      label: '📑 PDFDownloaders',
      color: '#c0392b',
      desc:  'scribd.pdfdownloaders.com — reliable, unlimited downloads',
      url:   (id) => `https://scribd.pdfdownloaders.com/?url=https://scribd.com/document/${id}`,
    },
    {
      label: '⬇ DocDownloader',
      color: '#27ae60',
      desc:  'Best for long documents — handles most formats',
      url:   (id) => `https://docdownloader.com/scribd?url=https://scribd.com/document/${id}`,
    },
    {
      label: '📥 DownloadScribd',
      color: '#2980b9',
      desc:  'downloadscribd.com — clean interface, fast',
      url:   (id) => `https://downloadscribd.com/?url=https://scribd.com/document/${id}`,
    },
    {
      label: '📑 ScribdDL',
      color: '#16a085',
      desc:  'scribddownloader.id — simple 2-click download',
      url:   (id) => `https://scribddownloader.id/?url=https://scribd.com/document/${id}`,
    },
    {
      label: '📥 DLScrib',
      color: '#7f8c8d',
      desc:  'dlscrib.pro — alternative PDF downloader',
      url:   (id) => `https://dlscrib.pro/download?url=https://scribd.com/document/${id}`,
    },
    {
      label: '👁 Embed View',
      color: SCRIBD_CLR, viewOnly: true,
      desc:  'Full document view in Scribd embed — no login needed',
      url:   (id) => `https://www.scribd.com/embeds/${id}/content?start_page=1&view_mode=scroll&access_key=key-fFexxf7r1bzEfWu3HKwf`,
    },
    {
      label: '🕰 Wayback',
      color: '#e67e22', viewOnly: true,
      desc:  'Internet Archive cached version — last resort',
      url:   (id) => `https://web.archive.org/web/*/scribd.com/document/${id}`,
    },
  ];

  // ─── SLIDESHARE METHODS ────────────────────────────────────────
  const slideMethods = [
    {
      label: '⚡ VPDFS',
      color: '#e74c3c',
      desc:  'Best quality — real PDF with text preserved',
      url:   (slug, fullURL) => `https://slideshare.vpdfs.com/${fullURL.replace(/https?:\/\/(www\.)?slideshare\.net\//,'')}`,
    },
    {
      label: '📊 GetMyPPT',
      color: SLIDES_CLR,
      desc:  'Download as PPT or PDF — keeps animations',
      url:   (slug, fullURL) => `https://getmyppt.com/?url=${encodeURIComponent(fullURL)}`,
    },
    {
      label: '⬇ SlidesDownloader',
      color: '#27ae60',
      desc:  'PDF + PPT formats, no login required',
      url:   (slug, fullURL) => `https://www.slidesdownloader.co/?url=${encodeURIComponent(fullURL)}`,
    },
    {
      label: '📥 Downloader.is',
      color: '#8e44ad',
      desc:  'Simple paste-and-download, mobile friendly',
      url:   (slug, fullURL) => `https://slideshare.downloader.is/?url=${encodeURIComponent(fullURL)}`,
    },
    {
      label: '💾 SlidesSaver',
      color: '#e67e22',
      desc:  'PPT / PDF / DOCX / ZIP — multiple formats',
      url:   (slug, fullURL) => `https://slidessaver.com/?url=${encodeURIComponent(fullURL)}`,
    },
  ];

  // ─── MOBILE DETECTION ──────────────────────────────────────────
  const isMobile = w.innerWidth < 700 || nav.userAgentData?.mobile
    || /Android|iPhone|iPad/i.test(nav.userAgent);

  // ─── INJECT STYLES ─────────────────────────────────────────────
  const injectStyles = (accent) => {
    $(STY)?.remove();
    const st = C('style'); st.id = STY;

    // Responsive values
    const PW   = isMobile ? `calc(100vw - 16px)` : '380px';
    const PMAX = isMobile ? '80vh' : '580px';
    const PTOP = isMobile ? 'auto' : '8px';
    const PBOT = isMobile ? '8px'  : 'auto';
    const PRGT = '8px';
    const PLFT = isMobile ? '8px'  : 'auto';
    const BRAD = isMobile ? '14px 14px 0 0' : '12px';
    const PAD  = isMobile ? '12px 16px' : '10px 14px';
    const FHDR = isMobile ? '14px' : '13px';
    const FROW = isMobile ? '13px' : '12px';
    const PBTN = isMobile ? '8px 14px' : '5px 10px';
    const FBTN = isMobile ? '12px' : '11px';
    const PROW = isMobile ? '12px 16px' : '9px 14px';

    st.textContent = `
      #${POP}{
        position:fixed;top:${PTOP};bottom:${PBOT};right:${PRGT};left:${PLFT};
        width:${PW};max-height:${PMAX};
        background:${BG};color:${TXT};border-radius:${BRAD};z-index:2147483647;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:${FROW};box-shadow:0 8px 32px rgba(0,0,0,.4);
        display:flex;flex-direction:column;overflow:hidden;
      }
      #_sdl_hdr{
        background:${accent};color:#fff;padding:${PAD};
        display:flex;justify-content:space-between;align-items:flex-start;
        flex-shrink:0;
      }
      #_sdl_hdr b{font-size:${FHDR};line-height:1.4}
      #_sdl_hdr small{font-size:${isMobile?'11px':'10px'};opacity:.8;display:block;margin-top:3px}
      #_sdl_cx{
        background:0;border:0;color:rgba(255,255,255,.6);
        font-size:${isMobile?'26px':'22px'};cursor:pointer;line-height:1;
        padding:0 2px;flex-shrink:0;min-width:${isMobile?'36px':'28px'};
        text-align:center;
      }
      #_sdl_inf{
        padding:${isMobile?'8px 16px':'6px 14px'};background:${INFOBG};
        border-bottom:1px solid ${BORDER};
        font-size:${isMobile?'12px':'11px'};color:${STXT};
        display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex-shrink:0;
      }
      ._sdl_ib{
        padding:${isMobile?'5px 11px':'3px 8px'};border:0;border-radius:4px;color:#fff;
        font-size:${isMobile?'11px':'10px'};cursor:pointer;white-space:nowrap;font-weight:600;
      }
      ._sdl_ib:active{filter:brightness(.85)}
      ._sdl_badge{font-size:${isMobile?'11px':'10px'};margin-left:4px;font-weight:700}
      #_sdl_tip{
        padding:5px ${isMobile?'16px':'14px'};background:${dk?'#0a1628':'#fffbe6'};
        border-bottom:1px solid ${BORDER};font-size:${isMobile?'11px':'10px'};
        color:${dk?'#f0c040':'#7d6608'};line-height:1.5;flex-shrink:0;
      }
      #_sdl_bd{overflow-y:auto;flex-grow:1;-webkit-overflow-scrolling:touch}
      .Sm{
        padding:${PROW};border-bottom:1px solid ${BORDER};background:${CARD};
        display:flex;align-items:center;gap:${isMobile?'12px':'10px'};
      }
      .Sm:last-child{border-bottom:0}
      .Smb{
        flex-shrink:0;padding:${PBTN};border:0;border-radius:5px;color:#fff;
        font-size:${FBTN};font-weight:600;cursor:pointer;white-space:nowrap;
        transition:filter .15s,transform .1s;min-width:${isMobile?'90px':'70px'};
        text-align:center;
      }
      .Smb:active{transform:scale(.95);filter:brightness(.85)}
      .Smd{font-size:${isMobile?'11px':'10px'};color:${STXT};line-height:1.5}
      ._sep{
        padding:${isMobile?'6px 16px':'5px 14px'};font-size:${isMobile?'11px':'10px'};
        font-weight:700;letter-spacing:.5px;color:${STXT};background:${INFOBG};
        border-bottom:1px solid ${BORDER};text-transform:uppercase;flex-shrink:0;
      }
      .Sl{padding:${PROW};border-bottom:1px solid ${BORDER};background:${CARD}}
      .Sl:last-child{border-bottom:0}
      .Slt{
        font-size:${isMobile?'12.5px':'11.5px'};color:${TXT};
        margin-bottom:${isMobile?'8px':'6px'};word-break:break-word;line-height:1.4;
      }
      .Slb{
        padding:${isMobile?'6px 12px':'4px 9px'};border:0;border-radius:4px;color:#fff;
        font-size:${isMobile?'12px':'11px'};font-weight:600;cursor:pointer;
        white-space:nowrap;margin-right:5px;margin-bottom:5px;
        display:inline-block;transition:filter .15s,transform .1s;
      }
      .Slb:active{transform:scale(.95)}
      #_sdl_empty{
        padding:${isMobile?'28px 16px':'20px 14px'};text-align:center;
        color:${STXT};font-size:${isMobile?'13px':'12px'};line-height:1.7;
      }
    `;
    d.head.append(st);
  };

  // ─── BUILD METHODS POPUP ───────────────────────────────────────
  const buildMethodsPopup = ({ title, subtitle, accent, copyURL, methods, extras }) => {
    injectStyles(accent);
    $(POP)?.remove();
    const pop = C('div'); pop.id = POP;

    // Header
    const hdr = C('div'); hdr.id = '_sdl_hdr';
    const htxt = C('div');
    htxt.innerHTML = `<b>${subtitle}</b><small>${truncate(title,50)}</small>`;
    const cx = C('button'); cx.id = '_sdl_cx';
    cx.textContent = '×'; cx.onclick = () => pop.remove();
    hdr.append(htxt, cx);

    // Info bar — action buttons
    const inf = C('div'); inf.id = '_sdl_inf';

    // Tip panel — shown when Scholar is tapped to explain what it does
    const tipPanel = C('div'); tipPanel.id = '_sdl_tip';
    tipPanel.style.display = 'none';

    const mkIB = (label, bg, fn) => {
      const b = C('button'); b.className = '_sdl_ib';
      b.style.background = bg; b.textContent = label; b.onclick = fn;
      return b;
    };

    // Copy URL
    if (copyURL) {
      inf.append(mkIB('📋 Copy', accent, () => {
        buzz(); nav.clipboard?.writeText(copyURL).then(() => toast('📋 URL copied!'));
      }));
    }

    // Auto-find
    if (extras?.autoURLs?.length) {
      inf.append(mkIB('⚡ Auto Find', '#27ae60', () => autoFind(extras.autoURLs, title)));
    }

    // Check status — wired after bd is built
    const statusIB = mkIB('🔍 Status', '#8e44ad', () => {});
    inf.append(statusIB);

    // Google Scholar — shows a tip first then opens
    if (extras?.scholarQuery) {
      const schBtn = mkIB('🎓 Scholar', '#4285f4', () => {
        const isVisible = tipPanel.style.display !== 'none';
        if (isVisible) {
          tipPanel.style.display = 'none';
          buzz();
          w.open('https://scholar.google.com/scholar?q=' + encodeURIComponent(extras.scholarQuery), '_blank');
        } else {
          tipPanel.style.display = 'block';
          tipPanel.textContent = '🎓 Searches Google Scholar for this document title — finds academic papers, citations and citable versions. Tap again to open.';
        }
      });
      inf.append(schBtn);
    }

    // Reader mode
    if (extras?.embedURL) {
      inf.append(mkIB('📖 Reader', '#e67e22', () => openReaderMode(extras.embedURL, title)));
    }

    // Body — method rows
    const bd = C('div'); bd.id = '_sdl_bd';
    const rowEls = [];
    const allURLs = [];

    methods.forEach(({ label, color, desc, onclick, url, direct, filename }) => {
      const row = C('div'); row.className = 'Sm';

      const btn = C('button'); btn.className = 'Smb';
      btn.style.background = color; btn.textContent = label;
      btn.onclick = onclick;

      // Status badge
      const badge = C('span'); badge.className = '_sdl_badge'; badge.textContent = '○';
      btn.append(badge);

      const dsc = C('div'); dsc.className = 'Smd';
      dsc.textContent = desc;

      // Direct Save: anchor with download attribute — no fetch needed, no CORS issue
      if (direct) {
        const svBtn = C('button'); svBtn.className = 'Smb';
        svBtn.style.cssText = `background:#27ae60;margin-left:auto;flex-shrink:0;min-width:${isMobile?'70px':'60px'}`;
        svBtn.textContent = '⬇ Save';
        svBtn.onclick = e => {
          e.stopPropagation(); buzz();
          const a = C('a'); a.href = url; a.download = filename || 'document.pdf';
          a.setAttribute('target', '_blank');
          d.body.append(a); a.click(); a.remove();
          toast('⬇ Download starting…');
        };
        row.append(btn, dsc, svBtn);
      } else {
        row.append(btn, dsc);
      }

      bd.append(row);
      rowEls.push(row);
      if (url) allURLs.push(url);
    });

    // Wire check status now that rowEls is built
    statusIB.onclick = () => checkStatus(rowEls, allURLs);

    pop.append(hdr, inf, tipPanel, bd);
    d.body.append(pop);
    d.addEventListener('keydown', e => e.key==='Escape' && pop.remove(), {once:true});
  };

  // ─── SCRIBD POPUP ──────────────────────────────────────────────
  const showScribd = (id, type, title, fullURL) => {
    const cleanTitle = title.replace(/\s*[\(\[].{0,20}[\)\]]/g,'').replace(/\s{2,}/g,' ').trim();
    const embedURL   = `https://www.scribd.com/embeds/${id}/content?start_page=1&view_mode=scroll&access_key=key-fFexxf7r1bzEfWu3HKwf`;

    buildMethodsPopup({
      title: cleanTitle,
      subtitle: '📜 Scribd Downloader',
      accent: SCRIBD_CLR,
      copyURL: fullURL,
      extras: {
        autoURLs:    scribdMethods.filter(m=>!m.viewOnly).map(m => m.url(id, type)),
        scholarQuery: cleanTitle,
        embedURL,
      },
      methods: scribdMethods.map(m => ({
        label:    m.label,
        color:    m.color,
        desc:     m.desc,
        url:      m.url(id, type),
        direct:   !!m.direct,
        filename: `${cleanTitle.slice(0,40).replace(/[^\w\s-]/g,'')}.pdf`,
        onclick:  () => openURL(m.url(id, type)),
      })),
    });
  };

  // ─── SLIDESHARE POPUP ──────────────────────────────────────────
  const showSlide = (slug, title, fullURL) => {
    const cleanTitle = title.replace(/\s*[\(\[].{0,20}[\)\]]/g,'').replace(/\s{2,}/g,' ').trim();
    buildMethodsPopup({
      title: cleanTitle,
      subtitle: '📊 SlideShare Downloader',
      accent: SLIDES_CLR,
      copyURL: fullURL,
      extras: {
        autoURLs:    slideMethods.map(m => m.url(slug, fullURL)),
        scholarQuery: cleanTitle,
      },
      methods: slideMethods.map(m => ({
        label:   m.label,
        color:   m.color,
        desc:    m.desc,
        url:     m.url(slug, fullURL),
        onclick: () => openURL(m.url(slug, fullURL)),
      })),
    });
  };

  // ─── LINK SCAN POPUP ───────────────────────────────────────────
  const showLinkList = (scribdLinks, slideLinks) => {
    const total = scribdLinks.length + slideLinks.length;
    injectStyles(SCRIBD_CLR);
    $(POP)?.remove();
    const pop = C('div'); pop.id = POP;

    const hdr = C('div'); hdr.id = '_sdl_hdr';
    const htxt = C('b');
    htxt.textContent = `📜 ${total} link${total!==1?'s':''} found`;
    const cx = C('button'); cx.id = '_sdl_cx';
    cx.textContent = '×'; cx.onclick = () => pop.remove();
    hdr.append(htxt, cx);

    const bd = C('div'); bd.id = '_sdl_bd';

    if (total === 0) {
      const em = C('div'); em.id = '_sdl_empty';
      em.innerHTML = `No Scribd or SlideShare links on this page.<br><br>
        <a href="https://scribd.com" target="_blank" style="color:${SCRIBD_CLR};font-weight:600;text-decoration:none">Open Scribd</a>
        &nbsp;·&nbsp;
        <a href="https://slideshare.net" target="_blank" style="color:${SLIDES_CLR};font-weight:600;text-decoration:none">Open SlideShare</a>`;
      bd.append(em);
    }

    if (scribdLinks.length > 0) {
      const sep = C('div'); sep.className = '_sep';
      sep.textContent = `📜 Scribd — ${scribdLinks.length} document${scribdLinks.length!==1?'s':''}`;
      bd.append(sep);
      scribdLinks.forEach(({ docId, docType, title, href }) => {
        const row = C('div'); row.className = 'Sl';
        const lbl = C('div'); lbl.className = 'Slt';
        lbl.textContent = title; lbl.title = href;
        const bw = C('div');
        const vBtn = C('button'); vBtn.className = 'Slb'; vBtn.style.background = SCRIBD_CLR;
        vBtn.textContent = '👁 View';
        vBtn.onclick = () => openURL(`https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=key-fFexxf7r1bzEfWu3HKwf`);
        const dBtn = C('button'); dBtn.className = 'Slb'; dBtn.style.background = '#e74c3c';
        dBtn.textContent = '⬇ Download';
        dBtn.onclick = () => openURL(`https://scribd.vdownloaders.com/${docType||'document'}/${docId}/x`);
        const mBtn = C('button'); mBtn.className = 'Slb'; mBtn.style.background = '#636e72';
        mBtn.textContent = '⋯ More';
        mBtn.onclick = () => showScribd(docId, docType, title, href);
        bw.append(vBtn, dBtn, mBtn); row.append(lbl, bw); bd.append(row);
      });
    }

    if (slideLinks.length > 0) {
      const sep = C('div'); sep.className = '_sep';
      sep.textContent = `📊 SlideShare — ${slideLinks.length} presentation${slideLinks.length!==1?'s':''}`;
      bd.append(sep);
      slideLinks.forEach(({ slug, title, href }) => {
        const row = C('div'); row.className = 'Sl';
        const lbl = C('div'); lbl.className = 'Slt';
        lbl.textContent = title; lbl.title = href;
        const bw = C('div');
        const pBtn = C('button'); pBtn.className = 'Slb'; pBtn.style.background = SLIDES_CLR;
        pBtn.textContent = '⬇ PDF';
        pBtn.onclick = () => openURL(`https://slideshare.vpdfs.com/${href.replace(/https?:\/\/(www\.)?slideshare\.net\//,'')}`);
        const mBtn = C('button'); mBtn.className = 'Slb'; mBtn.style.background = '#636e72';
        mBtn.textContent = '⋯ More';
        mBtn.onclick = () => showSlide(slug, title, href);
        bw.append(pBtn, mBtn); row.append(lbl, bw); bd.append(row);
      });
    }

    pop.append(hdr, bd);
    d.body.append(pop);
    d.addEventListener('keydown', e => e.key==='Escape' && pop.remove(), {once:true});
  };

  // ─── MAIN ──────────────────────────────────────────────────────
  const url   = w.location.href;
  const scrib = parseScribd(url);
  const slide = url.includes('slideshare.net') ? parseSlideShare(url) : null;

  if (scrib) {
    showScribd(scrib.id, scrib.type, getPageTitle(), url);
  } else if (slide) {
    showSlide(slide.slug, getPageTitle(), url);
  } else {
    // Scan current page for all links
    const seenS = new Set(), seenSL = new Set();
    const sLinks = [], slLinks = [];

    d.querySelectorAll('a[href]').forEach(a => {
      const href = a.href || '';
      const sc = parseScribd(href);
      if (sc && !seenS.has(sc.id)) {
        seenS.add(sc.id);
        const raw = (a.textContent||a.title||'').trim();
        sLinks.push({ docId:sc.id, docType:sc.type,
          title: raw.length>2 ? truncate(raw) : truncate(href.split('/').pop()?.replace(/-/g,' ')||'Scribd doc'),
          href });
      }
      const sl = parseSlideShare(href);
      if (sl && href.includes('slideshare.net') && !seenSL.has(sl.slug)) {
        seenSL.add(sl.slug);
        const raw = (a.textContent||a.title||'').trim();
        slLinks.push({ slug:sl.slug,
          title: raw.length>2 ? truncate(raw) : truncate(sl.slug.replace(/-/g,' ')),
          href });
      }
    });

    showLinkList(sLinks, slLinks);
  }

})();
