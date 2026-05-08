(function () {

/* ══════════════════════════════════════════
   GUARD
══════════════════════════════════════════ */
var PID = '__ps11P', SID = '__ps11S';
var ex = document.getElementById(PID);
if (ex) { ex.remove(); var es = document.getElementById(SID); if (es) es.remove(); _cleanup(); return; }

/* ══════════════════════════════════════════
   FONTS
══════════════════════════════════════════ */
if (!document.getElementById('__ps11Font')) {
  var _fl = document.createElement('link');
  _fl.id = '__ps11Font'; _fl.rel = 'stylesheet';
  _fl.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@500;600;700&display=swap';
  document.head.appendChild(_fl);
}

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
var selected  = [];   /* confirmed elements */
var pending   = null; /* element awaiting 2nd tap */
var undoStack = [];
var mode      = 'tap';
var textSel   = '';

/* Check existing text selection (Android long-press) */
var _sel = window.getSelection();
if (_sel && _sel.toString().trim().length > 20) {
  textSel = _sel.toString().trim();
  mode = 'text';
}

/* ══════════════════════════════════════════
   SMART BLOCK FINDER
   Key fix for Poetry Foundation:
   - Caps selection at 55% viewport height
   - Stops before grabbing huge wrapper divs
   - Prefers semantic tags even if small
══════════════════════════════════════════ */
function findBlock(el) {
  var VH = window.innerHeight, VW = window.innerWidth;
  var SEMANTIC_INLINE  = ['P','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','PRE','DT','DD','FIGCAPTION','CAPTION'];
  var SEMANTIC_SECTION = ['ARTICLE','SECTION','FIGURE','TABLE','DETAILS'];
  var best = null, cur = el;

  while (cur && cur !== document.body && cur !== document.documentElement) {
    var tag = (cur.tagName || '').toUpperCase();
    var r   = cur.getBoundingClientRect();
    var txt = (cur.innerText || '').trim();
    /* Skip invisible or our own panel */
    if (cur === document.getElementById(PID)) { cur = cur.parentElement; continue; }
    if (r.width === 0 && r.height === 0)       { cur = cur.parentElement; continue; }

    var tooBig = r.height > VH * 0.55 || (r.width > VW * 0.9 && r.height > VH * 0.25);

    /* Perfect semantic inline picks — always prefer, even if small */
    if (SEMANTIC_INLINE.indexOf(tag) !== -1 && !tooBig) return cur;

    /* Section-level semantics */
    if (SEMANTIC_SECTION.indexOf(tag) !== -1 && !tooBig) return cur;

    /* Divs/spans: good candidate if has own text + reasonable size */
    if ((tag === 'DIV' || tag === 'SPAN') && txt.length > 10 && !tooBig) {
      best = cur;
      /* Peek at parent — if parent would be too big, stop here */
      var par = cur.parentElement;
      if (par) {
        var pr = par.getBoundingClientRect();
        if (pr.height > VH * 0.55) return best;
      }
    }

    /* If we already have a candidate and hit a too-big element, use candidate */
    if (tooBig && best) return best;

    cur = cur.parentElement;
  }
  return best || el;
}

/* Walk one level up (expand selection) */
function expandEl(el) {
  var p = el.parentElement;
  if (!p || p === document.body) return el;
  return p;
}
/* Walk to first meaningful child (shrink selection) */
function shrinkEl(el) {
  var children = Array.prototype.slice.call(el.children);
  for (var i = 0; i < children.length; i++) {
    var ch = children[i];
    if ((ch.innerText||'').trim().length > 10) return ch;
  }
  return el;
}

/* ══════════════════════════════════════════
   STANZA / PARAGRAPH SPLITTER
   For poems: splits a block at <br><br>,
   empty-line divs, or direct <p> children
══════════════════════════════════════════ */
function splitIntoStanzas(el) {
  var parts = [];
  /* Case 1: has direct <p> children */
  var pChildren = el.querySelectorAll(':scope > p');
  if (pChildren.length > 1) { pChildren.forEach(function(p){ parts.push(p); }); return parts; }
  /* Case 2: has <div> children each with text */
  var divChildren = el.querySelectorAll(':scope > div');
  if (divChildren.length > 1) {
    divChildren.forEach(function(d){ if((d.innerText||'').trim().length>5) parts.push(d); });
    if (parts.length > 1) return parts;
  }
  /* Case 3: split innerHTML on <br><br> */
  var html = el.innerHTML;
  if (html.match(/<br\s*\/?>\s*<br\s*\/?>/i)) {
    var chunks = html.split(/<br\s*\/?>\s*<br\s*\/?>/i);
    chunks.forEach(function(chunk) {
      var d = document.createElement('div');
      d.innerHTML = chunk;
      if (d.innerText.trim().length > 3) parts.push(d);
    });
    return parts;
  }
  return [el]; /* can't split */
}

function canSplit(el) {
  return splitIntoStanzas(el).length > 1;
}

/* ══════════════════════════════════════════
   HIGHLIGHT HELPERS
══════════════════════════════════════════ */
function _markSel(el) {
  el.setAttribute('data-ps11','sel');
  el.style.cssText += ';outline:3px solid #7c3aed!important;outline-offset:3px!important;background-color:rgba(109,40,217,0.1)!important;border-radius:4px!important;transition:all .2s!important;';
}
function _markPend(el) {
  el.setAttribute('data-ps11','pend');
  el.style.cssText += ';outline:2.5px dashed #f59e0b!important;outline-offset:3px!important;background-color:rgba(245,158,11,0.08)!important;border-radius:4px!important;transition:all .15s!important;';
}
function _unmark(el) {
  if (!el) return;
  el.removeAttribute('data-ps11');
  el.style.outline=''; el.style.outlineOffset='';
  el.style.backgroundColor=''; el.style.borderRadius=''; el.style.transition='';
}
function _clearPending() {
  if (pending) { _unmark(pending); pending = null; }
}

/* ══════════════════════════════════════════
   ICONS
══════════════════════════════════════════ */
var IC = {
  scissors:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  print:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  undo:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  trash:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
  expand:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  shrink:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>',
  split:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 6l7-3 7 3"/><path d="M5 18l7 3 7-3"/></svg>',
  eye:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  text:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  check:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

/* ══════════════════════════════════════════
   HTML
══════════════════════════════════════════ */
var panel = document.createElement('div');
panel.id = PID;
panel.innerHTML =
'<div id="__ps11Sht">'+
  '<div id="__ps11Hdl"><div id="__ps11HdlBar"></div></div>'+

  /* Header */
  '<div id="__ps11Hdr">'+
    '<div id="__ps11HLft">'+
      '<div id="__ps11HIco">'+IC.scissors+'</div>'+
      '<div>'+
        '<div id="__ps11Ttl">Print Selection</div>'+
        '<div id="__ps11Sub">Tap a block \u2192 confirm \u2192 print</div>'+
      '</div>'+
    '</div>'+
    '<button id="__ps11Cls">&#x2715;</button>'+
  '</div>'+

  /* Mode tabs */
  '<div id="__ps11Tabs">'+
    '<button class="__ps11Tab'+(mode==='tap'?' _on':'')+'" data-m="tap">'+IC.scissors+' Tap Pick</button>'+
    '<button class="__ps11Tab'+(mode==='text'?' _on':'')+'" data-m="text">'+IC.text+' Text Sel</button>'+
  '</div>'+

  /* ── TAP MODE ── */
  '<div id="__ps11TapPane" style="display:'+(mode==='tap'?'block':'none')+'">'+

    /* Pending confirmation banner */
    '<div id="__ps11Pend" style="display:none">'+
      '<div id="__ps11PendIcon">\u26a0\ufe0f</div>'+
      '<div id="__ps11PendTxt">'+
        '<strong>Block highlighted in orange.</strong><br>'+
        '<span id="__ps11PendPreview"></span>'+
      '</div>'+
      '<div id="__ps11PendBtns">'+
        '<button id="__ps11PendAdd">'+IC.check+' Add</button>'+
        '<button id="__ps11PendExp">'+IC.expand+' Bigger</button>'+
        '<button id="__ps11PendShr">'+IC.shrink+' Smaller</button>'+
        '<button id="__ps11PendCanc">&#x2715;</button>'+
      '</div>'+
    '</div>'+

    /* Status row */
    '<div id="__ps11Stat">'+
      '<div id="__ps11CntWrap">'+
        '<div id="__ps11Cnt">0</div>'+
        '<div id="__ps11CntLbl">blocks</div>'+
      '</div>'+
      '<div id="__ps11Tip">'+
        '<div id="__ps11TipI">\uD83D\uDC46</div>'+
        '<div id="__ps11TipT">Scroll and tap any paragraph, heading, stanza, or image. <strong>First tap previews</strong> (orange), second tap confirms (purple).</div>'+
      '</div>'+
    '</div>'+

    /* Selected blocks preview list */
    '<div id="__ps11SelList" style="display:none">'+
      '<div id="__ps11SelListHdr">'+
        '<span id="__ps11SelListLbl">Selected blocks</span>'+
        '<button id="__ps11ToggleList">hide</button>'+
      '</div>'+
      '<div id="__ps11SelItems"></div>'+
    '</div>'+

    /* Adjust last selection */
    '<div id="__ps11Adjust" style="display:none">'+
      '<span class="__ps11SLbl">Adjust last block:</span>'+
      '<div id="__ps11AdjBtns">'+
        '<button class="__ps11ABtn" id="__ps11AExp">'+IC.expand+' Expand</button>'+
        '<button class="__ps11ABtn" id="__ps11AShr">'+IC.shrink+' Shrink</button>'+
        '<button class="__ps11ABtn" id="__ps11ASpl">'+IC.split+' Split stanzas</button>'+
      '</div>'+
    '</div>'+

  '</div>'+/* /tap pane */

  /* ── TEXT MODE ── */
  '<div id="__ps11TextPane" style="display:'+(mode==='text'?'block':'none')+'">'+
    '<div id="__ps11TxtPrev"></div>'+
    '<div id="__ps11TxtMeta"></div>'+
    '<div id="__ps11TxtNote">'+
      '\uD83D\uDCA1 On Android: <strong>long-press a word \u2192 drag handles</strong> to extend selection \u2192 open bookmarklet again to refresh.'+
    '</div>'+
    '<button id="__ps11TxtRef">&#x21bb; Refresh selection</button>'+
  '</div>'+

  /* ── ACTION ROW ── */
  '<div id="__ps11Acts">'+
    '<button class="__ps11Btn _sm" id="__ps11BAll">&#x2714; All</button>'+
    '<button class="__ps11Btn _sm" id="__ps11BUndo">'+IC.undo+' Undo</button>'+
    '<button class="__ps11Btn _sm" id="__ps11BClr">'+IC.trash+' Clear</button>'+
    '<button class="__ps11Btn _print" id="__ps11BPrn">'+IC.print+' <span id="__ps11PrnLbl">Print</span></button>'+
  '</div>'+

'</div>';/* /sheet */
document.body.appendChild(panel);

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
var sEl = document.createElement('style');
sEl.id = SID;
sEl.textContent = [
'#__ps11P *,#__ps11P *::before,#__ps11P *::after{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;font-family:"Outfit","Segoe UI",sans-serif;}',

/* Sheet */
'#__ps11Sht{position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#0a0a12;border-top:1px solid rgba(255,255,255,0.07);border-radius:22px 22px 0 0;box-shadow:0 -24px 80px rgba(0,0,0,0.75),0 0 0 1px rgba(255,255,255,0.03) inset;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;animation:__psSU .3s cubic-bezier(.16,1,.3,1) forwards;}',
'@keyframes __psSU{from{transform:translateY(110%)}to{transform:translateY(0)}}',

/* Handle */
'#__ps11Hdl{display:flex;justify-content:center;padding:12px 0 6px;cursor:grab;}',
'#__ps11HdlBar{width:38px;height:4px;background:rgba(255,255,255,0.12);border-radius:99px;}',

/* Header */
'#__ps11Hdr{display:flex;align-items:center;justify-content:space-between;padding:4px 18px 14px;}',
'#__ps11HLft{display:flex;align-items:center;gap:12px;}',
'#__ps11HIco{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 18px rgba(109,40,217,0.5);}',
'#__ps11Ttl{font-size:17px;font-weight:700;color:#f0f0fa;letter-spacing:-.3px;}',
'#__ps11Sub{font-size:11px;color:rgba(255,255,255,0.28);margin-top:2px;}',
'#__ps11Cls{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.4);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;-webkit-tap-highlight-color:transparent;}',
'#__ps11Cls:active{background:rgba(239,68,68,0.2);color:#f87171;}',

/* Tabs */
'#__ps11Tabs{display:flex;gap:6px;padding:0 18px 12px;}',
'.__ps11Tab{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 6px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.35);font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;-webkit-tap-highlight-color:transparent;}',
'.__ps11Tab._on{background:rgba(109,40,217,0.22);border-color:rgba(109,40,217,0.6);color:#c4b5fd;}',
'.__ps11Tab:active{transform:scale(.97);}',

/* Pending banner */
'#__ps11Pend{margin:0 18px 12px;background:rgba(245,158,11,0.1);border:1.5px solid rgba(245,158,11,0.35);border-radius:14px;padding:12px 14px;display:none;flex-direction:column;gap:8px;}',
'#__ps11PendIcon{font-size:18px;}',
'#__ps11PendTxt{font-size:12px;color:rgba(255,255,255,0.6);line-height:1.5;}',
'#__ps11PendTxt strong{color:#fcd34d;}',
'#__ps11PendPreview{display:block;font-size:11px;color:rgba(255,255,255,0.38);font-family:"JetBrains Mono",monospace;margin-top:4px;max-height:42px;overflow:hidden;text-overflow:ellipsis;}',
'#__ps11PendBtns{display:flex;gap:6px;flex-wrap:wrap;}',
'#__ps11PendBtns button{padding:7px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;-webkit-tap-highlight-color:transparent;transition:all .15s;}',
'#__ps11PendAdd{background:rgba(109,40,217,0.3)!important;border-color:rgba(109,40,217,0.6)!important;color:#c4b5fd!important;}',
'#__ps11PendAdd:active,#__ps11PendExp:active,#__ps11PendShr:active,#__ps11PendCanc:active{transform:scale(.95);}',

/* Status */
'#__ps11Stat{display:flex;align-items:center;gap:14px;padding:0 18px 12px;}',
'#__ps11CntWrap{flex-shrink:0;width:68px;height:68px;border-radius:16px;background:rgba(109,40,217,0.14);border:2px solid rgba(109,40,217,0.3);display:flex;flex-direction:column;align-items:center;justify-content:center;}',
'#__ps11Cnt{font-size:26px;font-weight:700;color:#c4b5fd;line-height:1;transition:transform .2s cubic-bezier(.34,1.56,.64,1);}',
'#__ps11CntLbl{font-size:9px;color:rgba(196,181,253,0.5);margin-top:2px;}',
'#__ps11Tip{flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:11px 13px;display:flex;gap:9px;align-items:flex-start;}',
'#__ps11TipI{font-size:18px;line-height:1;flex-shrink:0;}',
'#__ps11TipT{font-size:11.5px;color:rgba(255,255,255,0.35);line-height:1.55;}',
'#__ps11TipT strong{color:rgba(255,255,255,0.6);}',

/* Selected list */
'#__ps11SelList{margin:0 18px 12px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;}',
'#__ps11SelListHdr{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);}',
'#__ps11SelListLbl{font-size:10px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:.07em;}',
'#__ps11ToggleList{font-size:10px;color:rgba(109,40,217,0.8);background:none;border:none;cursor:pointer;}',
'#__ps11SelItems{max-height:120px;overflow-y:auto;}',
'.__ps11SItem{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;}',
'.__ps11SItemNum{width:18px;height:18px;border-radius:50%;background:rgba(109,40,217,0.25);color:#c4b5fd;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'.__ps11SItemTxt{flex:1;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
'.__ps11SItemDel{width:20px;height:20px;border-radius:50%;border:none;background:rgba(239,68,68,0.1);color:rgba(239,68,68,0.6);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',

/* Adjust row */
'#__ps11Adjust{margin:0 18px 12px;display:none;}',
'.__ps11SLbl{font-size:10px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:7px;}',
'#__ps11AdjBtns{display:flex;gap:6px;flex-wrap:wrap;}',
'.__ps11ABtn{padding:8px 14px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.45);font-size:11.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;-webkit-tap-highlight-color:transparent;transition:all .15s;}',
'.__ps11ABtn:hover{border-color:rgba(109,40,217,0.5);color:#c4b5fd;}',
'.__ps11ABtn:active{transform:scale(.96);}',

/* Text pane */
'#__ps11TextPane{padding:0 18px 12px;display:none;flex-direction:column;gap:10px;}',
'#__ps11TextPane{display:none;}',
'#__ps11TextPane.vis{display:flex;}',
'#__ps11TxtPrev{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px;font-size:12.5px;color:rgba(255,255,255,0.55);line-height:1.6;max-height:110px;overflow-y:auto;font-family:"JetBrains Mono",monospace;white-space:pre-wrap;word-break:break-word;}',
'#__ps11TxtMeta{font-size:11px;color:rgba(255,255,255,0.28);}',
'#__ps11TxtNote{font-size:11.5px;color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 12px;line-height:1.55;}',
'#__ps11TxtNote strong{color:rgba(255,255,255,0.55);}',
'#__ps11TxtRef{padding:10px;border-radius:10px;border:1.5px solid rgba(109,40,217,0.35);background:rgba(109,40,217,0.1);color:#c4b5fd;font-size:12px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;}',

/* Actions */
'#__ps11Acts{display:grid;grid-template-columns:1fr 1fr 1fr 2.2fr;gap:7px;padding:0 18px 28px;}',
'.__ps11Btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:14px 4px;border-radius:14px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.4);font-size:11.5px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all .15s;}',
'.__ps11Btn._sm{flex-direction:column;gap:4px;font-size:11px;}',
'.__ps11Btn:active{transform:scale(.95);}',
'.__ps11Btn._print{background:linear-gradient(135deg,#6d28d9,#4338ca);border:none;color:#fff;font-size:13px;font-weight:700;box-shadow:0 6px 24px rgba(109,40,217,0.45);}',
'.__ps11Btn._print:active{transform:scale(.96);}'
].join('\n');
document.head.appendChild(sEl);

/* ══════════════════════════════════════════
   UI UPDATE
══════════════════════════════════════════ */
function updateUI() {
  var n = selected.length;
  var cnt = document.getElementById('__ps11Cnt');
  var lbl = document.getElementById('__ps11PrnLbl');
  var sub = document.getElementById('__ps11Sub');
  if (cnt) { cnt.textContent = n; cnt.style.transform='scale(1.3)'; setTimeout(function(){cnt.style.transform='';},200); }
  if (lbl) lbl.textContent = mode==='text' ? (textSel?'Print selection':'No text selected') : (n===0?'Nothing selected':'Print '+n+' block'+(n!==1?'s':''));
  if (sub) sub.textContent = pending ? '\u26a0 Confirm or dismiss the highlighted block first' : (n===0?'Tap any block to begin':''+n+' block'+(n!==1?'s':'')+' ready \u2022 scroll for more');

  /* Print button opacity */
  var pBtn = document.getElementById('__ps11BPrn');
  if (pBtn) pBtn.style.opacity = (mode==='text'&&textSel)||(mode==='tap'&&n>0) ? '1':'0.4';

  /* Show/hide selected list */
  var sl = document.getElementById('__ps11SelList');
  if (sl) sl.style.display = n>0 ? 'block':'none';

  /* Adjust row (for last selected block) */
  var adj = document.getElementById('__ps11Adjust');
  if (adj) adj.style.display = n>0 ? 'block':'none';

  /* Rebuild items list */
  refreshSelList();

  /* Text pane */
  if (mode==='text') refreshTextPane();
}

function refreshSelList() {
  var items = document.getElementById('__ps11SelItems');
  if (!items) return;
  items.innerHTML = '';
  selected.forEach(function(el, i){
    var txt = (el.innerText||'').trim().slice(0,60).replace(/\s+/g,' ');
    var row = document.createElement('div');
    row.className = '__ps11SItem';
    row.innerHTML =
      '<div class="__ps11SItemNum">'+(i+1)+'</div>'+
      '<div class="__ps11SItemTxt">'+escHtml(txt)+'</div>'+
      '<button class="__ps11SItemDel" data-i="'+i+'">\u2715</button>';
    items.appendChild(row);
  });
  items.querySelectorAll('.__ps11SItemDel').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var i = parseInt(this.getAttribute('data-i'),10);
      if(selected[i]) _unmark(selected[i]);
      selected.splice(i,1);
      updateUI();
    });
  });
}

function refreshTextPane(){
  var prev = document.getElementById('__ps11TxtPrev');
  var meta = document.getElementById('__ps11TxtMeta');
  if(prev) prev.textContent = textSel || 'No text selected.\nLong-press a word on the page \u2192 drag to extend \u2192 then tap the bookmarklet.';
  if(meta && textSel){
    var w = textSel.trim().split(/\s+/).length;
    meta.textContent = w+' words \u00b7 ~'+Math.ceil(w/200)+' min read';
  }
}

/* ══════════════════════════════════════════
   PENDING BANNER
══════════════════════════════════════════ */
function showPendingBanner(el) {
  var pend = document.getElementById('__ps11Pend');
  if (!pend) return;
  var txt = (el.innerText||'').trim().slice(0,100).replace(/\s+/g,' ');
  document.getElementById('__ps11PendPreview').textContent = txt || '(no text preview)';
  pend.style.display = 'flex';
}
function hidePendingBanner() {
  var pend = document.getElementById('__ps11Pend');
  if (pend) pend.style.display = 'none';
}

/* ══════════════════════════════════════════
   TAP HANDLER (2-tap: preview → confirm)
══════════════════════════════════════════ */
function onTap(e) {
  var p = document.getElementById(PID);
  if (p && p.contains(e.target)) return; /* inside panel — ignore */
  e.preventDefault(); e.stopPropagation();

  var block = findBlock(e.target);
  if (!block) return;

  if (block === pending) {
    /* ── Second tap: CONFIRM ── */
    _unmark(block);
    undoStack.push({ type:'add', el:block });
    selected.push(block);
    _markSel(block);
    _clearPending();
    hidePendingBanner();
    updateUI();
  } else {
    /* ── First tap: PREVIEW ── */
    _clearPending();
    hidePendingBanner();
    pending = block;
    _markPend(block);
    showPendingBanner(block);
    updateUI();
  }
}

/* ══════════════════════════════════════════
   PENDING BANNER BUTTONS
══════════════════════════════════════════ */
document.getElementById('__ps11PendAdd').addEventListener('click', function(){
  if (!pending) return;
  _unmark(pending);
  undoStack.push({type:'add',el:pending});
  selected.push(pending);
  _markSel(pending);
  _clearPending(); hidePendingBanner(); updateUI();
});
document.getElementById('__ps11PendCanc').addEventListener('click', function(){
  _clearPending(); hidePendingBanner(); updateUI();
});
document.getElementById('__ps11PendExp').addEventListener('click', function(){
  if (!pending) return;
  var bigger = expandEl(pending);
  _unmark(pending); pending = bigger; _markPend(bigger); showPendingBanner(bigger);
});
document.getElementById('__ps11PendShr').addEventListener('click', function(){
  if (!pending) return;
  var smaller = shrinkEl(pending);
  if (smaller !== pending) { _unmark(pending); pending = smaller; _markPend(smaller); showPendingBanner(smaller); }
});

/* ══════════════════════════════════════════
   ADJUST LAST SELECTED
══════════════════════════════════════════ */
document.getElementById('__ps11AExp').addEventListener('click', function(){
  if (!selected.length) return;
  var i = selected.length-1, cur = selected[i];
  var bigger = expandEl(cur);
  if (bigger !== cur) { _unmark(cur); selected[i]=bigger; _markSel(bigger); updateUI(); }
});
document.getElementById('__ps11AShr').addEventListener('click', function(){
  if (!selected.length) return;
  var i = selected.length-1, cur = selected[i];
  var smaller = shrinkEl(cur);
  if (smaller !== cur) { _unmark(cur); selected[i]=smaller; _markSel(smaller); updateUI(); }
});
document.getElementById('__ps11ASpl').addEventListener('click', function(){
  if (!selected.length) return;
  var i = selected.length-1, cur = selected[i];
  var parts = splitIntoStanzas(cur);
  if (parts.length <= 1) { alert('Could not detect multiple stanzas in this block.'); return; }
  _unmark(cur);
  selected.splice(i,1);
  parts.forEach(function(part){ selected.push(part); _markSel(part); });
  updateUI();
});

/* ══════════════════════════════════════════
   SELECT ALL
══════════════════════════════════════════ */
document.getElementById('__ps11BAll').addEventListener('click', function(){
  _clearAll();
  var tags = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figure,table';
  var p = document.getElementById(PID);
  document.querySelectorAll(tags).forEach(function(el){
    if (p && p.contains(el)) return;
    if (el.offsetParent===null) return;
    if ((el.innerText||'').trim().length < 5) return;
    if (selected.indexOf(el)===-1){ selected.push(el); _markSel(el); }
  });
  updateUI();
});

/* ══════════════════════════════════════════
   UNDO
══════════════════════════════════════════ */
document.getElementById('__ps11BUndo').addEventListener('click', function(){
  var last = undoStack.pop(); if (!last) return;
  if (last.type==='add'){
    var idx=selected.indexOf(last.el);
    if(idx!==-1){selected.splice(idx,1);_unmark(last.el);}
  }
  updateUI();
});

/* ══════════════════════════════════════════
   CLEAR
══════════════════════════════════════════ */
document.getElementById('__ps11BClr').addEventListener('click', function(){ _clearAll(); updateUI(); });
function _clearAll(){
  _clearPending(); hidePendingBanner();
  selected.forEach(function(el){_unmark(el);}); selected=[]; undoStack=[];
}

/* ══════════════════════════════════════════
   TOGGLE LIST
══════════════════════════════════════════ */
document.getElementById('__ps11ToggleList').addEventListener('click', function(){
  var items = document.getElementById('__ps11SelItems');
  var hidden = items.style.display==='none';
  items.style.display = hidden?'block':'none';
  this.textContent = hidden?'hide':'show';
});

/* ══════════════════════════════════════════
   TEXT MODE: REFRESH SELECTION
══════════════════════════════════════════ */
document.getElementById('__ps11TxtRef').addEventListener('click', function(){
  var s2 = window.getSelection();
  if(s2&&s2.toString().trim().length>0) textSel=s2.toString().trim();
  refreshTextPane(); updateUI();
});

/* ══════════════════════════════════════════
   MODE TABS
══════════════════════════════════════════ */
document.querySelectorAll('.__ps11Tab').forEach(function(btn){
  btn.addEventListener('click', function(){
    mode = this.getAttribute('data-m');
    document.querySelectorAll('.__ps11Tab').forEach(function(b){b.classList.remove('_on');});
    this.classList.add('_on');
    document.getElementById('__ps11TapPane').style.display  = mode==='tap'  ? 'block':'none';
    var tp = document.getElementById('__ps11TextPane');
    if(mode==='text'){tp.style.display='flex';}else{tp.style.display='none';}
    if(mode==='tap') { _activateTap(); }
    else { _deactivateTap(); var s3=window.getSelection(); if(s3&&s3.toString().trim().length>0)textSel=s3.toString().trim(); }
    updateUI();
  });
});

/* ══════════════════════════════════════════
   PRINT: TEXT SELECTION
══════════════════════════════════════════ */
function printText(){
  if(!textSel) return;
  var win=window.open('','_blank','width=800,height=600,toolbar=0,menubar=0,location=0,scrollbars=1');
  if(!win){alert('Allow pop-ups and try again.');return;}
  var src = escHtml(location.href);
  var pg = escHtml(document.title||location.hostname);
  var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+pg+'</title>'
    +'<style>body{font-family:Georgia,serif;font-size:13pt;line-height:1.8;max-width:760px;margin:40px auto;color:#111;padding:0 24px;}'
    +'pre{white-space:pre-wrap;font-size:12pt;background:#f8f8f8;padding:16px;border-radius:6px;}'
    +'footer{margin-top:40px;font-size:9pt;color:#999;border-top:1px solid #eee;padding-top:12px;}'
    +'@media print{@page{margin:25mm 20mm}body{margin:0;}}</style></head><body>'
    +'<pre>'+escHtml(textSel)+'</pre>'
    +'<footer>Source: <a href="'+src+'">'+src+'</a></footer>'
    +'</body></html>';
  win.document.write(html); win.document.close(); win.focus();
  setTimeout(function(){win.print();},400);
  closePanel();
}

/* ══════════════════════════════════════════
   PRINT: TAPPED BLOCKS
══════════════════════════════════════════ */
function printBlocks(){
  if(!selected.length) return;

  /* Collect page styles */
  var pageCSS = '';
  try {
    Array.prototype.slice.call(document.styleSheets).forEach(function(sh){
      try {
        Array.prototype.slice.call(sh.cssRules||sh.rules||[]).forEach(function(r){
          pageCSS += r.cssText+'\n';
        });
      } catch(e){}
    });
  } catch(e){}

  /* Clone and clean selected elements */
  var parts = selected.map(function(el){
    var c = el.cloneNode(true);
    c.removeAttribute('data-ps11');
    c.style.cssText = c.style.cssText
      .replace(/outline[^;]*;?/gi,'')
      .replace(/outline-offset[^;]*;?/gi,'')
      .replace(/background-color:rgba\(109,40,217[^;]*;?/gi,'')
      .replace(/border-radius:4px!important;?/gi,'')
      .replace(/transition[^;]*;?/gi,'');
    return '<div class="__ps11blk">'+c.outerHTML+'</div>';
  });

  var win=window.open('','_blank','width=820,height=700,toolbar=0,menubar=0,location=0,scrollbars=1');
  if(!win){alert('Allow pop-ups and try again.');return;}

  var html='<!DOCTYPE html><html><head><meta charset="utf-8">'
    +'<base href="'+location.origin+'">'
    +'<title>Print Selection \u2014 '+escHtml(document.title||location.hostname)+'</title>'
    +'<style>'+pageCSS+'</style>'
    +'<style>'
    +'body{max-width:800px;margin:0 auto;padding:24px;}'
    +'.__ps11blk{margin-bottom:1.4em;}'
    +'footer{margin-top:36px;font-size:9pt;color:#aaa;border-top:1px solid #eee;padding-top:10px;}'
    +'@media print{'
    +'  @page{margin:25mm 20mm}'
    +'  body{padding:0;max-width:none;}'
    +'  footer{color:#999;}'
    +'  a{color:inherit;text-decoration:none;}'
    +'}'
    +'</style>'
    +'</head><body>'
    +parts.join('\n')
    +'<footer>'+selected.length+' block'+(selected.length!==1?'s':'')+' \u00b7 '
    +'<a href="'+escHtml(location.href)+'">'+escHtml(location.href)+'</a></footer>'
    +'</body></html>';

  win.document.write(html); win.document.close(); win.focus();
  setTimeout(function(){win.print();},500);
  closePanel();
}

/* ══════════════════════════════════════════
   PRINT BUTTON
══════════════════════════════════════════ */
document.getElementById('__ps11BPrn').addEventListener('click', function(){
  if(mode==='text') printText(); else printBlocks();
});

/* ══════════════════════════════════════════
   CLOSE & CLEANUP
══════════════════════════════════════════ */
function _cleanup(){
  _deactivateTap();
  selected.forEach(function(el){_unmark(el);});
  if(pending) _unmark(pending);
  selected=[]; pending=null; undoStack=[];
  document.removeEventListener('keydown',_onKey);
}
function closePanel(){
  _cleanup();
  var p=document.getElementById(PID); if(p) p.remove();
  var s=document.getElementById(SID); if(s) s.remove();
}
document.getElementById('__ps11Cls').addEventListener('click', closePanel);

/* Swipe down handle to close */
var _swipeY=0;
var hdl = document.getElementById('__ps11Hdl');
hdl.addEventListener('touchstart',function(e){_swipeY=e.touches[0].clientY;},{passive:true});
hdl.addEventListener('touchend',function(e){if(e.changedTouches[0].clientY-_swipeY>55) closePanel();},{passive:true});

/* ══════════════════════════════════════════
   TAP ACTIVATION
══════════════════════════════════════════ */
function _activateTap(){ document.addEventListener('click',onTap,true); }
function _deactivateTap(){ document.removeEventListener('click',onTap,true); }

/* ══════════════════════════════════════════
   KEYBOARD
══════════════════════════════════════════ */
function _onKey(e){
  if(e.key==='Escape') closePanel();
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter') document.getElementById('__ps11BPrn').click();
  if((e.ctrlKey||e.metaKey)&&e.key==='z') document.getElementById('__ps11BUndo').click();
}
document.addEventListener('keydown',_onKey);

/* ══════════════════════════════════════════
   HELPER
══════════════════════════════════════════ */
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
if(mode==='tap') _activateTap();
else { var tp2=document.getElementById('__ps11TextPane'); if(tp2) tp2.style.display='flex'; }
updateUI();

})();
