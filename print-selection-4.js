(function(){
'use strict';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   GUARD
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var NS='__ps14';
function $id(s){return document.getElementById(NS+s);}

if($id('Mini')){
  ['Mini','Sheet','Tip','ExTip','Style'].forEach(function(k){var e=$id(k);if(e)e.remove();});
  _gc(); return;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   FONT
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
if(!$id('Fnt')){
  var _lk=document.createElement('link');
  _lk.id=NS+'Fnt';_lk.rel='stylesheet';
  _lk.href='https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap';
  document.head.appendChild(_lk);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var SEL=[], UNDO=[], PENDING=null, PANEL='mini', MODE='tap', TXTSEL='';
var TIP_TMR=null;

/* Margin state — internal mm */
var MRG={t:25.4,r:19.0,b:25.4,l:38.1};
var MRG_UNIT='mm', MRG_LINKED=false, MRG_BIND='left';
var MRG_PRESETS={
  none:{t:0,r:0,b:0,l:0},
  narrow:{t:12.7,r:12.7,b:12.7,l:12.7},
  normal:{t:25.4,r:25.4,b:25.4,l:25.4},
  punch:{t:25.4,r:19.0,b:25.4,l:38.1},
  binding:{t:25.4,r:19.0,b:25.4,l:44.45}
};
var MF={mm:1,cm:0.1,'in':1/25.4};
var MD={mm:1,cm:2,'in':3};

/* Print options */
var POPT={fontSize:'13',paper:'A4',showSrc:true,keepStyle:true};

/* Restore saved prefs */
try{
  var sv=JSON.parse(localStorage.getItem(NS+'pref')||'null');
  if(sv){if(sv.MRG)MRG=sv.MRG;if(sv.MRG_UNIT)MRG_UNIT=sv.MRG_UNIT;if(sv.MRG_BIND)MRG_BIND=sv.MRG_BIND;if(sv.POPT)POPT=sv.POPT;}
}catch(e){}

/* Detect text selection */
var _ws=window.getSelection();
if(_ws&&_ws.toString().trim().length>20){TXTSEL=_ws.toString().trim();MODE='text';}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   UNIT HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function toD(mm){return parseFloat((mm*MF[MRG_UNIT]).toFixed(MD[MRG_UNIT]));}
function toMM(v){return v/MF[MRG_UNIT];}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   SMART BLOCK FINDER
   Never grabs >55% viewport height
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function findBlock(el){
  var VH=window.innerHeight,VW=window.innerWidth;
  var INL='P,H1,H2,H3,H4,H5,H6,LI,BLOCKQUOTE,PRE,DT,DD,FIGCAPTION,CAPTION,TD,TH'.split(',');
  var SEC='ARTICLE,SECTION,FIGURE,TABLE,DETAILS'.split(',');
  var best=null,cur=el,d=0;
  while(cur&&cur!==document.body&&d<14){
    if(_isUI(cur))break;
    var tag=(cur.tagName||'').toUpperCase();
    var r=cur.getBoundingClientRect();
    var txt=(cur.innerText||'').trim();
    if(r.width===0&&r.height===0){cur=cur.parentElement;d++;continue;}
    var big=r.height>VH*0.55||(r.width>VW*0.9&&r.height>VH*0.22);
    if(INL.indexOf(tag)!==-1&&!big)return cur;
    if(SEC.indexOf(tag)!==-1&&!big)return cur;
    if((tag==='DIV'||tag==='SPAN')&&txt.length>10&&!big){
      best=cur;
      var par=cur.parentElement;
      if(par&&par.getBoundingClientRect().height>VH*0.55)return best;
    }
    if(big&&best)return best;
    cur=cur.parentElement;d++;
  }
  return best||el;
}
function _isUI(el){var id=el.id||'';return id.indexOf(NS)===0;}

function expandEl(el){var p=el.parentElement;return(!p||p===document.body)?el:p;}
function shrinkEl(el){
  var ch=Array.prototype.slice.call(el.children);
  for(var i=0;i<ch.length;i++)if((ch[i].innerText||'').trim().length>8)return ch[i];
  return el;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   STANZA SPLITTER
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function splitEl(el){
  var parts=[];
  /* Direct <p> children */
  var pc=el.querySelectorAll(':scope > p');
  if(pc.length>1){pc.forEach(function(p){parts.push(p);});return parts;}
  /* Direct <div> children */
  var dc=el.querySelectorAll(':scope > div');
  if(dc.length>1){
    dc.forEach(function(d){if((d.innerText||'').trim().length>3)parts.push(d);});
    if(parts.length>1)return parts;
  }
  /* <br><br> split */
  var htm=el.innerHTML;
  if(/<br\s*\/?>\s*<br/i.test(htm)){
    var chunks=htm.split(/<br\s*\/?>\s*<br\s*\/?>/i);
    chunks.forEach(function(c){var d=document.createElement('div');d.innerHTML=c;if(d.innerText.trim().length>3)parts.push(d);});
    if(parts.length>1)return parts;
  }
  /* All direct children as fallback */
  var all=Array.prototype.slice.call(el.children);
  if(all.length>1)return all;
  return[el];
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   FIND WHICH SELECTED PARENT
   contains a tapped element
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function selectedParentOf(el){
  for(var i=0;i<SEL.length;i++){
    if(SEL[i]!==el&&SEL[i].contains(el))return SEL[i];
  }
  return null;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   HIGHLIGHT HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function _mSel(el){el.setAttribute('data-ps14','s');el.style.cssText+=';outline:3px solid #7c3aed!important;outline-offset:3px!important;background-color:rgba(109,40,217,0.09)!important;border-radius:4px!important;';}
function _mPend(el){el.setAttribute('data-ps14','p');el.style.cssText+=';outline:2.5px dashed #f59e0b!important;outline-offset:3px!important;background-color:rgba(245,158,11,0.07)!important;border-radius:4px!important;';}
function _mExcl(el){
  el.setAttribute('data-ps14','x');
  el.style.cssText+=';outline:2px dashed #ef4444!important;outline-offset:3px!important;background-color:rgba(239,68,68,0.07)!important;border-radius:4px!important;';
  /* Fade out exclusion marker after 2s */
  setTimeout(function(){
    if(el.getAttribute('data-ps14')==='x'){
      el.removeAttribute('data-ps14');
      el.style.outline=el.style.outlineOffset=el.style.backgroundColor=el.style.borderRadius='';
    }
  },2000);
}
function _unmark(el){
  if(!el)return;
  el.removeAttribute('data-ps14');
  el.style.outline=el.style.outlineOffset=el.style.backgroundColor=el.style.borderRadius='';
}
function _clearPend(){if(PENDING){_unmark(PENDING);PENDING=null;}}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   ICONS
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var I={
  cut:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  print:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  up:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  dn:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  undo:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  trash:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
  copy:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  split:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 6l7-3 7 3M5 18l7 3 7-3"/></svg>',
  cog:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  txt:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  ok:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  link:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  excl:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   BUILD DOM
━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* 1 — Mini Pill */
var mini=document.createElement('div');
mini.id=NS+'Mini';
mini.innerHTML=
  '<button id="'+NS+'MBtn">'+
    '<div id="'+NS+'MIco">'+I.cut+'</div>'+
    '<div id="'+NS+'MInfo"><span id="'+NS+'MCnt">0</span><span id="'+NS+'MLbl"> selected</span></div>'+
    '<div id="'+NS+'MArr">'+I.up+'</div>'+
  '</button>'+
  '<button id="'+NS+'MPrn" title="Print now">'+I.print+'</button>';
document.body.appendChild(mini);

/* 2 — Add Tip (orange: preview/confirm) */
var addTip=document.createElement('div');
addTip.id=NS+'Tip';
addTip.innerHTML=
  '<div id="'+NS+'TipPrev"></div>'+
  '<div id="'+NS+'TipBtns">'+
    '<button id="'+NS+'TipOk">'+I.ok+' Add</button>'+
    '<button id="'+NS+'TipBig">'+I.up+' Bigger</button>'+
    '<button id="'+NS+'TipSml">'+I.dn+' Smaller</button>'+
    '<button id="'+NS+'TipX">\u2715</button>'+
  '</div>';
document.body.appendChild(addTip);

/* 3 — Exclude Tip (red: partial deselection) */
var exTip=document.createElement('div');
exTip.id=NS+'ExTip';
exTip.innerHTML=
  '<div id="'+NS+'ExHdr">'+I.excl+' <strong>Inside a selected block</strong></div>'+
  '<div id="'+NS+'ExPrev"></div>'+
  '<div id="'+NS+'ExBtns">'+
    '<button id="'+NS+'ExExcl">'+I.excl+' Exclude this part</button>'+
    '<button id="'+NS+'ExSplit">'+I.split+' Split into parts</button>'+
    '<button id="'+NS+'ExX">\u2715</button>'+
  '</div>';
document.body.appendChild(exTip);

/* 4 — Full Sheet */
var sheet=document.createElement('div');
sheet.id=NS+'Sheet';
sheet.innerHTML=
/* Handle */
'<div id="'+NS+'Hdl"><div id="'+NS+'HdlBar"></div></div>'+

/* Header */
'<div id="'+NS+'Hdr">'+
  '<div id="'+NS+'HdrL">'+
    '<div id="'+NS+'HdrIco">'+I.cut+'</div>'+
    '<div>'+
      '<div id="'+NS+'HdrT">Print Selection Pro</div>'+
      '<div id="'+NS+'HdrS">Select \u2022 Refine \u2022 Print</div>'+
    '</div>'+
  '</div>'+
  '<div id="'+NS+'HdrR">'+
    '<button id="'+NS+'BCog" title="Options">'+I.cog+'</button>'+
    '<button id="'+NS+'BMin">'+I.dn+' Minimise</button>'+
    '<button id="'+NS+'BCls">\u2715</button>'+
  '</div>'+
'</div>'+

/* Mode tabs */
'<div id="'+NS+'Tabs">'+
  '<button class="'+NS+'Tab _on" data-m="tap">'+I.cut+' Tap Pick</button>'+
  '<button class="'+NS+'Tab" data-m="text">'+I.txt+' Text Sel</button>'+
'</div>'+

/* ── TAP PANE ── */
'<div id="'+NS+'TapPane">'+

  /* Instruction */
  '<div id="'+NS+'Inst">'+
    '<span id="'+NS+'InstI">\uD83D\uDC46</span>'+
    '<div id="'+NS+'InstT">'+
      '<strong>Minimise then tap blocks</strong> on the page. '+
      'First tap = orange preview. Second tap = purple confirmed. '+
      'Tap <em>inside</em> a selected block to exclude a portion.'+
    '</div>'+
    '<button id="'+NS+'InstGo">'+I.dn+' Go</button>'+
  '</div>'+

  /* List */
  '<div id="'+NS+'List">'+
    '<div id="'+NS+'ListHdr">'+
      '<span class="'+NS+'SLbl">Selected</span>'+
      '<div id="'+NS+'ListR">'+
        '<span id="'+NS+'LBadge" class="'+NS+'Badge">0</span>'+
        '<button id="'+NS+'BAll">\u2714 All</button>'+
        '<button id="'+NS+'BUndo">'+I.undo+'</button>'+
        '<button id="'+NS+'BClr">'+I.trash+'</button>'+
      '</div>'+
    '</div>'+
    '<div id="'+NS+'ListBody"><div id="'+NS+'ListEmpty">Minimise and tap content on the page to begin.</div></div>'+
  '</div>'+

  /* Adjust */
  '<div id="'+NS+'Adj" style="display:none">'+
    '<span class="'+NS+'SLbl">Adjust last block</span>'+
    '<div id="'+NS+'AdjRow">'+
      '<button class="'+NS+'AB" id="'+NS+'AExp">'+I.up+' Expand</button>'+
      '<button class="'+NS+'AB" id="'+NS+'AShr">'+I.dn+' Shrink</button>'+
      '<button class="'+NS+'AB" id="'+NS+'ASpl">'+I.split+' Split</button>'+
      '<button class="'+NS+'AB" id="'+NS+'ACpy">'+I.copy+' Copy</button>'+
    '</div>'+
  '</div>'+

'</div>'+ /* /TapPane */

/* ── TEXT PANE ── */
'<div id="'+NS+'TextPane" style="display:none">'+
  '<div id="'+NS+'TxtBox"></div>'+
  '<div id="'+NS+'TxtMeta"></div>'+
  '<div id="'+NS+'TxtNote">\uD83D\uDCA1 Android: long-press a word \u2192 drag selection handles \u2192 re-open bookmarklet or tap Refresh.</div>'+
  '<button id="'+NS+'TxtRef">\u21bb Refresh selection</button>'+
'</div>'+

/* ── OPTIONS PANE ── */
'<div id="'+NS+'OptsPane" style="display:none">'+

  /* Margins */
  '<div class="'+NS+'OptSec">'+
    '<div class="'+NS+'OptSecHdr">\uD83D\uDDD2 Page Margins</div>'+

    /* Presets */
    '<div class="'+NS+'OptRow">'+
      '<span class="'+NS+'OLbl">Preset</span>'+
      '<div class="'+NS+'OBtns" id="'+NS+'MPresets">'+
        '<button class="'+NS+'OB" data-p="none">None</button>'+
        '<button class="'+NS+'OB" data-p="narrow">Narrow</button>'+
        '<button class="'+NS+'OB" data-p="normal">Normal</button>'+
        '<button class="'+NS+'OB _on" data-p="punch">Punch</button>'+
        '<button class="'+NS+'OB" data-p="binding">Binding</button>'+
      '</div>'+
    '</div>'+

    /* Inputs grid */
    '<div id="'+NS+'MGrid">'+
      '<div class="'+NS+'MCell '+NS+'MCT"><label>Top</label><div class="'+NS+'MStepper"><button class="'+NS+'MMinus" data-k="t">\u2212</button><input type="number" id="'+NS+'MT" min="0" step="0.5"><button class="'+NS+'MPlus" data-k="t">+</button></div></div>'+
      '<div id="'+NS+'MMidRow">'+
        '<div class="'+NS+'MCell '+NS+'MCL"><label id="'+NS+'LLbl">Left</label><div class="'+NS+'MStepper"><button class="'+NS+'MMinus" data-k="l">\u2212</button><input type="number" id="'+NS+'ML" min="0" step="0.5"><button class="'+NS+'MPlus" data-k="l">+</button></div></div>'+
        '<div id="'+NS+'MPageThumb">'+
          '<div id="'+NS+'MBandT" class="'+NS+'MBand"></div>'+
          '<div id="'+NS+'MBandB" class="'+NS+'MBand '+NS+'MBandBt"></div>'+
          '<div id="'+NS+'MBandL" class="'+NS+'MBand '+NS+'MBandLt"></div>'+
          '<div id="'+NS+'MBandR" class="'+NS+'MBand '+NS+'MBandRt"></div>'+
          '<div id="'+NS+'MContent">'+
            '<div class="'+NS+'MCLine"></div><div class="'+NS+'MCLine" style="width:80%"></div>'+
            '<div class="'+NS+'MCLine"></div><div class="'+NS+'MCLine" style="width:65%"></div>'+
            '<div class="'+NS+'MCLine" style="width:90%"></div>'+
          '</div>'+
        '</div>'+
        '<div class="'+NS+'MCell '+NS+'MCR"><label id="'+NS+'RLbl">Right</label><div class="'+NS+'MStepper"><button class="'+NS+'MMinus" data-k="r">\u2212</button><input type="number" id="'+NS+'MR" min="0" step="0.5"><button class="'+NS+'MPlus" data-k="r">+</button></div></div>'+
      '</div>'+
      '<div class="'+NS+'MCell '+NS+'MCB"><label>Bottom</label><div class="'+NS+'MStepper"><button class="'+NS+'MMinus" data-k="b">\u2212</button><input type="number" id="'+NS+'MB" min="0" step="0.5"><button class="'+NS+'MPlus" data-k="b">+</button></div></div>'+
    '</div>'+

    /* Unit + Link */
    '<div class="'+NS+'OptRow">'+
      '<span class="'+NS+'OLbl">Unit</span>'+
      '<div class="'+NS+'OBtns" id="'+NS+'UBtns">'+
        '<button class="'+NS+'OB" data-u="mm">mm</button>'+
        '<button class="'+NS+'OB" data-u="cm">cm</button>'+
        '<button class="'+NS+'OB" data-u="in">in</button>'+
      '</div>'+
      '<button id="'+NS+'LnkBtn">'+I.link+' <span id="'+NS+'LnkLbl">Link all</span></button>'+
    '</div>'+

    /* Binding side */
    '<div class="'+NS+'OptRow">'+
      '<span class="'+NS+'OLbl">Bind</span>'+
      '<div class="'+NS+'OBtns" id="'+NS+'BindBtns">'+
        '<button class="'+NS+'OB _on" data-s="left">\u25c4 Left</button>'+
        '<button class="'+NS+'OB" data-s="right">Right \u25ba</button>'+
        '<button class="'+NS+'OB" data-s="top">\u25b2 Top</button>'+
      '</div>'+
    '</div>'+

    /* Clearance meter */
    '<div id="'+NS+'Meter">'+
      '<div id="'+NS+'MeterBar"><div id="'+NS+'MeterFill"></div><div id="'+NS+'MeterMark"></div></div>'+
      '<div id="'+NS+'MeterInfo"><span id="'+NS+'MeterVal"></span><span id="'+NS+'MeterHint"></span></div>'+
    '</div>'+

  '</div>'+ /* /margin sec */

  /* Print settings */
  '<div class="'+NS+'OptSec">'+
    '<div class="'+NS+'OptSecHdr">\uD83D\uDDA8 Print Settings</div>'+
    '<div class="'+NS+'OptRow"><span class="'+NS+'OLbl">Font</span>'+
      '<div class="'+NS+'OBtns" id="'+NS+'FntBtns">'+
        '<button class="'+NS+'OB" data-f="11">Small</button>'+
        '<button class="'+NS+'OB _on" data-f="13">Normal</button>'+
        '<button class="'+NS+'OB" data-f="16">Large</button>'+
      '</div>'+
    '</div>'+
    '<div class="'+NS+'OptRow"><span class="'+NS+'OLbl">Paper</span>'+
      '<div class="'+NS+'OBtns" id="'+NS+'PprBtns">'+
        '<button class="'+NS+'OB _on" data-pp="A4">A4</button>'+
        '<button class="'+NS+'OB" data-pp="Letter">Letter</button>'+
      '</div>'+
    '</div>'+
    '<div class="'+NS+'OptRow"><span class="'+NS+'OLbl">Include</span>'+
      '<div class="'+NS+'OBtns">'+
        '<button class="'+NS+'OB _tog _on" id="'+NS+'OSrc">Source URL</button>'+
        '<button class="'+NS+'OB _tog _on" id="'+NS+'OKpS">Page styles</button>'+
      '</div>'+
    '</div>'+
  '</div>'+

'</div>'+ /* /OptsPane */

/* Footer */
'<div id="'+NS+'Footer">'+
  '<button class="'+NS+'FB _ghost" id="'+NS+'FCpy">'+I.copy+' Copy</button>'+
  '<button class="'+NS+'FB _primary" id="'+NS+'FPrn">'+I.print+' <span id="'+NS+'FPrnL">Print</span></button>'+
'</div>';

document.body.appendChild(sheet);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   STYLES
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var stEl=document.createElement('style');
stEl.id=NS+'Style';
stEl.textContent=[
/* Reset */
'[id^="'+NS+'"] *,[id^="'+NS+'"] *::before,[id^="'+NS+'"] *::after{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;font-family:"Outfit","Segoe UI",sans-serif;}',

/* Mini */
'#'+NS+'Mini{position:fixed;bottom:72px;right:16px;z-index:2147483646;display:flex;align-items:center;gap:5px;animation:ps14pop .32s cubic-bezier(.34,1.56,.64,1);}',
'@keyframes ps14pop{from{opacity:0;transform:scale(.5) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}',
'#'+NS+'MBtn{display:flex;align-items:center;gap:8px;height:50px;padding:0 16px 0 11px;background:rgba(8,8,16,0.92);backdrop-filter:blur(18px) saturate(1.6);border:1px solid rgba(255,255,255,0.1);border-radius:99px;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 8px 32px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.03) inset;transition:transform .15s,box-shadow .15s;}',
'#'+NS+'MBtn:active{transform:scale(.94);}',
'#'+NS+'MIco{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'#'+NS+'MCnt{font-size:18px;font-weight:700;color:#c4b5fd;transition:transform .2s cubic-bezier(.34,1.56,.64,1);}',
'#'+NS+'MLbl{font-size:12px;color:rgba(255,255,255,0.38);}',
'#'+NS+'MArr{color:rgba(255,255,255,0.35);display:flex;align-items:center;}',
'#'+NS+'MPrn{width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#4338ca);border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 22px rgba(109,40,217,0.55);transition:transform .15s;}',
'#'+NS+'MPrn:active{transform:scale(.9);}',

/* Add Tip */
'#'+NS+'Tip{display:none;position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);width:calc(100vw - 28px);max-width:360px;background:rgba(10,10,18,0.97);backdrop-filter:blur(22px);border:1px solid rgba(245,158,11,0.35);border-radius:16px;padding:12px 13px;box-shadow:0 16px 48px rgba(0,0,0,0.7),0 0 0 1px rgba(245,158,11,0.08) inset;}',
'#'+NS+'TipPrev{font-size:11.5px;color:rgba(255,255,255,0.4);font-family:"JetBrains Mono",monospace;margin-bottom:9px;max-height:44px;overflow:hidden;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}',
'#'+NS+'TipBtns{display:flex;gap:5px;}',
'#'+NS+'TipBtns button{padding:8px 11px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.6);font-size:11.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;flex:1;justify-content:center;-webkit-tap-highlight-color:transparent;transition:transform .1s;}',
'#'+NS+'TipBtns button:active{transform:scale(.93);}',
'#'+NS+'TipOk{background:rgba(109,40,217,0.3)!important;border-color:rgba(109,40,217,0.65)!important;color:#ddd6fe!important;}',
'#'+NS+'TipX{flex:0!important;padding:8px 11px!important;color:rgba(255,255,255,0.28)!important;}',

/* Exclude Tip */
'#'+NS+'ExTip{display:none;position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);width:calc(100vw - 28px);max-width:360px;background:rgba(10,10,18,0.97);backdrop-filter:blur(22px);border:1px solid rgba(239,68,68,0.38);border-radius:16px;padding:12px 13px;box-shadow:0 16px 48px rgba(0,0,0,0.7),0 0 0 1px rgba(239,68,68,0.07) inset;}',
'#'+NS+'ExHdr{display:flex;align-items:center;gap:6px;font-size:12px;color:#fca5a5;margin-bottom:6px;}',
'#'+NS+'ExHdr strong{color:#f87171;}',
'#'+NS+'ExPrev{font-size:11px;color:rgba(255,255,255,0.35);font-family:"JetBrains Mono",monospace;margin-bottom:9px;max-height:36px;overflow:hidden;line-height:1.5;}',
'#'+NS+'ExBtns{display:flex;gap:5px;flex-wrap:wrap;}',
'#'+NS+'ExBtns button{padding:8px 12px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.55);font-size:11.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;flex:1;justify-content:center;-webkit-tap-highlight-color:transparent;transition:transform .1s;}',
'#'+NS+'ExBtns button:active{transform:scale(.93);}',
'#'+NS+'ExExcl{background:rgba(239,68,68,0.18)!important;border-color:rgba(239,68,68,0.45)!important;color:#fca5a5!important;}',
'#'+NS+'ExSplit{background:rgba(109,40,217,0.18)!important;border-color:rgba(109,40,217,0.45)!important;color:#c4b5fd!important;}',
'#'+NS+'ExX{flex:0!important;padding:8px 11px!important;color:rgba(255,255,255,0.28)!important;}',

/* Sheet */
'#'+NS+'Sheet{position:fixed;bottom:0;left:0;right:0;z-index:2147483645;background:#0a0a12;border-top:1px solid rgba(255,255,255,0.07);border-radius:22px 22px 0 0;max-height:84vh;display:flex;flex-direction:column;box-shadow:0 -20px 60px rgba(0,0,0,0.7);transform:translateY(110%);transition:transform .35s cubic-bezier(.16,1,.3,1);}',
'#'+NS+'Sheet._open{transform:translateY(0);}',

/* Handle */
'#'+NS+'Hdl{flex-shrink:0;display:flex;justify-content:center;padding:10px 0 4px;cursor:grab;}',
'#'+NS+'HdlBar{width:36px;height:4px;background:rgba(255,255,255,0.1);border-radius:99px;}',

/* Header */
'#'+NS+'Hdr{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:4px 15px 11px;}',
'#'+NS+'HdrL{display:flex;align-items:center;gap:10px;}',
'#'+NS+'HdrIco{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 14px rgba(109,40,217,0.5);}',
'#'+NS+'HdrT{font-size:15px;font-weight:700;color:#f0f0fa;letter-spacing:-.25px;}',
'#'+NS+'HdrS{font-size:10px;color:rgba(255,255,255,0.22);margin-top:1px;}',
'#'+NS+'HdrR{display:flex;align-items:center;gap:5px;}',
'#'+NS+'BCog,#'+NS+'BMin{padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.35);font-size:11px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;transition:all .12s;}',
'#'+NS+'BCog:hover,#'+NS+'BMin:hover{border-color:rgba(109,40,217,0.45);color:#c4b5fd;}',
'#'+NS+'BCls{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.38);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
'#'+NS+'BCls:active{background:rgba(239,68,68,0.2);color:#f87171;}',

/* Tabs */
'#'+NS+'Tabs{flex-shrink:0;display:flex;gap:5px;padding:0 15px 10px;}',
'.'+NS+'Tab{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border-radius:10px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.32);font-size:12.5px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all .15s;}',
'.'+NS+'Tab._on{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.55);color:#c4b5fd;}',

/* Scrollable content area */
'#'+NS+'TapPane,#'+NS+'TextPane,#'+NS+'OptsPane{overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;min-height:0;}',

/* Instruction */
'#'+NS+'Inst{margin:0 15px 10px;display:flex;align-items:center;gap:9px;background:rgba(109,40,217,0.1);border:1px solid rgba(109,40,217,0.22);border-radius:12px;padding:10px 12px;}',
'#'+NS+'InstI{font-size:18px;flex-shrink:0;}',
'#'+NS+'InstT{flex:1;font-size:11.5px;color:rgba(255,255,255,0.4);line-height:1.5;}',
'#'+NS+'InstT strong{color:rgba(255,255,255,0.7);}',
'#'+NS+'InstT em{color:#c4b5fd;font-style:normal;}',
'#'+NS+'InstGo{padding:7px 13px;border-radius:8px;border:none;background:linear-gradient(135deg,#6d28d9,#4338ca);color:#fff;font-size:11.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;flex-shrink:0;}',

/* List */
'#'+NS+'List{margin:0 15px 10px;border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;}',
'#'+NS+'ListHdr{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.05);}',
'.'+NS+'SLbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,0.25);}',
'#'+NS+'ListR{display:flex;align-items:center;gap:5px;}',
'.'+NS+'Badge{background:rgba(109,40,217,0.3);color:#c4b5fd;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;}',
'#'+NS+'ListR button{padding:4px 8px;border-radius:7px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.35);font-size:11px;cursor:pointer;display:flex;align-items:center;gap:3px;-webkit-tap-highlight-color:transparent;}',
'#'+NS+'ListBody{max-height:150px;overflow-y:auto;}',
'#'+NS+'ListEmpty{padding:18px;text-align:center;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6;}',
'.'+NS+'SItem{display:flex;align-items:center;gap:7px;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.04);}',
'.'+NS+'SItem:last-child{border-bottom:none;}',
'.'+NS+'SNum{width:18px;height:18px;border-radius:50%;background:rgba(109,40,217,0.22);color:#c4b5fd;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
'.'+NS+'STxt{flex:1;font-size:11.5px;color:rgba(255,255,255,0.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
'.'+NS+'STag{font-size:9px;color:rgba(255,255,255,0.18);background:rgba(255,255,255,0.05);border-radius:4px;padding:1px 5px;flex-shrink:0;font-family:"JetBrains Mono",monospace;}',
'.'+NS+'SDel{width:20px;height:20px;border-radius:50%;border:none;background:rgba(239,68,68,0.1);color:rgba(239,68,68,0.5);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',

/* Adjust */
'#'+NS+'Adj{margin:0 15px 10px;}',
'#'+NS+'AdjRow{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;}',
'.'+NS+'AB{padding:7px 12px;border-radius:9px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.4);font-size:11.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;-webkit-tap-highlight-color:transparent;transition:all .12s;}',
'.'+NS+'AB:active{transform:scale(.95);}',

/* Text pane */
'#'+NS+'TextPane{padding:0 15px 10px;display:none;flex-direction:column;gap:9px;}',
'#'+NS+'TxtBox{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:11px;padding:12px 13px;font-size:12px;color:rgba(255,255,255,0.48);line-height:1.65;max-height:95px;overflow-y:auto;font-family:"JetBrains Mono",monospace;white-space:pre-wrap;word-break:break-word;}',
'#'+NS+'TxtMeta{font-size:11px;color:rgba(255,255,255,0.24);}',
'#'+NS+'TxtNote{font-size:11.5px;color:rgba(255,255,255,0.28);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:9px 12px;line-height:1.55;}',
'#'+NS+'TxtRef{padding:9px;border-radius:9px;border:1.5px solid rgba(109,40,217,0.35);background:rgba(109,40,217,0.1);color:#c4b5fd;font-size:12px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;}',

/* Options pane */
'#'+NS+'OptsPane{padding:0 15px 12px;display:none;flex-direction:column;gap:14px;}',
'.'+NS+'OptSec{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:13px;padding:12px 13px;display:flex;flex-direction:column;gap:10px;}',
'.'+NS+'OptSecHdr{font-size:11px;font-weight:600;color:rgba(255,255,255,0.35);letter-spacing:.04em;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:8px;margin-bottom:2px;}',
'.'+NS+'OptRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
'.'+NS+'OLbl{font-size:10px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:.07em;width:44px;flex-shrink:0;}',
'.'+NS+'OBtns{display:flex;gap:4px;flex-wrap:wrap;}',
'.'+NS+'OB{padding:6px 11px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.33);font-size:11.5px;font-weight:500;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all .12s;}',
'.'+NS+'OB._on{background:rgba(109,40,217,0.22);border-color:rgba(109,40,217,0.6);color:#c4b5fd;}',
'.'+NS+'OB:active{transform:scale(.95);}',
'#'+NS+'LnkBtn{padding:6px 11px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.33);font-size:11px;cursor:pointer;display:flex;align-items:center;gap:5px;-webkit-tap-highlight-color:transparent;white-space:nowrap;transition:all .12s;}',
'#'+NS+'LnkBtn._on{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.6);color:#c4b5fd;}',

/* Margin grid */
'#'+NS+'MGrid{display:flex;flex-direction:column;align-items:center;gap:5px;}',
'#'+NS+'MMidRow{display:flex;align-items:center;gap:5px;width:100%;}',
'.'+NS+'MCell{display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;}',
'.'+NS+'MCT,.'+NS+'MCB{max-width:140px;}',
'.'+NS+'MCL,.'+NS+'MCR{width:80px;flex-shrink:0;}',
'.'+NS+'MCell label{font-size:9px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:.07em;}',
'.'+NS+'MStepper{display:flex;align-items:center;gap:2px;width:100%;}',
'.'+NS+'MStepper input{flex:1;text-align:center;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.08);border-radius:8px;color:#e8e8f8;font-size:15px;font-family:"JetBrains Mono",monospace;font-weight:500;padding:6px 2px;outline:none;width:0;-moz-appearance:textfield;}',
'.'+NS+'MStepper input:focus{border-color:rgba(109,40,217,0.7);box-shadow:0 0 0 2px rgba(109,40,217,0.15);}',
'.'+NS+'MStepper input::-webkit-inner-spin-button{-webkit-appearance:none;}',
'.'+NS+'MMinus,.'+NS+'MPlus{width:28px;height:34px;border-radius:7px;border:1.5px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.4);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;transition:all .1s;}',
'.'+NS+'MMinus:active,.'+NS+'MPlus:active{background:rgba(109,40,217,0.2);color:#c4b5fd;}',

/* Page thumb diagram */
'#'+NS+'MPageThumb{flex:1;position:relative;height:90px;background:#131320;border:1.5px solid rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;}',
'.'+NS+'MBand{position:absolute;background:rgba(109,40,217,0.28);transition:all .18s ease;}',
'#'+NS+'MBandT{top:0;left:0;right:0;height:0;}',
'.'+NS+'MBandBt{bottom:0!important;top:auto!important;left:0;right:0;height:0;}',
'.'+NS+'MBandLt{top:0!important;left:0;bottom:0!important;width:0;}',
'.'+NS+'MBandRt{top:0!important;right:0;bottom:0!important;width:0;}',
'#'+NS+'MContent{position:absolute;inset:0;display:flex;flex-direction:column;gap:5px;justify-content:center;padding:5px;transition:all .18s ease;}',
'.'+NS+'MCLine{height:2px;width:100%;border-radius:1px;background:rgba(196,181,253,0.25);}',

/* Meter */
'#'+NS+'Meter{background:rgba(0,0,0,0.2);border-radius:9px;padding:9px 11px;display:flex;gap:10px;align-items:center;}',
'#'+NS+'MeterBar{flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:99px;position:relative;}',
'#'+NS+'MeterFill{height:100%;border-radius:99px;background:linear-gradient(90deg,#6d28d9,#7c3aed);transition:width .2s;}',
'#'+NS+'MeterMark{position:absolute;top:50%;transform:translateY(-50%);width:2px;height:14px;background:rgba(196,181,253,0.5);border-radius:1px;}',
'#'+NS+'MeterInfo{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;}',
'#'+NS+'MeterVal{font-size:16px;font-weight:600;color:#c4b5fd;font-family:"JetBrains Mono",monospace;line-height:1;}',
'#'+NS+'MeterHint{font-size:10px;color:rgba(255,255,255,0.28);margin-top:2px;}',

/* Footer */
'#'+NS+'Footer{flex-shrink:0;display:flex;gap:7px;padding:9px 15px 26px;border-top:1px solid rgba(255,255,255,0.05);}',
'.'+NS+'FB{flex:1;padding:12px;border-radius:13px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;-webkit-tap-highlight-color:transparent;transition:all .15s;}',
'.'+NS+'FB._ghost{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.38);}',
'.'+NS+'FB._primary{background:linear-gradient(135deg,#6d28d9,#4338ca);border:none;color:#fff;box-shadow:0 6px 22px rgba(109,40,217,0.45);}',
'.'+NS+'FB:active{transform:scale(.96);}'
].join('\n');
document.head.appendChild(stEl);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   PANEL OPEN / MIN / CLOSE
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function openPanel(){PANEL='full';sheet.classList.add('_open');$id('MArr').innerHTML=I.dn;}
function minPanel(){PANEL='mini';sheet.classList.remove('_open');$id('MArr').innerHTML=I.up;}
function closeAll(){
  minPanel();
  setTimeout(function(){
    ['Mini','Sheet','Tip','ExTip','Style'].forEach(function(k){var e=$id(k);if(e)e.remove();});
    _gc();
  },350);
}

$id('MBtn').addEventListener('click',openPanel);
$id('BMin').addEventListener('click',minPanel);
$id('InstGo').addEventListener('click',minPanel);
$id('BCls').addEventListener('click',closeAll);
$id('MPrn').addEventListener('click',function(){doPrint();});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAP HANDLER
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function onTap(e){
  var uiEls=['Mini','Sheet','Tip','ExTip'];
  for(var i=0;i<uiEls.length;i++){var el=$id(uiEls[i]);if(el&&el.contains(e.target))return;}
  e.preventDefault();e.stopPropagation();

  var block=findBlock(e.target);
  if(!block)return;

  /* ── Is the tapped element INSIDE an already selected block? ── */
  var parentSel=selectedParentOf(e.target);
  if(parentSel){
    /* Show exclusion tooltip */
    _clearPend();hideTip();
    var subBlock=findBlock(e.target);
    showExTip(e.clientY,parentSel,subBlock);
    return;
  }

  /* ── Is it the pending element? → CONFIRM ── */
  if(block===PENDING){
    _unmark(block);
    UNDO.push({type:'add',el:block});
    SEL.push(block);_mSel(block);
    _clearPend();hideTip();
    pulseCnt();updateUI();
    return;
  }

  /* ── New tap → PREVIEW ── */
  _clearPend();hideTip();hideExTip();
  PENDING=block;_mPend(block);
  showTip(e.clientY,block);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   ADD TOOLTIP
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function showTip(y,el){
  var t=$id('Tip');
  t.style.top=_tipY(y)+'px';
  $id('TipPrev').textContent=(el.innerText||'').trim().slice(0,90).replace(/\s+/g,' ')||'(no text)';
  t.style.display='block';
  clearTimeout(TIP_TMR);TIP_TMR=setTimeout(hideTip,6000);
}
function hideTip(){var t=$id('Tip');if(t)t.style.display='none';clearTimeout(TIP_TMR);}

$id('TipOk').addEventListener('click',function(){
  if(!PENDING)return;
  _unmark(PENDING);UNDO.push({type:'add',el:PENDING});
  SEL.push(PENDING);_mSel(PENDING);
  _clearPend();hideTip();pulseCnt();updateUI();
});
$id('TipX').addEventListener('click',function(){_clearPend();hideTip();});
$id('TipBig').addEventListener('click',function(){
  if(!PENDING)return;
  var b=expandEl(PENDING);_unmark(PENDING);PENDING=b;_mPend(b);
  $id('TipPrev').textContent=(b.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
});
$id('TipSml').addEventListener('click',function(){
  if(!PENDING)return;
  var s=shrinkEl(PENDING);if(s===PENDING)return;
  _unmark(PENDING);PENDING=s;_mPend(s);
  $id('TipPrev').textContent=(s.innerText||'').trim().slice(0,90).replace(/\s+/g,' ');
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   EXCLUDE TOOLTIP
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var _exParent=null,_exChild=null;

function showExTip(y,parent,child){
  _exParent=parent;_exChild=child;
  var t=$id('ExTip');
  t.style.top=_tipY(y)+'px';
  $id('ExPrev').textContent=(child.innerText||parent.innerText||'').trim().slice(0,80).replace(/\s+/g,' ');
  t.style.display='block';
}
function hideExTip(){var t=$id('ExTip');if(t)t.style.display='none';_exParent=null;_exChild=null;}

/* EXCLUDE: split parent into children, keep all except the tapped one */
$id('ExExcl').addEventListener('click',function(){
  if(!_exParent)return;
  var parent=_exParent,child=_exChild;
  hideExTip();

  /* Find which direct child of parent contains the tapped element */
  var kids=Array.prototype.slice.call(parent.children);
  var hitKid=null;
  for(var i=0;i<kids.length;i++){
    if(kids[i]===child||kids[i].contains(child)){hitKid=kids[i];break;}
  }
  /* If only 1 child or no children, try the child element directly */
  if(!hitKid)hitKid=child;

  if(kids.length<=1||hitKid===parent){
    /* Can't split — just deselect the whole block */
    var idx=SEL.indexOf(parent);
    if(idx!==-1){_unmark(parent);SEL.splice(idx,1);}
    updateUI();return;
  }

  /* Remove parent from selection */
  var pi=SEL.indexOf(parent);
  if(pi!==-1){_unmark(parent);SEL.splice(pi,1);}
  UNDO.push({type:'exclude',parent:parent,removed:hitKid,added:[]});

  /* Add all siblings, exclude the hit child */
  kids.forEach(function(k){
    if(k===hitKid){
      _mExcl(k); /* red flash then fade */
    } else {
      if((k.innerText||'').trim().length<2)return;
      SEL.push(k);_mSel(k);
      UNDO[UNDO.length-1].added.push(k);
    }
  });
  pulseCnt();updateUI();
});

/* SPLIT: replace parent with all its direct children as individual selections */
$id('ExSplit').addEventListener('click',function(){
  if(!_exParent)return;
  var parent=_exParent;
  hideExTip();

  var pi=SEL.indexOf(parent);
  if(pi!==-1){_unmark(parent);SEL.splice(pi,1);}

  var kids=splitEl(parent);
  var added=[];
  kids.forEach(function(k){
    if((k.innerText||'').trim().length<2)return;
    SEL.push(k);_mSel(k);added.push(k);
  });
  UNDO.push({type:'split',parent:parent,added:added});
  pulseCnt();updateUI();
});

$id('ExX').addEventListener('click',hideExTip);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   UNDO (handles exclude/split too)
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
$id('BUndo').addEventListener('click',function(){
  var last=UNDO.pop();if(!last)return;
  if(last.type==='add'){
    var i=SEL.indexOf(last.el);if(i!==-1){_unmark(last.el);SEL.splice(i,1);}
  } else if(last.type==='exclude'||last.type==='split'){
    /* Remove the added children */
    last.added.forEach(function(el){var i=SEL.indexOf(el);if(i!==-1){_unmark(el);SEL.splice(i,1);}});
    /* Restore parent */
    SEL.push(last.parent);_mSel(last.parent);
  }
  updateUI();
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   UPDATE UI
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function updateUI(){
  var n=SEL.length;
  var mc=$id('MCnt');if(mc)mc.textContent=n;
  var lb=$id('LBadge');if(lb)lb.textContent=n;
  var pl=$id('FPrnL');
  if(pl)pl.textContent=MODE==='text'?(TXTSEL?'Print text':'No text'):(n===0?'Nothing selected':'Print '+n+' block'+(n!==1?'s':''));
  var pb=$id('FPrn');
  if(pb)pb.style.opacity=(MODE==='text'&&TXTSEL)||(MODE==='tap'&&n>0)?'1':'0.42';
  var adj=$id('Adj');if(adj)adj.style.display=n>0?'block':'none';
  rebuildList();
  if(MODE==='text')refreshTxtPane();
  updateDiagram();updateMeter();updateMrgInputs();
  _save();
}

function pulseCnt(){var mc=$id('MCnt');if(!mc)return;mc.style.transform='scale(1.55)';setTimeout(function(){mc.style.transform='';},220);}

function rebuildList(){
  var body=$id('ListBody');if(!body)return;
  if(SEL.length===0){body.innerHTML='<div id="'+NS+'ListEmpty">Minimise and tap content on the page to begin.</div>';return;}
  body.innerHTML='';
  SEL.forEach(function(el,i){
    var txt=(el.innerText||'').trim().slice(0,52).replace(/\s+/g,' ');
    var tag=(el.tagName||'div').toLowerCase();
    var row=document.createElement('div');row.className=NS+'SItem';
    row.innerHTML='<div class="'+NS+'SNum">'+(i+1)+'</div>'
      +'<div class="'+NS+'STxt">'+escH(txt)+'</div>'
      +'<span class="'+NS+'STag">&lt;'+tag+'&gt;</span>'
      +'<button class="'+NS+'SDel" data-i="'+i+'">\u2715</button>';
    body.appendChild(row);
  });
  body.querySelectorAll('.'+NS+'SDel').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var i=parseInt(this.getAttribute('data-i'),10);
      if(SEL[i]){_unmark(SEL[i]);SEL.splice(i,1);updateUI();}
    });
  });
}

function refreshTxtPane(){
  var box=$id('TxtBox'),meta=$id('TxtMeta');
  if(box)box.textContent=TXTSEL||'No text selected yet.\nLong-press on the page \u2192 drag to extend \u2192 re-open bookmarklet.';
  if(meta&&TXTSEL){var w=TXTSEL.trim().split(/\s+/).length;meta.textContent=w+' words \u00b7 ~'+Math.ceil(w/200)+' min read \u00b7 '+TXTSEL.length+' chars';}
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   MARGIN DIAGRAM + METER
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function updateDiagram(){
  /* Page thumb is ~flex-1 wide, ~90px tall. Use 80x90 approx. A4=210x297 */
  var thumb=$id('MPageThumb');if(!thumb)return;
  var W=thumb.offsetWidth||80,H=90;
  var scW=W/210,scH=H/297;
  var tPx=Math.min(MRG.t*scH,H*0.42);
  var bPx=Math.min(MRG.b*scH,H*0.42);
  var lPx=Math.min(MRG.l*scW,W*0.42);
  var rPx=Math.min(MRG.r*scW,W*0.42);
  var bT=$id('MBandT'),bBt=$id('MBandB'),bL=$id('MBandL'),bR=$id('MBandR'),cnt=$id('MContent');
  if(bT)bT.style.height=tPx+'px';
  if(bBt)bBt.style.height=bPx+'px';
  if(bL)bL.style.width=lPx+'px';
  if(bR)bR.style.width=rPx+'px';
  /* Highlight binding side band */
  [bT,bBt,bL,bR].forEach(function(b){if(b)b.style.background='rgba(109,40,217,0.25)';});
  var bindBand={left:bL,right:bR,top:bT}[MRG_BIND];
  if(bindBand)bindBand.style.background='rgba(109,40,217,0.5)';
  if(cnt){cnt.style.top=tPx+'px';cnt.style.bottom=bPx+'px';cnt.style.left=lPx+'px';cnt.style.right=rPx+'px';}
}

function updateMeter(){
  var bindMM={left:MRG.l,right:MRG.r,top:MRG.t}[MRG_BIND]||MRG.l;
  var MAX=60,HOLE=25.4;
  var fill=$id('MeterFill'),mark=$id('MeterMark'),val=$id('MeterVal'),hint=$id('MeterHint');
  if(!fill)return;
  fill.style.width=Math.min(bindMM/MAX*100,100)+'%';
  if(mark)mark.style.left=Math.min(HOLE/MAX*100,100)+'%';
  if(val)val.textContent=toD(bindMM)+MRG_UNIT;
  var clearance=bindMM-HOLE;
  if(hint){
    if(clearance<0){hint.style.color='#f87171';hint.textContent='\u26a0 '+Math.abs(toD(clearance)).toFixed(MD[MRG_UNIT])+MRG_UNIT+' too narrow';}
    else if(clearance<4){hint.style.color='#fbbf24';hint.textContent='\u26a0 Only '+toD(clearance)+MRG_UNIT+' clearance';}
    else{hint.style.color='#34d399';hint.textContent='\u2713 '+toD(clearance)+MRG_UNIT+' safe';}
  }
}

function updateMrgInputs(){
  var keys=['t','r','b','l'];
  keys.forEach(function(k){var el=$id('M'+k.toUpperCase());if(el)el.value=toD(MRG[k]);});
  /* Active unit */
  document.querySelectorAll('#'+NS+'UBtns .'+NS+'OB').forEach(function(b){
    b.classList.toggle('_on',b.getAttribute('data-u')===MRG_UNIT);
  });
  /* Active binding */
  document.querySelectorAll('#'+NS+'BindBtns .'+NS+'OB').forEach(function(b){
    b.classList.toggle('_on',b.getAttribute('data-s')===MRG_BIND);
  });
  /* Binding side labels */
  var ll=$id('LLbl'),rl=$id('RLbl');
  if(ll)ll.innerHTML='Left'+(MRG_BIND==='left'?' <span style="color:#a78bfa;font-size:8px">\u25c4bind</span>':'');
  if(rl)rl.innerHTML='Right'+(MRG_BIND==='right'?' <span style="color:#a78bfa;font-size:8px">bind\u25ba</span>':'');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   MARGIN INPUT EVENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function wireInput(k,inputId){
  var el=$id(inputId);if(!el)return;
  el.addEventListener('input',function(){
    var v=toMM(parseFloat(this.value)||0);
    if(MRG_LINKED){MRG.t=MRG.r=MRG.b=MRG.l=v;updateMrgInputs();}
    else{MRG[k]=v;}
    updateDiagram();updateMeter();detectPreset();_save();
  });
}
wireInput('t','MT');wireInput('r','MR');wireInput('b','MB');wireInput('l','ML');

/* Stepper +/- */
document.querySelectorAll('.'+NS+'MMinus,.'+NS+'MPlus').forEach(function(btn){
  btn.addEventListener('click',function(){
    var k=this.getAttribute('data-k');
    var step=MRG_UNIT==='in'?0.05:MRG_UNIT==='cm'?0.5:1; /* step in mm */
    var delta=this.className.indexOf('Plus')!==-1?step:-step;
    if(MRG_LINKED){MRG.t=Math.max(0,MRG.t+delta);MRG.r=Math.max(0,MRG.r+delta);MRG.b=Math.max(0,MRG.b+delta);MRG.l=Math.max(0,MRG.l+delta);}
    else{MRG[k]=Math.max(0,MRG[k]+delta);}
    updateMrgInputs();updateDiagram();updateMeter();detectPreset();_save();
  });
});

/* Presets */
$id('MPresets').addEventListener('click',function(e){
  var btn=e.target.closest('.'+NS+'OB');if(!btn)return;
  var p=btn.getAttribute('data-p');if(!p||!MRG_PRESETS[p])return;
  MRG=Object.assign({},MRG_PRESETS[p]);
  updateMrgInputs();updateDiagram();updateMeter();detectPreset();_save();
});

function detectPreset(){
  var found=null;
  Object.keys(MRG_PRESETS).forEach(function(k){
    var p=MRG_PRESETS[k];
    if(Math.abs(MRG.t-p.t)<0.2&&Math.abs(MRG.r-p.r)<0.2&&Math.abs(MRG.b-p.b)<0.2&&Math.abs(MRG.l-p.l)<0.2)found=k;
  });
  document.querySelectorAll('#'+NS+'MPresets .'+NS+'OB').forEach(function(b){b.classList.toggle('_on',b.getAttribute('data-p')===found);});
}

/* Unit */
$id('UBtns').addEventListener('click',function(e){
  var btn=e.target.closest('.'+NS+'OB');if(!btn)return;
  MRG_UNIT=btn.getAttribute('data-u');
  updateMrgInputs();updateDiagram();updateMeter();_save();
});

/* Link */
$id('LnkBtn').addEventListener('click',function(){
  MRG_LINKED=!MRG_LINKED;
  this.classList.toggle('_on',MRG_LINKED);
  $id('LnkLbl').textContent=MRG_LINKED?'Linked \u2713':'Link all';
  if(MRG_LINKED){MRG.r=MRG.b=MRG.l=MRG.t;updateMrgInputs();updateDiagram();updateMeter();detectPreset();}
  _save();
});

/* Binding side */
$id('BindBtns').addEventListener('click',function(e){
  var btn=e.target.closest('.'+NS+'OB');if(!btn)return;
  MRG_BIND=btn.getAttribute('data-s');
  updateMeter();updateMrgInputs();updateDiagram();_save();
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   OPTIONS PANE TOGGLE
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
$id('BCog').addEventListener('click',function(){
  var op=$id('OptsPane'),tp=$id('TapPane'),txp=$id('TextPane');
  var vis=op.style.display!=='none';
  op.style.display=vis?'none':'flex';
  tp.style.display=vis?(MODE==='tap'?'block':'none'):'none';
  txp.style.display=vis?(MODE==='text'?'flex':'none'):'none';
  if(!vis){updateDiagram();updateMeter();updateMrgInputs();}
});

/* Print settings toggles */
$id('FntBtns').addEventListener('click',function(e){
  var b=e.target.closest('.'+NS+'OB');if(!b)return;
  this.querySelectorAll('.'+NS+'OB').forEach(function(x){x.classList.remove('_on');});b.classList.add('_on');
  POPT.fontSize=b.getAttribute('data-f');_save();
});
$id('PprBtns').addEventListener('click',function(e){
  var b=e.target.closest('.'+NS+'OB');if(!b)return;
  this.querySelectorAll('.'+NS+'OB').forEach(function(x){x.classList.remove('_on');});b.classList.add('_on');
  POPT.paper=b.getAttribute('data-pp');_save();
});
$id('OSrc').addEventListener('click',function(){POPT.showSrc=!POPT.showSrc;this.classList.toggle('_on',POPT.showSrc);_save();});
$id('OKpS').addEventListener('click',function(){POPT.keepStyle=!POPT.keepStyle;this.classList.toggle('_on',POPT.keepStyle);_save();});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   SELECT ALL / CLEAR
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
$id('BAll').addEventListener('click',function(){
  _clearAll();
  var sh=$id('Sheet');
  document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figure,table').forEach(function(el){
    if(sh&&sh.contains(el))return;
    if(el.offsetParent===null)return;
    if((el.innerText||'').trim().length<5)return;
    if(SEL.indexOf(el)===-1){SEL.push(el);_mSel(el);}
  });
  updateUI();
});
$id('BClr').addEventListener('click',function(){_clearAll();updateUI();});
function _clearAll(){_clearPend();hideTip();hideExTip();SEL.forEach(function(el){_unmark(el);});SEL=[];UNDO=[];}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   ADJUST LAST BLOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
$id('AExp').addEventListener('click',function(){if(!SEL.length)return;var i=SEL.length-1,cur=SEL[i],b=expandEl(cur);if(b!==cur){_unmark(cur);SEL[i]=b;_mSel(b);updateUI();}});
$id('AShr').addEventListener('click',function(){if(!SEL.length)return;var i=SEL.length-1,cur=SEL[i],b=shrinkEl(cur);if(b!==cur){_unmark(cur);SEL[i]=b;_mSel(b);updateUI();}});
$id('ASpl').addEventListener('click',function(){
  if(!SEL.length)return;
  var i=SEL.length-1,cur=SEL[i],parts=splitEl(cur);
  if(parts.length<=1)return;
  _unmark(cur);SEL.splice(i,1);
  parts.forEach(function(p){if((p.innerText||'').trim().length>2){SEL.push(p);_mSel(p);}});
  updateUI();
});
$id('ACpy').addEventListener('click',function(){
  if(!SEL.length)return;
  _copyTxt(SEL.map(function(el){return(el.innerText||'').trim();}).join('\n\n'),$id('ACpy'));
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODE TABS
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
document.querySelectorAll('.'+NS+'Tab').forEach(function(btn){
  btn.addEventListener('click',function(){
    MODE=this.getAttribute('data-m');
    document.querySelectorAll('.'+NS+'Tab').forEach(function(b){b.classList.remove('_on');});
    this.classList.add('_on');
    $id('TapPane').style.display=MODE==='tap'?'block':'none';
    $id('TextPane').style.display=MODE==='text'?'flex':'none';
    $id('OptsPane').style.display='none';
    if(MODE==='text'){var s2=window.getSelection();if(s2&&s2.toString().trim().length>0)TXTSEL=s2.toString().trim();}
    updateUI();
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   TEXT MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
$id('TxtRef').addEventListener('click',function(){var s3=window.getSelection();if(s3&&s3.toString().trim().length>0)TXTSEL=s3.toString().trim();refreshTxtPane();updateUI();});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   COPY
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
$id('FCpy').addEventListener('click',function(){
  var txt=MODE==='text'?TXTSEL:SEL.map(function(el){return(el.innerText||'').trim();}).join('\n\n');
  if(!txt)return;_copyTxt(txt,$id('FCpy'));
});
function _copyTxt(txt,btn){
  function done(){if(btn){var orig=btn.innerHTML;btn.innerHTML=I.ok+' Copied!';setTimeout(function(){btn.innerHTML=orig;},2000);}}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(function(){_fb(txt);done();});}
  else{_fb(txt);done();}
}
function _fb(t){var ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0;top:0;left:0;';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   PRINT
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
$id('FPrn').addEventListener('click',doPrint);
function doPrint(){MODE==='text'?printText():printBlocks();}

function _margin(){return MRG.t+'mm '+MRG.r+'mm '+MRG.b+'mm '+MRG.l+'mm';}
function _paperMrg(){return POPT.paper==='Letter'?'1in':'25mm';}

function printText(){
  if(!TXTSEL)return;
  var win=window.open('','_blank','width=800,height=600,toolbar=0,menubar=0,location=0,scrollbars=1');
  if(!win){alert('Allow pop-ups and try again.');return;}
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print Selection</title>'
    +'<style>body{font-family:Georgia,serif;font-size:'+POPT.fontSize+'pt;line-height:1.85;max-width:760px;margin:40px auto;color:#111;padding:0 24px;}'
    +'pre{white-space:pre-wrap;font-size:inherit;background:none;padding:0;}footer{margin-top:36px;font-size:9pt;color:#aaa;border-top:1px solid #eee;padding-top:10px;}'
    +'@media print{@page{margin:'+_margin()+'}body{margin:0;}}</style></head><body>'
    +'<pre>'+escH(TXTSEL)+'</pre>'
    +(POPT.showSrc?'<footer>'+escH(location.href)+'</footer>':'')
    +'</body></html>');
  win.document.close();win.focus();setTimeout(function(){win.print();},400);
  minPanel();
}

function printBlocks(){
  if(!SEL.length)return;
  var pageCSS='';
  if(POPT.keepStyle){
    try{Array.prototype.slice.call(document.styleSheets).forEach(function(sh){
      try{Array.prototype.slice.call(sh.cssRules||sh.rules||[]).forEach(function(r){pageCSS+=r.cssText+'\n';});}catch(e){}
    });}catch(e){}
  }
  var parts=SEL.map(function(el){
    var c=el.cloneNode(true);c.removeAttribute('data-ps14');
    c.style.outline=c.style.outlineOffset=c.style.backgroundColor=c.style.borderRadius='';
    return '<div class="ps14b">'+c.outerHTML+'</div>';
  });
  var win=window.open('','_blank','width=820,height=700,toolbar=0,menubar=0,location=0,scrollbars=1');
  if(!win){alert('Allow pop-ups and try again.');return;}
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8">'
    +'<base href="'+location.origin+'">'
    +'<title>'+escH(document.title||location.hostname)+'</title>'
    +(POPT.keepStyle?'<style>'+pageCSS+'</style>':'')
    +'<style>body{max-width:800px;margin:0 auto;padding:24px;font-size:'+POPT.fontSize+'pt;}.ps14b{margin-bottom:1.5em;}'
    +'footer{margin-top:36px;font-size:9pt;color:#999;border-top:1px solid #eee;padding-top:10px;}'
    +'@media print{@page{margin:'+_margin()+'}body{padding:0;max-width:none;}a{color:inherit;text-decoration:none;}}'
    +'</style></head><body>'
    +parts.join('\n')
    +(POPT.showSrc?'<footer>'+SEL.length+' block'+(SEL.length!==1?'s':'')+' \u00b7 '+escH(location.href)+'</footer>':'')
    +'</body></html>');
  win.document.close();win.focus();setTimeout(function(){win.print();},500);
  minPanel();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   SWIPE + KEYBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var _sy=0;
var hdl=$id('Hdl');
hdl.addEventListener('touchstart',function(e){_sy=e.touches[0].clientY;},{passive:true});
hdl.addEventListener('touchend',function(e){if(e.changedTouches[0].clientY-_sy>50)minPanel();},{passive:true});

function _onKey(e){
  if(e.key==='Escape'){if(PANEL==='full')minPanel();else closeAll();}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter')doPrint();
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){$id('BUndo').click();}
}
document.addEventListener('keydown',_onKey);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function _tipY(tapY){var VH=window.innerHeight;var top=tapY-140;if(top<10)top=tapY+65;if(top+130>VH-80)top=VH-230;return Math.max(8,top);}
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _save(){
  try{localStorage.setItem(NS+'pref',JSON.stringify({MRG:MRG,MRG_UNIT:MRG_UNIT,MRG_BIND:MRG_BIND,POPT:POPT}));}catch(e){}
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   GLOBAL CLEANUP
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function _gc(){
  document.removeEventListener('click',onTap,true);
  document.removeEventListener('keydown',_onKey);
  clearTimeout(TIP_TMR);
  SEL.forEach(function(el){_unmark(el);});
  _clearPend();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━
   INIT
━━━━━━━━━━━━━━━━━━━━━━━━━━ */
document.addEventListener('click',onTap,true);
if(MODE==='text')openPanel();
updateUI();detectPreset();

})();
