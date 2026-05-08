(function () {

/* ══════════════════════════════════════
   GUARD
══════════════════════════════════════ */
var PID = '__ps10Panel', SID = '__ps10Style';
var ex = document.getElementById(PID);
if (ex) { ex.remove(); var es = document.getElementById(SID); if (es) es.remove(); cleanup(); return; }

/* ══════════════════════════════════════
   FONT
══════════════════════════════════════ */
if (!document.getElementById('__ps10Font')) {
  var fl = document.createElement('link');
  fl.id = '__ps10Font'; fl.rel = 'stylesheet';
  fl.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@500;600;700&display=swap';
  document.head.appendChild(fl);
}

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
var selected   = [];   /* array of DOM elements user tapped */
var history    = [];   /* undo stack */
var mode       = 'tap';/* 'tap' | 'text' */
var hoverEl    = null;
var textSel    = '';

/* Check for existing text selection (long-press on Android) */
var sel = window.getSelection();
if (sel && sel.toString().trim().length > 20) {
  textSel = sel.toString().trim();
  mode = 'text';
}

/* ══════════════════════════════════════
   SEMANTIC BLOCK FINDER
   Walk up DOM to find a meaningful block
══════════════════════════════════════ */
var BLOCK_TAGS = {
  P:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1,
  LI:1, BLOCKQUOTE:1, PRE:1, FIGURE:1, FIGCAPTION:1,
  ARTICLE:1, SECTION:1, HEADER:1, FOOTER:1, ASIDE:1, MAIN:1,
  TABLE:1, TR:1, TD:1, TH:1, DL:1, DT:1, DD:1,
  DIV:1, SPAN:1
};

function findBlock(el) {
  if (!el || el === document.body || el === document.documentElement) return null;
  var tag = el.tagName;
  /* Prefer semantic content blocks */
  if (['ARTICLE','SECTION','MAIN','BLOCKQUOTE','FIGURE','TABLE'].indexOf(tag) !== -1) return el;
  if (['P','H1','H2','H3','H4','H5','H6','PRE','LI'].indexOf(tag) !== -1) return el;
  /* For divs: use if it has direct text or is reasonably sized */
  if (tag === 'DIV' || tag === 'SPAN') {
    var r = el.getBoundingClientRect();
    var hasText = el.innerText && el.innerText.trim().length > 30;
    var goodSize = r.width > 80 && r.height > 20;
    if (hasText && goodSize) return el;
    return findBlock(el.parentElement);
  }
  return findBlock(el.parentElement);
}

/* ══════════════════════════════════════
   HIGHLIGHT HELPERS
══════════════════════════════════════ */
function markSelected(el) {
  el.setAttribute('data-ps10', 'sel');
  el.style.outline = '3px solid #7c3aed';
  el.style.outlineOffset = '2px';
  el.style.backgroundColor = 'rgba(109,40,217,0.1)';
  el.style.borderRadius = '4px';
  el.style.transition = 'all .2s';
}
function unmarkSelected(el) {
  el.removeAttribute('data-ps10');
  el.style.outline = '';
  el.style.outlineOffset = '';
  el.style.backgroundColor = '';
  el.style.borderRadius = '';
  el.style.transition = '';
}
function markHover(el) {
  if (!el) return;
  el.setAttribute('data-ps10', 'hov');
  el.style.outline = '2px dashed rgba(167,139,250,0.7)';
  el.style.outlineOffset = '2px';
  el.style.backgroundColor = 'rgba(109,40,217,0.06)';
}
function unmarkHover(el) {
  if (!el || el.getAttribute('data-ps10') === 'hov') {
    if (el) { el.removeAttribute('data-ps10'); el.style.outline=''; el.style.outlineOffset=''; el.style.backgroundColor=''; }
  }
}

/* ══════════════════════════════════════
   TAP HANDLER
══════════════════════════════════════ */
function onTap(e) {
  var panel = document.getElementById(PID);
  if (panel && panel.contains(e.target)) return; /* ignore taps inside panel */

  e.preventDefault();
  e.stopPropagation();

  var block = findBlock(e.target);
  if (!block) return;

  var idx = selected.indexOf(block);
  history.push({ type: idx === -1 ? 'add' : 'remove', el: block });

  if (idx === -1) {
    selected.push(block);
    markSelected(block);
  } else {
    selected.splice(idx, 1);
    unmarkSelected(block);
  }
  updatePanel();
  pulseCount();
}

/* Desktop hover preview */
function onMouseOver(e) {
  var panel = document.getElementById(PID);
  if (panel && panel.contains(e.target)) return;
  var block = findBlock(e.target);
  if (block && block !== hoverEl && selected.indexOf(block) === -1) {
    if (hoverEl && selected.indexOf(hoverEl) === -1) unmarkHover(hoverEl);
    hoverEl = block;
    markHover(block);
  }
}
function onMouseOut(e) {
  var block = findBlock(e.target);
  if (block && selected.indexOf(block) === -1) unmarkHover(block);
}

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
var panel = document.createElement('div');
panel.id = PID;

var icoScissors = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>';
var icoPrint = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
var icoUndo = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';
var icoTrash = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
var icoAll = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>';
var icoText = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>';

panel.innerHTML =
  '<div id="__ps10Sht">' +
    /* Handle bar */
    '<div id="__ps10Hdl"><div id="__ps10HdlBar"></div></div>' +

    /* Header */
    '<div id="__ps10Hdr">' +
      '<div id="__ps10HLft">' +
        '<div id="__ps10HIco">' + icoScissors + '</div>' +
        '<div>' +
          '<div id="__ps10Ttl">Print Selection</div>' +
          '<div id="__ps10Sub" class="mode-tap">Tap any block on the page to select it</div>' +
        '</div>' +
      '</div>' +
      '<button id="__ps10Cls" aria-label="Close">&#x2715;</button>' +
    '</div>' +

    /* Mode tabs */
    '<div id="__ps10Tabs">' +
      '<button class="__ps10Tab' + (mode==='tap'?' __ps10TOn':'') + '" data-m="tap">' + icoScissors + ' Tap Pick</button>' +
      '<button class="__ps10Tab' + (mode==='text'?' __ps10TOn':'') + '" data-m="text">' + icoText + ' Text Sel</button>' +
    '</div>' +

    /* Text mode panel */
    '<div id="__ps10TextPane" style="display:' + (mode==='text'?'flex':'none') + '">' +
      '<div id="__ps10TxtPrev"></div>' +
      '<div id="__ps10TxtMeta"></div>' +
    '</div>' +

    /* Tap mode status */
    '<div id="__ps10Status" style="display:' + (mode==='tap'?'flex':'none') + '">' +
      '<div id="__ps10CountWrap">' +
        '<div id="__ps10Count">0</div>' +
        '<div id="__ps10CountLbl">blocks\nselected</div>' +
      '</div>' +
      '<div id="__ps10Tip">' +
        '<div id="__ps10TipIcon">\uD83D\uDC46</div>' +
        '<div id="__ps10TipTxt">Scroll the page and tap any paragraph, heading, image or section to include it.</div>' +
      '</div>' +
    '</div>' +

    /* Action buttons */
    '<div id="__ps10Acts">' +
      '<button class="__ps10Btn __ps10BtnSm" id="__ps10BtnAll">' + icoAll + ' All</button>' +
      '<button class="__ps10Btn __ps10BtnSm" id="__ps10BtnUndo">' + icoUndo + ' Undo</button>' +
      '<button class="__ps10Btn __ps10BtnSm" id="__ps10BtnClr">' + icoTrash + ' Clear</button>' +
      '<button class="__ps10Btn __ps10BtnPrint" id="__ps10BtnPrint">' + icoPrint + ' <span id="__ps10PrnLbl">Print 0 blocks</span></button>' +
    '</div>' +

  '</div>';

document.body.appendChild(panel);

/* ══════════════════════════════════════
   STYLES
══════════════════════════════════════ */
var style = document.createElement('style');
style.id = SID;
style.textContent = [

/* Reset */
'#__ps10Panel *,#__ps10Panel *::before,#__ps10Panel *::after{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;font-family:"Outfit","Segoe UI",sans-serif;}',

/* Bottom sheet */
'#__ps10Sht{',
'  position:fixed;bottom:0;left:0;right:0;z-index:2147483647;',
'  background:#0c0c14;',
'  border-top:1px solid rgba(255,255,255,0.08);',
'  border-radius:22px 22px 0 0;',
'  box-shadow:0 -20px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.04) inset;',
'  max-height:92vh;overflow-y:auto;',
'  animation:__psSU .32s cubic-bezier(.16,1,.3,1) forwards;',
'  -webkit-overflow-scrolling:touch;',
'}',
'@keyframes __psSU{from{transform:translateY(110%)}to{transform:translateY(0)}}',

/* Handle */
'#__ps10Hdl{display:flex;justify-content:center;padding:12px 0 6px;}',
'#__ps10HdlBar{width:40px;height:4px;background:rgba(255,255,255,0.15);border-radius:99px;}',

/* Header */
'#__ps10Hdr{display:flex;align-items:center;justify-content:space-between;padding:4px 18px 14px;}',
'#__ps10HLft{display:flex;align-items:center;gap:12px;}',
'#__ps10HIco{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 18px rgba(109,40,217,0.5);}',
'#__ps10Ttl{font-size:17px;font-weight:700;color:#f0f0fa;letter-spacing:-.3px;}',
'#__ps10Sub{font-size:11px;color:rgba(255,255,255,0.3);margin-top:1px;}',
'#__ps10Cls{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.4);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;-webkit-tap-highlight-color:transparent;}',
'#__ps10Cls:active{background:rgba(239,68,68,0.2);color:#f87171;}',

/* Tabs */
'#__ps10Tabs{display:flex;gap:6px;padding:0 18px 14px;}',
'.__ps10Tab{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 6px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.38);font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;-webkit-tap-highlight-color:transparent;}',
'.__ps10Tab:active{transform:scale(.97);}',
'.__ps10TOn{background:rgba(109,40,217,0.22)!important;border-color:rgba(109,40,217,0.65)!important;color:#c4b5fd!important;}',

/* Text pane */
'#__ps10TextPane{flex-direction:column;gap:10px;padding:0 18px 14px;}',
'#__ps10TxtPrev{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.55;max-height:120px;overflow-y:auto;font-family:"JetBrains Mono",monospace;}',
'#__ps10TxtMeta{font-size:11px;color:rgba(255,255,255,0.28);padding-left:2px;}',

/* Tap status */
'#__ps10Status{flex-direction:row;align-items:center;gap:14px;padding:0 18px 16px;}',
'#__ps10CountWrap{flex-shrink:0;width:72px;height:72px;border-radius:18px;background:rgba(109,40,217,0.15);border:2px solid rgba(109,40,217,0.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;}',
'#__ps10Count{font-size:28px;font-weight:700;color:#c4b5fd;line-height:1;transition:transform .15s;}',
'#__ps10CountLbl{font-size:9px;color:rgba(196,181,253,0.55);text-align:center;white-space:pre;line-height:1.3;}',
'#__ps10Tip{flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start;}',
'#__ps10TipIcon{font-size:20px;line-height:1;flex-shrink:0;}',
'#__ps10TipTxt{font-size:12px;color:rgba(255,255,255,0.38);line-height:1.55;}',

/* Actions */
'#__ps10Acts{display:grid;grid-template-columns:1fr 1fr 1fr 2fr;gap:8px;padding:0 18px 28px;}',
'.__ps10Btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:14px 6px;border-radius:14px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.45);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;}',
'.__ps10Btn:active{transform:scale(.95);}',
'.__ps10BtnSm{flex-direction:column;gap:5px;font-size:11px;}',
'.__ps10BtnPrint{background:linear-gradient(135deg,#6d28d9,#4338ca)!important;border:none!important;color:#fff!important;font-size:13px!important;font-weight:700!important;box-shadow:0 6px 24px rgba(109,40,217,0.45);}',
'.__ps10BtnPrint:active{transform:scale(.96)!important;}'

].join('\n');
document.head.appendChild(style);

/* ══════════════════════════════════════
   UPDATE PANEL UI
══════════════════════════════════════ */
function updatePanel() {
  var cnt = document.getElementById('__ps10Count');
  var lbl = document.getElementById('__ps10PrnLbl');
  var sub = document.getElementById('__ps10Sub');
  var n   = mode === 'text' ? (textSel ? 1 : 0) : selected.length;

  if (cnt) cnt.textContent = n;
  if (lbl) {
    if (mode === 'text') lbl.textContent = textSel ? 'Print Selection' : 'No text selected';
    else lbl.textContent = n === 0 ? 'Nothing selected' : 'Print ' + n + ' block' + (n !== 1 ? 's' : '');
  }
  if (sub) {
    if (mode === 'tap') sub.textContent = n === 0 ? 'Tap any block on the page to select it' : n + ' block' + (n!==1?'s':'') + ' selected \u2014 scroll for more';
    else sub.textContent = textSel ? Math.ceil(textSel.split(/\s+/).length) + ' words selected' : 'Long-press text first, then open bookmarklet';
  }

  /* Update text preview */
  if (mode === 'text') {
    var prev = document.getElementById('__ps10TxtPrev');
    var meta = document.getElementById('__ps10TxtMeta');
    if (prev) prev.textContent = textSel ? (textSel.length > 300 ? textSel.slice(0,300)+'…' : textSel) : 'No text selected yet.\nOn Android: long-press a word \u2192 drag to select \u2192 then click this bookmarklet.';
    if (meta && textSel) {
      var words = textSel.trim().split(/\s+/).length;
      var chars = textSel.length;
      meta.textContent = words + ' words \u00b7 ' + chars + ' characters \u00b7 ~' + Math.ceil(words/200) + ' min read';
    }
  }

  /* Print button state */
  var pBtn = document.getElementById('__ps10BtnPrint');
  if (pBtn) pBtn.style.opacity = n === 0 ? '0.4' : '1';
}

function pulseCount() {
  var cnt = document.getElementById('__ps10Count');
  if (!cnt) return;
  cnt.style.transform = 'scale(1.35)';
  setTimeout(function(){ cnt.style.transform = 'scale(1)'; cnt.style.transition = 'transform .2s cubic-bezier(.34,1.56,.64,1)'; }, 50);
}

/* ══════════════════════════════════════
   TAP MODE ACTIVATION
══════════════════════════════════════ */
function activateTapMode() {
  document.addEventListener('click', onTap, true);
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
}
function deactivateTapMode() {
  document.removeEventListener('click', onTap, true);
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  if (hoverEl && selected.indexOf(hoverEl) === -1) unmarkHover(hoverEl);
}

/* ══════════════════════════════════════
   MODE SWITCHING
══════════════════════════════════════ */
document.querySelectorAll('.__ps10Tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    mode = this.getAttribute('data-m');
    document.querySelectorAll('.__ps10Tab').forEach(function(b){ b.classList.remove('__ps10TOn'); });
    this.classList.add('__ps10TOn');

    document.getElementById('__ps10Status').style.display   = mode==='tap'  ? 'flex' : 'none';
    document.getElementById('__ps10TextPane').style.display = mode==='text' ? 'flex' : 'none';

    if (mode === 'tap') {
      activateTapMode();
      /* Re-check text selection in case user switched and selected something */
    } else {
      deactivateTapMode();
      var sel2 = window.getSelection();
      if (sel2 && sel2.toString().trim().length > 0) textSel = sel2.toString().trim();
    }
    updatePanel();
  });
});

/* ══════════════════════════════════════
   BUTTONS
══════════════════════════════════════ */

/* Select All meaningful blocks */
document.getElementById('__ps10BtnAll').addEventListener('click', function() {
  clearAll();
  var candidates = document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figure,table');
  var added = 0;
  candidates.forEach(function(el) {
    var panel = document.getElementById(PID);
    if (panel && panel.contains(el)) return;
    if (el.offsetParent === null) return; /* hidden */
    if (el.innerText && el.innerText.trim().length < 5) return;
    if (selected.indexOf(el) === -1) {
      selected.push(el);
      markSelected(el);
      added++;
    }
  });
  updatePanel(); pulseCount();
});

/* Undo */
document.getElementById('__ps10BtnUndo').addEventListener('click', function() {
  var last = history.pop();
  if (!last) return;
  if (last.type === 'add') {
    var idx = selected.indexOf(last.el);
    if (idx !== -1) { selected.splice(idx,1); unmarkSelected(last.el); }
  } else {
    if (selected.indexOf(last.el) === -1) { selected.push(last.el); markSelected(last.el); }
  }
  updatePanel(); pulseCount();
});

/* Clear all */
document.getElementById('__ps10BtnClr').addEventListener('click', function() {
  clearAll();
  updatePanel();
});
function clearAll() {
  selected.forEach(function(el){ unmarkSelected(el); });
  selected = []; history = [];
}

/* Print */
document.getElementById('__ps10BtnPrint').addEventListener('click', function() {
  if (mode === 'text') { printText(); }
  else { printBlocks(); }
});

/* ══════════════════════════════════════
   PRINT: TEXT SELECTION
══════════════════════════════════════ */
function printText() {
  if (!textSel) return;
  var win = window.open('', '_blank',
    'width=800,height=600,toolbar=0,menubar=0,location=0,status=0,scrollbars=1');
  if (!win) { alert('Allow pop-ups for this site, then try again.'); return; }
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print Selection</title><style>'
    + 'body{font-family:Georgia,serif;font-size:13pt;line-height:1.7;max-width:800px;margin:40px auto;color:#111;padding:0 20px;}'
    + 'pre{white-space:pre-wrap;font-family:monospace;font-size:11pt;background:#f4f4f4;padding:12px;border-radius:4px;}'
    + '@media print{@page{margin:25mm 20mm}body{margin:0;}}'
    + '</style></head><body>'
    + '<pre style="white-space:pre-wrap;font-family:inherit;background:none;padding:0;">'
    + escHtml(textSel)
    + '</pre>'
    + '<hr style="margin-top:30px;border:none;border-top:1px solid #ddd;">'
    + '<p style="font-size:9pt;color:#888;margin-top:8px;">Source: ' + escHtml(location.href) + '</p>'
    + '</body></html>';
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function(){ win.print(); }, 400);
  closePanel();
}

/* ══════════════════════════════════════
   PRINT: TAPPED BLOCKS
══════════════════════════════════════ */
function printBlocks() {
  if (selected.length === 0) return;

  /* Clone each selected element cleanly */
  var parts = selected.map(function(el) {
    var clone = el.cloneNode(true);
    /* Strip our own markers */
    clone.removeAttribute('data-ps10');
    clone.style.outline = '';
    clone.style.outlineOffset = '';
    clone.style.backgroundColor = '';
    clone.style.borderRadius = '';
    clone.style.transition = '';
    return clone.outerHTML;
  });

  /* Grab relevant styles from the original page */
  var pageStyles = '';
  try {
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      try {
        var rules = sheets[i].cssRules || sheets[i].rules;
        if (!rules) continue;
        for (var j = 0; j < rules.length; j++) {
          pageStyles += rules[j].cssText + '\n';
        }
      } catch(e) {}
    }
  } catch(e) {}

  var win = window.open('', '_blank',
    'width=800,height=700,toolbar=0,menubar=0,location=0,status=0,scrollbars=1');
  if (!win) { alert('Allow pop-ups for this site, then try again.'); return; }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print Selection</title>'
    + '<base href="' + location.origin + '">'
    + '<style>' + pageStyles + '</style>'
    + '<style>'
    + 'body{max-width:800px;margin:0 auto;padding:20px;}'
    + '.__ps10block{margin-bottom:1.2em;}'
    + '@media print{'
    + '  @page{margin:25mm 20mm}'
    + '  body{padding:0;}'
    + '  a{color:inherit;text-decoration:none;}'
    + '}'
    + '</style>'
    + '</head><body>'
    + parts.map(function(p){ return '<div class="__ps10block">' + p + '</div>'; }).join('\n')
    + '<hr style="margin:30px 0 10px;border:none;border-top:1px solid #ddd;">'
    + '<p style="font-size:9pt;color:#888;">'
    + selected.length + ' block' + (selected.length!==1?'s':'') + ' selected \u00b7 Source: ' + escHtml(location.href)
    + '</p>'
    + '</body></html>';

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function(){ win.print(); }, 500);
  closePanel();
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════
   CLOSE & CLEANUP
══════════════════════════════════════ */
function cleanup() {
  deactivateTapMode();
  clearAll();
  document.removeEventListener('keydown', onKey);
}
function closePanel() {
  cleanup();
  var p = document.getElementById(PID); if (p) p.remove();
  var s = document.getElementById(SID); if (s) s.remove();
}
document.getElementById('__ps10Cls').addEventListener('click', closePanel);

/* Swipe down to close */
var touchStartY = 0;
document.getElementById('__ps10Hdl').addEventListener('touchstart', function(e){
  touchStartY = e.touches[0].clientY;
}, {passive:true});
document.getElementById('__ps10Hdl').addEventListener('touchend', function(e){
  if (e.changedTouches[0].clientY - touchStartY > 60) closePanel();
}, {passive:true});

/* ══════════════════════════════════════
   KEYBOARD
══════════════════════════════════════ */
function onKey(e) {
  if (e.key === 'Escape') closePanel();
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') document.getElementById('__ps10BtnPrint').click();
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') document.getElementById('__ps10BtnUndo').click();
}
document.addEventListener('keydown', onKey);

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
if (mode === 'tap') activateTapMode();
updatePanel();

})();
