(function () {
'use strict';

/* ═══════════════════════════════════════════════════════════
   PRINT MASTER BOOKMARKLET  v2.0
   Complete rebuild — addresses problems #14–#26 across
   14 improvement phases.
   ═══════════════════════════════════════════════════════════ */

var NS = '__pm20';

/* ══════════════════ GUARD ══════════════════ */
if (document.getElementById(NS + 'Mini')) { cleanup(); return; }

/* ══════════════════ FONT ══════════════════ */
if (!document.getElementById(NS + 'Font')) {
  var fl = document.createElement('link');
  fl.id = NS + 'Font'; fl.rel = 'stylesheet';
  fl.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap';
  document.head.appendChild(fl);
}

/* ══════════════════ CONSTANTS ══════════════════ */

/* Phase 4/9 — Noise denylist (50+ selectors) */
var NOISE = [
  'nav','header','footer','aside',
  '[role="banner"]','[role="navigation"]','[role="contentinfo"]',
  '.cookie-banner','.cookie-notice','.cookie-consent',
  '[class*="cookie"]','[id*="cookie"]',
  '.ad','.ad-banner','.ad-container','.ad-wrapper','.advertisement',
  '[class*="advert"]','[id*="advert"]','[class*="ad-"]','[id*="ad-"]',
  '.newsletter','.subscribe','.signup-form',
  '[class*="subscribe"]','[id*="subscribe"]',
  '.social-share','.share-buttons','.sharing',
  '[class*="share-"]','[id*="share-"]',
  '#comments','.comments','.comment-section',
  '.related-posts','.related-articles',
  '[class*="related"]','[id*="related"]',
  '.sidebar','.widget','.widgets',
  '[class*="sidebar"]','[id*="sidebar"]',
  '.popup','.modal','.overlay','.lightbox',
  '[class*="popup"]','[id*="popup"]',
  '.breadcrumb','.pagination','.pager',
  '[class*="promo"]','[id*="promo"]',
  '[class*="sponsor"]','[id*="sponsor"]',
  '.menu','.nav-menu','.main-menu','.mobile-menu',
  '.top-bar','.bottom-bar','.site-header','.site-footer',
  '.search-bar','.search-form',
  '[class*="banner"]','[id*="banner"]',
  '.author-bio','.post-meta','.meta',
  '.tags','.tag-list','.categories',
  '.cta','.call-to-action'
].join(',');

/* Phase 4 — Semantic content containers */
var CONTENT_SEL = [
  'article','main','[role="main"]',
  '.post-content','.entry-content','.article-body',
  '.content','#content','.post-body',
  '.article-content','.story-body',
  '[class*="article-body"]','[class*="post-content"]','[class*="entry-content"]',
  '[class*="article-content"]','[class*="story-body"]'
].join(',');

/* Phase 14 — Block type icons */
var ICONS = {
  p:'📝', h1:'📋', h2:'📋', h3:'📋', h4:'📋', h5:'📋', h6:'📋',
  blockquote:'💬', pre:'⌨️', figure:'🖼️', table:'📊',
  ul:'▸', ol:'1.', li:'•', article:'📰', section:'📄', div:'📄',
  dd:'📄', dt:'📄', figcaption:'📝', td:'📊', th:'📊', caption:'📝'
};

/* Phase 3 — Properties to inline for style preservation */
var INLINE_PROPS = [
  'font-family','font-size','font-weight','font-style','font-variant',
  'color','background-color',
  'margin-top','margin-right','margin-bottom','margin-left',
  'padding-top','padding-right','padding-bottom','padding-left',
  'border-top-width','border-right-width','border-bottom-width','border-left-width',
  'border-top-style','border-right-style','border-bottom-style','border-left-style',
  'border-top-color','border-right-color','border-bottom-color','border-left-color',
  'border-radius',
  'display','text-align','text-decoration','text-transform','text-indent',
  'line-height','letter-spacing','word-spacing',
  'list-style-type','list-style-position',
  'white-space'
];

var PRESETS = {
  none:    { t:0,    r:0,    b:0,    l:0    },
  narrow:  { t:12.7, r:12.7, b:12.7, l:12.7 },
  normal:  { t:25.4, r:25.4, b:25.4, l:25.4 },
  wide:    { t:25.4, r:25.4, b:25.4, l:38.1 },
  binding: { t:25.4, r:19.0, b:25.4, l:38.1 }
};
var FACTOR   = { mm:1, cm:0.1, 'in':1/25.4 };
var DECIMALS = { mm:1, cm:2,   'in':3       };
var STEP     = { mm:'0.5', cm:'0.1', 'in':'0.01' };
var HOLE_MM  = 25.4;

/* ══════════════════ STATE ══════════════════ */
var S = {
  selected: [], undoStack: [], pending: null,
  panel: 'mini', mode: 'tap', tapAction: 'select',
  armed: true,       /* Phase 2: capture pause */
  textSel: '',
  tipTimer: null,
  multiMode: false,  /* Phase 12: batch delete */
  multiSet: {},
  lpTimer: null,     /* Phase 12: long-press timer */
  ptrDown: null,     /* Phase 12: pointer tracking */
  reducedMotion: window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
};

/* Phase 11 — Print options with localStorage persistence */
var printOpts = { fontSize:'13', paperSize:'A4', showSource:true, preserveStyle:true, forceLight:true };

/* Margin state with persistence */
var marginState = { unit:'mm', linked:false, bindSide:'left', MM:{t:25.4,r:19.0,b:25.4,l:38.1} };

try {
  var _sv = JSON.parse(localStorage.getItem(NS+'M')||'null');
  if (_sv) { if(_sv.unit) marginState.unit=_sv.unit; if(_sv.MM) marginState.MM=_sv.MM;
    if(_sv.bindSide) marginState.bindSide=_sv.bindSide; if(typeof _sv.linked!=='undefined') marginState.linked=_sv.linked; }
  var _po = JSON.parse(localStorage.getItem(NS+'PO')||'null');
  if (_po) Object.assign(printOpts, _po);
} catch(e){}

/* Phase 13 — Session recovery from sessionStorage */
var savedSession = null;
try { savedSession = JSON.parse(sessionStorage.getItem(NS+'Sess')||'null'); } catch(e){}

/* Detect pre-existing text selection */
var _ws = window.getSelection();
if (_ws && _ws.toString().trim().length > 20) { S.textSel = _ws.toString().trim(); S.mode = 'text'; }

/* ══════════════════ HELPERS ══════════════════ */
function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function wc(t) { return t.trim().split(/\s+/).filter(Boolean).length; }

/* Phase 10 — Convert relative URLs to absolute */
function absURL(u) {
  if (!u || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#') || u.startsWith('javascript:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('//')) return u;
  try { return new URL(u, location.href).href; } catch(e) { return u; }
}

/* Phase 13 — Generate CSS selector path for session persistence */
function getPath(el) {
  var parts = [], cur = el;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    var tag = (cur.tagName||'').toLowerCase();
    if (!tag) break;
    var sel = tag;
    if (cur.id) { var safe = cur.id.match(/^[a-zA-Z][\w-]*/); if(safe) { sel += '#' + safe[0]; parts.unshift(sel); break; } }
    var par = cur.parentElement;
    if (par) {
      var sibs = Array.prototype.filter.call(par.children, function(c){ return c.tagName === cur.tagName; });
      if (sibs.length > 1) sel += ':nth-of-type(' + (Array.prototype.indexOf.call(sibs, cur) + 1) + ')';
    }
    parts.unshift(sel);
    cur = par;
  }
  return parts.join('>');
}

function saveSession() {
  try {
    var data = S.selected.map(function(el) {
      return { path: getPath(el), text: (el.innerText||'').slice(0, 120) };
    });
    sessionStorage.setItem(NS + 'Sess', JSON.stringify(data));
  } catch(e){}
}

function restoreSession(data) {
  var count = 0;
  data.forEach(function(item) {
    try {
      var el = document.querySelector(item.path);
      if (el && (el.innerText||'').slice(0,120) === item.text) {
        S.selected.push(el); markSel(el); count++;
      }
    } catch(e){}
  });
  return count;
}

/* Phase 12 — Enable fast tap by disabling double-tap zoom delay */
function enableFastTap() { document.documentElement.style.setProperty('touch-action','manipulation','important'); }
function disableFastTap() { document.documentElement.style.removeProperty('touch-action'); }

/* Phase 7 — Flash-highlight a block when jumping to it from the list */
function flashBlock(el) {
  if (!el) return;
  el.style.transition = 'background-color 0.15s';
  el.style.backgroundColor = 'rgba(250,204,21,0.35)';
  setTimeout(function(){ el.style.backgroundColor = 'rgba(109,40,217,0.09)'; }, 600);
  setTimeout(function(){ el.style.transition = ''; }, 800);
}

/* Phase 7 — Scroll to element and flash */
function scrollToBlock(el) {
  if (!el) return;
  var r = el.getBoundingClientRect();
  var target = r.top + window.pageYOffset - 80;
  window.scrollTo({ top: target, behavior: S.reducedMotion ? 'auto' : 'smooth' });
  setTimeout(function(){ flashBlock(el); }, S.reducedMotion ? 50 : 350);
}

/* ══════════════════ BLOCK FINDING ══════════════════ */
function findBlock(el) {
  var VH = window.innerHeight, VW = window.innerWidth;
  var INLINE = 'P,H1,H2,H3,H4,H5,H6,LI,BLOCKQUOTE,PRE,DT,DD,FIGCAPTION,CAPTION,TD,TH'.split(',');
  var SECTION = 'ARTICLE,SECTION,FIGURE,TABLE,DETAILS'.split(',');
  var best = null, cur = el, depth = 0;
  while (cur && cur !== document.body && depth < 14) {
    var id = cur.id || '';
    if (id === NS+'Mini' || id === NS+'Sheet' || id === NS+'Tip' || id === NS+'Toast') break;
    var tag = (cur.tagName||'').toUpperCase();
    var r = cur.getBoundingClientRect();
    var txt = (cur.innerText||'').trim();
    if (r.width===0 && r.height===0) { cur=cur.parentElement; depth++; continue; }
    var tooBig = r.height > VH*0.55 || (r.width > VW*0.9 && r.height > VH*0.22);
    if (INLINE.indexOf(tag) !== -1 && !tooBig) return cur;
    if (SECTION.indexOf(tag) !== -1 && !tooBig) return cur;
    if ((tag==='DIV'||tag==='SPAN') && txt.length>10 && !tooBig) {
      best = cur;
      var par = cur.parentElement;
      if (par) { var pr = par.getBoundingClientRect(); if (pr.height > VH*0.55) return best; }
    }
    if (tooBig && best) return best;
    cur = cur.parentElement; depth++;
  }
  return best || el;
}

function expandEl(el) {
  var p = el.parentElement;
  if (!p || p===document.body || p===document.documentElement) return el;
  return p;
}
function shrinkEl(el) {
  var ch = Array.prototype.slice.call(el.children);
  for (var i=0;i<ch.length;i++) if((ch[i].innerText||'').trim().length>8) return ch[i];
  return el;
}
function splitStanzas(el) {
  var parts = [];
  var pch = el.querySelectorAll(':scope > p');
  if (pch.length > 1) { pch.forEach(function(p){ parts.push(p); }); return parts; }
  var dch = el.querySelectorAll(':scope > div');
  if (dch.length > 1) { dch.forEach(function(d){ if((d.innerText||'').trim().length>5) parts.push(d); }); if(parts.length>1) return parts; }
  var htm = el.innerHTML;
  if (/<br\s*\/?>\s*<br/i.test(htm)) {
    htm.split(/<br\s*\/?>\s*<br\s*\/?>/i).forEach(function(c){
      var d=document.createElement('div'); d.innerHTML=c;
      if(d.innerText.trim().length>3) parts.push(d);
    });
    if (parts.length > 1) return parts;
  }
  return [el];
}

/* ══════════════════ MARKING ══════════════════ */
function markSel(el) {
  el.setAttribute('data-'+NS,'s');
  el.style.outline='3px solid #7c3aed'; el.style.outlineOffset='3px';
  el.style.backgroundColor='rgba(109,40,217,0.09)'; el.style.borderRadius='4px';
}
function markPend(el) {
  el.setAttribute('data-'+NS,'p');
  el.style.outline='2.5px dashed #f59e0b'; el.style.outlineOffset='3px';
  el.style.backgroundColor='rgba(245,158,11,0.08)'; el.style.borderRadius='4px';
}
function markPendRem(el) {
  el.setAttribute('data-'+NS,'r');
  el.style.outline='2.5px dashed #ef4444'; el.style.outlineOffset='3px';
  el.style.backgroundColor='rgba(239,68,68,0.08)'; el.style.borderRadius='4px';
}
function unmark(el) {
  if(!el) return;
  el.removeAttribute('data-'+NS);
  el.style.outline=el.style.outlineOffset=el.style.backgroundColor=el.style.borderRadius='';
}
function clearPend() { if(S.pending){ unmark(S.pending.el||S.pending); S.pending=null; } }

/* ══════════════════ SVG ICONS ══════════════════ */
var I = {
  cut:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  print:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  up:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  down:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  undo:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  trash:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
  copy:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  split:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 6l7-3 7 3M5 18l7 3 7-3"/></svg>',
  cog:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  text:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  check:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  hole:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/></svg>',
  link:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  close:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  minus:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  margin:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 8h16M8 4v16"/></svg>',
  pause:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  play:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  restore:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  locate:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>'
};

/* ══════════════════ BUILD MINI PILL ══════════════════ */
/* Phase 2: Glowing ring when armed, pause button, mode dot */
var mini = document.createElement('div');
mini.id = NS + 'Mini';
mini.innerHTML =
  '<button id="'+NS+'MiniMain" title="Expand panel">'+
    '<div id="'+NS+'MiniRing"></div>'+
    '<div id="'+NS+'MiniIco">'+I.cut+'</div>'+
    '<div id="'+NS+'MiniInfo">'+
      '<span id="'+NS+'MiniDot" class="'+NS+'DotSel"></span>'+
      '<span id="'+NS+'MiniCnt">0</span>'+
      '<span id="'+NS+'MiniLbl"> blocks</span>'+
    '</div>'+
    '<div id="'+NS+'MiniArrow">'+I.up+'</div>'+
  '</button>'+
  '<button id="'+NS+'MiniPause" title="Pause capture">'+I.pause+'</button>'+
  '<button id="'+NS+'MiniPrint" title="Print now">'+I.print+'</button>';
document.body.appendChild(mini);

/* ══════════════════ BUILD TOOLTIP (Phase 1) ══════════════════ */
/* Compact floating chip, max 220px, smart positioning */
var tip = document.createElement('div');
tip.id = NS + 'Tip';
tip.innerHTML =
  '<div id="'+NS+'TipPrev"></div>'+
  '<div id="'+NS+'TipBtns">'+
    '<button id="'+NS+'TipAdd" title="Confirm">'+I.check+'</button>'+
    '<button id="'+NS+'TipRem" title="Remove">'+I.minus+'</button>'+
    '<button id="'+NS+'TipBig" title="Expand">'+I.up+'</button>'+
    '<button id="'+NS+'TipSml" title="Shrink">'+I.down+'</button>'+
    '<button id="'+NS+'TipX" title="Cancel">'+I.close+'</button>'+
  '</div>';
document.body.appendChild(tip);

/* ══════════════════ BUILD SHEET ══════════════════ */
/* Phase 11: Added Print Options tab */
/* Phase 13: Added restore banner */
var sheet = document.createElement('div');
sheet.id = NS + 'Sheet';
sheet.innerHTML =
  '<div id="'+NS+'Hdl"><div id="'+NS+'HdlBar"></div></div>'+

  /* Phase 13 — Restore banner */
  '<div id="'+NS+'Restore" style="display:none">'+
    '<div id="'+NS+'RestTxt"></div>'+
    '<div id="'+NS+'RestBtns">'+
      '<button id="'+NS+'RestYes">'+I.restore+' Restore</button>'+
      '<button id="'+NS+'RestNo">Dismiss</button>'+
    '</div>'+
  '</div>'+

  '<div id="'+NS+'Hdr">'+
    '<div id="'+NS+'HdrL">'+
      '<div id="'+NS+'HdrIco">'+I.cut+'</div>'+
      '<div>'+
        '<div id="'+NS+'HdrTtl">Print Master</div>'+
        '<div id="'+NS+'HdrSub">Select · Margins · Print</div>'+
      '</div>'+
    '</div>'+
    '<div id="'+NS+'HdrR">'+
      '<button id="'+NS+'BtnMin" title="Minimise">'+I.down+' Minimise</button>'+
      '<button id="'+NS+'BtnCls" title="Close">'+I.close+'</button>'+
    '</div>'+
  '</div>'+

  '<div id="'+NS+'Tabs">'+
    '<button class="'+NS+'Tab _on" data-m="tap">'+I.cut+' Tap Pick</button>'+
    '<button class="'+NS+'Tab" data-m="text">'+I.text+' Text Sel</button>'+
    '<button class="'+NS+'Tab" data-m="margin">'+I.margin+' Margins</button>'+
    '<button class="'+NS+'Tab" data-m="options">'+I.cog+' Options</button>'+
  '</div>'+

  /* ── TAP PICK PANE ── */
  '<div id="'+NS+'TapPane">'+
    '<div id="'+NS+'TapAction">'+
      '<button class="'+NS+'TAct _on" data-a="select">'+I.check+' Select</button>'+
      '<button class="'+NS+'TAct" data-a="deselect">'+I.minus+' Deselect</button>'+
    '</div>'+
    '<div id="'+NS+'Inst">'+
      '<span id="'+NS+'InstIco">👆</span>'+
      '<div id="'+NS+'InstTxt">'+
        '<strong>Minimise this panel first</strong>, then tap blocks on the page. First tap = preview, second = confirm.'+
      '</div>'+
      '<button id="'+NS+'InstMin">'+I.down+' Go</button>'+
    '</div>'+
    '<div id="'+NS+'List">'+
      '<div id="'+NS+'ListHdr">'+
        '<span id="'+NS+'ListLbl">Selected blocks</span>'+
        '<div id="'+NS+'ListHdrR">'+
          '<span id="'+NS+'ListCnt" class="'+NS+'Badge">0</span>'+
          '<button id="'+NS+'BtnAll">&#x2714; Select content</button>'+
          '<button id="'+NS+'BtnUndo">'+I.undo+'</button>'+
          '<button id="'+NS+'BtnClr">'+I.trash+'</button>'+
        '</div>'+
      '</div>'+
      /* Phase 12: Multi-select batch bar */
      '<div id="'+NS+'BatchBar" style="display:none">'+
        '<span id="'+NS+'BatchTxt">0 selected</span>'+
        '<button id="'+NS+'BatchDel">'+I.trash+' Delete selected</button>'+
        '<button id="'+NS+'BatchDone">Done</button>'+
      '</div>'+
      '<div id="'+NS+'ListItems"><div id="'+NS+'ListEmpty">No blocks selected yet. Minimise and tap content on the page.</div></div>'+
    '</div>'+
    '<div id="'+NS+'Adj" style="display:none">'+
      '<span class="'+NS+'SLbl">Adjust last block</span>'+
      '<div id="'+NS+'AdjBtns">'+
        '<button class="'+NS+'ABtn" id="'+NS+'AExp">'+I.up+' Expand</button>'+
        '<button class="'+NS+'ABtn" id="'+NS+'AShr">'+I.down+' Shrink</button>'+
        '<button class="'+NS+'ABtn" id="'+NS+'ASpl">'+I.split+' Split stanzas</button>'+
        '<button class="'+NS+'ABtn" id="'+NS+'ACpy">'+I.copy+' Copy text</button>'+
      '</div>'+
    '</div>'+
  '</div>'+

  /* ── TEXT SELECTION PANE ── */
  '<div id="'+NS+'TextPane" style="display:none">'+
    '<div id="'+NS+'TxtPrev"></div>'+
    '<div id="'+NS+'TxtMeta"></div>'+
    '<div id="'+NS+'TxtNote">💡 On Android: long-press a word → drag handles → re-open bookmarklet or tap Refresh.</div>'+
    '<button id="'+NS+'TxtRef">↻ Refresh selection</button>'+
  '</div>'+

  /* ── MARGINS PANE ── */
  '<div id="'+NS+'MarginPane" style="display:none">'+
    '<div id="'+NS+'BindStrip">'+
      '<div id="'+NS+'BSLeft">'+
        '<span class="'+NS+'Pill" id="'+NS+'PunchBadge">'+I.hole+' Hole-punch mode</span>'+
      '</div>'+
      '<div id="'+NS+'BindSide">'+
        '<span class="'+NS+'SLbl">Binding</span>'+
        '<button class="'+NS+'BS active" data-s="left">◄ Left</button>'+
        '<button class="'+NS+'BS" data-s="right">Right ►</button>'+
        '<button class="'+NS+'BS" data-s="top">▲ Top</button>'+
      '</div>'+
    '</div>'+
    '<div id="'+NS+'BindRow">'+
      '<div id="'+NS+'BindGauge">'+
        '<div id="'+NS+'GaugeTrack"><div id="'+NS+'GaugeFill"></div><div id="'+NS+'GaugeHole"></div></div>'+
        '<div id="'+NS+'GaugeLbls"><span>0</span><span id="'+NS+'HoleLbl">25.4mm</span><span>60mm</span></div>'+
      '</div>'+
      '<div id="'+NS+'BindInfo"><div id="'+NS+'BindVal"></div><div id="'+NS+'BindHint"></div></div>'+
    '</div>'+
    '<div id="'+NS+'PreRow">'+
      '<span class="'+NS+'SLbl">Preset</span>'+
      '<div id="'+NS+'PBtns">'+
        '<button class="'+NS+'P" data-p="none">None</button>'+
        '<button class="'+NS+'P" data-p="narrow">Narrow</button>'+
        '<button class="'+NS+'P" data-p="normal">Normal</button>'+
        '<button class="'+NS+'P" data-p="wide">Punch</button>'+
        '<button class="'+NS+'P" data-p="binding">Binding</button>'+
      '</div>'+
    '</div>'+
    '<div id="'+NS+'Grid">'+
      '<div class="'+NS+'IC" id="'+NS+'CellT"><label class="'+NS+'ILbl">Top</label><input type="number" id="'+NS+'T" min="0" inputmode="decimal"></div>'+
      '<div id="'+NS+'Mid">'+
        '<div class="'+NS+'IC '+NS+'Side" id="'+NS+'CellL"><label class="'+NS+'ILbl" id="'+NS+'LLbl">Left<span class="'+NS+'BindMark" id="'+NS+'LMark"></span></label><input type="number" id="'+NS+'L" min="0" inputmode="decimal"></div>'+
        '<div id="'+NS+'DWrap"><canvas id="'+NS+'Canvas" width="90" height="126"></canvas></div>'+
        '<div class="'+NS+'IC '+NS+'Side" id="'+NS+'CellR"><label class="'+NS+'ILbl" id="'+NS+'RLbl">Right<span class="'+NS+'BindMark" id="'+NS+'RMark"></span></label><input type="number" id="'+NS+'R" min="0" inputmode="decimal"></div>'+
      '</div>'+
      '<div class="'+NS+'IC" id="'+NS+'CellB"><label class="'+NS+'ILbl" id="'+NS+'BLbl">Bottom<span class="'+NS+'BindMark" id="'+NS+'BMark"></span></label><input type="number" id="'+NS+'B" min="0" inputmode="decimal"></div>'+
    '</div>'+
    '<div id="'+NS+'CtrlRow">'+
      '<button id="'+NS+'LnkBtn">'+I.link+' <span id="'+NS+'LnkLbl">Link all</span></button>'+
      '<div id="'+NS+'UBtns">'+
        '<button class="'+NS+'U" data-u="mm">mm</button>'+
        '<button class="'+NS+'U" data-u="cm">cm</button>'+
        '<button class="'+NS+'U" data-u="in">in</button>'+
      '</div>'+
    '</div>'+
    '<div id="'+NS+'CSSBar">'+
      '<code id="'+NS+'CSSCode"></code>'+
      '<button id="'+NS+'CpyBtn">'+I.copy+' <span id="'+NS+'CpyLbl">Copy</span></button>'+
    '</div>'+
  '</div>'+

  /* ── PRINT OPTIONS PANE (Phase 11) ── */
  '<div id="'+NS+'OptsPane" style="display:none">'+
    '<div class="'+NS+'OptGroup">'+
      '<label class="'+NS+'OptLbl">Font size</label>'+
      '<select id="'+NS+'OptFontSize" class="'+NS+'OptSelect">'+
        '<option value="11"'+(printOpts.fontSize==='11'?' selected':'')+'>Small (11pt)</option>'+
        '<option value="13"'+(printOpts.fontSize==='13'?' selected':'')+'>Normal (13pt)</option>'+
        '<option value="16"'+(printOpts.fontSize==='16'?' selected':'')+'>Large (16pt)</option>'+
        '<option value="18"'+(printOpts.fontSize==='18'?' selected':'')+'>Extra Large (18pt)</option>'+
      '</select>'+
    '</div>'+
    '<div class="'+NS+'OptGroup">'+
      '<label class="'+NS+'OptLbl">Paper size</label>'+
      '<select id="'+NS+'OptPaper" class="'+NS+'OptSelect">'+
        '<option value="A4"'+(printOpts.paperSize==='A4'?' selected':'')+'>A4</option>'+
        '<option value="letter"'+(printOpts.paperSize==='letter'?' selected':'')+'>US Letter</option>'+
        '<option value="legal"'+(printOpts.paperSize==='legal'?' selected':'')+'>US Legal</option>'+
      '</select>'+
    '</div>'+
    '<div class="'+NS+'OptToggle">'+
      '<div><span class="'+NS+'OptLbl">Preserve page styles</span><span class="'+NS+'OptHint">Keep fonts, colors from original</span></div>'+
      '<label class="'+NS+'Switch"><input type="checkbox" id="'+NS+'OptPreserve"'+(printOpts.preserveStyle?' checked':'')+'><span class="'+NS+'Slider"></span></label>'+
    '</div>'+
    '<div class="'+NS+'OptToggle">'+
      '<div><span class="'+NS+'OptLbl">Show source URL</span><span class="'+NS+'OptHint">Print page URL at bottom</span></div>'+
      '<label class="'+NS+'Switch"><input type="checkbox" id="'+NS+'OptSource"'+(printOpts.showSource?' checked':'')+'><span class="'+NS+'Slider"></span></label>'+
    '</div>'+
    '<div class="'+NS+'OptToggle">'+
      '<div><span class="'+NS+'OptLbl">Force light background</span><span class="'+NS+'OptHint">White bg, dark text for printing</span></div>'+
      '<label class="'+NS+'Switch"><input type="checkbox" id="'+NS+'OptLight"'+(printOpts.forceLight?' checked':'')+'><span class="'+NS+'Slider"></span></label>'+
    '</div>'+
  '</div>'+

  /* ── FOOTER ── */
  '<div id="'+NS+'Footer">'+
    '<button class="'+NS+'FBtn _ghost" id="'+NS+'FCpy">'+I.copy+' Copy text</button>'+
    '<button class="'+NS+'FBtn _primary" id="'+NS+'FPrn">'+I.print+' <span id="'+NS+'FPrnLbl">Print</span></button>'+
  '</div>';
document.body.appendChild(sheet);

/* ══════════════════ CSS STYLES ══════════════════ */
var styleEl = document.createElement('style');
styleEl.id = NS + 'Style';
styleEl.textContent = [
/* ── Base reset ── */
'[id^="'+NS+'"] *,[id^="'+NS+'"] *::before,[id^="'+NS+'"] *::after{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;font-family:"Outfit","Segoe UI",sans-serif;}',
/* ── Reduced motion (Phase 6) ── */
'@media(prefers-reduced-motion:reduce){[id^="'+NS+'"]{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}',

/* ── MINI PILL ── */
'#'+NS+'Mini{position:fixed;bottom:72px;right:16px;z-index:2147483646;display:flex;align-items:center;gap:4px;animation:'+NS+'pop .3s cubic-bezier(.34,1.56,.64,1);}',
'@keyframes '+NS+'pop{from{opacity:0;transform:scale(.6) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}',
'#'+NS+'MiniMain{position:relative;display:flex;align-items:center;gap:8px;height:48px;padding:0 16px 0 12px;background:rgba(10,10,18,0.9);backdrop-filter:blur(16px) saturate(1.5);border:1px solid rgba(255,255,255,0.1);border-radius:99px;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 8px 32px rgba(0,0,0,0.5);transition:transform .15s,box-shadow .15s;}',

/* Phase 2: Glowing ring when capture is armed */
'#'+NS+'MiniRing{position:absolute;inset:-3px;border-radius:99px;border:2px solid transparent;pointer-events:none;transition:border-color .3s;}',
'#'+NS+'MiniRing._armed{border-color:rgba(124,58,237,0.6);box-shadow:0 0 12px rgba(124,58,237,0.3),inset 0 0 12px rgba(124,58,237,0.1);animation:'+NS+'glow 2s ease-in-out infinite;}',
'@keyframes '+NS+'glow{0%,100%{border-color:rgba(124,58,237,0.5);box-shadow:0 0 8px rgba(124,58,237,0.2)}50%{border-color:rgba(124,58,237,0.8);box-shadow:0 0 20px rgba(124,58,237,0.4)}}',
'#'+NS+'MiniRing._paused{border-color:rgba(245,158,11,0.4);box-shadow:none;animation:none;}',
'#'+NS+'MiniRing._deselect{border-color:rgba(239,68,68,0.5);box-shadow:0 0 12px rgba(239,68,68,0.2);animation:'+NS+'glowR 2s ease-in-out infinite;}',
'@keyframes '+NS+'glowR{0%,100%{border-color:rgba(239,68,68,0.4)}50%{border-color:rgba(239,68,68,0.7)}}',

'#'+NS+'MiniMain:active{transform:scale(.95);}',
'#'+NS+'MiniIco{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'#'+NS+'MiniInfo{display:flex;align-items:center;gap:4px;}',
/* Phase 7: Mode indicator dot */
'.'+NS+'DotSel{width:7px;height:7px;border-radius:50%;background:#7c3aed;display:inline-block;flex-shrink:0;}',
'.'+NS+'DotDesel{width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0;}',
'.'+NS+'DotPause{width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;flex-shrink:0;}',
'#'+NS+'MiniCnt{font-size:18px;font-weight:700;color:#c4b5fd;transition:transform .2s cubic-bezier(.34,1.56,.64,1);}',
'#'+NS+'MiniLbl{font-size:12px;color:rgba(255,255,255,0.4);}',
'#'+NS+'MiniArrow{color:rgba(255,255,255,0.4);display:flex;align-items:center;margin-left:2px;}',
/* Phase 2: Pause button — 44px target */
'#'+NS+'MiniPause{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all .15s;flex-shrink:0;}',
'#'+NS+'MiniPause:hover{background:rgba(245,158,11,0.15);color:#fbbf24;border-color:rgba(245,158,11,0.4);}',
'#'+NS+'MiniPause._paused{background:rgba(109,40,217,0.2);color:#c4b5fd;border-color:rgba(109,40,217,0.5);}',
'#'+NS+'MiniPrint{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#4338ca);border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 20px rgba(109,40,217,0.5);transition:transform .15s;flex-shrink:0;}',
'#'+NS+'MiniPrint:active{transform:scale(.92);}',

/* ── TOOLTIP (Phase 1: Compact chip) ── */
'#'+NS+'Tip{display:none;position:fixed;z-index:2147483647;max-width:220px;background:rgba(12,12,20,0.97);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:10px 12px;box-shadow:0 12px 40px rgba(0,0,0,0.7);animation:'+NS+'tipIn .15s ease-out;}',
'@keyframes '+NS+'tipIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}',
'#'+NS+'TipPrev{font-size:11px;color:rgba(255,255,255,0.4);font-family:"JetBrains Mono",monospace;margin-bottom:8px;max-height:40px;overflow:hidden;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}',
'#'+NS+'TipBtns{display:flex;gap:5px;}',
'#'+NS+'TipBtns button{width:36px;height:36px;border-radius:10px;border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;transition:all .12s;flex-shrink:0;}',
'#'+NS+'TipAdd{background:rgba(109,40,217,0.3)!important;border-color:rgba(109,40,217,0.7)!important;color:#ddd6fe!important;}',
'#'+NS+'TipRem{background:rgba(239,68,68,0.2)!important;border-color:rgba(239,68,68,0.6)!important;color:#fca5a5!important;display:none;}',
'#'+NS+'TipX{color:rgba(255,255,255,0.25)!important;margin-left:auto;}',
'#'+NS+'TipBtns button:active{transform:scale(.9);}',
/* Phase 1: Mobile — hide text preview, icon-only */
'@media(max-width:480px){#'+NS+'TipPrev{display:none;}#'+NS+'Tip{padding:8px 10px;max-width:200px;}}',

/* ── SHEET ── */
'#'+NS+'Sheet{position:fixed;bottom:0;left:0;right:0;z-index:2147483645;background:#0a0a12;border-top:1px solid rgba(255,255,255,0.07);border-radius:22px 22px 0 0;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 -20px 60px rgba(0,0,0,0.7);transform:translateY(110%);transition:transform .35s cubic-bezier(.16,1,.3,1);}',
'#'+NS+'Sheet._open{transform:translateY(0);}',
'#'+NS+'Hdl{flex-shrink:0;display:flex;justify-content:center;padding:10px 0 6px;cursor:grab;}',
'#'+NS+'HdlBar{width:36px;height:4px;background:rgba(255,255,255,0.1);border-radius:99px;}',

/* Phase 13: Restore banner */
'#'+NS+'Restore{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 16px 8px;padding:10px 14px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:11px;}',
'#'+NS+'RestTxt{flex:1;font-size:12px;color:rgba(52,211,153,0.85);}',
'#'+NS+'RestBtns{display:flex;gap:6px;}',
'#'+NS+'RestYes{padding:7px 14px;border-radius:8px;border:none;background:rgba(52,211,153,0.25);color:#6ee7b7;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;}',
'#'+NS+'RestNo{padding:7px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer;}',

'#'+NS+'Hdr{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:2px 16px 12px;}',
'#'+NS+'HdrL{display:flex;align-items:center;gap:11px;}',
'#'+NS+'HdrIco{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 16px rgba(109,40,217,0.5);}',
'#'+NS+'HdrTtl{font-size:16px;font-weight:700;color:#f0f0fa;letter-spacing:-.3px;}',
/* Phase 7: Word count in header */
'#'+NS+'HdrSub{font-size:10.5px;color:rgba(255,255,255,0.25);margin-top:1px;}',
'#'+NS+'HdrR{display:flex;align-items:center;gap:6px;}',
/* Phase 25: 44px close button */
'#'+NS+'BtnMin{min-height:44px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.38);font-size:11.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .15s;white-space:nowrap;}',
'#'+NS+'BtnMin:hover{border-color:rgba(109,40,217,0.45);color:#c4b5fd;}',
'#'+NS+'BtnCls{min-width:44px;min-height:44px;border-radius:50%;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.4);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}',
'#'+NS+'BtnCls:active{background:rgba(239,68,68,0.2);color:#f87171;}',
'#'+NS+'Tabs{flex-shrink:0;display:flex;gap:4px;padding:0 16px 12px;}',
'.'+NS+'Tab{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 4px;border-radius:11px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.33);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;}',
'.'+NS+'Tab._on{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.55);color:#c4b5fd;}',
'#'+NS+'TapPane,#'+NS+'TextPane,#'+NS+'MarginPane,#'+NS+'OptsPane{overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;padding-bottom:4px;}',

/* ── Tap action buttons ── */
'#'+NS+'TapAction{display:flex;gap:5px;padding:0 16px 10px;}',
'.'+NS+'TAct{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:10px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.33);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;}',
'.'+NS+'TAct._on{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.55);color:#c4b5fd;}',
'.'+NS+'TAct[data-a="deselect"]._on{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.55);color:#fca5a5;}',
'#'+NS+'Inst{margin:0 16px 12px;display:flex;align-items:center;gap:10px;background:rgba(109,40,217,0.1);border:1px solid rgba(109,40,217,0.25);border-radius:13px;padding:11px 13px;}',
'#'+NS+'Inst._warn{background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.2);}',
'#'+NS+'InstIco{font-size:20px;flex-shrink:0;}',
'#'+NS+'InstTxt{flex:1;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;}',
'#'+NS+'InstTxt strong{color:rgba(255,255,255,0.7);}',
'#'+NS+'InstMin{min-height:44px;padding:8px 14px;border-radius:9px;border:none;background:linear-gradient(135deg,#6d28d9,#4338ca);color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px;flex-shrink:0;}',

/* ── List ── */
'#'+NS+'List{margin:0 16px 12px;border:1px solid rgba(255,255,255,0.07);border-radius:13px;overflow:hidden;}',
'#'+NS+'ListHdr{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.05);}',
'#'+NS+'ListLbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,0.28);}',
'#'+NS+'ListHdrR{display:flex;align-items:center;gap:5px;}',
'.'+NS+'Badge{background:rgba(109,40,217,0.3);color:#c4b5fd;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;}',
'#'+NS+'ListHdrR button{min-height:32px;padding:4px 9px;border-radius:7px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.38);font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;-webkit-tap-highlight-color:transparent;}',
/* Phase 12: Batch delete bar */
'#'+NS+'BatchBar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 13px;background:rgba(239,68,68,0.1);border-bottom:1px solid rgba(239,68,68,0.2);}',
'#'+NS+'BatchTxt{font-size:12px;font-weight:600;color:#fca5a5;}',
'#'+NS+'BatchDel{min-height:44px;padding:8px 14px;border-radius:8px;border:none;background:rgba(239,68,68,0.25);color:#fca5a5;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;}',
'#'+NS+'BatchDone{min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.5);font-size:12px;cursor:pointer;}',
'#'+NS+'ListItems{max-height:180px;overflow-y:auto;-webkit-overflow-scrolling:touch;}',
'#'+NS+'ListEmpty{padding:20px;text-align:center;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6;}',

/* Phase 14: Enhanced list items with icon, word count, locate button */
'.'+NS+'SItem{display:flex;align-items:center;gap:8px;padding:8px 13px;border-bottom:1px solid rgba(255,255,255,0.04);position:relative;overflow:hidden;-webkit-user-select:none;user-select:none;}',
'.'+NS+'SItem:last-child{border-bottom:none;}',
'.'+NS+'SItem._swiping{transition:transform .2s ease;}',
'.'+NS+'SDelBg{position:absolute;right:0;top:0;bottom:0;width:80px;background:rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;color:#f87171;font-size:12px;font-weight:600;}',
'.'+NS+'SItemInner{display:flex;align-items:center;gap:8px;flex:1;min-width:0;position:relative;z-index:1;background:inherit;}',
/* Phase 12: Multi-select checkbox */
'.'+NS+'SChk{width:20px;height:20px;border-radius:6px;border:2px solid rgba(255,255,255,0.15);background:transparent;display:none;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent;}',
'.'+NS+'Multi .'+NS+'SChk{display:flex;}',
'.'+NS+'SChk._checked{background:rgba(109,40,217,0.4);border-color:rgba(109,40,217,0.8);}',
'.'+NS+'SIcon{font-size:14px;flex-shrink:0;width:22px;text-align:center;}',
'.'+NS+'SNum{width:20px;height:20px;border-radius:50%;background:rgba(109,40,217,0.22);color:#c4b5fd;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'.'+NS+'Multi .'+NS+'SNum{display:none;}',
'.'+NS+'STxt{flex:1;font-size:11.5px;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}',
/* Phase 14: Word count badge */
'.'+NS+'SWc{font-size:9px;color:rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);border-radius:4px;padding:1px 5px;flex-shrink:0;font-family:"JetBrains Mono",monospace;}',
/* Phase 14: Locate button */
'.'+NS+'SLoc{min-width:44px;min-height:44px;border:none;background:transparent;color:rgba(255,255,255,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;transition:color .15s;}',
'.'+NS+'SLoc:hover{color:#c4b5fd;}',
'.'+NS+'SLoc:active{transform:scale(.9);}',
/* Phase 25: 44px delete button */
'.'+NS+'SDel{min-width:44px;min-height:44px;border-radius:50%;border:none;background:transparent;color:rgba(239,68,68,0.4);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;transition:all .12s;}',
'.'+NS+'SDel:hover{background:rgba(239,68,68,0.15);color:#f87171;}',

'#'+NS+'Adj{margin:0 16px 12px;}',
'.'+NS+'SLbl{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,0.25);margin-bottom:7px;}',
'#'+NS+'AdjBtns{display:flex;gap:5px;flex-wrap:wrap;}',
'.'+NS+'ABtn{min-height:44px;padding:8px 13px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.42);font-size:11.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;-webkit-tap-highlight-color:transparent;transition:all .12s;}',
'.'+NS+'ABtn:hover{border-color:rgba(109,40,217,0.5);color:#c4b5fd;}',
'.'+NS+'ABtn:active{transform:scale(.95);}',

/* ── Text pane ── */
'#'+NS+'TextPane{padding:0 16px 12px;display:none;flex-direction:column;gap:10px;}',
'#'+NS+'TxtPrev{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 14px;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.65;max-height:100px;overflow-y:auto;font-family:"JetBrains Mono",monospace;white-space:pre-wrap;word-break:break-word;}',
'#'+NS+'TxtMeta{font-size:11px;color:rgba(255,255,255,0.25);}',
'#'+NS+'TxtNote{font-size:11.5px;color:rgba(255,255,255,0.28);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 12px;line-height:1.55;}',
'#'+NS+'TxtRef{min-height:44px;padding:10px;border-radius:10px;border:1.5px solid rgba(109,40,217,0.35);background:rgba(109,40,217,0.1);color:#c4b5fd;font-size:12.5px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;}',

/* ── Margin pane ── */
'#'+NS+'MarginPane{padding:0 16px 14px;display:none;flex-direction:column;gap:10px;}',
'#'+NS+'BindStrip{display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(109,40,217,0.1);border:1px solid rgba(109,40,217,0.25);border-radius:12px;padding:9px 12px;}',
'#'+NS+'BSLeft{flex-shrink:0;}',
'.'+NS+'Pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:#c4b5fd;font-weight:500;}',
'#'+NS+'BindSide{display:flex;align-items:center;gap:6px;}',
'.'+NS+'BS{min-height:32px;padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-size:10px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'.'+NS+'BS.active{background:rgba(109,40,217,0.28);border-color:rgba(109,40,217,0.7);color:#ddd6fe;}',
'#'+NS+'BindRow{background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:10px 13px;display:flex;gap:12px;align-items:center;}',
'#'+NS+'BindGauge{flex:1;}',
'#'+NS+'GaugeTrack{height:10px;background:rgba(255,255,255,0.06);border-radius:99px;position:relative;overflow:visible;margin-bottom:5px;}',
'#'+NS+'GaugeFill{height:100%;border-radius:99px;background:linear-gradient(90deg,#6d28d9,#7c3aed);transition:width .2s;position:absolute;top:0;left:0;}',
'#'+NS+'GaugeHole{position:absolute;top:50%;transform:translateY(-50%);width:2px;height:18px;background:rgba(196,181,253,0.5);border-radius:1px;}',
'#'+NS+'GaugeLbls{display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,0.2);}',
'#'+NS+'HoleLbl{color:rgba(196,181,253,0.6);}',
'#'+NS+'BindInfo{text-align:right;flex-shrink:0;}',
'#'+NS+'BindVal{font-size:18px;font-weight:500;color:#c4b5fd;line-height:1;}',
'#'+NS+'BindHint{font-size:9.5px;color:rgba(255,255,255,0.25);margin-top:3px;}',
'#'+NS+'PreRow{display:flex;align-items:center;gap:8px;}',
'#'+NS+'PBtns{display:flex;gap:3px;flex:1;}',
'.'+NS+'P{min-height:36px;padding:6px 2px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;color:rgba(255,255,255,0.35);font-size:10.5px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'.'+NS+'P._on{background:rgba(109,40,217,0.22);border-color:rgba(109,40,217,0.65);color:#c4b5fd;}',
'#'+NS+'Grid{display:flex;flex-direction:column;align-items:center;gap:5px;}',
'#'+NS+'Mid{display:flex;align-items:center;gap:7px;width:100%;}',
'.'+NS+'IC{display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;}',
'.'+NS+'Side{width:62px;flex-shrink:0;}',
'.'+NS+'ILbl{font-size:9.5px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:4px;}',
'.'+NS+'BindMark{font-size:8px;color:#a78bfa;display:none;}',
'.'+NS+'BindMark.vis{display:inline;}',
/* Phase 6: inputmode="decimal" set in HTML */
'.'+NS+'IC input{width:100%;text-align:center;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.08);border-radius:10px;color:#e8e8f8;font-size:16px;font-family:"JetBrains Mono",monospace;font-weight:500;padding:7px 2px;outline:none;transition:border-color .15s,box-shadow .15s;-moz-appearance:textfield;}',
'.'+NS+'IC input::-webkit-inner-spin-button,.'+NS+'IC input::-webkit-outer-spin-button{-webkit-appearance:none;}',
'.'+NS+'IC input:focus{border-color:rgba(109,40,217,0.75);box-shadow:0 0 0 3px rgba(109,40,217,0.18);}',
'.'+NS+'IC input._bind{border-color:rgba(109,40,217,0.45);background:rgba(109,40,217,0.1);}',
'.'+NS+'Side input{font-size:13px;padding:6px 2px;}',
'#'+NS+'DWrap{flex:1;display:flex;align-items:center;justify-content:center;}',
/* Phase 6: Canvas scales with viewport */
'#'+NS+'Canvas{border-radius:3px;display:block;width:100%;max-width:120px;height:auto;}',
'#'+NS+'CtrlRow{display:flex;align-items:center;justify-content:space-between;gap:10px;}',
'#'+NS+'LnkBtn{min-height:44px;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-size:11px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'#'+NS+'LnkBtn._on{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.7);color:#c4b5fd;}',
'#'+NS+'UBtns{display:flex;gap:3px;}',
'.'+NS+'U{min-height:44px;padding:6px 10px;border-radius:7px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.35);font-size:11px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'.'+NS+'U._on{background:rgba(109,40,217,0.25);border-color:rgba(109,40,217,0.7);color:#c4b5fd;}',
'#'+NS+'CSSBar{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:8px 10px 8px 13px;}',
'#'+NS+'CSSCode{font-size:10px;color:#a78bfa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;font-family:"JetBrains Mono",monospace;}',
'#'+NS+'CpyBtn{min-height:44px;display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:7px;white-space:nowrap;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);font-size:10px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;flex-shrink:0;}',
'#'+NS+'CpyBtn._cp{color:#34d399;border-color:rgba(52,211,153,0.4);}',

/* ── Print Options pane (Phase 11) ── */
'#'+NS+'OptsPane{padding:0 16px 14px;display:none;flex-direction:column;gap:12px;}',
'.'+NS+'OptGroup{display:flex;flex-direction:column;gap:6px;}',
'.'+NS+'OptLbl{font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);}',
'.'+NS+'OptHint{display:block;font-size:10.5px;color:rgba(255,255,255,0.25);margin-top:2px;}',
'.'+NS+'OptSelect{min-height:44px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#e8e8f8;font-size:14px;font-family:"Outfit",sans-serif;font-weight:500;outline:none;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg width=\'12\' height=\'8\' viewBox=\'0 0 12 8\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1.5L6 6.5L11 1.5\' stroke=\'rgba(255,255,255,0.3)\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;cursor:pointer;}',
'.'+NS+'OptSelect:focus{border-color:rgba(109,40,217,0.75);box-shadow:0 0 0 3px rgba(109,40,217,0.18);}',
'.'+NS+'OptSelect option{background:#0a0a12;color:#e8e8f8;}',
/* Phase 11: Toggle switch */
'.'+NS+'OptToggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;}',
'.'+NS+'Switch{position:relative;display:inline-block;width:48px;height:28px;flex-shrink:0;cursor:pointer;}',
'.'+NS+'Switch input{opacity:0;width:0;height:0;}',
'.'+NS+'Slider{position:absolute;inset:0;background:rgba(255,255,255,0.1);border-radius:99px;transition:all .25s;}',
'.'+NS+'Slider::before{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;background:rgba(255,255,255,0.5);border-radius:50%;transition:all .25s;}',
'.'+NS+'Switch input:checked + .'+NS+'Slider{background:rgba(109,40,217,0.5);}',
'.'+NS+'Switch input:checked + .'+NS+'Slider::before{transform:translateX(20px);background:#c4b5fd;}',

/* ── Footer ── */
'#'+NS+'Footer{flex-shrink:0;display:flex;gap:8px;padding:10px 16px 28px;border-top:1px solid rgba(255,255,255,0.05);}',
'.'+NS+'FBtn{flex:1;min-height:52px;padding:13px;border-radius:14px;font-size:13.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;-webkit-tap-highlight-color:transparent;transition:all .15s;}',
'.'+NS+'FBtn._ghost{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);}',
'.'+NS+'FBtn._primary{background:linear-gradient(135deg,#6d28d9,#4338ca);border:none;color:#fff;box-shadow:0 6px 24px rgba(109,40,217,0.45);}',
'.'+NS+'FBtn:active{transform:scale(.97);}',

/* ── Toast ── */
'.'+NS+'Toast{position:fixed;bottom:140px;left:50%;transform:translateX(-50%);background:rgba(10,10,18,0.95);color:rgba(255,255,255,0.7);padding:10px 18px;border-radius:99px;font-size:12px;z-index:2147483647;border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(10px);white-space:nowrap;animation:'+NS+'toastIn .2s ease-out;}',
'@keyframes '+NS+'toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
].join('\n');
document.head.appendChild(styleEl);

/* ══════════════════ UI REFERENCES ══════════════════ */
var $ = function(id) { return document.getElementById(NS + id); };
var ringEl = $('MiniRing'), dotEl = $('MiniCnt'), miniCntEl = $('MiniCnt');

/* ══════════════════ PANEL CONTROL ══════════════════ */
function openSheet() {
  S.panel = 'full';
  sheet.classList.add('_open');
  $('MiniArrow').innerHTML = I.down;
  updateUI();
}
function minimizeSheet() {
  S.panel = 'mini';
  sheet.classList.remove('_open');
  $('MiniArrow').innerHTML = I.up;
  /* Phase 2: Arm capture when mini */
  if (S.mode === 'tap') { S.armed = true; updateRing(); enableFastTap(); }
}
function closeAll() {
  minimizeSheet();
  disableFastTap();
  setTimeout(function(){ cleanup(); }, 350);
}

 $('MiniMain').addEventListener('click', function(e) {
  e.stopPropagation();
  if (S.panel === 'full') minimizeSheet(); else openSheet();
});
 $('BtnMin').addEventListener('click', minimizeSheet);
 $('InstMin').addEventListener('click', minimizeSheet);
 $('BtnCls').addEventListener('click', closeAll);
 $('MiniPrint').addEventListener('click', function(){ doPrint(); });

/* Phase 2: Pause/resume capture */
 $('MiniPause').addEventListener('click', function(e) {
  e.stopPropagation();
  S.armed = !S.armed;
  this.classList.toggle('_paused', !S.armed);
  this.innerHTML = S.armed ? I.pause : I.play;
  this.title = S.armed ? 'Pause capture' : 'Resume capture';
  updateRing();
  if (S.armed) enableFastTap(); else disableFastTap();
  toast(S.armed ? 'Capture resumed' : 'Capture paused');
});

/* Phase 2 & 7: Update ring glow and mode dot */
function updateRing() {
  ringEl.className = '';
  if (!S.armed) { ringEl.classList.add('_paused'); }
  else if (S.tapAction === 'deselect') { ringEl.classList.add('_deselect'); }
  else { ringEl.classList.add('_armed'); }
}
function updateDot() {
  var dot = $('MiniDot');
  dot.className = '';
  if (!S.armed) dot.classList.add(NS+'DotPause');
  else if (S.tapAction === 'deselect') dot.classList.add(NS+'DotDesel');
  else dot.classList.add(NS+'DotSel');
}

function isUI(el) {
  var m = $('Mini'), s = $('Sheet'), t = $('Tip');
  return (m && m.contains(el)) || (s && s.contains(el)) || (t && t.contains(el));
}

/* ══════════════════ PHASE 12: POINTER EVENTS (300ms fix) ══════════════════ */
/* Use pointerdown to detect taps instantly; gate capture to mini + tap mode + armed */
document.addEventListener('pointerdown', function(e) {
  if (isUI(e.target)) return;
  /* Only track potential taps when we might handle them */
  if (S.panel !== 'mini' || S.mode !== 'tap' || !S.armed) return;
  S.ptrDown = { x: e.clientX, y: e.clientY, t: Date.now(), target: e.target };
}, true);

document.addEventListener('pointermove', function(e) {
  if (!S.ptrDown) return;
  var dx = e.clientX - S.ptrDown.x, dy = e.clientY - S.ptrDown.y;
  if (Math.sqrt(dx*dx + dy*dy) > 12) S.ptrDown = null; /* It's a scroll/drag, not a tap */
}, true);

document.addEventListener('pointerup', function(e) {
  if (!S.ptrDown || S.ptrDown.target !== e.target) { S.ptrDown = null; return; }
  var elapsed = Date.now() - S.ptrDown.t;
  var info = S.ptrDown;
  S.ptrDown = null;
  /* Must be < 400ms and we already confirmed < 12px movement */
  if (elapsed > 400) return;
  handleTap(info.x, info.y, info.target);
}, true);

/* Prevent the ghost click from firing after our pointerup handling */
document.addEventListener('click', function(e) {
  if (S.panel === 'mini' && S.mode === 'tap' && S.armed && !isUI(e.target)) {
    e.preventDefault(); e.stopPropagation();
  }
}, true);

/* Phase 1: Dismiss tooltip on scroll */
document.addEventListener('scroll', function() { hideTip(); }, true);
/* Phase 1: Dismiss tooltip on outside tap */
document.addEventListener('pointerdown', function(e) {
  if ($('Tip').style.display === 'block' && !isUI(e.target)) {
    /* Small delay to let the tap handler run first */
    setTimeout(hideTip, 50);
  }
}, true);

/* ══════════════════ TAP HANDLER ══════════════════ */
function handleTap(x, y, target) {
  var block = findBlock(target);
  if (!block) return;

  /* Phase 7: Auto-filter empty blocks (reject < 30 chars) */
  var txt = (block.innerText || '').trim();
  if (txt.length < 30) { toast('Too short to select (< 30 chars)'); return; }

  if (S.tapAction === 'select') {
    if (block === S.pending) {
      /* Second tap = confirm */
      unmark(S.pending);
      S.undoStack.push({ type:'add', el:block });
      S.selected.push(block);
      markSel(block);
      clearPend(); hideTip();
      pulseCount(); saveSession(); updateUI();
    } else {
      /* First tap = preview */
      clearPend(); hideTip();
      S.pending = block; markPend(block);
      showTip(y, block, 'select');
    }
  } else {
    /* Deselect mode */
    var idx = S.selected.indexOf(block);
    if (idx !== -1) {
      if (S.pending === block) {
        removeSel(idx);
        clearPend(); hideTip(); saveSession();
      } else {
        clearPend(); hideTip();
        S.pending = block; markPendRem(block);
        showTip(y, block, 'deselect');
      }
      return;
    }
    var pIdx = findParentSelected(block);
    if (pIdx !== -1) {
      var parent = S.selected[pIdx];
      if (S.pending && S.pending._act === 'split-rm' && S.pending.par === parent && S.pending.ch === block) {
        doSplitRemove(pIdx, block);
        clearPend(); hideTip(); saveSession();
      } else {
        clearPend(); hideTip();
        S.pending = block; S.pending._act = 'split-rm'; S.pending.par = parent; S.pending.ch = block;
        markPendRem(block);
        showTipSplit(y, block);
      }
      return;
    }
    toast('Tap a selected block to remove it');
  }
}

function findParentSelected(el) {
  var cur = el;
  while (cur && cur !== document.body) {
    var idx = S.selected.indexOf(cur);
    if (idx !== -1) return idx;
    cur = cur.parentElement;
  }
  return -1;
}

function removeSel(idx) {
  var el = S.selected[idx];
  S.undoStack.push({ type:'remove', el:el, index:idx });
  unmark(el);
  S.selected.splice(idx, 1);
  updateUI();
}

function doSplitRemove(pIdx, child) {
  var parent = S.selected[pIdx];
  var parts = splitStanzas(parent);
  if (parts.length <= 1) { removeSel(pIdx); return; }
  var rmIdx = -1;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === child || parts[i].contains(child)) { rmIdx = i; break; }
  }
  if (rmIdx === -1) { removeSel(pIdx); return; }
  unmark(parent); S.selected.splice(pIdx, 1);
  var added = [];
  parts.forEach(function(p, i) { if (i !== rmIdx) { S.selected.push(p); markSel(p); added.push(p); } });
  S.undoStack.push({ type:'split-remove', parent:parent, added:added });
  pulseCount(); updateUI();
}

/* ══════════════════ PHASE 1: TOOLTIP ══════════════════ */
function showTip(tapY, el, action) {
  var t = $('Tip');
  var VH = window.innerHeight;
  var VW = window.innerWidth;
  /* Phase 1: Smart positioning — top-half → below, bottom-half → above */
  var above = tapY > VH * 0.5;
  t.style.left = 'auto'; t.style.right = 'auto'; t.style.top = 'auto'; t.style.bottom = 'auto';
  /* Position near tap, offset to not cover element */
  var targetX = Math.min(Math.max(tapX_fromLast || VW/2, 16), VW - 236);
  t.style.left = targetX + 'px';
  if (above) {
    t.style.bottom = (VH - tapY + 12) + 'px';
  } else {
    t.style.top = (tapY + 12) + 'px';
  }
  /* Clamp to viewport */
  t.style.display = 'block';
  requestAnimationFrame(function() {
    var r = t.getBoundingClientRect();
    if (r.top < 8) t.style.top = '8px';
    if (r.bottom > VH - 8) t.style.bottom = '8px';
    if (r.left < 8) t.style.left = '8px';
    if (r.right > VW - 8) { t.style.left = 'auto'; t.style.right = '8px'; }
  });

  var prev = (el.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
  $('TipPrev').textContent = prev || '(no text)';
  $('TipAdd').style.display = action === 'select' ? 'flex' : 'none';
  $('TipRem').style.display = action === 'deselect' ? 'flex' : 'none';
  /* Phase 1: 3-second timeout */
  clearTimeout(S.tipTimer);
  S.tipTimer = setTimeout(hideTip, 3000);
}
var tapX_fromLast = 0;
/* Override handleTap to store x */
var _origHandleTap = handleTap;
handleTap = function(x, y, target) {
  tapX_fromLast = x;
  _origHandleTap(x, y, target);
};

function showTipSplit(tapY, child) {
  var t = $('Tip');
  var VH = window.innerHeight, VW = window.innerWidth;
  var above = tapY > VH * 0.5;
  t.style.left = 'auto'; t.style.right = 'auto'; t.style.top = 'auto'; t.style.bottom = 'auto';
  var targetX = Math.min(Math.max(tapX_fromLast || VW/2, 16), VW - 236);
  t.style.left = targetX + 'px';
  if (above) t.style.bottom = (VH - tapY + 12) + 'px';
  else t.style.top = (tapY + 12) + 'px';
  t.style.display = 'block';
  requestAnimationFrame(function() {
    var r = t.getBoundingClientRect();
    if (r.top < 8) t.style.top = '8px';
    if (r.bottom > VH - 8) t.style.bottom = '8px';
  });
  var prev = (child.innerText||'').trim().slice(0,80).replace(/\s+/g,' ');
  $('TipPrev').textContent = '(Split & remove) ' + (prev || '');
  $('TipAdd').style.display = 'none';
  $('TipRem').style.display = 'flex';
  clearTimeout(S.tipTimer);
  S.tipTimer = setTimeout(hideTip, 3000);
}

function hideTip() {
  var t = $('Tip'); if(t) t.style.display = 'none';
  clearTimeout(S.tipTimer);
}

/* Tooltip buttons */
 $('TipAdd').addEventListener('click', function() {
  if (!S.pending) return;
  unmark(S.pending);
  S.undoStack.push({ type:'add', el:S.pending });
  S.selected.push(S.pending); markSel(S.pending);
  clearPend(); hideTip(); pulseCount(); saveSession(); updateUI();
});
 $('TipRem').addEventListener('click', function() {
  if (!S.pending) return;
  if (S.tapAction === 'deselect') {
    var idx = S.selected.indexOf(S.pending);
    if (idx !== -1) removeSel(idx);
    else if (S.pending._act === 'split-rm') {
      var pIdx = S.selected.indexOf(S.pending.par);
      if (pIdx !== -1) doSplitRemove(pIdx, S.pending.ch);
    }
  }
  clearPend(); hideTip(); saveSession();
});
 $('TipX').addEventListener('click', function() { clearPend(); hideTip(); });
 $('TipBig').addEventListener('click', function() {
  if (!S.pending) return;
  var b = expandEl(S.pending); unmark(S.pending); S.pending = b; markPend(b);
  $('TipPrev').textContent = (b.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
});
 $('TipSml').addEventListener('click', function() {
  if (!S.pending) return;
  var s = shrinkEl(S.pending); if (s === S.pending) return;
  unmark(S.pending); S.pending = s; markPend(s);
  $('TipPrev').textContent = (s.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
});

/* ══════════════════ UI UPDATE ══════════════════ */
function updateUI() {
  var n = S.selected.length;
  miniCntEl.textContent = n;
  updateRing(); updateDot();

  /* Phase 7: Block count + total word count */
  var totalWc = 0;
  S.selected.forEach(function(el) { totalWc += wc(el.innerText || ''); });
  $('HdrSub').textContent = n + ' block' + (n !== 1 ? 's' : '') + ' · ' + totalWc + ' words';

  var pl = $('FPrnLbl');
  if (pl) pl.textContent = S.mode === 'text' ? 'Print text' : (n === 0 ? 'Nothing selected' : 'Print ' + n + ' block' + (n !== 1 ? 's' : ''));
  var pb = $('FPrn');
  if (pb) pb.style.opacity = (S.mode === 'text' && S.textSel) || (S.mode === 'tap' && n > 0) ? '1' : '0.45';
  $('ListCnt').textContent = n;
  $('Adj').style.display = n > 0 ? 'block' : 'none';
  rebuildList();
  if (S.mode === 'text') refreshTextPane();
  if (S.mode === 'margin') updateAllMargins();
}

function pulseCount() {
  miniCntEl.style.transform = 'scale(1.5)';
  setTimeout(function(){ miniCntEl.style.transform = ''; }, 200);
}

/* ══════════════════ PHASE 14: LIST INTELLIGENCE ══════════════════ */
function rebuildList() {
  var container = $('ListItems');
  if (!container) return;
  if (S.selected.length === 0) {
    container.innerHTML = '<div id="'+NS+'ListEmpty">No blocks selected yet. Minimise and tap content on the page.</div>';
    $('BatchBar').style.display = 'none';
    return;
  }
  container.innerHTML = '';
  container.classList.toggle(NS+'Multi', S.multiMode);

  S.selected.forEach(function(el, i) {
    var txt = (el.innerText || '').trim().slice(0, 55).replace(/\s+/g, ' ');
    var tag = (el.tagName || 'div').toLowerCase();
    var icon = ICONS[tag] || '📄';
    var w = wc(el.innerText || '');

    var row = document.createElement('div');
    row.className = NS + 'SItem';
    row.setAttribute('data-i', i);

    /* Phase 12: Swipe-to-delete background */
    row.innerHTML =
      '<div class="'+NS+'SDelBg">Delete</div>'+
      '<div class="'+NS+'SItemInner">'+
        '<div class="'+NS+'SChk" data-i="'+i+'">'+(S.multiSet[i] ? I.check : '')+'</div>'+
        '<span class="'+NS+'SIcon">'+icon+'</span>'+
        '<div class="'+NS+'SNum">'+(i+1)+'</div>'+
        '<div class="'+NS+'STxt">'+escH(txt)+'</div>'+
        '<span class="'+NS+'SWc">'+w+'w</span>'+
        '<button class="'+NS+'SLoc" data-i="'+i+'" title="Scroll to block">'+I.locate+'</button>'+
        '<button class="'+NS+'SDel" data-i="'+i+'" title="Remove block">&#x2715;</button>'+
      '</div>';
    container.appendChild(row);

    /* Phase 12: Mark checked */
    if (S.multiSet[i]) row.querySelector('.'+NS+'SChk').classList.add('_checked');
  });

  /* Phase 14: Tap locate → scroll + highlight */
  container.querySelectorAll('.'+NS+'SLoc').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var idx = parseInt(this.getAttribute('data-i'), 10);
      if (S.selected[idx]) scrollToBlock(S.selected[idx]);
    });
  });

  /* Phase 14: Tap text → scroll + highlight */
  container.querySelectorAll('.'+NS+'STxt').forEach(function(txtEl) {
    txtEl.addEventListener('click', function(e) {
      e.stopPropagation();
      var row = this.closest('.'+NS+'SItem');
      var idx = parseInt(row.getAttribute('data-i'), 10);
      if (S.selected[idx]) scrollToBlock(S.selected[idx]);
    });
  });

  /* Delete buttons */
  container.querySelectorAll('.'+NS+'SDel').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var i = parseInt(this.getAttribute('data-i'), 10);
      if (S.selected[i]) { removeSel(i); saveSession(); }
    });
  });

  /* Phase 12: Multi-select checkboxes */
  container.querySelectorAll('.'+NS+'SChk').forEach(function(chk) {
    chk.addEventListener('click', function(e) {
      e.stopPropagation();
      var i = parseInt(this.getAttribute('data-i'), 10);
      S.multiSet[i] = !S.multiSet[i];
      this.classList.toggle('_checked', S.multiSet[i]);
      this.innerHTML = S.multiSet[i] ? I.check : '';
      updateBatchBar();
    });
  });

  /* Phase 12: Swipe-to-delete on list items */
  container.querySelectorAll('.'+NS+'SItem').forEach(function(row) {
    var startX = 0, curX = 0, swiping = false;
    row.addEventListener('pointerdown', function(e) {
      if (S.multiMode) return; /* No swipe in multi-select mode */
      startX = e.clientX; curX = 0; swiping = false;
    });
    row.addEventListener('pointermove', function(e) {
      var dx = e.clientX - startX;
      if (dx < -10) {
        swiping = true;
        curX = Math.max(dx, -80);
        row.querySelector('.'+NS+'SItemInner').style.transform = 'translateX(' + curX + 'px)';
      }
    });
    row.addEventListener('pointerup', function(e) {
      if (!swiping) return;
      swiping = false;
      var inner = row.querySelector('.'+NS+'SItemInner');
      if (curX < -50) {
        /* Swiped far enough — delete */
        var idx = parseInt(row.getAttribute('data-i'), 10);
        inner.style.transition = 'transform .2s';
        inner.style.transform = 'translateX(-100%)';
        setTimeout(function() {
          if (S.selected[idx]) { removeSel(idx); saveSession(); }
        }, 200);
      } else {
        /* Snap back */
        inner.style.transition = 'transform .2s';
        inner.style.transform = 'translateX(0)';
        setTimeout(function() { inner.style.transition = ''; }, 200);
      }
    });
  });

  /* Phase 12: Long-press enters multi-select mode */
  container.querySelectorAll('.'+NS+'SItem').forEach(function(row) {
    var lpTimer = null;
    row.addEventListener('pointerdown', function(e) {
      if (e.target.closest('.'+NS+'SDel') || e.target.closest('.'+NS+'SLoc') || e.target.closest('.'+NS+'SChk')) return;
      var r = this;
      lpTimer = setTimeout(function() {
        enterMultiMode();
        var idx = parseInt(r.getAttribute('data-i'), 10);
        S.multiSet[idx] = true;
        rebuildList();
        updateBatchBar();
        if (navigator.vibrate) navigator.vibrate(30);
      }, 500);
    });
    row.addEventListener('pointerup', function() { clearTimeout(lpTimer); });
    row.addEventListener('pointermove', function() { clearTimeout(lpTimer); });
    row.addEventListener('pointercancel', function() { clearTimeout(lpTimer); });
  });

  updateBatchBar();
}

/* Phase 12: Multi-select mode */
function enterMultiMode() {
  S.multiMode = true;
  S.multiSet = {};
  $('BatchBar').style.display = 'flex';
  rebuildList();
}
function exitMultiMode() {
  S.multiMode = false;
  S.multiSet = {};
  $('BatchBar').style.display = 'none';
  rebuildList();
}
function updateBatchBar() {
  var count = Object.keys(S.multiSet).filter(function(k){ return S.multiSet[k]; }).length;
  $('BatchTxt').textContent = count + ' selected';
}

 $('BatchDel').addEventListener('click', function() {
  /* Delete checked items in reverse order to keep indices valid */
  var toRemove = Object.keys(S.multiSet).filter(function(k){ return S.multiSet[k]; }).map(Number).sort(function(a,b){ return b-a; });
  toRemove.forEach(function(idx) {
    if (S.selected[idx]) {
      S.undoStack.push({ type:'remove', el:S.selected[idx], index:idx });
      unmark(S.selected[idx]);
      S.selected.splice(idx, 1);
    }
  });
  exitMultiMode(); saveSession(); updateUI();
  if (toRemove.length) toast('Deleted ' + toRemove.length + ' blocks');
});
 $('BatchDone').addEventListener('click', exitMultiMode);

/* ══════════════════ TEXT PANE ══════════════════ */
function refreshTextPane() {
  var prev = $('TxtPrev'), meta = $('TxtMeta');
  if (prev) prev.textContent = S.textSel || 'No text selected yet.\nLong-press on the page → extend selection → re-open bookmarklet.';
  if (meta && S.textSel) {
    var w = S.textSel.trim().split(/\s+/).length;
    meta.textContent = w + ' words · ~' + Math.ceil(w / 200) + ' min read · ' + S.textSel.length + ' chars';
  }
}

 $('TxtRef').addEventListener('click', function() {
  var s = window.getSelection();
  if (s && s.toString().trim().length > 0) S.textSel = s.toString().trim();
  refreshTextPane(); updateUI();
});

/* ══════════════════ TABS (now 4 tabs) ══════════════════ */
document.querySelectorAll('.' + NS + 'Tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    S.mode = this.getAttribute('data-m');
    document.querySelectorAll('.' + NS + 'Tab').forEach(function(b) { b.classList.remove('_on'); });
    this.classList.add('_on');
    $('TapPane').style.display   = S.mode === 'tap'     ? 'block' : 'none';
    $('TextPane').style.display  = S.mode === 'text'    ? 'flex'  : 'none';
    $('MarginPane').style.display= S.mode === 'margin'  ? 'flex'  : 'none';
    $('OptsPane').style.display  = S.mode === 'options' ? 'flex'  : 'none';
    if (S.mode === 'text') {
      var s = window.getSelection();
      if (s && s.toString().trim().length > 0) S.textSel = s.toString().trim();
    }
    /* Phase 2: Only arm capture when in tap mode and mini */
    if (S.mode === 'tap' && S.panel === 'mini') { S.armed = true; enableFastTap(); }
    else { S.armed = false; disableFastTap(); }
    updateRing(); updateDot(); updateUI();
  });
});

/* ══════════════════ TAP ACTION TOGGLE ══════════════════ */
document.querySelectorAll('.' + NS + 'TAct').forEach(function(btn) {
  btn.addEventListener('click', function() {
    S.tapAction = this.getAttribute('data-a');
    document.querySelectorAll('.' + NS + 'TAct').forEach(function(b) { b.classList.remove('_on'); });
    this.classList.add('_on');
    var inst = $('Inst'), txt = $('InstTxt');
    if (S.tapAction === 'deselect') {
      inst.classList.add('_warn');
      txt.innerHTML = '<strong>Deselect mode is ON.</strong> Tap a selected block to remove it. Tap inside a selected block to split & remove that section.';
    } else {
      inst.classList.remove('_warn');
      txt.innerHTML = '<strong>Minimise this panel first</strong>, then tap blocks on the page. First tap = preview (orange), second tap = confirm (purple).';
    }
    updateRing(); updateDot();
  });
});

/* ══════════════════ PHASE 4/9: SMART "SELECT CONTENT" ══════════════════ */
 $('BtnAll').addEventListener('click', function() {
  clearPend(); hideTip();
  S.selected.forEach(function(el) { unmark(el); });
  S.selected = []; S.undoStack = [];

  /* Find content containers */
  var containers = document.querySelectorAll(CONTENT_SEL);
  if (containers.length === 0) containers = [document.body];

  var candidates = [];
  containers.forEach(function(container) {
    if ($('Sheet') && $('Sheet').contains(container)) return;
    var blocks = container.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figure,table,dl');
    blocks.forEach(function(el) {
      /* Phase 9: Skip noise elements */
      if (el.matches(NOISE)) return;
      /* Phase 9: Skip if any ancestor matches noise */
      var par = el.parentElement;
      var isNoise = false;
      while (par && par !== document.body) {
        if (par.matches(NOISE)) { isNoise = true; break; }
        par = par.parentElement;
      }
      if (isNoise) return;
      /* Phase 9: Skip if hidden */
      if (el.offsetParent === null) return;
      /* Phase 7: Minimum 30 chars of real text */
      var txt = (el.innerText || '').trim();
      if (txt.length < 30) return;
      /* Phase 9: Reject blocks that are mostly icons/buttons */
      var plainText = txt.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
      if (plainText.length < 15) return;
      /* Skip duplicates */
      if (S.selected.indexOf(el) !== -1) return;
      if (candidates.indexOf(el) !== -1) return;
      candidates.push(el);
    });
  });

  candidates.forEach(function(el) { S.selected.push(el); markSel(el); });
  saveSession(); updateUI();
  toast('Selected ' + candidates.length + ' content blocks');
});

 $('BtnUndo').addEventListener('click', function() {
  var last = S.undoStack.pop(); if (!last) return;
  if (last.type === 'add') {
    var i = S.selected.indexOf(last.el);
    if (i !== -1) { S.selected.splice(i, 1); unmark(last.el); }
  } else if (last.type === 'remove') {
    S.selected.splice(last.index, 0, last.el); markSel(last.el);
  } else if (last.type === 'split-remove') {
    last.added.forEach(function(a) { var i = S.selected.indexOf(a); if (i !== -1) { S.selected.splice(i, 1); unmark(a); } });
    S.selected.push(last.parent); markSel(last.parent);
  }
  saveSession(); updateUI();
});
 $('BtnClr').addEventListener('click', function() {
  clearPend(); hideTip();
  S.selected.forEach(function(el) { unmark(el); });
  S.selected = []; S.undoStack = []; saveSession(); updateUI();
});

/* ══════════════════ ADJUST LAST BLOCK ══════════════════ */
 $('AExp').addEventListener('click', function() {
  if (!S.selected.length) return;
  var i = S.selected.length - 1, cur = S.selected[i], b = expandEl(cur);
  if (b !== cur) { unmark(cur); S.selected[i] = b; markSel(b); saveSession(); updateUI(); }
});
 $('AShr').addEventListener('click', function() {
  if (!S.selected.length) return;
  var i = S.selected.length - 1, cur = S.selected[i], b = shrinkEl(cur);
  if (b !== cur) { unmark(cur); S.selected[i] = b; markSel(b); saveSession(); updateUI(); }
});
 $('ASpl').addEventListener('click', function() {
  if (!S.selected.length) return;
  var i = S.selected.length - 1, cur = S.selected[i], parts = splitStanzas(cur);
  if (parts.length <= 1) return;
  unmark(cur); S.selected.splice(i, 1);
  parts.forEach(function(p) { S.selected.push(p); markSel(p); });
  saveSession(); updateUI();
});
 $('ACpy').addEventListener('click', function() {
  if (!S.selected.length) return;
  var txt = S.selected.map(function(el) { return (el.innerText||'').trim(); }).join('\n\n');
  copyText(txt, $('ACpy'));
});

/* ══════════════════ PHASE 11: PRINT OPTIONS HANDLERS ══════════════════ */
 $('OptFontSize').addEventListener('change', function() {
  printOpts.fontSize = this.value; savePrintOpts();
});
 $('OptPaper').addEventListener('change', function() {
  printOpts.paperSize = this.value; savePrintOpts();
});
 $('OptPreserve').addEventListener('change', function() {
  printOpts.preserveStyle = this.checked; savePrintOpts();
});
 $('OptSource').addEventListener('change', function() {
  printOpts.showSource = this.checked; savePrintOpts();
});
 $('OptLight').addEventListener('change', function() {
  printOpts.forceLight = this.checked; savePrintOpts();
});

function savePrintOpts() {
  try { localStorage.setItem(NS + 'PO', JSON.stringify(printOpts)); } catch(e) {}
}

/* ══════════════════ FOOTER BUTTONS ══════════════════ */
 $('FCpy').addEventListener('click', function() {
  var txt = S.mode === 'text' ? S.textSel :
    S.selected.map(function(el) { return (el.innerText||'').trim(); }).join('\n\n');
  if (!txt) return;
  copyText(txt, $('FCpy'));
});

 $('FPrn').addEventListener('click', doPrint);

function doPrint() {
  S.mode === 'text' ? printText() : printBlocks();
}

/* ══════════════════ PHASE 3: BULLETPROOF STYLE PRESERVATION ══════════════════ */
function inlineStyles(el) {
  /* Recursively walk subtree and capture computed styles for critical properties */
  var walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT, null, false);
  var node;
  while (node = walker.nextNode()) {
    try {
      var cs = window.getComputedStyle(node);
      var important = [];
      INLINE_PROPS.forEach(function(prop) {
        var val = cs.getPropertyValue(prop);
        if (val && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== '0px' && val !== '0' && val !== 'transparent' && val !== 'rgba(0, 0, 0, 0)' && val !== 'rgb(0, 0, 0)' && val !== 'currentcolor' && val !== 'static' && val !== 'visible' && val !== 'medium' && val !== 'repeat' && val !== 'left' && val !== 'top') {
          important.push(prop + ':' + val);
        }
      });
      if (important.length) {
        node.setAttribute('style', (node.getAttribute('style') || '') + ';' + important.join(';') + ';');
      }
    } catch(e) {}
  }
}

/* ══════════════════ PHASE 10: MEDIA & LINK INTELLIGENCE ══════════════════ */
function fixMediaAndLinks(el) {
  /* Convert relative image src to absolute */
  var imgs = el.querySelectorAll('img');
  imgs.forEach(function(img) {
    if (img.getAttribute('src')) img.setAttribute('src', absURL(img.getAttribute('src')));
    if (img.getAttribute('data-src')) img.setAttribute('src', absURL(img.getAttribute('data-src')));
  });
  /* Fix background-image URLs */
  var allEls = el.querySelectorAll('*');
  allEls.forEach(function(node) {
    var bg = node.style.backgroundImage;
    if (bg && bg.indexOf('url(') !== -1) {
      node.style.backgroundImage = bg.replace(/url\(["']?([^"')]+)["']?\)/g, function(m, url) {
        return 'url("' + absURL(url) + '")';
      });
    }
  });
  /* Phase 10: Append URL after link text */
  var links = el.querySelectorAll('a[href]');
  links.forEach(function(a) {
    var href = a.getAttribute('href');
    if (href && href !== '#' && !href.startsWith('javascript:')) {
      var abs = absURL(href);
      var span = document.createElement('span');
      span.style.cssText = 'font-size:0.85em;color:#666;word-break:break-all;';
      span.textContent = ' (' + abs + ')';
      a.appendChild(span);
      a.setAttribute('href', abs);
    }
  });
  /* Phase 10/17: Replace iframes/videos/audio with placeholders */
  var embeds = el.querySelectorAll('iframe,video,audio');
  embeds.forEach(function(embed) {
    var src = embed.getAttribute('src') || embed.getAttribute('data-src') || '';
    var tag = embed.tagName.toLowerCase();
    var placeholder = document.createElement('div');
    placeholder.style.cssText = 'background:#f3f4f6;border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:8px 0;font-family:sans-serif;font-size:12px;color:#6b7280;';
    placeholder.innerHTML = '<div style="font-weight:600;margin-bottom:4px;color:#374151;">' +
      (tag === 'iframe' ? '📄 Embedded content' : tag === 'video' ? '🎬 Video' : '🎵 Audio') +
      '</div><div style="word-break:break-all;">' + escH(absURL(src) || '(no source)') + '</div>';
    embed.replaceWith(placeholder);
  });
}

/* ══════════════════ PHASE 5: PRINT OUTPUT HARDENING ══════════════════ */
function printCSS() {
  var m = getMarginStr();
  var ps = printOpts.paperSize === 'letter' ? 'size:letter;' : printOpts.paperSize === 'legal' ? 'size:legal;' : 'size:A4;';
  var light = printOpts.forceLight ?
    '*{background:#fff!important;color:#111!important;border-color:#ddd!important;}a{color:#111!important;text-decoration:underline!important;}' : '';
  return '@page{margin:' + m + '!important;' + ps + '}' +
    'body{font-family:Georgia,serif;font-size:' + printOpts.fontSize + 'pt;line-height:1.8;max-width:800px;margin:0 auto;padding:0 24px;color:#111;}' +
    '.ps14blk{margin-bottom:1.5em;}' +
    /* Phase 5: Image protection */
    'img{max-width:100%;height:auto;page-break-inside:avoid;}' +
    /* Phase 5: Table protection */
    'table{page-break-inside:auto;}tr{page-break-inside:avoid;}thead{display:table-header-group;}tfoot{display:table-footer-group;}' +
    /* Phase 5: Code blocks */
    'pre,code{white-space:pre-wrap;word-break:break-word;}' +
    /* Phase 5: Force light mode */
    '@media print{' + light +
    'body{padding:0;max-width:none;}' +
    '}' +
    /* Footer */
    'footer.ps14foot{margin-top:36px;font-size:9pt;color:#999;border-top:1px solid #eee;padding-top:10px;}';
}

function getMarginStr() {
  var m = marginState.MM;
  return m.t + 'mm ' + m.r + 'mm ' + m.b + 'mm ' + m.l + 'mm';
}

/* ══════════════════ PRINT TEXT ══════════════════ */
function printText() {
  if (!S.textSel) return;
  var win = window.open('', '_blank', 'width=800,height=600,toolbar=0,menubar=0,location=0,scrollbars=1');
  if (!win) { toast('Allow pop-ups and try again'); return; }
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print Selection</title>' +
    '<style>body{font-family:Georgia,serif;font-size:' + printOpts.fontSize + 'pt;line-height:1.8;max-width:760px;margin:40px auto;color:#111;padding:0 24px;}' +
    'pre{white-space:pre-wrap;}' +
    'footer.ps14foot{margin-top:36px;font-size:9pt;color:#aaa;border-top:1px solid #eee;padding-top:10px;}' +
    '@media print{@page{margin:' + getMarginStr() + '!important;}body{margin:0;}}</style></head><body>' +
    '<pre style="font-family:inherit;background:none;padding:0;">' + escH(S.textSel) + '</pre>' +
    (printOpts.showSource ? '<footer class="ps14foot">Source: ' + escH(location.href) + '</footer>' : '') +
    '</body></html>');
  win.document.close(); win.focus();
  setTimeout(function() { win.print(); }, 400);
  minimizeSheet();
}

/* ══════════════════ PRINT BLOCKS (Phase 3/5/10/15/16/17/21) ══════════════════ */
function printBlocks() {
  if (!S.selected.length) return;

  var parts = S.selected.map(function(el) {
    var c = el.cloneNode(true);
    c.removeAttribute('data-' + NS);
    c.style.outline = c.style.outlineOffset = '';
    /* Keep background/border-radius from selection style if preserveStyle is on */
    if (!printOpts.preserveStyle) c.style.backgroundColor = c.style.borderRadius = '';

    if (printOpts.preserveStyle) {
      /* Phase 3 Layer 1: Inline computed styles */
      inlineStyles(c);
    }

    /* Phase 10 Layer 2: Fix URLs + links + embeds */
    fixMediaAndLinks(c);

    return '<div class="ps14blk">' + c.outerHTML + '</div>';
  });

  var win = window.open('', '_blank', 'width=820,height=700,toolbar=0,menubar=0,location=0,scrollbars=1');
  if (!win) { toast('Allow pop-ups and try again'); return; }

  var fallbackStyle = printOpts.preserveStyle ? '' :
    '<style>*{font-family:Georgia,serif!important;}</style>';

  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<base href="' + location.origin + '">' +
    '<title>Print Selection — ' + escH(document.title || location.hostname) + '</title>' +
    fallbackStyle +
    '<style>' + printCSS() + '</style>' +
    '</head><body>' +
    parts.join('\n') +
    (printOpts.showSource ? '<footer class="ps14foot">' + S.selected.length + ' block' + (S.selected.length !== 1 ? 's' : '') + ' · <a href="' + escH(location.href) + '">' + escH(location.href) + '</a></footer>' : '') +
    '</body></html>');
  win.document.close(); win.focus();
  setTimeout(function() { win.print(); }, 500);
  minimizeSheet();
}

/* ══════════════════ MARGIN LOGIC ══════════════════ */
function toDisp(v) { return parseFloat((v * FACTOR[marginState.unit]).toFixed(DECIMALS[marginState.unit])); }
function toMM(v) { return v / FACTOR[marginState.unit]; }

var tEl = $('T'), rEl = $('R'), bEl = $('B'), lEl = $('L');
var canvas = $('Canvas'), ctx = canvas.getContext('2d');
var lnkBtn = $('LnkBtn'), lnkLbl = $('LnkLbl');
var cssCode = $('CSSCode'), cpyBtn = $('CpyBtn'), cpyLbl = $('CpyLbl');
var bindVal = $('BindVal'), bindHnt = $('BindHint');
var gFill = $('GaugeFill'), gHole = $('GaugeHole');

function drawPage() {
  var W = 90, H = 126;
  ctx.clearRect(0, 0, W, H);
  var scW = W / 210, scH = H / 297;
  var tPx = Math.min(marginState.MM.t * scH, H * 0.42);
  var rPx = Math.min(marginState.MM.r * scW, W * 0.42);
  var bPx = Math.min(marginState.MM.b * scH, H * 0.42);
  var lPx = Math.min(marginState.MM.l * scW, W * 0.42);
  var holePx = Math.min(HOLE_MM * (marginState.bindSide === 'top' ? scH : scW), 24);

  ctx.fillStyle = '#15151f'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(109,40,217,0.25)';
  ctx.fillRect(0, 0, W, tPx);
  ctx.fillRect(0, H - bPx, W, bPx);
  ctx.fillRect(0, tPx, lPx, H - tPx - bPx);
  ctx.fillRect(W - rPx, tPx, rPx, H - tPx - bPx);

  var bsColor = 'rgba(139,92,246,0.45)';
  if (marginState.bindSide === 'left')  { ctx.fillStyle = bsColor; ctx.fillRect(0, 0, lPx, H); }
  if (marginState.bindSide === 'right') { ctx.fillStyle = bsColor; ctx.fillRect(W - rPx, 0, rPx, H); }
  if (marginState.bindSide === 'top')   { ctx.fillStyle = bsColor; ctx.fillRect(0, 0, W, tPx); }

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);

  var cx = lPx + 3, cy = tPx + 5, cw = W - lPx - rPx - 6, ch = H - tPx - bPx - 10;
  if (cw > 6 && ch > 6) {
    var lineH = 2, gap = 6, lc = Math.floor((ch + gap) / (lineH + gap));
    var widths = [1, .82, 1, .68, .9, .55, .78, 1, .6, .85];
    for (var i = 0; i < Math.min(lc, widths.length); i++) {
      ctx.fillStyle = 'rgba(196,181,253,0.28)';
      ctx.fillRect(cx, cy + i * (lineH + gap), cw * widths[i], lineH);
    }
  }

  if (marginState.bindSide === 'left' || marginState.bindSide === 'right') {
    var hx = marginState.bindSide === 'left' ? holePx : W - holePx;
    var hps = [H * 0.25, H * 0.5, H * 0.75];
    ctx.strokeStyle = 'rgba(196,181,253,0.75)'; ctx.lineWidth = 1;
    for (var hi = 0; hi < hps.length; hi++) {
      ctx.beginPath(); ctx.arc(hx, hps[hi], 3.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - 5, hps[hi]); ctx.lineTo(hx + 5, hps[hi]);
      ctx.moveTo(hx, hps[hi] - 5); ctx.lineTo(hx, hps[hi] + 5); ctx.stroke();
    }
    ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(196,181,253,0.3)';
    ctx.beginPath();
    if (marginState.bindSide === 'left') { ctx.moveTo(holePx + 5, 0); ctx.lineTo(holePx + 5, H); }
    else { ctx.moveTo(W - holePx - 5, 0); ctx.lineTo(W - holePx - 5, H); }
    ctx.stroke(); ctx.setLineDash([]);
  } else if (marginState.bindSide === 'top') {
    var hy = holePx;
    var hps2 = [W * 0.25, W * 0.5, W * 0.75];
    ctx.strokeStyle = 'rgba(196,181,253,0.75)'; ctx.lineWidth = 1;
    for (var hi2 = 0; hi2 < hps2.length; hi2++) {
      ctx.beginPath(); ctx.arc(hps2[hi2], hy, 3.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hps2[hi2] - 5, hy); ctx.lineTo(hps2[hi2] + 5, hy);
      ctx.moveTo(hps2[hi2], hy - 5); ctx.lineTo(hps2[hi2], hy + 5); ctx.stroke();
    }
    ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(196,181,253,0.3)';
    ctx.beginPath(); ctx.moveTo(0, hy + 5); ctx.lineTo(W, hy + 5); ctx.stroke(); ctx.setLineDash([]);
  }
}

function updateGauge() {
  var bindMM = marginState.bindSide === 'left' ? marginState.MM.l :
    marginState.bindSide === 'right' ? marginState.MM.r : marginState.MM.t;
  var MAX = 60, pct = Math.min(bindMM / MAX * 100, 100);
  gFill.style.width = pct + '%';
  var holePct = Math.min(HOLE_MM / MAX * 100, 100);
  gHole.style.left = holePct + '%';
  $('HoleLbl').textContent = toDisp(HOLE_MM) + marginState.unit;
  bindVal.textContent = toDisp(bindMM) + marginState.unit;
  var safe = bindMM - HOLE_MM;
  if (safe < 0) { bindHnt.style.color = '#f87171'; bindHnt.textContent = '⚠ ' + Math.abs(toDisp(safe)).toFixed(DECIMALS[marginState.unit]) + marginState.unit + ' too narrow'; }
  else if (safe < 5) { bindHnt.style.color = '#fbbf24'; bindHnt.textContent = '⚠ Only ' + toDisp(safe) + marginState.unit + ' clearance'; }
  else { bindHnt.style.color = '#34d399'; bindHnt.textContent = '✓ ' + toDisp(safe) + marginState.unit + ' safe clearance'; }
}

function updateMarks() {
  $('LMark').textContent = '◄ bind';
  $('RMark').textContent = 'bind ►';
  $('BMark').textContent = '▲ bind';
  ['LMark', 'RMark', 'BMark'].forEach(function(id) { $(id).classList.remove('vis'); });
  if (marginState.bindSide === 'left')  $('LMark').classList.add('vis');
  if (marginState.bindSide === 'right') $('RMark').classList.add('vis');
  if (marginState.bindSide === 'top')   $('BMark').classList.add('vis');
  [tEl, rEl, bEl, lEl].forEach(function(el) { el.classList.remove('_bind'); });
  var bindEl = { left: lEl, right: rEl, top: tEl }[marginState.bindSide];
  if (bindEl) bindEl.classList.add('_bind');
}

function syncInputs() {
  tEl.value = toDisp(marginState.MM.t);
  rEl.value = toDisp(marginState.MM.r);
  bEl.value = toDisp(marginState.MM.b);
  lEl.value = toDisp(marginState.MM.l);
}

function cssValStr() {
  function f(v) { return toDisp(v) + marginState.unit; }
  return '@page { margin: ' + f(marginState.MM.t) + ' ' + f(marginState.MM.r) + ' ' + f(marginState.MM.b) + ' ' + f(marginState.MM.l) + ' }';
}

function detectPreset() {
  var found = null, keys = Object.keys(PRESETS);
  for (var i = 0; i < keys.length; i++) {
    var p = PRESETS[keys[i]];
    if (Math.abs(marginState.MM.t - p.t) < 0.2 && Math.abs(marginState.MM.r - p.r) < 0.2 &&
        Math.abs(marginState.MM.b - p.b) < 0.2 && Math.abs(marginState.MM.l - p.l) < 0.2) { found = keys[i]; break; }
  }
  document.querySelectorAll('.' + NS + 'P').forEach(function(b) { b.classList.remove('_on'); });
  if (found) { var el = document.querySelector('.' + NS + 'P[data-p="' + found + '"]'); if (el) el.classList.add('_on'); }
}

function saveMargins() {
  try { localStorage.setItem(NS + 'M', JSON.stringify({ unit: marginState.unit, MM: marginState.MM, bindSide: marginState.bindSide, linked: marginState.linked })); } catch(e) {}
}

function updateAllMargins() {
  drawPage(); updateGauge(); updateMarks();
  cssCode.textContent = cssValStr(); detectPreset(); saveMargins();
}

function wire(key, el) {
  el.addEventListener('input', function() {
    var v = toMM(parseFloat(this.value) || 0);
    if (marginState.linked) { marginState.MM.t = marginState.MM.r = marginState.MM.b = marginState.MM.l = v; syncInputs(); }
    else { marginState.MM[key] = v; }
    updateAllMargins();
  });
}
wire('t', tEl); wire('r', rEl); wire('b', bEl); wire('l', lEl);

document.querySelectorAll('.' + NS + 'BS').forEach(function(btn) {
  btn.addEventListener('click', function() {
    marginState.bindSide = this.getAttribute('data-s');
    document.querySelectorAll('.' + NS + 'BS').forEach(function(b) { b.classList.remove('active'); });
    this.classList.add('active');
    updateAllMargins();
  });
});

document.querySelectorAll('.' + NS + 'P').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var p = PRESETS[this.getAttribute('data-p')];
    marginState.MM = { t: p.t, r: p.r, b: p.b, l: p.l };
    syncInputs(); updateAllMargins();
  });
});

lnkBtn.addEventListener('click', function() {
  marginState.linked = !marginState.linked;
  lnkBtn.classList.toggle('_on', marginState.linked);
  lnkLbl.textContent = marginState.linked ? 'Linked ✓' : 'Link all';
  if (marginState.linked) { marginState.MM.r = marginState.MM.b = marginState.MM.l = marginState.MM.t; syncInputs(); updateAllMargins(); }
});

document.querySelectorAll('.' + NS + 'U').forEach(function(btn) {
  btn.addEventListener('click', function() {
    marginState.unit = this.getAttribute('data-u');
    document.querySelectorAll('.' + NS + 'U').forEach(function(b) { b.classList.remove('_on'); });
    this.classList.add('_on');
    [tEl, rEl, bEl, lEl].forEach(function(el) { el.step = STEP[marginState.unit]; });
    syncInputs(); updateAllMargins();
  });
});

cpyBtn.addEventListener('click', function() {
  var txt = cssValStr();
  function done() {
    cpyBtn.classList.add('_cp'); cpyLbl.textContent = 'Copied!';
    setTimeout(function() { cpyBtn.classList.remove('_cp'); cpyLbl.textContent = 'Copy'; }, 2200);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(function() { fbCopy(txt); done(); });
  } else { fbCopy(txt); done(); }
});

/* Sheet drag-to-minimize */
var _sy = 0;
 $('Hdl').addEventListener('touchstart', function(e) { _sy = e.touches[0].clientY; }, { passive: true });
 $('Hdl').addEventListener('touchend', function(e) { if (e.changedTouches[0].clientY - _sy > 50) minimizeSheet(); }, { passive: true });

/* ══════════════════ KEYBOARD SHORTCUTS ══════════════════ */
function onKey(e) {
  if (e.key === 'Escape') {
    if (S.multiMode) exitMultiMode();
    else if (S.panel === 'full') minimizeSheet();
    else closeAll();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doPrint();
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    var last = S.undoStack.pop();
    if (!last) return;
    if (last.type === 'add') { var i = S.selected.indexOf(last.el); if (i !== -1) { S.selected.splice(i, 1); unmark(last.el); } }
    else if (last.type === 'remove') { S.selected.splice(last.index, 0, last.el); markSel(last.el); }
    else if (last.type === 'split-remove') {
      last.added.forEach(function(a) { var i = S.selected.indexOf(a); if (i !== -1) { S.selected.splice(i, 1); unmark(a); } });
      S.selected.push(last.parent); markSel(last.parent);
    }
    saveSession(); updateUI();
  }
}
document.addEventListener('keydown', onKey);

/* ══════════════════ PHASE 13: SESSION RECOVERY ══════════════════ */
if (savedSession && savedSession.length > 0 && S.mode === 'tap') {
  $('Restore').style.display = 'flex';
  $('RestTxt').textContent = 'Restore ' + savedSession.length + ' previous selections?';
  $('RestYes').addEventListener('click', function() {
    var count = restoreSession(savedSession);
    $('Restore').style.display = 'none';
    saveSession(); updateUI();
    toast('Restored ' + count + ' blocks');
  });
  $('RestNo').addEventListener('click', function() {
    $('Restore').style.display = 'none';
    sessionStorage.removeItem(NS + 'Sess');
  });
}

/* ══════════════════ UTILITY FUNCTIONS ══════════════════ */
function copyText(txt, btn) {
  function onDone() {
    if (btn) {
      btn.innerHTML = I.check + ' Copied!';
      setTimeout(function() { btn.innerHTML = I.copy + ' Copy text'; }, 2000);
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(onDone).catch(function() { fbCopy(txt); onDone(); });
  } else { fbCopy(txt); onDone(); }
}
function fbCopy(t) {
  var ta = document.createElement('textarea');
  ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
}

function toast(msg) {
  var t = document.createElement('div');
  t.className = NS + 'Toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0'; t.style.transition = 'opacity .3s';
    setTimeout(function() { t.remove(); }, 300);
  }, 2000);
}

/* ══════════════════ CLEANUP ══════════════════ */
function cleanup() {
  disableFastTap();
  document.removeEventListener('keydown', onKey);
  clearTimeout(S.tipTimer);
  S.selected.forEach(function(el) { unmark(el); });
  clearPend();
  ['Mini', 'Sheet', 'Style', 'Tip', 'Font'].forEach(function(s) {
    var el = document.getElementById(NS + s); if (el) el.remove();
  });
  /* Remove any lingering toasts */
  document.querySelectorAll('.' + NS + 'Toast').forEach(function(t) { t.remove(); });
}

/* ══════════════════ INIT ══════════════════ */
/* Set initial unit button states */
document.querySelectorAll('.' + NS + 'U').forEach(function(b) {
  b.classList.toggle('_on', b.getAttribute('data-u') === marginState.unit);
});
document.querySelectorAll('.' + NS + 'BS').forEach(function(b) {
  b.classList.toggle('active', b.getAttribute('data-s') === marginState.bindSide);
});
lnkBtn.classList.toggle('_on', marginState.linked);
lnkLbl.textContent = marginState.linked ? 'Linked ✓' : 'Link all';
[tEl, rEl, bEl, lEl].forEach(function(el) { el.step = STEP[marginState.unit]; });
syncInputs();
updateAllMargins();

/* If text was pre-selected, open sheet */
if (S.mode === 'text') openSheet();

/* Arm capture if starting in tap mode */
if (S.mode === 'tap') { S.armed = true; enableFastTap(); }
updateRing(); updateDot();
updateUI();

})();
