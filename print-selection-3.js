(function () {
'use strict';

/* ══════════════════ GUARD ══════════════════ */
var NS = '__ps12';
if (document.getElementById(NS+'Mini')) {
  ['Mini','Sheet','Style','Tip','Font'].forEach(function(s){
    var el=document.getElementById(NS+s); if(el) el.remove();
  });
  _cleanupGlobal(); return;
}

/* ══════════════════ FONT ══════════════════ */
if (!document.getElementById(NS+'Font')) {
  var _fl=document.createElement('link');
  _fl.id=NS+'Font'; _fl.rel='stylesheet';
  _fl.href='https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap';
  document.head.appendChild(_fl);
}

/* ══════════════════ STATE ══════════════════ */
var selected   = [];
var undoStack  = [];
var pending    = null;   /* element previewed (orange) */
var panelState = 'mini'; /* 'mini' | 'full' */
var mode       = 'tap';  /* 'tap' | 'text' */
var textSel    = '';
var tipTimer   = null;

/* Print options */
var printOpts = {
  fontSize: '13', paperSize: 'A4',
  showSource: true, preserveStyle: true
};

/* Detect existing text selection */
var _ws = window.getSelection();
if (_ws && _ws.toString().trim().length > 20) {
  textSel = _ws.toString().trim(); mode = 'text';
}

/* ══════════════════ SMART BLOCK FINDER ══════════════════
   Caps at 55% viewport height → never grabs full-poem wrappers
   Prefers smallest meaningful ancestor
═══════════════════════════════════════════════════════════ */
function findBlock(el) {
  var VH = window.innerHeight, VW = window.innerWidth;
  var INLINE  = 'P,H1,H2,H3,H4,H5,H6,LI,BLOCKQUOTE,PRE,DT,DD,FIGCAPTION,CAPTION,TD,TH'.split(',');
  var SECTION = 'ARTICLE,SECTION,FIGURE,TABLE,DETAILS'.split(',');
  var best = null, cur = el, depth = 0;

  while (cur && cur !== document.body && depth < 14) {
    var id = cur.id || '';
    if (id === NS+'Mini' || id === NS+'Sheet' || id === NS+'Tip') break;
    var tag = (cur.tagName||'').toUpperCase();
    var r   = cur.getBoundingClientRect();
    var txt = (cur.innerText||'').trim();
    if (r.width===0 && r.height===0) { cur=cur.parentElement; depth++; continue; }

    var tooBig = r.height > VH*0.55 || (r.width > VW*0.9 && r.height > VH*0.22);

    if (INLINE.indexOf(tag)  !== -1 && !tooBig) return cur;
    if (SECTION.indexOf(tag) !== -1 && !tooBig) return cur;

    if ((tag==='DIV'||tag==='SPAN') && txt.length>10 && !tooBig) {
      best = cur;
      var par = cur.parentElement;
      if (par) {
        var pr = par.getBoundingClientRect();
        if (pr.height > VH*0.55) return best;
      }
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

/* ══════════════════ STANZA SPLITTER ══════════════════ */
function splitStanzas(el) {
  var parts=[];
  var pch = el.querySelectorAll(':scope > p');
  if (pch.length>1){ pch.forEach(function(p){parts.push(p);}); return parts; }
  var dch = el.querySelectorAll(':scope > div');
  if (dch.length>1){
    dch.forEach(function(d){ if((d.innerText||'').trim().length>5) parts.push(d); });
    if (parts.length>1) return parts;
  }
  var htm = el.innerHTML;
  if (/<br\s*\/?>\s*<br/i.test(htm)) {
    htm.split(/<br\s*\/?>\s*<br\s*\/?>/i).forEach(function(c){
      var d=document.createElement('div'); d.innerHTML=c;
      if(d.innerText.trim().length>3) parts.push(d);
    });
    if (parts.length>1) return parts;
  }
  return [el];
}

/* ══════════════════ HIGHLIGHT ══════════════════ */
function _sel(el){
  el.setAttribute('data-ps12','s');
  el.style.outline='3px solid #7c3aed'; el.style.outlineOffset='3px';
  el.style.backgroundColor='rgba(109,40,217,0.09)'; el.style.borderRadius='4px';
}
function _pend(el){
  el.setAttribute('data-ps12','p');
  el.style.outline='2.5px dashed #f59e0b'; el.style.outlineOffset='3px';
  el.style.backgroundColor='rgba(245,158,11,0.08)'; el.style.borderRadius='4px';
}
function _unmark(el){
  if(!el) return;
  el.removeAttribute('data-ps12');
  el.style.outline=el.style.outlineOffset=el.style.backgroundColor=el.style.borderRadius='';
}
function _clearPend(){ if(pending){_unmark(pending);pending=null;} }

/* ══════════════════ SVG ICONS ══════════════════ */
var I = {
  cut:    '<svg w="15" h="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  print:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  up:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  down:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  undo:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  trash:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
  copy:   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  split:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 6l7-3 7 3M5 18l7 3 7-3"/></svg>',
  cog:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  text:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  check:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

/* ══════════════════ BUILD DOM ══════════════════ */

/* 1. MINI FLOATING PILL */
var mini = document.createElement('div');
mini.id = NS+'Mini';
mini.innerHTML =
  '<button id="'+NS+'MiniMain" title="Click to expand panel">'+
    '<div id="'+NS+'MiniIco">'+I.cut+'</div>'+
    '<div id="'+NS+'MiniInfo">'+
      '<span id="'+NS+'MiniCnt">0</span>'+
      '<span id="'+NS+'MiniLbl"> blocks</span>'+
    '</div>'+
    '<div id="'+NS+'MiniArrow">'+I.up+'</div>'+
  '</button>'+
  '<button id="'+NS+'MiniPrint" title="Print now">'+I.print+'</button>';
document.body.appendChild(mini);

/* 2. CONTEXT TOOLTIP (appears near tap point) */
var tip = document.createElement('div');
tip.id = NS+'Tip';
tip.innerHTML =
  '<div id="'+NS+'TipPrev"></div>'+
  '<div id="'+NS+'TipBtns">'+
    '<button id="'+NS+'TipAdd">'+I.check+' Add</button>'+
    '<button id="'+NS+'TipBig">'+I.up+' Bigger</button>'+
    '<button id="'+NS+'TipSml">'+I.down+' Smaller</button>'+
    '<button id="'+NS+'TipX">&#x2715;</button>'+
  '</div>';
document.body.appendChild(tip);

/* 3. FULL BOTTOM SHEET */
var sheet = document.createElement('div');
sheet.id = NS+'Sheet';
sheet.innerHTML =
  /* Drag handle */
  '<div id="'+NS+'Hdl"><div id="'+NS+'HdlBar"></div></div>'+

  /* Header */
  '<div id="'+NS+'Hdr">'+
    '<div id="'+NS+'HdrL">'+
      '<div id="'+NS+'HdrIco">'+I.cut+'</div>'+
      '<div>'+
        '<div id="'+NS+'HdrTtl">Print Selection</div>'+
        '<div id="'+NS+'HdrSub">Select blocks \u2022 Review \u2022 Print</div>'+
      '</div>'+
    '</div>'+
    '<div id="'+NS+'HdrR">'+
      '<button id="'+NS+'BtnCog" title="Print options">'+I.cog+'</button>'+
      '<button id="'+NS+'BtnMin" title="Minimise — keep selecting">'+I.down+' Minimise</button>'+
      '<button id="'+NS+'BtnCls">&#x2715;</button>'+
    '</div>'+
  '</div>'+

  /* Mode tabs */
  '<div id="'+NS+'Tabs">'+
    '<button class="'+NS+'Tab _on" data-m="tap">'+I.cut+' Tap Pick</button>'+
    '<button class="'+NS+'Tab" data-m="text">'+I.text+' Text Sel</button>'+
  '</div>'+

  /* TAP PANE */
  '<div id="'+NS+'TapPane">'+

    /* Instruction bar */
    '<div id="'+NS+'Inst">'+
      '<span id="'+NS+'InstIco">\uD83D\uDC46</span>'+
      '<div id="'+NS+'InstTxt">'+
        '<strong>Minimise this panel first</strong>, then tap blocks on the page. '+
        'First tap = preview (orange), second tap = confirm (purple).'+
      '</div>'+
      '<button id="'+NS+'InstMin">'+I.down+' Go</button>'+
    '</div>'+

    /* Selected blocks list */
    '<div id="'+NS+'List">'+
      '<div id="'+NS+'ListHdr">'+
        '<span id="'+NS+'ListLbl">Selected blocks</span>'+
        '<div id="'+NS+'ListHdrR">'+
          '<span id="'+NS+'ListCnt" class="'+NS+'Badge">0</span>'+
          '<button id="'+NS+'BtnAll">&#x2714; Select all</button>'+
          '<button id="'+NS+'BtnUndo">'+I.undo+' Undo</button>'+
          '<button id="'+NS+'BtnClr">'+I.trash+'</button>'+
        '</div>'+
      '</div>'+
      '<div id="'+NS+'ListItems"><div id="'+NS+'ListEmpty">No blocks selected yet. Minimise and tap content on the page.</div></div>'+
    '</div>'+

    /* Adjust row */
    '<div id="'+NS+'Adj" style="display:none">'+
      '<span class="'+NS+'SLbl">Adjust last block</span>'+
      '<div id="'+NS+'AdjBtns">'+
        '<button class="'+NS+'ABtn" id="'+NS+'AExp">'+I.up+' Expand</button>'+
        '<button class="'+NS+'ABtn" id="'+NS+'AShr">'+I.down+' Shrink</button>'+
        '<button class="'+NS+'ABtn" id="'+NS+'ASpl">'+I.split+' Split stanzas</button>'+
        '<button class="'+NS+'ABtn" id="'+NS+'ACpy">'+I.copy+' Copy text</button>'+
      '</div>'+
    '</div>'+

  '</div>'+ /* /TapPane */

  /* TEXT PANE */
  '<div id="'+NS+'TextPane" style="display:none">'+
    '<div id="'+NS+'TxtPrev"></div>'+
    '<div id="'+NS+'TxtMeta"></div>'+
    '<div id="'+NS+'TxtNote">\uD83D\uDCA1 On Android: long-press a word \u2192 drag handles to extend \u2192 re-open bookmarklet or tap Refresh below.</div>'+
    '<button id="'+NS+'TxtRef">\u21bb Refresh selection</button>'+
  '</div>'+

  /* PRINT OPTIONS PANE (hidden by default) */
  '<div id="'+NS+'OptsPane" style="display:none">'+
    '<div class="'+NS+'OptRow">'+
      '<label class="'+NS+'OptLbl">Font size</label>'+
      '<div class="'+NS+'OptBtns" id="'+NS+'FontBtns">'+
        '<button class="'+NS+'OB" data-v="11">Small</button>'+
        '<button class="'+NS+'OB _on" data-v="13">Normal</button>'+
        '<button class="'+NS+'OB" data-v="16">Large</button>'+
      '</div>'+
    '</div>'+
    '<div class="'+NS+'OptRow">'+
      '<label class="'+NS+'OptLbl">Paper</label>'+
      '<div class="'+NS+'OptBtns" id="'+NS+'PaperBtns">'+
        '<button class="'+NS+'OB _on" data-v="A4">A4</button>'+
        '<button class="'+NS+'OB" data-v="Letter">Letter</button>'+
      '</div>'+
    '</div>'+
    '<div class="'+NS+'OptRow">'+
      '<label class="'+NS+'OptLbl">Options</label>'+
      '<div class="'+NS+'OptBtns">'+
        '<button class="'+NS+'OB _tog _on" id="'+NS+'OptSrc">Source URL</button>'+
        '<button class="'+NS+'OB _tog _on" id="'+NS+'OptSty">Page styles</button>'+
      '</div>'+
    '</div>'+
  '</div>'+

  /* ACTION FOOTER */
  '<div id="'+NS+'Footer">'+
    '<button class="'+NS+'FBtn _ghost" id="'+NS+'FCpy">'+I.copy+' Copy text</button>'+
    '<button class="'+NS+'FBtn _primary" id="'+NS+'FPrn">'+I.print+' <span id="'+NS+'FPrnLbl">Print</span></button>'+
  '</div>';

document.body.appendChild(sheet);

/* ══════════════════ STYLES ══════════════════ */
var styleEl = document.createElement('style');
styleEl.id = NS+'Style';
styleEl.textContent = [

/* Reset */
'[id^="'+NS+'"] *,[id^="'+NS+'"] *::before,[id^="'+NS+'"] *::after{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;font-family:"Outfit","Segoe UI",sans-serif;}',

/* ═══ MINI PILL ═══ */
'#'+NS+'Mini{position:fixed;bottom:72px;right:16px;z-index:2147483646;display:flex;align-items:center;gap:4px;animation:ps12pop .3s cubic-bezier(.34,1.56,.64,1);}',
'@keyframes ps12pop{from{opacity:0;transform:scale(.6) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}',
'#'+NS+'MiniMain{display:flex;align-items:center;gap:8px;height:48px;padding:0 16px 0 12px;background:rgba(10,10,18,0.9);backdrop-filter:blur(16px) saturate(1.5);border:1px solid rgba(255,255,255,0.1);border-radius:99px;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.04) inset;transition:transform .15s,box-shadow .15s;}',
'#'+NS+'MiniMain:active{transform:scale(.95);}',
'#'+NS+'MiniIco{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'#'+NS+'MiniInfo{display:flex;align-items:baseline;gap:2px;}',
'#'+NS+'MiniCnt{font-size:18px;font-weight:700;color:#c4b5fd;transition:transform .2s cubic-bezier(.34,1.56,.64,1);}',
'#'+NS+'MiniLbl{font-size:12px;color:rgba(255,255,255,0.4);}',
'#'+NS+'MiniArrow{color:rgba(255,255,255,0.4);display:flex;align-items:center;margin-left:2px;}',
'#'+NS+'MiniPrint{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#4338ca);border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 20px rgba(109,40,217,0.5);transition:transform .15s,box-shadow .15s;}',
'#'+NS+'MiniPrint:active{transform:scale(.92);box-shadow:0 2px 8px rgba(109,40,217,0.3);}',

/* ═══ CONTEXT TOOLTIP ═══ */
'#'+NS+'Tip{display:none;position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);width:calc(100vw - 32px);max-width:360px;background:rgba(12,12,20,0.97);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:12px 14px;box-shadow:0 16px 48px rgba(0,0,0,0.7);animation:ps12tipIn .2s cubic-bezier(.16,1,.3,1);}',
'@keyframes ps12tipIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}',
'#'+NS+'TipPrev{font-size:11.5px;color:rgba(255,255,255,0.45);font-family:"JetBrains Mono",monospace;margin-bottom:10px;max-height:48px;overflow:hidden;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}',
'#'+NS+'TipBtns{display:flex;gap:6px;flex-wrap:wrap;}',
'#'+NS+'TipBtns button{padding:8px 13px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;-webkit-tap-highlight-color:transparent;transition:all .12s;flex:1;justify-content:center;}',
'#'+NS+'TipAdd{background:rgba(109,40,217,0.3)!important;border-color:rgba(109,40,217,0.7)!important;color:#ddd6fe!important;}',
'#'+NS+'TipX{flex:0!important;padding:8px 12px!important;color:rgba(255,255,255,0.3)!important;}',
'#'+NS+'TipBtns button:active{transform:scale(.95);}',

/* ═══ BOTTOM SHEET ═══ */
'#'+NS+'Sheet{position:fixed;bottom:0;left:0;right:0;z-index:2147483645;background:#0a0a12;border-top:1px solid rgba(255,255,255,0.07);border-radius:22px 22px 0 0;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 -20px 60px rgba(0,0,0,0.7);transform:translateY(110%);transition:transform .35s cubic-bezier(.16,1,.3,1);}',
'#'+NS+'Sheet._open{transform:translateY(0);}',

/* Handle */
'#'+NS+'Hdl{flex-shrink:0;display:flex;justify-content:center;padding:10px 0 6px;cursor:grab;}',
'#'+NS+'HdlBar{width:36px;height:4px;background:rgba(255,255,255,0.1);border-radius:99px;}',

/* Header */
'#'+NS+'Hdr{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:2px 16px 12px;}',
'#'+NS+'HdrL{display:flex;align-items:center;gap:11px;}',
'#'+NS+'HdrIco{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 16px rgba(109,40,217,0.5);}',
'#'+NS+'HdrTtl{font-size:16px;font-weight:700;color:#f0f0fa;letter-spacing:-.3px;}',
'#'+NS+'HdrSub{font-size:10.5px;color:rgba(255,255,255,0.25);margin-top:1px;}',
'#'+NS+'HdrR{display:flex;align-items:center;gap:6px;}',
'#'+NS+'BtnCog,#'+NS+'BtnMin{padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.38);font-size:11.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .15s;white-space:nowrap;}',
'#'+NS+'BtnCog:hover,#'+NS+'BtnMin:hover{border-color:rgba(109,40,217,0.45);color:#c4b5fd;}',
'#'+NS+'BtnCls{width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.4);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}',
'#'+NS+'BtnCls:active{background:rgba(239,68,68,0.2);color:#f87171;}',

/* Tabs */
'#'+NS+'Tabs{flex-shrink:0;display:flex;gap:5px;padding:0 16px 12px;}',
'.'+NS+'Tab{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:10px;border-radius:11px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.33);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;}',
'.'+NS+'Tab._on{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.55);color:#c4b5fd;}',

/* Panes scroll */
'#'+NS+'TapPane,#'+NS+'TextPane,#'+NS+'OptsPane{overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;}',

/* Instruction banner */
'#'+NS+'Inst{margin:0 16px 12px;display:flex;align-items:center;gap:10px;background:rgba(109,40,217,0.1);border:1px solid rgba(109,40,217,0.25);border-radius:13px;padding:11px 13px;}',
'#'+NS+'InstIco{font-size:20px;flex-shrink:0;}',
'#'+NS+'InstTxt{flex:1;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;}',
'#'+NS+'InstTxt strong{color:rgba(255,255,255,0.7);}',
'#'+NS+'InstMin{padding:8px 14px;border-radius:9px;border:none;background:linear-gradient(135deg,#6d28d9,#4338ca);color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px;flex-shrink:0;}',

/* List */
'#'+NS+'List{margin:0 16px 12px;border:1px solid rgba(255,255,255,0.07);border-radius:13px;overflow:hidden;}',
'#'+NS+'ListHdr{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.05);}',
'#'+NS+'ListLbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,0.28);}',
'#'+NS+'ListHdrR{display:flex;align-items:center;gap:5px;}',
'.'+NS+'Badge{background:rgba(109,40,217,0.3);color:#c4b5fd;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;}',
'#'+NS+'ListHdrR button{padding:4px 9px;border-radius:7px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.38);font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;-webkit-tap-highlight-color:transparent;}',
'#'+NS+'ListItems{max-height:160px;overflow-y:auto;}',
'#'+NS+'ListEmpty{padding:20px;text-align:center;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6;}',
'.'+NS+'SItem{display:flex;align-items:center;gap:8px;padding:8px 13px;border-bottom:1px solid rgba(255,255,255,0.04);}',
'.'+NS+'SItem:last-child{border-bottom:none;}',
'.'+NS+'SNum{width:20px;height:20px;border-radius:50%;background:rgba(109,40,217,0.22);color:#c4b5fd;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'.'+NS+'STxt{flex:1;font-size:11.5px;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
'.'+NS+'STag{font-size:9px;color:rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);border-radius:4px;padding:1px 5px;flex-shrink:0;font-family:"JetBrains Mono",monospace;}',
'.'+NS+'SDel{width:22px;height:22px;border-radius:50%;border:none;background:rgba(239,68,68,0.1);color:rgba(239,68,68,0.5);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;}',

/* Adjust */
'#'+NS+'Adj{margin:0 16px 12px;}',
'.'+NS+'SLbl{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,0.25);margin-bottom:7px;}',
'#'+NS+'AdjBtns{display:flex;gap:5px;flex-wrap:wrap;}',
'.'+NS+'ABtn{padding:8px 13px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.42);font-size:11.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;-webkit-tap-highlight-color:transparent;transition:all .12s;}',
'.'+NS+'ABtn:hover{border-color:rgba(109,40,217,0.5);color:#c4b5fd;}',
'.'+NS+'ABtn:active{transform:scale(.95);}',

/* Text pane */
'#'+NS+'TextPane{padding:0 16px 12px;display:none;flex-direction:column;gap:10px;}',
'#'+NS+'TxtPrev{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 14px;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.65;max-height:100px;overflow-y:auto;font-family:"JetBrains Mono",monospace;white-space:pre-wrap;word-break:break-word;}',
'#'+NS+'TxtMeta{font-size:11px;color:rgba(255,255,255,0.25);}',
'#'+NS+'TxtNote{font-size:11.5px;color:rgba(255,255,255,0.28);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 12px;line-height:1.55;}',
'#'+NS+'TxtRef{padding:10px;border-radius:10px;border:1.5px solid rgba(109,40,217,0.35);background:rgba(109,40,217,0.1);color:#c4b5fd;font-size:12.5px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;}',

/* Options pane */
'#'+NS+'OptsPane{padding:0 16px 12px;display:none;flex-direction:column;gap:12px;}',
'.'+NS+'OptRow{display:flex;align-items:center;gap:10px;}',
'.'+NS+'OptLbl{font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:.06em;width:52px;flex-shrink:0;}',
'.'+NS+'OptBtns{display:flex;gap:4px;flex-wrap:wrap;}',
'.'+NS+'OB{padding:6px 12px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.35);font-size:11.5px;font-weight:500;cursor:pointer;transition:all .12s;-webkit-tap-highlight-color:transparent;}',
'.'+NS+'OB._on{background:rgba(109,40,217,0.22);border-color:rgba(109,40,217,0.6);color:#c4b5fd;}',

/* Footer */
'#'+NS+'Footer{flex-shrink:0;display:flex;gap:8px;padding:10px 16px 28px;border-top:1px solid rgba(255,255,255,0.05);}',
'.'+NS+'FBtn{flex:1;padding:13px;border-radius:14px;font-size:13.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;-webkit-tap-highlight-color:transparent;transition:all .15s;}',
'.'+NS+'FBtn._ghost{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);}',
'.'+NS+'FBtn._primary{background:linear-gradient(135deg,#6d28d9,#4338ca);border:none;color:#fff;box-shadow:0 6px 24px rgba(109,40,217,0.45);}',
'.'+NS+'FBtn:active{transform:scale(.97);}',

].join('\n');
document.head.appendChild(styleEl);

/* ══════════════════ PANEL OPEN / CLOSE ══════════════════ */
function openSheet() {
  panelState = 'full';
  sheet.classList.add('_open');
  document.getElementById(NS+'MiniArrow').innerHTML = I.down;
  updateUI();
}
function minimizeSheet() {
  panelState = 'mini';
  sheet.classList.remove('_open');
  document.getElementById(NS+'MiniArrow').innerHTML = I.up;
}
function closeAll() {
  minimizeSheet();
  setTimeout(function(){
    var m=document.getElementById(NS+'Mini');
    var s=document.getElementById(NS+'Sheet');
    var t=document.getElementById(NS+'Tip');
    var st=document.getElementById(NS+'Style');
    if(m)m.remove(); if(s)s.remove(); if(t)t.remove(); if(st)st.remove();
    _cleanupGlobal();
  }, 350);
}

document.getElementById(NS+'MiniMain').addEventListener('click', function(){ openSheet(); });
document.getElementById(NS+'BtnMin').addEventListener('click', minimizeSheet);
document.getElementById(NS+'InstMin').addEventListener('click', minimizeSheet);
document.getElementById(NS+'BtnCls').addEventListener('click', closeAll);
document.getElementById(NS+'MiniPrint').addEventListener('click', function(){ doPrint(); });

/* ══════════════════ TAP HANDLER ══════════════════ */
function onTap(e) {
  var m=document.getElementById(NS+'Mini'),
      s=document.getElementById(NS+'Sheet'),
      t=document.getElementById(NS+'Tip');
  if((m&&m.contains(e.target))||(s&&s.contains(e.target))||(t&&t.contains(e.target))) return;
  e.preventDefault(); e.stopPropagation();

  var block = findBlock(e.target);
  if (!block) return;

  if (block === pending) {
    /* 2nd tap: CONFIRM */
    _unmark(block);
    undoStack.push({type:'add',el:block});
    selected.push(block); _sel(block);
    _clearPend(); hideTip();
    pulseMiniCount();
  } else {
    /* 1st tap: PREVIEW */
    _clearPend(); hideTip();
    pending = block; _pend(block);
    showTip(e.clientY, block);
  }
}

/* ══════════════════ CONTEXT TOOLTIP ══════════════════ */
function showTip(tapY, el) {
  var t = document.getElementById(NS+'Tip');
  var VH = window.innerHeight;
  /* Position: above tap if room, else below */
  var TOP = tapY - 130;
  if (TOP < 10) TOP = tapY + 60;
  if (TOP + 120 > VH - 80) TOP = VH - 220;
  t.style.top = Math.max(10,TOP)+'px';
  t.style.display = 'block';
  var prev = (el.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
  document.getElementById(NS+'TipPrev').textContent = prev || '(no text)';
  /* Auto-dismiss after 6s */
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 6000);
}
function hideTip(){
  var t=document.getElementById(NS+'Tip');
  if(t) t.style.display='none';
  clearTimeout(tipTimer);
}

/* Tooltip buttons */
document.getElementById(NS+'TipAdd').addEventListener('click',function(){
  if(!pending)return;
  _unmark(pending); undoStack.push({type:'add',el:pending});
  selected.push(pending); _sel(pending);
  _clearPend(); hideTip(); pulseMiniCount(); updateUI();
});
document.getElementById(NS+'TipX').addEventListener('click',function(){ _clearPend(); hideTip(); });
document.getElementById(NS+'TipBig').addEventListener('click',function(){
  if(!pending)return;
  var b=expandEl(pending); _unmark(pending); pending=b; _pend(b);
  document.getElementById(NS+'TipPrev').textContent=(b.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
});
document.getElementById(NS+'TipSml').addEventListener('click',function(){
  if(!pending)return;
  var s2=shrinkEl(pending); if(s2===pending)return;
  _unmark(pending); pending=s2; _pend(s2);
  document.getElementById(NS+'TipPrev').textContent=(s2.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
});

/* ══════════════════ UPDATE UI ══════════════════ */
function updateUI() {
  var n = selected.length;
  /* Mini pill */
  var mc=document.getElementById(NS+'MiniCnt');
  if(mc) mc.textContent = n;
  /* Sheet print button */
  var pl=document.getElementById(NS+'FPrnLbl');
  if(pl) pl.textContent = mode==='text' ? 'Print text' : (n===0?'Nothing selected':'Print '+n+' block'+(n!==1?'s':''));
  var pb=document.getElementById(NS+'FPrn');
  if(pb) pb.style.opacity=(mode==='text'&&textSel)||(mode==='tap'&&n>0)?'1':'0.45';
  /* List badge */
  var lc=document.getElementById(NS+'ListCnt'); if(lc) lc.textContent=n;
  /* Adjust row */
  var adj=document.getElementById(NS+'Adj'); if(adj) adj.style.display=n>0?'block':'none';
  /* Rebuild list */
  rebuildList();
  if(mode==='text') refreshTextPane();
}

function pulseMiniCount(){
  var mc=document.getElementById(NS+'MiniCnt'); if(!mc)return;
  mc.style.transform='scale(1.5)';
  setTimeout(function(){mc.style.transform='';},200);
  updateUI();
}

function rebuildList(){
  var container=document.getElementById(NS+'ListItems'); if(!container)return;
  if(selected.length===0){ container.innerHTML='<div id="'+NS+'ListEmpty">No blocks selected yet. Minimise and tap content on the page.</div>'; return; }
  container.innerHTML='';
  selected.forEach(function(el,i){
    var txt=(el.innerText||'').trim().slice(0,55).replace(/\s+/g,' ');
    var tag=(el.tagName||'div').toLowerCase();
    var row=document.createElement('div'); row.className=NS+'SItem';
    row.innerHTML='<div class="'+NS+'SNum">'+(i+1)+'</div>'
      +'<div class="'+NS+'STxt">'+escH(txt)+'</div>'
      +'<span class="'+NS+'STag">&lt;'+tag+'&gt;</span>'
      +'<button class="'+NS+'SDel" data-i="'+i+'">\u2715</button>';
    container.appendChild(row);
  });
  container.querySelectorAll('.'+NS+'SDel').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var i=parseInt(this.getAttribute('data-i'),10);
      if(selected[i]){_unmark(selected[i]); selected.splice(i,1); updateUI();}
    });
  });
}

function refreshTextPane(){
  var prev=document.getElementById(NS+'TxtPrev');
  var meta=document.getElementById(NS+'TxtMeta');
  if(prev) prev.textContent=textSel||'No text selected yet.\nLong-press on the page \u2192 extend selection \u2192 re-open bookmarklet.';
  if(meta&&textSel){ var w=textSel.trim().split(/\s+/).length; meta.textContent=w+' words \u00b7 ~'+Math.ceil(w/200)+' min read \u00b7 '+textSel.length+' chars'; }
}

/* ══════════════════ MODE TABS ══════════════════ */
document.querySelectorAll('.'+NS+'Tab').forEach(function(btn){
  btn.addEventListener('click',function(){
    mode=this.getAttribute('data-m');
    document.querySelectorAll('.'+NS+'Tab').forEach(function(b){b.classList.remove('_on');});
    this.classList.add('_on');
    document.getElementById(NS+'TapPane').style.display   = mode==='tap'  ? 'block':'none';
    document.getElementById(NS+'TextPane').style.display  = mode==='text' ? 'flex':'none';
    document.getElementById(NS+'OptsPane').style.display  = 'none';
    if(mode==='text'){ var s3=window.getSelection(); if(s3&&s3.toString().trim().length>0) textSel=s3.toString().trim(); }
    updateUI();
  });
});

/* ══════════════════ OPTIONS PANEL TOGGLE ══════════════════ */
document.getElementById(NS+'BtnCog').addEventListener('click',function(){
  var op=document.getElementById(NS+'OptsPane');
  var tp=document.getElementById(NS+'TapPane');
  var txp=document.getElementById(NS+'TextPane');
  var showing = op.style.display!=='none';
  op.style.display=showing?'none':'flex';
  tp.style.display=showing?(mode==='tap'?'block':'none'):'none';
  txp.style.display=showing?(mode==='text'?'flex':'none'):'none';
});

/* Option buttons */
document.getElementById(NS+'FontBtns').addEventListener('click',function(e){
  var b=e.target.closest('.'+NS+'OB'); if(!b)return;
  this.querySelectorAll('.'+NS+'OB').forEach(function(x){x.classList.remove('_on');}); b.classList.add('_on');
  printOpts.fontSize=b.getAttribute('data-v');
});
document.getElementById(NS+'PaperBtns').addEventListener('click',function(e){
  var b=e.target.closest('.'+NS+'OB'); if(!b)return;
  this.querySelectorAll('.'+NS+'OB').forEach(function(x){x.classList.remove('_on');}); b.classList.add('_on');
  printOpts.paperSize=b.getAttribute('data-v');
});
document.getElementById(NS+'OptSrc').addEventListener('click',function(){
  printOpts.showSource=!printOpts.showSource; this.classList.toggle('_on',printOpts.showSource);
});
document.getElementById(NS+'OptSty').addEventListener('click',function(){
  printOpts.preserveStyle=!printOpts.preserveStyle; this.classList.toggle('_on',printOpts.preserveStyle);
});

/* ══════════════════ SELECT ALL / UNDO / CLEAR ══════════════════ */
document.getElementById(NS+'BtnAll').addEventListener('click',function(){
  _clearAll();
  var p2=document.getElementById(NS+'Sheet');
  document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figure,table').forEach(function(el){
    if(p2&&p2.contains(el)) return;
    if(el.offsetParent===null) return;
    if((el.innerText||'').trim().length<5) return;
    if(selected.indexOf(el)===-1){selected.push(el);_sel(el);}
  });
  updateUI();
});
document.getElementById(NS+'BtnUndo').addEventListener('click',function(){
  var last=undoStack.pop(); if(!last)return;
  if(last.type==='add'){var i=selected.indexOf(last.el);if(i!==-1){selected.splice(i,1);_unmark(last.el);}}
  updateUI();
});
document.getElementById(NS+'BtnClr').addEventListener('click',function(){ _clearAll(); updateUI(); });
function _clearAll(){ _clearPend(); hideTip(); selected.forEach(function(el){_unmark(el);}); selected=[]; undoStack=[]; }

/* ══════════════════ ADJUST LAST BLOCK ══════════════════ */
document.getElementById(NS+'AExp').addEventListener('click',function(){
  if(!selected.length)return;
  var i=selected.length-1,cur=selected[i],b=expandEl(cur);
  if(b!==cur){_unmark(cur);selected[i]=b;_sel(b);updateUI();}
});
document.getElementById(NS+'AShr').addEventListener('click',function(){
  if(!selected.length)return;
  var i=selected.length-1,cur=selected[i],b=shrinkEl(cur);
  if(b!==cur){_unmark(cur);selected[i]=b;_sel(b);updateUI();}
});
document.getElementById(NS+'ASpl').addEventListener('click',function(){
  if(!selected.length)return;
  var i=selected.length-1,cur=selected[i],parts=splitStanzas(cur);
  if(parts.length<=1){return;}
  _unmark(cur); selected.splice(i,1);
  parts.forEach(function(p){selected.push(p);_sel(p);}); updateUI();
});
document.getElementById(NS+'ACpy').addEventListener('click',function(){
  if(!selected.length)return;
  var txt=selected.map(function(el){return (el.innerText||'').trim();}).join('\n\n');
  _copyText(txt,document.getElementById(NS+'ACpy'));
});

/* ══════════════════ TEXT MODE ══════════════════ */
document.getElementById(NS+'TxtRef').addEventListener('click',function(){
  var s4=window.getSelection(); if(s4&&s4.toString().trim().length>0) textSel=s4.toString().trim();
  refreshTextPane(); updateUI();
});

/* ══════════════════ COPY TEXT ══════════════════ */
document.getElementById(NS+'FCpy').addEventListener('click',function(){
  var txt = mode==='text' ? textSel :
    selected.map(function(el){return (el.innerText||'').trim();}).join('\n\n');
  if(!txt) return;
  _copyText(txt, document.getElementById(NS+'FCpy'));
});
function _copyText(txt,btn){
  function onDone(){ if(btn){var orig=btn.textContent; btn.textContent='\u2713 Copied!'; setTimeout(function(){btn.innerHTML=I.copy+' Copy text';},2000);} }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(onDone).catch(function(){_fbCopy(txt);onDone();});
  } else { _fbCopy(txt); onDone(); }
}
function _fbCopy(t){ var ta=document.createElement('textarea'); ta.value=t; ta.style.cssText='position:fixed;opacity:0;top:0;left:0;'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }

/* ══════════════════ PRINT ══════════════════ */
document.getElementById(NS+'FPrn').addEventListener('click', doPrint);
function doPrint(){ mode==='text' ? printText() : printBlocks(); }

function printText(){
  if(!textSel) return;
  var win=window.open('','_blank','width=800,height=600,toolbar=0,menubar=0,location=0,scrollbars=1');
  if(!win){alert('Allow pop-ups and try again.');return;}
  var margin = printOpts.paperSize==='Letter' ? '1in' : '25mm';
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print Selection</title>'
    +'<style>body{font-family:Georgia,serif;font-size:'+printOpts.fontSize+'pt;line-height:1.8;max-width:760px;margin:40px auto;color:#111;padding:0 24px;}'
    +'pre{white-space:pre-wrap;}footer{margin-top:36px;font-size:9pt;color:#aaa;border-top:1px solid #eee;padding-top:10px;}'
    +'@media print{@page{margin:'+margin+' '+margin+'}body{margin:0;}}</style></head><body>'
    +'<pre style="font-family:inherit;background:none;padding:0;">'+escH(textSel)+'</pre>'
    +(printOpts.showSource?'<footer>Source: '+escH(location.href)+'</footer>':'')
    +'</body></html>');
  win.document.close(); win.focus(); setTimeout(function(){win.print();},400);
  minimizeSheet();
}

function printBlocks(){
  if(!selected.length) return;
  var pageCSS='';
  if(printOpts.preserveStyle){
    try{Array.prototype.slice.call(document.styleSheets).forEach(function(sh){
      try{Array.prototype.slice.call(sh.cssRules||sh.rules||[]).forEach(function(r){pageCSS+=r.cssText+'\n';});}catch(e){}
    });}catch(e){}
  }
  var parts=selected.map(function(el){
    var c=el.cloneNode(true); c.removeAttribute('data-ps12');
    c.style.outline=c.style.outlineOffset=c.style.backgroundColor=c.style.borderRadius='';
    return '<div class="ps12blk">'+c.outerHTML+'</div>';
  });
  var margin=printOpts.paperSize==='Letter'?'1in':'25mm';
  var win=window.open('','_blank','width=820,height=700,toolbar=0,menubar=0,location=0,scrollbars=1');
  if(!win){alert('Allow pop-ups and try again.');return;}
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8">'
    +'<base href="'+location.origin+'">'
    +'<title>Print Selection \u2014 '+escH(document.title||location.hostname)+'</title>'
    +(printOpts.preserveStyle?'<style>'+pageCSS+'</style>':'')
    +'<style>body{max-width:800px;margin:0 auto;padding:24px;font-size:'+printOpts.fontSize+'pt;}.ps12blk{margin-bottom:1.5em;}'
    +'footer{margin-top:36px;font-size:9pt;color:#999;border-top:1px solid #eee;padding-top:10px;}'
    +'@media print{@page{margin:'+margin+'}body{padding:0;max-width:none;}a{color:inherit;text-decoration:none;}}'
    +'</style></head><body>'
    +parts.join('\n')
    +(printOpts.showSource?'<footer>'+selected.length+' block'+(selected.length!==1?'s':'')+' \u00b7 <a href="'+escH(location.href)+'">'+escH(location.href)+'</a></footer>':'')
    +'</body></html>');
  win.document.close(); win.focus(); setTimeout(function(){win.print();},500);
  minimizeSheet();
}

/* ══════════════════ SWIPE DOWN HANDLE ══════════════════ */
var _sy=0;
var hdl=document.getElementById(NS+'Hdl');
hdl.addEventListener('touchstart',function(e){_sy=e.touches[0].clientY;},{passive:true});
hdl.addEventListener('touchend',function(e){if(e.changedTouches[0].clientY-_sy>50)minimizeSheet();},{passive:true});

/* ══════════════════ KEYBOARD ══════════════════ */
function _onKey(e){
  if(e.key==='Escape'){if(panelState==='full')minimizeSheet(); else closeAll();}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter') doPrint();
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){var last=undoStack.pop();if(last&&last.type==='add'){var i=selected.indexOf(last.el);if(i!==-1){selected.splice(i,1);_unmark(last.el);}updateUI();}}
}
document.addEventListener('keydown',_onKey);

/* ══════════════════ GLOBAL CLEANUP ══════════════════ */
function _cleanupGlobal(){
  document.removeEventListener('click',onTap,true);
  document.removeEventListener('keydown',_onKey);
  clearTimeout(tipTimer);
  selected.forEach(function(el){_unmark(el);});
  _clearPend();
}

/* ══════════════════ HELPERS ══════════════════ */
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ══════════════════ INIT ══════════════════ */
document.addEventListener('click',onTap,true);
if(mode==='text') openSheet();
updateUI();

})();
