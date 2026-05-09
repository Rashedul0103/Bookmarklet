(function () {
'use strict';

/* ═══════════════════════════════════════════════════════════
   PRINT MASTER BOOKMARKLET  v1.0
   Combines: Print Selection + Print Margins
   ----------------------------------------------------------
   • Mini pill + expandable bottom sheet
   • Tap Pick  (Select / Deselect modes)
   • Text Sel  (native text selection)
   • Margins   (presets, binding side, hole-punch gauge)
   ═══════════════════════════════════════════════════════════ */

var NS = '__ps14';

/* ══════════════════ GUARD ══════════════════ */
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
var pending    = null;
var panelState = 'mini';
var mode       = 'tap';
var tapAction  = 'select';
var textSel    = '';
var tipTimer   = null;

var printOpts = {
  fontSize: '13', paperSize: 'A4',
  showSource: true, preserveStyle: true
};

var marginState = {
  unit: 'mm',
  linked: false,
  bindSide: 'left',
  MM: { t:25.4, r:19.0, b:25.4, l:38.1 }
};
try {
  var sv = JSON.parse(localStorage.getItem(NS+'Margins')||'null');
  if (sv) {
    if (sv.unit)     marginState.unit     = sv.unit;
    if (sv.MM)       marginState.MM       = sv.MM;
    if (sv.bindSide) marginState.bindSide = sv.bindSide;
    if (typeof sv.linked !== 'undefined') marginState.linked = sv.linked;
  }
} catch(e){}

var HOLE_OFFSET_MM = 25.4;
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

var _ws = window.getSelection();
if (_ws && _ws.toString().trim().length > 20) {
  textSel = _ws.toString().trim(); mode = 'text';
}

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

function _sel(el){
  el.setAttribute('data-'+NS,'s');
  el.style.outline='3px solid #7c3aed'; el.style.outlineOffset='3px';
  el.style.backgroundColor='rgba(109,40,217,0.09)'; el.style.borderRadius='4px';
}
function _pend(el){
  el.setAttribute('data-'+NS,'p');
  el.style.outline='2.5px dashed #f59e0b'; el.style.outlineOffset='3px';
  el.style.backgroundColor='rgba(245,158,11,0.08)'; el.style.borderRadius='4px';
}
function _pendRemove(el){
  el.setAttribute('data-'+NS,'r');
  el.style.outline='2.5px dashed #ef4444'; el.style.outlineOffset='3px';
  el.style.backgroundColor='rgba(239,68,68,0.08)'; el.style.borderRadius='4px';
}
function _unmark(el){
  if(!el) return;
  el.removeAttribute('data-'+NS);
  el.style.outline=el.style.outlineOffset=el.style.backgroundColor=el.style.borderRadius='';
}
function _clearPend(){ if(pending){ _unmark(pending.el||pending); pending=null;} }

var I = {
  cut:    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  print:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  up:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  down:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  undo:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  trash:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
  copy:   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  split:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 6l7-3 7 3M5 18l7 3 7-3"/></svg>',
  cog:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  text:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  check:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  hole:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/></svg>',
  link:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  close:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  minus:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  margin: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 8h16M8 4v16"/></svg>'
};

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

var tip = document.createElement('div');
tip.id = NS+'Tip';
tip.innerHTML =
  '<div id="'+NS+'TipPrev"></div>'+
  '<div id="'+NS+'TipBtns">'+
    '<button id="'+NS+'TipAdd">'+I.check+' Add</button>'+
    '<button id="'+NS+'TipRem">'+I.minus+' Remove</button>'+
    '<button id="'+NS+'TipBig">'+I.up+' Bigger</button>'+
    '<button id="'+NS+'TipSml">'+I.down+' Smaller</button>'+
    '<button id="'+NS+'TipX">&#x2715;</button>'+
  '</div>';
document.body.appendChild(tip);

var sheet = document.createElement('div');
sheet.id = NS+'Sheet';
sheet.innerHTML =
  '<div id="'+NS+'Hdl"><div id="'+NS+'HdlBar"></div></div>'+
  '<div id="'+NS+'Hdr">'+
    '<div id="'+NS+'HdrL">'+
      '<div id="'+NS+'HdrIco">'+I.cut+'</div>'+
      '<div>'+
        '<div id="'+NS+'HdrTtl">Print Master</div>'+
        '<div id="'+NS+'HdrSub">Select • Margins • Print</div>'+
      '</div>'+
    '</div>'+
    '<div id="'+NS+'HdrR">'+
      '<button id="'+NS+'BtnMin" title="Minimise">'+I.down+' Minimise</button>'+
      '<button id="'+NS+'BtnCls">&#x2715;</button>'+
    '</div>'+
  '</div>'+
  '<div id="'+NS+'Tabs">'+
    '<button class="'+NS+'Tab _on" data-m="tap">'+I.cut+' Tap Pick</button>'+
    '<button class="'+NS+'Tab" data-m="text">'+I.text+' Text Sel</button>'+
    '<button class="'+NS+'Tab" data-m="margin">'+I.margin+' Margins</button>'+
  '</div>'+
  '<div id="'+NS+'TapPane">'+
    '<div id="'+NS+'TapAction">'+
      '<button class="'+NS+'TAct _on" data-a="select">'+I.check+' Select</button>'+
      '<button class="'+NS+'TAct" data-a="deselect">'+I.minus+' Deselect</button>'+
    '</div>'+
    '<div id="'+NS+'Inst">'+
      '<span id="'+NS+'InstIco">👆</span>'+
      '<div id="'+NS+'InstTxt">'+
        '<strong>Minimise this panel first</strong>, then tap blocks on the page. '+
        'First tap = preview, second tap = confirm.'+
      '</div>'+
      '<button id="'+NS+'InstMin">'+I.down+' Go</button>'+
    '</div>'+
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
  '<div id="'+NS+'TextPane" style="display:none">'+
    '<div id="'+NS+'TxtPrev"></div>'+
    '<div id="'+NS+'TxtMeta"></div>'+
    '<div id="'+NS+'TxtNote">💡 On Android: long-press a word → drag handles to extend → re-open bookmarklet or tap Refresh below.</div>'+
    '<button id="'+NS+'TxtRef">↻ Refresh selection</button>'+
  '</div>'+

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
        '<div id="'+NS+'GaugeTrack">'+
          '<div id="'+NS+'GaugeFill"></div>'+
          '<div id="'+NS+'GaugeHole"></div>'+
        '</div>'+
        '<div id="'+NS+'GaugeLbls">'+
          '<span>0</span><span id="'+NS+'HoleLbl">25.4mm</span><span>60mm</span>'+
        '</div>'+
      '</div>'+
      '<div id="'+NS+'BindInfo">'+
        '<div id="'+NS+'BindVal"></div>'+
        '<div id="'+NS+'BindHint"></div>'+
      '</div>'+
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
      '<div class="'+NS+'IC" id="'+NS+'CellT">'+
        '<label class="'+NS+'ILbl">Top</label>'+
        '<input type="number" id="'+NS+'T" min="0">'+
      '</div>'+
      '<div id="'+NS+'Mid">'+
        '<div class="'+NS+'IC '+NS+'Side" id="'+NS+'CellL">'+
          '<label class="'+NS+'ILbl" id="'+NS+'LLbl">Left<span class="'+NS+'BindMark" id="'+NS+'LMark"></span></label>'+
          '<input type="number" id="'+NS+'L" min="0">'+
        '</div>'+
        '<div id="'+NS+'DWrap">'+
          '<canvas id="'+NS+'Canvas" width="90" height="126"></canvas>'+
        '</div>'+
        '<div class="'+NS+'IC '+NS+'Side" id="'+NS+'CellR">'+
          '<label class="'+NS+'ILbl" id="'+NS+'RLbl">Right<span class="'+NS+'BindMark" id="'+NS+'RMark"></span></label>'+
          '<input type="number" id="'+NS+'R" min="0">'+
        '</div>'+
      '</div>'+
      '<div class="'+NS+'IC" id="'+NS+'CellB">'+
        '<label class="'+NS+'ILbl" id="'+NS+'BLbl">Bottom<span class="'+NS+'BindMark" id="'+NS+'BMark"></span></label>'+
        '<input type="number" id="'+NS+'B" min="0">'+
      '</div>'+
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
  '<div id="'+NS+'Footer">'+
    '<button class="'+NS+'FBtn _ghost" id="'+NS+'FCpy">'+I.copy+' Copy text</button>'+
    '<button class="'+NS+'FBtn _primary" id="'+NS+'FPrn">'+I.print+' <span id="'+NS+'FPrnLbl">Print</span></button>'+
  '</div>';
document.body.appendChild(sheet);

var styleEl = document.createElement('style');
styleEl.id = NS+'Style';
styleEl.textContent = [
'[id^="'+NS+'"] *,[id^="'+NS+'"] *::before,[id^="'+NS+'"] *::after{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;font-family:"Outfit","Segoe UI",sans-serif;}',
'#'+NS+'Mini{position:fixed;bottom:72px;right:16px;z-index:2147483646;display:flex;align-items:center;gap:4px;animation:ps14pop .3s cubic-bezier(.34,1.56,.64,1);}',
'@keyframes ps14pop{from{opacity:0;transform:scale(.6) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}',
'#'+NS+'MiniMain{display:flex;align-items:center;gap:8px;height:48px;padding:0 16px 0 12px;background:rgba(10,10,18,0.9);backdrop-filter:blur(16px) saturate(1.5);border:1px solid rgba(255,255,255,0.1);border-radius:99px;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.04) inset;transition:transform .15s,box-shadow .15s;}',
'#'+NS+'MiniMain:active{transform:scale(.95);}',
'#'+NS+'MiniIco{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'#'+NS+'MiniInfo{display:flex;align-items:baseline;gap:2px;}',
'#'+NS+'MiniCnt{font-size:18px;font-weight:700;color:#c4b5fd;transition:transform .2s cubic-bezier(.34,1.56,.64,1);}',
'#'+NS+'MiniLbl{font-size:12px;color:rgba(255,255,255,0.4);}',
'#'+NS+'MiniArrow{color:rgba(255,255,255,0.4);display:flex;align-items:center;margin-left:2px;}',
'#'+NS+'MiniPrint{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#4338ca);border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 20px rgba(109,40,217,0.5);transition:transform .15s,box-shadow .15s;}',
'#'+NS+'MiniPrint:active{transform:scale(.92);box-shadow:0 2px 8px rgba(109,40,217,0.3);}',
'#'+NS+'Tip{display:none;position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);width:calc(100vw - 32px);max-width:360px;background:rgba(12,12,20,0.97);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:12px 14px;box-shadow:0 16px 48px rgba(0,0,0,0.7);animation:ps14tipIn .2s cubic-bezier(.16,1,.3,1);}',
'@keyframes ps14tipIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}',
'#'+NS+'TipPrev{font-size:11.5px;color:rgba(255,255,255,0.45);font-family:"JetBrains Mono",monospace;margin-bottom:10px;max-height:48px;overflow:hidden;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}',
'#'+NS+'TipBtns{display:flex;gap:6px;flex-wrap:wrap;}',
'#'+NS+'TipBtns button{padding:8px 13px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;-webkit-tap-highlight-color:transparent;transition:all .12s;flex:1;justify-content:center;}',
'#'+NS+'TipAdd{background:rgba(109,40,217,0.3)!important;border-color:rgba(109,40,217,0.7)!important;color:#ddd6fe!important;}',
'#'+NS+'TipRem{background:rgba(239,68,68,0.2)!important;border-color:rgba(239,68,68,0.6)!important;color:#fca5a5!important;display:none;}',
'#'+NS+'TipX{flex:0!important;padding:8px 12px!important;color:rgba(255,255,255,0.3)!important;}',
'#'+NS+'TipBtns button:active{transform:scale(.95);}',
'#'+NS+'Sheet{position:fixed;bottom:0;left:0;right:0;z-index:2147483645;background:#0a0a12;border-top:1px solid rgba(255,255,255,0.07);border-radius:22px 22px 0 0;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 -20px 60px rgba(0,0,0,0.7);transform:translateY(110%);transition:transform .35s cubic-bezier(.16,1,.3,1);}',
'#'+NS+'Sheet._open{transform:translateY(0);}',
'#'+NS+'Hdl{flex-shrink:0;display:flex;justify-content:center;padding:10px 0 6px;cursor:grab;}',
'#'+NS+'HdlBar{width:36px;height:4px;background:rgba(255,255,255,0.1);border-radius:99px;}',
'#'+NS+'Hdr{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:2px 16px 12px;}',
'#'+NS+'HdrL{display:flex;align-items:center;gap:11px;}',
'#'+NS+'HdrIco{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 16px rgba(109,40,217,0.5);}',
'#'+NS+'HdrTtl{font-size:16px;font-weight:700;color:#f0f0fa;letter-spacing:-.3px;}',
'#'+NS+'HdrSub{font-size:10.5px;color:rgba(255,255,255,0.25);margin-top:1px;}',
'#'+NS+'HdrR{display:flex;align-items:center;gap:6px;}',
'#'+NS+'BtnMin{padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.38);font-size:11.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .15s;white-space:nowrap;}',
'#'+NS+'BtnMin:hover{border-color:rgba(109,40,217,0.45);color:#c4b5fd;}',
'#'+NS+'BtnCls{width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.4);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}',
'#'+NS+'BtnCls:active{background:rgba(239,68,68,0.2);color:#f87171;}',
'#'+NS+'Tabs{flex-shrink:0;display:flex;gap:5px;padding:0 16px 12px;}',
'.'+NS+'Tab{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:10px;border-radius:11px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.33);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;}',
'.'+NS+'Tab._on{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.55);color:#c4b5fd;}',
'#'+NS+'TapPane,#'+NS+'TextPane,#'+NS+'MarginPane{overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;}',
'#'+NS+'TapAction{display:flex;gap:5px;padding:0 16px 10px;}',
'.'+NS+'TAct{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:10px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.33);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;}',
'.'+NS+'TAct._on{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.55);color:#c4b5fd;}',
'.'+NS+'TAct[data-a="deselect"]._on{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.55);color:#fca5a5;}',
'#'+NS+'Inst{margin:0 16px 12px;display:flex;align-items:center;gap:10px;background:rgba(109,40,217,0.1);border:1px solid rgba(109,40,217,0.25);border-radius:13px;padding:11px 13px;}',
'#'+NS+'Inst._warn{background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.2);}',
'#'+NS+'InstIco{font-size:20px;flex-shrink:0;}',
'#'+NS+'InstTxt{flex:1;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;}',
'#'+NS+'InstTxt strong{color:rgba(255,255,255,0.7);}',
'#'+NS+'InstMin{padding:8px 14px;border-radius:9px;border:none;background:linear-gradient(135deg,#6d28d9,#4338ca);color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px;flex-shrink:0;}',
'#'+NS+'List{margin:0 16px 12px;border:1px solid rgba(255,255,255,0.07);border-radius:13px;overflow:hidden;}',
'#'+NS+'ListHdr{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.05);}',
'#'+NS+'ListLbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,0.28);}',
'#'+NS+'ListHdrR{display:flex;align-items:center;gap:5px;}',
'.'+NS+'Badge{background:rgba(109,40,217,0.3);color:#c4b5fd;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;}',
'#'+NS+'ListHdrR button{padding:4px 9px;border-radius:7px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.38);font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;-webkit-tap-highlight-color:transparent;}',
'#'+NS+'ListItems{max-height:140px;overflow-y:auto;}',
'#'+NS+'ListEmpty{padding:20px;text-align:center;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6;}',
'.'+NS+'SItem{display:flex;align-items:center;gap:8px;padding:8px 13px;border-bottom:1px solid rgba(255,255,255,0.04);}',
'.'+NS+'SItem:last-child{border-bottom:none;}',
'.'+NS+'SNum{width:20px;height:20px;border-radius:50%;background:rgba(109,40,217,0.22);color:#c4b5fd;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'.'+NS+'STxt{flex:1;font-size:11.5px;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
'.'+NS+'STag{font-size:9px;color:rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);border-radius:4px;padding:1px 5px;flex-shrink:0;font-family:"JetBrains Mono",monospace;}',
'.'+NS+'SDel{width:22px;height:22px;border-radius:50%;border:none;background:rgba(239,68,68,0.1);color:rgba(239,68,68,0.5);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;}',
'.'+NS+'SDel:hover{background:rgba(239,68,68,0.25);color:#f87171;}',
'#'+NS+'Adj{margin:0 16px 12px;}',
'.'+NS+'SLbl{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,0.25);margin-bottom:7px;}',
'#'+NS+'AdjBtns{display:flex;gap:5px;flex-wrap:wrap;}',
'.'+NS+'ABtn{padding:8px 13px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.42);font-size:11.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;-webkit-tap-highlight-color:transparent;transition:all .12s;}',
'.'+NS+'ABtn:hover{border-color:rgba(109,40,217,0.5);color:#c4b5fd;}',
'.'+NS+'ABtn:active{transform:scale(.95);}',
'#'+NS+'TextPane{padding:0 16px 12px;display:none;flex-direction:column;gap:10px;}',
'#'+NS+'TxtPrev{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 14px;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.65;max-height:100px;overflow-y:auto;font-family:"JetBrains Mono",monospace;white-space:pre-wrap;word-break:break-word;}',
'#'+NS+'TxtMeta{font-size:11px;color:rgba(255,255,255,0.25);}',
'#'+NS+'TxtNote{font-size:11.5px;color:rgba(255,255,255,0.28);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 12px;line-height:1.55;}',
'#'+NS+'TxtRef{padding:10px;border-radius:10px;border:1.5px solid rgba(109,40,217,0.35);background:rgba(109,40,217,0.1);color:#c4b5fd;font-size:12.5px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;}',
'#'+NS+'MarginPane{padding:0 16px 14px;display:none;flex-direction:column;gap:10px;}',
'#'+NS+'BindStrip{display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(109,40,217,0.1);border:1px solid rgba(109,40,217,0.25);border-radius:12px;padding:9px 12px;}',
'#'+NS+'BSLeft{flex-shrink:0;}',
'.'+NS+'Pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:#c4b5fd;font-weight:500;}',
'#'+NS+'BindSide{display:flex;align-items:center;gap:6px;}',
'.'+NS+'BS{padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-size:10px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'.'+NS+'BS:hover{border-color:rgba(109,40,217,0.5);color:#c4b5fd;}',
'.'+NS+'BS.active{background:rgba(109,40,217,0.28);border-color:rgba(109,40,217,0.7);color:#ddd6fe;}',
'#'+NS+'BindRow{background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:10px 13px;display:flex;gap:12px;align-items:center;}',
'#'+NS+'BindGauge{flex:1;}',
'#'+NS+'GaugeTrack{height:10px;background:rgba(255,255,255,0.06);border-radius:99px;position:relative;overflow:visible;margin-bottom:5px;}',
'#'+NS+'GaugeFill{height:100%;border-radius:99px;background:linear-gradient(90deg,#6d28d9,#7c3aed);transition:width .2s ease;position:absolute;top:0;left:0;}',
'#'+NS+'GaugeHole{position:absolute;top:50%;transform:translateY(-50%);width:2px;height:18px;background:rgba(196,181,253,0.5);border-radius:1px;}',
'#'+NS+'GaugeLbls{display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,0.2);}',
'#'+NS+'HoleLbl{color:rgba(196,181,253,0.6);}',
'#'+NS+'BindInfo{text-align:right;flex-shrink:0;}',
'#'+NS+'BindVal{font-size:18px;font-weight:500;color:#c4b5fd;line-height:1;}',
'#'+NS+'BindHint{font-size:9.5px;color:rgba(255,255,255,0.25);margin-top:3px;}',
'#'+NS+'PreRow{display:flex;align-items:center;gap:8px;}',
'#'+NS+'PBtns{display:flex;gap:3px;flex:1;}',
'.'+NS+'P{flex:1;padding:6px 2px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;color:rgba(255,255,255,0.35);font-size:10.5px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'.'+NS+'P:hover{border-color:rgba(109,40,217,0.5);color:rgba(255,255,255,0.7);}',
'.'+NS+'P._on{background:rgba(109,40,217,0.22);border-color:rgba(109,40,217,0.65);color:#c4b5fd;}',
'#'+NS+'Grid{display:flex;flex-direction:column;align-items:center;gap:5px;}',
'#'+NS+'Mid{display:flex;align-items:center;gap:7px;width:100%;}',
'.'+NS+'IC{display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;}',
'.'+NS+'Side{width:62px;flex-shrink:0;}',
'.'+NS+'ILbl{font-size:9.5px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:4px;}',
'.'+NS+'BindMark{font-size:8px;color:#a78bfa;display:none;}',
'.'+NS+'BindMark.vis{display:inline;}',
'.'+NS+'IC input{width:100%;text-align:center;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.08);border-radius:10px;color:#e8e8f8;font-size:16px;font-family:"JetBrains Mono",monospace;font-weight:500;padding:7px 2px;outline:none;transition:border-color .15s,box-shadow .15s;-moz-appearance:textfield;}',
'.'+NS+'IC input::-webkit-inner-spin-button,.'+NS+'IC input::-webkit-outer-spin-button{-webkit-appearance:none;}',
'.'+NS+'IC input:focus{border-color:rgba(109,40,217,0.75);box-shadow:0 0 0 3px rgba(109,40,217,0.18);}',
'.'+NS+'IC input._bind{border-color:rgba(109,40,217,0.45);background:rgba(109,40,217,0.1);}',
'.'+NS+'Side input{font-size:13px;padding:6px 2px;}',
'#'+NS+'DWrap{flex:1;display:flex;align-items:center;justify-content:center;}',
'#'+NS+'Canvas{border-radius:3px;display:block;}',
'#'+NS+'CtrlRow{display:flex;align-items:center;justify-content:space-between;gap:10px;}',
'#'+NS+'LnkBtn{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-size:11px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'#'+NS+'LnkBtn:hover{border-color:rgba(109,40,217,0.5);color:rgba(255,255,255,0.7);}',
'#'+NS+'LnkBtn._on{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.7);color:#c4b5fd;}',
'#'+NS+'UBtns{display:flex;gap:3px;}',
'.'+NS+'U{padding:6px 10px;border-radius:7px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.35);font-size:11px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'.'+NS+'U:hover{color:rgba(255,255,255,0.7);border-color:rgba(255,255,255,0.15);}',
'.'+NS+'U._on{background:rgba(109,40,217,0.25);border-color:rgba(109,40,217,0.7);color:#c4b5fd;}',
'#'+NS+'CSSBar{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:8px 10px 8px 13px;}',
'#'+NS+'CSSCode{font-size:10px;color:#a78bfa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;font-family:"JetBrains Mono",monospace;}',
'#'+NS+'CpyBtn{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:7px;white-space:nowrap;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);font-size:10px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;flex-shrink:0;}',
'#'+NS+'CpyBtn:hover{border-color:rgba(109,40,217,0.5);color:#c4b5fd;}',
'#'+NS+'CpyBtn._cp{color:#34d399;border-color:rgba(52,211,153,0.4);}',
'#'+NS+'Footer{flex-shrink:0;display:flex;gap:8px;padding:10px 16px 28px;border-top:1px solid rgba(255,255,255,0.05);}',
'.'+NS+'FBtn{flex:1;padding:13px;border-radius:14px;font-size:13.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;-webkit-tap-highlight-color:transparent;transition:all .15s;}',
'.'+NS+'FBtn._ghost{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);}',
'.'+NS+'FBtn._primary{background:linear-gradient(135deg,#6d28d9,#4338ca);border:none;color:#fff;box-shadow:0 6px 24px rgba(109,40,217,0.45);}',
'.'+NS+'FBtn:active{transform:scale(.97);}'
].join('\n');
document.head.appendChild(styleEl);

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

document.getElementById(NS+'MiniMain').addEventListener('click', openSheet);
document.getElementById(NS+'BtnMin').addEventListener('click', minimizeSheet);
document.getElementById(NS+'InstMin').addEventListener('click', minimizeSheet);
document.getElementById(NS+'BtnCls').addEventListener('click', closeAll);
document.getElementById(NS+'MiniPrint').addEventListener('click', function(){ doPrint(); });

function isUI(el) {
  var m=document.getElementById(NS+'Mini'),
      s=document.getElementById(NS+'Sheet'),
      t=document.getElementById(NS+'Tip');
  return (m&&m.contains(el))||(s&&s.contains(el))||(t&&t.contains(el));
}

function onTap(e) {
  if (isUI(e.target)) return;
  e.preventDefault(); e.stopPropagation();
  var block = findBlock(e.target);
  if (!block) return;
  if (tapAction === 'select') {
    if (block === pending) {
      _unmark(block);
      undoStack.push({type:'add',el:block});
      selected.push(block); _sel(block);
      _clearPend(); hideTip();
      pulseMiniCount();
    } else {
      _clearPend(); hideTip();
      pending = block; _pend(block);
      showTip(e.clientY, block, 'select');
    }
  } else {
    var idx = selected.indexOf(block);
    if (idx !== -1) {
      if (pending === block) {
        removeSelected(idx);
        _clearPend(); hideTip();
      } else {
        _clearPend(); hideTip();
        pending = block; _pendRemove(block);
        showTip(e.clientY, block, 'deselect');
      }
      return;
    }
    var parentIdx = findParentSelected(block);
    if (parentIdx !== -1) {
      var parent = selected[parentIdx];
      if (pending && pending._action === 'split-remove' && pending.parent === parent && pending.child === block) {
        doSplitRemove(parentIdx, block);
        _clearPend(); hideTip();
      } else {
        _clearPend(); hideTip();
        pending = block;
        pending._action = 'split-remove';
        pending.parent = parent;
        pending.child = block;
        _pendRemove(block);
        showTipSplitRemove(e.clientY, block, parent);
      }
      return;
    }
    showToast('Tap a selected block or its child to remove');
  }
}

function findParentSelected(el) {
  var cur = el;
  while (cur && cur !== document.body) {
    var idx = selected.indexOf(cur);
    if (idx !== -1) return idx;
    cur = cur.parentElement;
  }
  return -1;
}

function removeSelected(idx) {
  var el = selected[idx];
  undoStack.push({type:'remove',el:el,index:idx});
  _unmark(el);
  selected.splice(idx, 1);
  updateUI();
}

function doSplitRemove(parentIdx, child) {
  var parent = selected[parentIdx];
  var parts = splitStanzas(parent);
  if (parts.length <= 1) {
    removeSelected(parentIdx);
    return;
  }
  var removeIdx = -1;
  for (var i=0;i<parts.length;i++) {
    if (parts[i] === child || parts[i].contains(child)) { removeIdx = i; break; }
  }
  if (removeIdx === -1) { removeSelected(parentIdx); return; }
  _unmark(parent);
  selected.splice(parentIdx, 1);
  var added = [];
  parts.forEach(function(p, i) {
    if (i !== removeIdx) { selected.push(p); _sel(p); added.push(p); }
  });
  undoStack.push({type:'split-remove', parent:parent, added:added, removed:parts[removeIdx]});
  updateUI();
  pulseMiniCount();
}

function showTip(tapY, el, action) {
  var t = document.getElementById(NS+'Tip');
  var VH = window.innerHeight;
  var TOP = tapY - 130;
  if (TOP < 10) TOP = tapY + 60;
  if (TOP + 120 > VH - 80) TOP = VH - 220;
  t.style.top = Math.max(10,TOP)+'px';
  t.style.display = 'block';
  var prev = (el.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
  document.getElementById(NS+'TipPrev').textContent = prev || '(no text)';
  var btnAdd = document.getElementById(NS+'TipAdd');
  var btnRem = document.getElementById(NS+'TipRem');
  if (action === 'select') {
    btnAdd.style.display = 'flex';
    btnRem.style.display = 'none';
  } else {
    btnAdd.style.display = 'none';
    btnRem.style.display = 'flex';
  }
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 6000);
}

function showTipSplitRemove(tapY, child, parent) {
  var t = document.getElementById(NS+'Tip');
  var VH = window.innerHeight;
  var TOP = tapY - 130;
  if (TOP < 10) TOP = tapY + 60;
  if (TOP + 120 > VH - 80) TOP = VH - 220;
  t.style.top = Math.max(10,TOP)+'px';
  t.style.display = 'block';
  var prev = (child.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
  document.getElementById(NS+'TipPrev').textContent = '(Split & remove) ' + (prev || '(no text)');
  document.getElementById(NS+'TipAdd').style.display = 'none';
  document.getElementById(NS+'TipRem').style.display = 'flex';
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 6000);
}

function hideTip(){
  var t=document.getElementById(NS+'Tip');
  if(t) t.style.display='none';
  clearTimeout(tipTimer);
}

document.getElementById(NS+'TipAdd').addEventListener('click',function(){
  if(!pending) return;
  _unmark(pending); undoStack.push({type:'add',el:pending});
  selected.push(pending); _sel(pending);
  _clearPend(); hideTip(); pulseMiniCount(); updateUI();
});
document.getElementById(NS+'TipRem').addEventListener('click',function(){
  if(!pending) return;
  if (tapAction === 'deselect') {
    var idx = selected.indexOf(pending);
    if (idx !== -1) {
      removeSelected(idx);
    } else if (pending._action === 'split-remove') {
      var pIdx = selected.indexOf(pending.parent);
      if (pIdx !== -1) doSplitRemove(pIdx, pending.child);
    }
  }
  _clearPend(); hideTip();
});
document.getElementById(NS+'TipX').addEventListener('click',function(){ _clearPend(); hideTip(); });
document.getElementById(NS+'TipBig').addEventListener('click',function(){
  if(!pending) return;
  var b=expandEl(pending); _unmark(pending); pending=b; _pend(b);
  document.getElementById(NS+'TipPrev').textContent=(b.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
});
document.getElementById(NS+'TipSml').addEventListener('click',function(){
  if(!pending) return;
  var s2=shrinkEl(pending); if(s2===pending) return;
  _unmark(pending); pending=s2; _pend(s2);
  document.getElementById(NS+'TipPrev').textContent=(s2.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
});

function updateUI() {
  var n = selected.length;
  document.getElementById(NS+'MiniCnt').textContent = n;
  var pl=document.getElementById(NS+'FPrnLbl');
  if(pl) pl.textContent = mode==='text' ? 'Print text' : (n===0?'Nothing selected':'Print '+n+' block'+(n!==1?'s':''));
  var pb=document.getElementById(NS+'FPrn');
  if(pb) pb.style.opacity=(mode==='text'&&textSel)||(mode==='tap'&&n>0)?'1':'0.45';
  document.getElementById(NS+'ListCnt').textContent = n;
  document.getElementById(NS+'Adj').style.display = n>0?'block':'none';
  rebuildList();
  if(mode==='text') refreshTextPane();
  if(mode==='margin') updateAllMargins();
}

function pulseMiniCount(){
  var mc=document.getElementById(NS+'MiniCnt'); if(!mc) return;
  mc.style.transform='scale(1.5)';
  setTimeout(function(){mc.style.transform='';},200);
}

function rebuildList(){
  var container=document.getElementById(NS+'ListItems'); if(!container) return;
  if(selected.length===0){
    container.innerHTML='<div id="'+NS+'ListEmpty">No blocks selected yet. Minimise and tap content on the page.</div>';
    return;
  }
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
      if(selected[i]){ removeSelected(i); }
    });
  });
}

function refreshTextPane(){
  var prev=document.getElementById(NS+'TxtPrev');
  var meta=document.getElementById(NS+'TxtMeta');
  if(prev) prev.textContent=textSel||'No text selected yet.\nLong-press on the page \u2192 extend selection \u2192 re-open bookmarklet.';
  if(meta&&textSel){ var w=textSel.trim().split(/\s+/).length; meta.textContent=w+' words \u00b7 ~'+Math.ceil(w/200)+' min read \u00b7 '+textSel.length+' chars'; }
}

document.querySelectorAll('.'+NS+'Tab').forEach(function(btn){
  btn.addEventListener('click',function(){
    mode=this.getAttribute('data-m');
    document.querySelectorAll('.'+NS+'Tab').forEach(function(b){b.classList.remove('_on');});
    this.classList.add('_on');
    document.getElementById(NS+'TapPane').style.display   = mode==='tap'    ? 'block':'none';
    document.getElementById(NS+'TextPane').style.display  = mode==='text'   ? 'flex':'none';
    document.getElementById(NS+'MarginPane').style.display= mode==='margin' ? 'flex':'none';
    if(mode==='text'){ var s3=window.getSelection(); if(s3&&s3.toString().trim().length>0) textSel=s3.toString().trim(); }
    updateUI();
  });
});

document.querySelectorAll('.'+NS+'TAct').forEach(function(btn){
  btn.addEventListener('click',function(){
    tapAction = this.getAttribute('data-a');
    document.querySelectorAll('.'+NS+'TAct').forEach(function(b){b.classList.remove('_on');});
    this.classList.add('_on');
    var inst = document.getElementById(NS+'Inst');
    var txt = document.getElementById(NS+'InstTxt');
    if (tapAction === 'deselect') {
      inst.classList.add('_warn');
      txt.innerHTML = '<strong>Deselect mode is ON.</strong> Tap a selected block to remove it. Tap inside a selected block to split & remove that section only.';
    } else {
      inst.classList.remove('_warn');
      txt.innerHTML = '<strong>Minimise this panel first</strong>, then tap blocks on the page. First tap = preview (orange), second tap = confirm (purple).';
    }
  });
});

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
  else if(last.type==='remove'){selected.splice(last.index,0,last.el);_sel(last.el);}
  else if(last.type==='split-remove'){
    last.added.forEach(function(a){var i=selected.indexOf(a);if(i!==-1){selected.splice(i,1);_unmark(a);}});
    selected.push(last.parent); _sel(last.parent);
  }
  updateUI();
});
document.getElementById(NS+'BtnClr').addEventListener('click',function(){ _clearAll(); updateUI(); });
function _clearAll(){ _clearPend(); hideTip(); selected.forEach(function(el){_unmark(el);}); selected=[]; undoStack=[]; }

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

document.getElementById(NS+'TxtRef').addEventListener('click',function(){
  var s4=window.getSelection(); if(s4&&s4.toString().trim().length>0) textSel=s4.toString().trim();
  refreshTextPane(); updateUI();
});

document.getElementById(NS+'FCpy').addEventListener('click',function(){
  var txt = mode==='text' ? textSel :
    selected.map(function(el){return (el.innerText||'').trim();}).join('\n\n');
  if(!txt) return;
  _copyText(txt, document.getElementById(NS+'FCpy'));
});
function _copyText(txt,btn){
  function onDone(){ if(btn){btn.innerHTML=I.check+' Copied!'; setTimeout(function(){btn.innerHTML=I.copy+' Copy text';},2000);} }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(onDone).catch(function(){_fbCopy(txt);onDone();});
  } else { _fbCopy(txt); onDone(); }
}
function _fbCopy(t){ var ta=document.createElement('textarea'); ta.value=t; ta.style.cssText='position:fixed;opacity:0;top:0;left:0;'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }

document.getElementById(NS+'FPrn').addEventListener('click', doPrint);
function doPrint(){ mode==='text' ? printText() : printBlocks(); }

function getMarginStr() {
  var m = marginState.MM;
  return m.t+'mm '+m.r+'mm '+m.b+'mm '+m.l+'mm';
}

function printText(){
  if(!textSel) return;
  var win=window.open('','_blank','width=800,height=600,toolbar=0,menubar=0,location=0,scrollbars=1');
  if(!win){alert('Allow pop-ups and try again.');return;}
  var margin = getMarginStr();
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print Selection</title>'
    +'<style>body{font-family:Georgia,serif;font-size:'+printOpts.fontSize+'pt;line-height:1.8;max-width:760px;margin:40px auto;color:#111;padding:0 24px;}'
    +'pre{white-space:pre-wrap;}footer{margin-top:36px;font-size:9pt;color:#aaa;border-top:1px solid #eee;padding-top:10px;}'
    +'@media print{@page{margin:'+margin+' !important;}body{margin:0;}}</style></head><body>'
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
    var c=el.cloneNode(true); c.removeAttribute('data-'+NS);
    c.style.outline=c.style.outlineOffset=c.style.backgroundColor=c.style.borderRadius='';
    return '<div class="ps14blk">'+c.outerHTML+'</div>';
  });
  var margin = getMarginStr();
  var win=window.open('','_blank','width=820,height=700,toolbar=0,menubar=0,location=0,scrollbars=1');
  if(!win){alert('Allow pop-ups and try again.');return;}
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8">'
    +'<base href="'+location.origin+'">'
    +'<title>Print Selection \u2014 '+escH(document.title||location.hostname)+'</title>'
    +(printOpts.preserveStyle?'<style>'+pageCSS+'</style>':'')
    +'<style>body{max-width:800px;margin:0 auto;padding:24px;font-size:'+printOpts.fontSize+'pt;}.ps14blk{margin-bottom:1.5em;}'
    +'footer{margin-top:36px;font-size:9pt;color:#999;border-top:1px solid #eee;padding-top:10px;}'
    +'@media print{@page{margin:'+margin+' !important;}body{padding:0;max-width:none;}a{color:inherit;text-decoration:none;}}'
    +'</style></head><body>'
    +parts.join('\n')
    +(printOpts.showSource?'<footer>'+selected.length+' block'+(selected.length!==1?'s':'')+' \u00b7 <a href="'+escH(location.href)+'">'+escH(location.href)+'</a></footer>':'')
    +'</body></html>');
  win.document.close(); win.focus(); setTimeout(function(){win.print();},500);
  minimizeSheet();
}

function toDisp(v){ return parseFloat((v*FACTOR[marginState.unit]).toFixed(DECIMALS[marginState.unit])); }
function toMM(v)  { return v/FACTOR[marginState.unit]; }

var tEl=document.getElementById(NS+'T'), rEl=document.getElementById(NS+'R'),
    bEl=document.getElementById(NS+'B'), lEl=document.getElementById(NS+'L');
var canvas=document.getElementById(NS+'Canvas'), ctx=canvas.getContext('2d');
var lnkBtn=document.getElementById(NS+'LnkBtn'), lnkLbl=document.getElementById(NS+'LnkLbl');
var cssCode=document.getElementById(NS+'CSSCode'), cpyBtn=document.getElementById(NS+'CpyBtn'), cpyLbl=document.getElementById(NS+'CpyLbl');
var bindVal=document.getElementById(NS+'BindVal'), bindHnt=document.getElementById(NS+'BindHint');
var gFill=document.getElementById(NS+'GaugeFill'), gHole=document.getElementById(NS+'GaugeHole');

function drawPage() {
  var W=90, H=126;
  ctx.clearRect(0,0,W,H);
  var scW=W/210, scH=H/297;
  var tPx=Math.min(marginState.MM.t*scH,H*0.42);
  var rPx=Math.min(marginState.MM.r*scW,W*0.42);
  var bPx=Math.min(marginState.MM.b*scH,H*0.42);
  var lPx=Math.min(marginState.MM.l*scW,W*0.42);
  var holePx=Math.min(HOLE_OFFSET_MM*(marginState.bindSide==='top'?scH:scW),24);

  ctx.fillStyle='#15151f'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(109,40,217,0.25)';
  ctx.fillRect(0,0,W,tPx);
  ctx.fillRect(0,H-bPx,W,bPx);
  ctx.fillRect(0,tPx,lPx,H-tPx-bPx);
  ctx.fillRect(W-rPx,tPx,rPx,H-tPx-bPx);

  var bsColor='rgba(139,92,246,0.45)';
  if(marginState.bindSide==='left'){ctx.fillStyle=bsColor;ctx.fillRect(0,0,lPx,H);}
  if(marginState.bindSide==='right'){ctx.fillStyle=bsColor;ctx.fillRect(W-rPx,0,rPx,H);}
  if(marginState.bindSide==='top'){ctx.fillStyle=bsColor;ctx.fillRect(0,0,W,tPx);}

  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1.5;
  ctx.strokeRect(0.75,0.75,W-1.5,H-1.5);

  var cx=lPx+3,cy=tPx+5,cw=W-lPx-rPx-6,ch=H-tPx-bPx-10;
  if(cw>6&&ch>6){
    var lineH=2,gap=6,lc=Math.floor((ch+gap)/(lineH+gap));
    var widths=[1,.82,1,.68,.9,.55,.78,1,.6,.85];
    for(var i=0;i<Math.min(lc,widths.length);i++){
      ctx.fillStyle='rgba(196,181,253,0.28)';
      ctx.fillRect(cx,cy+i*(lineH+gap),cw*widths[i],lineH);
    }
  }

  if(marginState.bindSide==='left'||marginState.bindSide==='right'){
    var hx=marginState.bindSide==='left'?holePx:W-holePx;
    var hps=[H*0.25,H*0.5,H*0.75];
    ctx.strokeStyle='rgba(196,181,253,0.75)'; ctx.lineWidth=1;
    for(var hi=0;hi<hps.length;hi++){
      ctx.beginPath(); ctx.arc(hx,hps[hi],3.5,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx-5,hps[hi]);ctx.lineTo(hx+5,hps[hi]);
      ctx.moveTo(hx,hps[hi]-5);ctx.lineTo(hx,hps[hi]+5); ctx.stroke();
    }
    ctx.setLineDash([2,2]); ctx.strokeStyle='rgba(196,181,253,0.3)';
    ctx.beginPath();
    if(marginState.bindSide==='left'){ctx.moveTo(holePx+5,0);ctx.lineTo(holePx+5,H);}
    else{ctx.moveTo(W-holePx-5,0);ctx.lineTo(W-holePx-5,H);}
    ctx.stroke(); ctx.setLineDash([]);
  } else if(marginState.bindSide==='top'){
    var hy=holePx;
    var hps2=[W*0.25,W*0.5,W*0.75];
    ctx.strokeStyle='rgba(196,181,253,0.75)'; ctx.lineWidth=1;
    for(var hi2=0;hi2<hps2.length;hi2++){
      ctx.beginPath(); ctx.arc(hps2[hi2],hy,3.5,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hps2[hi2]-5,hy);ctx.lineTo(hps2[hi2]+5,hy);
      ctx.moveTo(hps2[hi2],hy-5);ctx.lineTo(hps2[hi2],hy+5); ctx.stroke();
    }
    ctx.setLineDash([2,2]); ctx.strokeStyle='rgba(196,181,253,0.3)';
    ctx.beginPath(); ctx.moveTo(0,hy+5);ctx.lineTo(W,hy+5); ctx.stroke(); ctx.setLineDash([]);
  }
}

function updateGauge() {
  var bindMM = marginState.bindSide==='left'?marginState.MM.l:marginState.bindSide==='right'?marginState.MM.r:marginState.MM.t;
  var MAX=60, pct=Math.min(bindMM/MAX*100,100);
  gFill.style.width=pct+'%';
  var holePct=Math.min(HOLE_OFFSET_MM/MAX*100,100);
  gHole.style.left=holePct+'%';
  document.getElementById(NS+'HoleLbl').textContent=toDisp(HOLE_OFFSET_MM)+marginState.unit;
  bindVal.textContent=toDisp(bindMM)+marginState.unit;
  var safe=bindMM-HOLE_OFFSET_MM;
  if(safe<0){bindHnt.style.color='#f87171';bindHnt.textContent='\u26a0 '+Math.abs(toDisp(safe)).toFixed(DECIMALS[marginState.unit])+marginState.unit+' too narrow';}
  else if(safe<5){bindHnt.style.color='#fbbf24';bindHnt.textContent='\u26a0 Only '+toDisp(safe)+marginState.unit+' clearance';}
  else{bindHnt.style.color='#34d399';bindHnt.textContent='\u2713 '+toDisp(safe)+marginState.unit+' safe clearance';}
}

function updateMarks(){
  document.getElementById(NS+'LMark').textContent='\u25c4 bind';
  document.getElementById(NS+'RMark').textContent='bind \u25ba';
  document.getElementById(NS+'BMark').textContent='\u25b2 bind';
  ['LMark','RMark','BMark'].forEach(function(id){document.getElementById(NS+id).classList.remove('vis');});
  if(marginState.bindSide==='left')document.getElementById(NS+'LMark').classList.add('vis');
  if(marginState.bindSide==='right')document.getElementById(NS+'RMark').classList.add('vis');
  if(marginState.bindSide==='top')document.getElementById(NS+'BMark').classList.add('vis');
  [tEl,rEl,bEl,lEl].forEach(function(el){el.classList.remove('_bind');});
  var bindEl={left:lEl,right:rEl,top:tEl}[marginState.bindSide];
  if(bindEl)bindEl.classList.add('_bind');
}

function syncInputs(){
  tEl.value=toDisp(marginState.MM.t); rEl.value=toDisp(marginState.MM.r);
  bEl.value=toDisp(marginState.MM.b); lEl.value=toDisp(marginState.MM.l);
}

function cssValStr(){
  function f(v){return toDisp(v)+marginState.unit;}
  return '@page { margin: '+f(marginState.MM.t)+' '+f(marginState.MM.r)+' '+f(marginState.MM.b)+' '+f(marginState.MM.l)+' }';
}

function detectPreset(){
  var found=null, keys=Object.keys(PRESETS);
  for(var i=0;i<keys.length;i++){
    var p=PRESETS[keys[i]];
    if(Math.abs(marginState.MM.t-p.t)<0.2&&Math.abs(marginState.MM.r-p.r)<0.2&&Math.abs(marginState.MM.b-p.b)<0.2&&Math.abs(marginState.MM.l-p.l)<0.2){found=keys[i];break;}
  }
  document.querySelectorAll('.'+NS+'P').forEach(function(b){b.classList.remove('_on');});
  if(found){var el=document.querySelector('.'+NS+'P[data-p="'+found+'"]');if(el)el.classList.add('_on');}
}

function saveMargins(){
  try{localStorage.setItem(NS+'Margins',JSON.stringify({unit:marginState.unit,MM:marginState.MM,bindSide:marginState.bindSide,linked:marginState.linked}));}catch(e){}
}

function updateAllMargins(){
  drawPage(); updateGauge(); updateMarks();
  cssCode.textContent=cssValStr(); detectPreset(); saveMargins();
}

function wire(key,el){
  el.addEventListener('input',function(){
    var v=toMM(parseFloat(this.value)||0);
    if(marginState.linked){marginState.MM.t=marginState.MM.r=marginState.MM.b=marginState.MM.l=v;syncInputs();}
    else{marginState.MM[key]=v;}
    updateAllMargins();
  });
}
wire('t',tEl); wire('r',rEl); wire('b',bEl); wire('l',lEl);

document.querySelectorAll('.'+NS+'BS').forEach(function(btn){
  btn.addEventListener('click',function(){
    marginState.bindSide=this.getAttribute('data-s');
    document.querySelectorAll('.'+NS+'BS').forEach(function(b){b.classList.remove('active');});
    this.classList.add('active'); updateAllMargins();
  });
});

document.querySelectorAll('.'+NS+'P').forEach(function(btn){
  btn.addEventListener('click',function(){
    var p=PRESETS[this.getAttribute('data-p')];
    marginState.MM={t:p.t,r:p.r,b:p.b,l:p.l};
    syncInputs(); updateAllMargins();
  });
});

lnkBtn.addEventListener('click',function(){
  marginState.linked=!marginState.linked;
  lnkBtn.classList.toggle('_on',marginState.linked);
  lnkLbl.textContent=marginState.linked?'Linked \u2713':'Link all';
  if(marginState.linked){marginState.MM.r=marginState.MM.b=marginState.MM.l=marginState.MM.t;syncInputs();updateAllMargins();}
});

document.querySelectorAll('.'+NS+'U').forEach(function(btn){
  btn.addEventListener('click',function(){
    marginState.unit=this.getAttribute('data-u');
    document.querySelectorAll('.'+NS+'U').forEach(function(b){b.classList.remove('_on');});
    this.classList.add('_on');
    [tEl,rEl,bEl,lEl].forEach(function(el){el.step=STEP[marginState.unit];});
    syncInputs(); updateAllMargins();
  });
});

cpyBtn.addEventListener('click',function(){
  var txt=cssValStr();
  function done(){cpyBtn.classList.add('_cp');cpyLbl.textContent='Copied!';
    setTimeout(function(){cpyBtn.classList.remove('_cp');cpyLbl.textContent='Copy';},2200);}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(function(){_fbCopy(txt);done();});
  }else{_fbCopy(txt);done();}
});

var _sy=0;
var hdl=document.getElementById(NS+'Hdl');
hdl.addEventListener('touchstart',function(e){_sy=e.touches[0].clientY;},{passive:true});
hdl.addEventListener('touchend',function(e){if(e.changedTouches[0].clientY-_sy>50)minimizeSheet();},{passive:true});

function _onKey(e){
  if(e.key==='Escape'){if(panelState==='full')minimizeSheet(); else closeAll();}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter') doPrint();
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){
    var last=undoStack.pop();
    if(!last)return;
    if(last.type==='add'){var i=selected.indexOf(last.el);if(i!==-1){selected.splice(i,1);_unmark(last.el);}}
    else if(last.type==='remove'){selected.splice(last.index,0,last.el);_sel(last.el);}
    else if(last.type==='split-remove'){last.added.forEach(function(a){var i=selected.indexOf(a);if(i!==-1){selected.splice(i,1);_unmark(a);}});selected.push(last.parent);_sel(last.parent);}
    updateUI();
  }
}
document.addEventListener('keydown',_onKey);

function _cleanupGlobal(){
  document.removeEventListener('click',onTap,true);
  document.removeEventListener('keydown',_onKey);
  clearTimeout(tipTimer);
  selected.forEach(function(el){_unmark(el);});
  _clearPend();
}

function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function showToast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:130px;left:50%;transform:translateX(-50%);background:rgba(10,10,18,0.95);color:rgba(255,255,255,0.7);padding:10px 18px;border-radius:99px;font-size:12px;z-index:2147483647;border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(10px);';
  document.body.appendChild(t);
  setTimeout(function(){t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(function(){t.remove();},300);},2000);
}

document.addEventListener('click',onTap,true);

document.querySelectorAll('.'+NS+'U').forEach(function(b){b.classList.toggle('_on',b.getAttribute('data-u')===marginState.unit);});
document.querySelectorAll('.'+NS+'BS').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-s')===marginState.bindSide);});
lnkBtn.classList.toggle('_on',marginState.linked);
lnkLbl.textContent=marginState.linked?'Linked \u2713':'Link all';
[tEl,rEl,bEl,lEl].forEach(function(el){el.step=STEP[marginState.unit];});
syncInputs();
updateAllMargins();

if(mode==='text') openSheet();
updateUI();

})();
