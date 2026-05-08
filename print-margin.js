(function () {

/* ═══ GUARD ═══ */
var PID = '__pm9Panel', SID = '__pm9Style';
var ex = document.getElementById(PID);
if (ex) { ex.remove(); var es = document.getElementById(SID); if (es) es.remove(); return; }

/* ═══ FONTS ═══ */
if (!document.getElementById('__pm9Font')) {
  var fl = document.createElement('link');
  fl.id = '__pm9Font'; fl.rel = 'stylesheet';
  fl.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@600;700&display=swap';
  document.head.appendChild(fl);
}

/* ═══ CONSTANTS ═══ */
/* Standard hole-punch offset: 25.4mm from edge to centre of holes */
var HOLE_OFFSET_MM = 25.4;

var PRESETS = {
  none:    { t:0,    r:0,    b:0,    l:0    },
  narrow:  { t:12.7, r:12.7, b:12.7, l:12.7 },
  normal:  { t:25.4, r:25.4, b:25.4, l:25.4 },
  wide:    { t:25.4, r:25.4, b:25.4, l:38.1 }, /* ← "Punch" default */
  binding: { t:25.4, r:19.0, b:25.4, l:38.1 }
};

/* Binding sides */
var BIND_SIDES = ['left','right','top'];

var FACTOR   = { mm:1, cm:0.1, 'in':1/25.4 };
var DECIMALS = { mm:1, cm:2,   'in':3       };
var STEP     = { mm:'0.5', cm:'0.1', 'in':'0.01' };

/* ═══ STATE ═══ */
var unit  = 'mm';
var linked= false;
var bindSide = 'left';          /* which side gets the extra margin */
var MM = { t:25.4, r:19.0, b:25.4, l:38.1 };  /* wider left default */

try {
  var sv = JSON.parse(localStorage.getItem('__pm9v3')||'null');
  if (sv) {
    if (sv.unit)     unit     = sv.unit;
    if (sv.MM)       MM       = sv.MM;
    if (sv.bindSide) bindSide = sv.bindSide;
  }
} catch(e){}

/* ═══ UNIT HELPERS ═══ */
function toDisp(v){ return parseFloat((v*FACTOR[unit]).toFixed(DECIMALS[unit])); }
function toMM(v)  { return v/FACTOR[unit]; }

/* ═══ SVG ICONS ═══ */
var icoPrint = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
var icoLink  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
var icoCopy  = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
var icoHole  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/></svg>';
var icoClose = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

/* ═══ HTML ═══ */
var panel = document.createElement('div');
panel.id = PID;

panel.innerHTML =
  '<div id="__pm9Ov"></div>'+
  '<div id="__pm9Box">'+

  /* Header */
  '<div id="__pm9Hdr">'+
    '<div id="__pm9HLft">'+
      '<div id="__pm9HIco">'+icoHole+'</div>'+
      '<div><div id="__pm9Ttl">Print Margins</div>'+
      '<div id="__pm9Sub">drag \u00b7 Esc closes \u00b7 Ctrl+\u21b5 prints</div></div>'+
    '</div>'+
    '<button id="__pm9Cls" title="Close">'+icoClose+'</button>'+
  '</div>'+

  /* Body */
  '<div id="__pm9Bdy">'+

  /* ── Binding strip ── */
  '<div id="__pm9BindStrip">'+
    '<div id="__pm9BSLeft">'+
      '<span class="__pm9Pill" id="__pm9PunchBadge">'+icoHole+' Hole-punch mode</span>'+
    '</div>'+
    '<div id="__pm9BindSide">'+
      '<span class="__pm9SLbl">Binding side</span>'+
      '<button class="__pm9BS active" data-s="left">\u25c4 Left</button>'+
      '<button class="__pm9BS" data-s="right">Right \u25ba</button>'+
      '<button class="__pm9BS" data-s="top">\u25b2 Top</button>'+
    '</div>'+
  '</div>'+

  /* ── Binding margin offset ── */
  '<div id="__pm9BindRow">'+
    '<div id="__pm9BindGauge">'+
      '<div id="__pm9GaugeTrack">'+
        '<div id="__pm9GaugeFill"></div>'+
        '<div id="__pm9GaugeHole" title="25.4mm hole-punch safe zone"></div>'+
      '</div>'+
      '<div id="__pm9GaugeLbls">'+
        '<span>0</span>'+
        '<span id="__pm9HoleLbl">25.4mm</span>'+
        '<span>60mm</span>'+
      '</div>'+
    '</div>'+
    '<div id="__pm9BindInfo">'+
      '<div id="__pm9BindVal"></div>'+
      '<div id="__pm9BindHint"></div>'+
    '</div>'+
  '</div>'+

  /* ── Presets ── */
  '<div id="__pm9PreRow">'+
    '<span class="__pm9SLbl">Preset</span>'+
    '<div id="__pm9PBtns">'+
      '<button class="__pm9P" data-p="none">None</button>'+
      '<button class="__pm9P" data-p="narrow">Narrow</button>'+
      '<button class="__pm9P" data-p="normal">Normal</button>'+
      '<button class="__pm9P" data-p="wide">Punch</button>'+
      '<button class="__pm9P" data-p="binding">Binding</button>'+
    '</div>'+
  '</div>'+

  /* ── Margin grid + diagram ── */
  '<div id="__pm9Grid">'+
    '<div class="__pm9IC" id="__pm9CellT">'+
      '<label class="__pm9ILbl">Top</label>'+
      '<input type="number" id="__pm9T" min="0">'+
    '</div>'+
    '<div id="__pm9Mid">'+
      '<div class="__pm9IC __pm9Side" id="__pm9CellL">'+
        '<label class="__pm9ILbl" id="__pm9LLbl">Left<span class="__pm9BindMark" id="__pm9LMark"></span></label>'+
        '<input type="number" id="__pm9L" min="0">'+
      '</div>'+

      '<div id="__pm9DWrap">'+
        '<canvas id="__pm9Canvas" width="106" height="150"></canvas>'+
      '</div>'+

      '<div class="__pm9IC __pm9Side" id="__pm9CellR">'+
        '<label class="__pm9ILbl" id="__pm9RLbl">Right<span class="__pm9BindMark" id="__pm9RMark"></span></label>'+
        '<input type="number" id="__pm9R" min="0">'+
      '</div>'+
    '</div>'+
    '<div class="__pm9IC" id="__pm9CellB">'+
      '<label class="__pm9ILbl" id="__pm9BLbl">Bottom<span class="__pm9BindMark" id="__pm9BMark"></span></label>'+
      '<input type="number" id="__pm9B" min="0">'+
    '</div>'+
  '</div>'+

  /* ── Controls: link + units ── */
  '<div id="__pm9CtrlRow">'+
    '<button id="__pm9LnkBtn">'+icoLink+' <span id="__pm9LnkLbl">Link all</span></button>'+
    '<div id="__pm9UBtns">'+
      '<button class="__pm9U" data-u="mm">mm</button>'+
      '<button class="__pm9U" data-u="cm">cm</button>'+
      '<button class="__pm9U" data-u="in">in</button>'+
    '</div>'+
  '</div>'+

  /* ── CSS bar ── */
  '<div id="__pm9CSSBar">'+
    '<code id="__pm9CSSCode"></code>'+
    '<button id="__pm9CpyBtn">'+icoCopy+' <span id="__pm9CpyLbl">Copy</span></button>'+
  '</div>'+

  /* ── Print button ── */
  '<button id="__pm9PrnBtn">'+icoHole+' Print &amp; Punch Ready<span id="__pm9KHint">Ctrl+\u21b5</span></button>'+

  '</div>'+ /* /body */
  '</div>';  /* /box */

document.body.appendChild(panel);

/* ═══ STYLES ═══ */
var style = document.createElement('style');
style.id = SID;
style.textContent = [
'#__pm9Panel *,#__pm9Panel *::before,#__pm9Panel *::after{box-sizing:border-box;margin:0;padding:0;font-family:"JetBrains Mono","Courier New",monospace;-webkit-font-smoothing:antialiased;}',
'#__pm9Ov{position:fixed;inset:0;z-index:2147483640;background:rgba(4,4,8,0.7);backdrop-filter:blur(10px) saturate(0.6);animation:__pmFI .22s ease forwards;}',
'@keyframes __pmFI{from{opacity:0}to{opacity:1}}',
'#__pm9Box{position:fixed;z-index:2147483641;top:50%;left:50%;transform:translate(-50%,-50%);width:390px;background:#080810;border:1px solid rgba(255,255,255,0.07);border-radius:22px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,0.03) inset,0 60px 140px rgba(0,0,0,0.9),0 0 100px rgba(109,40,217,0.12);animation:__pmSU .3s cubic-bezier(.16,1,.3,1) forwards;}',
'@keyframes __pmSU{from{opacity:0;transform:translate(-50%,-47%) scale(.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}',

/* Header */
'#__pm9Hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:linear-gradient(135deg,rgba(109,40,217,0.2),rgba(67,56,202,0.08));border-bottom:1px solid rgba(255,255,255,0.06);cursor:grab;user-select:none;}',
'#__pm9Hdr:active{cursor:grabbing;}',
'#__pm9HLft{display:flex;align-items:center;gap:11px;}',
'#__pm9HIco{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6d28d9,#4338ca);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 16px rgba(109,40,217,0.5);}',
'#__pm9Ttl{font-family:"Outfit",sans-serif;font-size:15px;font-weight:700;color:#f0f0fa;letter-spacing:-.2px;}',
'#__pm9Sub{font-size:9.5px;color:rgba(255,255,255,0.2);margin-top:2px;}',
'#__pm9Cls{width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}',
'#__pm9Cls:hover{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171;}',

/* Body */
'#__pm9Bdy{padding:15px 18px 20px;display:flex;flex-direction:column;gap:12px;}',
'.__pm9SLbl{font-size:10px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;}',

/* Binding strip */
'#__pm9BindStrip{display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(109,40,217,0.1);border:1px solid rgba(109,40,217,0.25);border-radius:12px;padding:9px 12px;}',
'#__pm9BSLeft{flex-shrink:0;}',
'.__pm9Pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:#c4b5fd;font-weight:500;}',
'#__pm9BindSide{display:flex;align-items:center;gap:6px;}',
'.__pm9BS{padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-size:10px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'.__pm9BS:hover{border-color:rgba(109,40,217,0.5);color:#c4b5fd;}',
'.__pm9BS.active{background:rgba(109,40,217,0.28);border-color:rgba(109,40,217,0.7);color:#ddd6fe;}',

/* Binding gauge */
'#__pm9BindRow{background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:10px 13px;display:flex;gap:12px;align-items:center;}',
'#__pm9BindGauge{flex:1;}',
'#__pm9GaugeTrack{height:10px;background:rgba(255,255,255,0.06);border-radius:99px;position:relative;overflow:visible;margin-bottom:5px;}',
'#__pm9GaugeFill{height:100%;border-radius:99px;background:linear-gradient(90deg,#6d28d9,#7c3aed);transition:width .2s ease;position:absolute;top:0;left:0;}',
'#__pm9GaugeHole{position:absolute;top:50%;transform:translateY(-50%);width:2px;height:18px;background:rgba(196,181,253,0.5);border-radius:1px;}',
'#__pm9GaugeLbls{display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,0.2);}',
'#__pm9HoleLbl{color:rgba(196,181,253,0.6);}',
'#__pm9BindInfo{text-align:right;flex-shrink:0;}',
'#__pm9BindVal{font-size:18px;font-weight:500;color:#c4b5fd;line-height:1;}',
'#__pm9BindHint{font-size:9.5px;color:rgba(255,255,255,0.25);margin-top:3px;}',

/* Presets */
'#__pm9PreRow{display:flex;align-items:center;gap:8px;}',
'#__pm9PBtns{display:flex;gap:3px;flex:1;}',
'.__pm9P{flex:1;padding:6px 2px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;color:rgba(255,255,255,0.35);font-size:10.5px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'.__pm9P:hover{border-color:rgba(109,40,217,0.5);color:rgba(255,255,255,0.7);}',
'.__pm9P.__pm9On{background:rgba(109,40,217,0.22);border-color:rgba(109,40,217,0.65);color:#c4b5fd;}',

/* Grid */
'#__pm9Grid{display:flex;flex-direction:column;align-items:center;gap:6px;}',
'#__pm9Mid{display:flex;align-items:center;gap:7px;width:100%;}',
'.__pm9IC{display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;}',
'.__pm9Side{width:72px;flex-shrink:0;}',
'.__pm9ILbl{font-size:9.5px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:4px;}',
'.__pm9BindMark{font-size:8px;color:#a78bfa;display:none;}',
'.__pm9BindMark.vis{display:inline;}',
'.__pm9IC input{width:100%;text-align:center;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.08);border-radius:10px;color:#e8e8f8;font-size:17px;font-family:"JetBrains Mono",monospace;font-weight:500;padding:8px 2px;outline:none;transition:border-color .15s,box-shadow .15s;-moz-appearance:textfield;}',
'.__pm9IC input::-webkit-inner-spin-button,.__pm9IC input::-webkit-outer-spin-button{-webkit-appearance:none;}',
'.__pm9IC input:focus{border-color:rgba(109,40,217,0.75);box-shadow:0 0 0 3px rgba(109,40,217,0.18);}',
'.__pm9IC input.__pm9BindInput{border-color:rgba(109,40,217,0.45);background:rgba(109,40,217,0.1);}',
'.__pm9Side input{font-size:14px;padding:7px 2px;}',

/* Canvas diagram */
'#__pm9DWrap{flex:1;display:flex;align-items:center;justify-content:center;}',
'#__pm9Canvas{border-radius:3px;display:block;}',

/* Controls */
'#__pm9CtrlRow{display:flex;align-items:center;justify-content:space-between;gap:10px;}',
'#__pm9LnkBtn{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-size:11px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'#__pm9LnkBtn:hover{border-color:rgba(109,40,217,0.5);color:rgba(255,255,255,0.7);}',
'#__pm9LnkBtn.__pm9On{background:rgba(109,40,217,0.2);border-color:rgba(109,40,217,0.7);color:#c4b5fd;}',
'#__pm9UBtns{display:flex;gap:3px;}',
'.__pm9U{padding:6px 10px;border-radius:7px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.35);font-size:11px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;}',
'.__pm9U:hover{color:rgba(255,255,255,0.7);border-color:rgba(255,255,255,0.15);}',
'.__pm9U.__pm9On{background:rgba(109,40,217,0.25);border-color:rgba(109,40,217,0.7);color:#c4b5fd;}',

/* CSS bar */
'#__pm9CSSBar{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:8px 10px 8px 13px;}',
'#__pm9CSSCode{font-size:10px;color:#a78bfa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;}',
'#__pm9CpyBtn{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:7px;white-space:nowrap;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);font-size:10px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .15s;flex-shrink:0;}',
'#__pm9CpyBtn:hover{border-color:rgba(109,40,217,0.5);color:#c4b5fd;}',
'#__pm9CpyBtn.__pm9Cp{color:#34d399;border-color:rgba(52,211,153,0.4);}',

/* Print button */
'#__pm9PrnBtn{width:100%;padding:13px;background:linear-gradient(135deg,#6d28d9 0%,#4338ca 100%);border:none;border-radius:13px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-family:"Outfit",sans-serif;font-weight:700;font-size:14px;letter-spacing:.025em;transition:opacity .15s,transform .1s,box-shadow .15s;box-shadow:0 8px 30px rgba(109,40,217,0.45);position:relative;}',
'#__pm9PrnBtn:hover{opacity:.9;transform:translateY(-1px);box-shadow:0 16px 40px rgba(109,40,217,0.55);}',
'#__pm9PrnBtn:active{transform:translateY(0);}',
'#__pm9KHint{position:absolute;right:14px;font-size:10px;opacity:.4;font-family:"JetBrains Mono",monospace;font-weight:400;}'
].join('\n');
document.head.appendChild(style);

/* ═══ DOM REFS ═══ */
var box     = document.getElementById('__pm9Box');
var tEl     = document.getElementById('__pm9T');
var rEl     = document.getElementById('__pm9R');
var bEl     = document.getElementById('__pm9B');
var lEl     = document.getElementById('__pm9L');
var canvas  = document.getElementById('__pm9Canvas');
var ctx     = canvas.getContext('2d');
var lnkBtn  = document.getElementById('__pm9LnkBtn');
var lnkLbl  = document.getElementById('__pm9LnkLbl');
var cssCode = document.getElementById('__pm9CSSCode');
var cpyBtn  = document.getElementById('__pm9CpyBtn');
var cpyLbl  = document.getElementById('__pm9CpyLbl');
var bindVal = document.getElementById('__pm9BindVal');
var bindHnt = document.getElementById('__pm9BindHint');
var gFill   = document.getElementById('__pm9GaugeFill');
var gHole   = document.getElementById('__pm9GaugeHole');

/* ═══ DIAGRAM RENDERER ═══ */
function drawPage() {
  var W = 106, H = 150;
  ctx.clearRect(0,0,W,H);

  var scW = W/210, scH = H/297;
  var tPx = Math.min(MM.t*scH, H*0.42);
  var rPx = Math.min(MM.r*scW, W*0.42);
  var bPx = Math.min(MM.b*scH, H*0.42);
  var lPx = Math.min(MM.l*scW, W*0.42);
  var holePx = Math.min(HOLE_OFFSET_MM * (bindSide==='top'?scH:scW), 28);

  /* Page background */
  ctx.fillStyle = '#15151f';
  ctx.fillRect(0,0,W,H);

  /* Margin bands */
  ctx.fillStyle = 'rgba(109,40,217,0.25)';
  ctx.fillRect(0,0,W,tPx);                  /* top */
  ctx.fillRect(0,H-bPx,W,bPx);             /* bottom */
  ctx.fillRect(0,tPx,lPx,H-tPx-bPx);      /* left */
  ctx.fillRect(W-rPx,tPx,rPx,H-tPx-bPx); /* right */

  /* Binding-side highlight */
  var bsColor = 'rgba(139,92,246,0.45)';
  if (bindSide==='left')  { ctx.fillStyle=bsColor; ctx.fillRect(0,0,lPx,H); }
  if (bindSide==='right') { ctx.fillStyle=bsColor; ctx.fillRect(W-rPx,0,rPx,H); }
  if (bindSide==='top')   { ctx.fillStyle=bsColor; ctx.fillRect(0,0,W,tPx); }

  /* Page border */
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75,0.75,W-1.5,H-1.5);

  /* Content area lines */
  var cx = lPx+4, cy = tPx+6;
  var cw = W-lPx-rPx-8, ch = H-tPx-bPx-12;
  if (cw>8 && ch>8) {
    var lineH = 2, gap = 7, lineCount = Math.floor((ch+gap)/(lineH+gap));
    var widths=[1,.82,1,.68,.9,.55,.78,1,.6,.85];
    for(var i=0;i<Math.min(lineCount,widths.length);i++){
      ctx.fillStyle='rgba(196,181,253,0.28)';
      ctx.beginPath();
      ctx.roundRect(cx, cy+i*(lineH+gap), cw*widths[i], lineH, 1);
      ctx.fill();
    }
  }

  /* Margin dimension lines */
  drawDimLine(ctx, lPx, tPx, 0,    tPx, lPx>6);   /* left dim */
  drawDimLine(ctx, W-rPx, tPx, W,  tPx, rPx>6);   /* right dim */
  drawDimLine(ctx, lPx, 0, lPx, tPx,    tPx>6);   /* top dim */
  drawDimLine(ctx, lPx, H, lPx, H-bPx, bPx>6);    /* bottom dim */

  /* Hole-punch markers */
  if (bindSide==='left'||bindSide==='right') {
    var hx = bindSide==='left' ? holePx : W-holePx;
    var holePositions=[H*0.25, H*0.5, H*0.75];
    ctx.strokeStyle='rgba(196,181,253,0.75)';
    ctx.lineWidth=1;
    for(var hi=0;hi<holePositions.length;hi++){
      ctx.beginPath();
      ctx.arc(hx, holePositions[hi], 4, 0, Math.PI*2);
      ctx.stroke();
      /* Cross-hair */
      ctx.beginPath();
      ctx.moveTo(hx-6, holePositions[hi]); ctx.lineTo(hx+6, holePositions[hi]);
      ctx.moveTo(hx, holePositions[hi]-6); ctx.lineTo(hx, holePositions[hi]+6);
      ctx.stroke();
    }
    /* Safe-zone dashed line */
    ctx.setLineDash([2,2]);
    ctx.strokeStyle='rgba(196,181,253,0.3)';
    ctx.beginPath();
    if(bindSide==='left'){ ctx.moveTo(holePx+6,0); ctx.lineTo(holePx+6,H); }
    else { ctx.moveTo(W-holePx-6,0); ctx.lineTo(W-holePx-6,H); }
    ctx.stroke();
    ctx.setLineDash([]);
  } else if(bindSide==='top'){
    var hy = holePx;
    var hps=[W*0.25, W*0.5, W*0.75];
    ctx.strokeStyle='rgba(196,181,253,0.75)';
    ctx.lineWidth=1;
    for(var hi2=0;hi2<hps.length;hi2++){
      ctx.beginPath(); ctx.arc(hps[hi2], hy, 4, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hps[hi2]-6,hy); ctx.lineTo(hps[hi2]+6,hy);
      ctx.moveTo(hps[hi2],hy-6); ctx.lineTo(hps[hi2],hy+6);
      ctx.stroke();
    }
    ctx.setLineDash([2,2]);
    ctx.strokeStyle='rgba(196,181,253,0.3)';
    ctx.beginPath(); ctx.moveTo(0,hy+6); ctx.lineTo(W,hy+6); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawDimLine(ctx, x1,y1,x2,y2, show){
  if(!show) return;
  ctx.strokeStyle='rgba(255,255,255,0.08)';
  ctx.lineWidth=1;
  ctx.setLineDash([2,3]);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.setLineDash([]);
}

/* ═══ GAUGE UPDATE ═══ */
function updateGauge() {
  var bindMM = bindSide==='left' ? MM.l : bindSide==='right' ? MM.r : MM.t;
  var MAX = 60;
  var pct = Math.min(bindMM/MAX*100, 100);
  gFill.style.width = pct+'%';

  /* Hole marker position */
  var holePct = Math.min(HOLE_OFFSET_MM/MAX*100, 100);
  gHole.style.left = holePct+'%';
  document.getElementById('__pm9HoleLbl').textContent = toDisp(HOLE_OFFSET_MM)+unit;

  /* Info */
  bindVal.textContent = toDisp(bindMM)+unit;
  var safe = bindMM - HOLE_OFFSET_MM;
  if(safe < 0){
    bindHnt.style.color='#f87171';
    bindHnt.textContent = '\u26a0 '+Math.abs(toDisp(safe)).toFixed(DECIMALS[unit])+unit+' too narrow for holes';
  } else if(safe < 5){
    bindHnt.style.color='#fbbf24';
    bindHnt.textContent = '\u26a0 Only '+toDisp(safe)+unit+' clearance';
  } else {
    bindHnt.style.color='#34d399';
    bindHnt.textContent = '\u2713 '+toDisp(safe)+unit+' safe clearance';
  }
}

/* ═══ BINDING SIDE MARKS ═══ */
function updateMarks(){
  document.getElementById('__pm9LMark').textContent = '◀ bind';
  document.getElementById('__pm9RMark').textContent = 'bind ▶';
  document.getElementById('__pm9BMark').textContent = '▲ bind';
  ['__pm9LMark','__pm9RMark','__pm9BMark'].forEach(function(id){
    document.getElementById(id).classList.remove('vis');
  });
  document.getElementById('__pm9LLbl').querySelector('.__pm9BindMark').textContent = bindSide==='left'?'\u25c4 bind':'';
  document.getElementById('__pm9RLbl').querySelector('.__pm9BindMark').textContent = bindSide==='right'?'bind \u25ba':'';
  document.getElementById('__pm9BLbl').querySelector('.__pm9BindMark').textContent = bindSide==='top'?'\u25b2 bind':'';

  /* Highlight the binding input */
  [tEl,rEl,bEl,lEl].forEach(function(el){ el.classList.remove('__pm9BindInput'); });
  var bindEl = {left:lEl,right:rEl,top:tEl}[bindSide];
  if(bindEl) bindEl.classList.add('__pm9BindInput');
}

/* ═══ CORE UPDATE ═══ */
function syncInputs(){
  tEl.value = toDisp(MM.t);
  rEl.value = toDisp(MM.r);
  bEl.value = toDisp(MM.b);
  lEl.value = toDisp(MM.l);
}

function cssValStr(){
  function f(v){ return toDisp(v)+unit; }
  return '@page { margin: '+f(MM.t)+' '+f(MM.r)+' '+f(MM.b)+' '+f(MM.l)+' }';
}

function detectPreset(){
  var found=null, keys=Object.keys(PRESETS);
  for(var i=0;i<keys.length;i++){
    var p=PRESETS[keys[i]];
    if(Math.abs(MM.t-p.t)<0.2&&Math.abs(MM.r-p.r)<0.2&&Math.abs(MM.b-p.b)<0.2&&Math.abs(MM.l-p.l)<0.2){found=keys[i];break;}
  }
  document.querySelectorAll('.__pm9P').forEach(function(b){b.classList.remove('__pm9On');});
  if(found){var el=document.querySelector('.__pm9P[data-p="'+found+'"]');if(el)el.classList.add('__pm9On');}
}

function save(){
  try{ localStorage.setItem('__pm9v3',JSON.stringify({unit:unit,MM:MM,bindSide:bindSide})); }catch(e){}
}

function updateAll(){
  drawPage();
  updateGauge();
  updateMarks();
  cssCode.textContent = cssValStr();
  detectPreset();
  save();
}

/* ═══ INPUT EVENTS ═══ */
function wire(key,el){
  el.addEventListener('input',function(){
    var v=toMM(parseFloat(this.value)||0);
    if(linked){ MM.t=MM.r=MM.b=MM.l=v; syncInputs(); }
    else { MM[key]=v; }
    updateAll();
  });
}
wire('t',tEl); wire('r',rEl); wire('b',bEl); wire('l',lEl);

/* ═══ BINDING SIDE ═══ */
document.querySelectorAll('.__pm9BS').forEach(function(btn){
  btn.addEventListener('click',function(){
    bindSide = this.getAttribute('data-s');
    document.querySelectorAll('.__pm9BS').forEach(function(b){b.classList.remove('active');});
    this.classList.add('active');
    updateAll();
  });
});

/* ═══ PRESETS ═══ */
document.querySelectorAll('.__pm9P').forEach(function(btn){
  btn.addEventListener('click',function(){
    var p=PRESETS[this.getAttribute('data-p')];
    MM={t:p.t,r:p.r,b:p.b,l:p.l};
    syncInputs(); updateAll();
  });
});

/* ═══ LINK ═══ */
lnkBtn.addEventListener('click',function(){
  linked=!linked;
  lnkBtn.classList.toggle('__pm9On',linked);
  lnkLbl.textContent=linked?'Linked \u2713':'Link all';
  if(linked){ MM.r=MM.b=MM.l=MM.t; syncInputs(); updateAll(); }
});

/* ═══ UNIT ═══ */
document.querySelectorAll('.__pm9U').forEach(function(btn){
  btn.addEventListener('click',function(){
    unit=this.getAttribute('data-u');
    document.querySelectorAll('.__pm9U').forEach(function(b){b.classList.remove('__pm9On');});
    this.classList.add('__pm9On');
    [tEl,rEl,bEl,lEl].forEach(function(el){el.step=STEP[unit];});
    syncInputs(); updateAll();
  });
});

/* ═══ COPY ═══ */
cpyBtn.addEventListener('click',function(){
  var txt=cssValStr();
  function done(){ cpyBtn.classList.add('__pm9Cp'); cpyLbl.textContent='Copied!';
    setTimeout(function(){ cpyBtn.classList.remove('__pm9Cp'); cpyLbl.textContent='Copy'; },2200); }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(function(){fbCopy(txt);done();});
  } else { fbCopy(txt); done(); }
});
function fbCopy(t){ var ta=document.createElement('textarea'); ta.value=t;
  ta.style.cssText='position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }

/* ═══ PRINT ═══ */
document.getElementById('__pm9PrnBtn').addEventListener('click',function(){
  var old=document.getElementById('__pm9PrintStyle'); if(old) old.remove();
  var ps=document.createElement('style'); ps.id='__pm9PrintStyle';
  ps.textContent='@media print{@page{margin:'+MM.t+'mm '+MM.r+'mm '+MM.b+'mm '+MM.l+'mm !important;}}';
  document.head.appendChild(ps);
  closePanel();
  setTimeout(function(){ window.print(); },80);
});

/* ═══ CLOSE ═══ */
function closePanel(){
  var p=document.getElementById(PID), s=document.getElementById(SID);
  if(p) p.remove(); if(s) s.remove();
  document.removeEventListener('keydown',onKey);
  document.removeEventListener('mousemove',onMove);
  document.removeEventListener('mouseup',onUp);
}
document.getElementById('__pm9Cls').addEventListener('click',closePanel);
document.getElementById('__pm9Ov').addEventListener('click',closePanel);

/* ═══ KEYBOARD ═══ */
function onKey(e){
  if(e.key==='Escape') closePanel();
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter') document.getElementById('__pm9PrnBtn').click();
}
document.addEventListener('keydown',onKey);

/* ═══ DRAG ═══ */
var drag=false, ox=0, oy=0;
document.getElementById('__pm9Hdr').addEventListener('mousedown',function(e){
  if(e.target.closest&&e.target.closest('#__pm9Cls')) return;
  drag=true;
  var r=box.getBoundingClientRect();
  ox=e.clientX-r.left; oy=e.clientY-r.top;
  box.style.transition='none'; e.preventDefault();
});
function onMove(e){ if(!drag) return;
  var x=Math.max(0,Math.min(e.clientX-ox,window.innerWidth-box.offsetWidth));
  var y=Math.max(0,Math.min(e.clientY-oy,window.innerHeight-box.offsetHeight));
  box.style.left=x+'px'; box.style.top=y+'px'; box.style.transform='none';
}
function onUp(){ drag=false; }
document.addEventListener('mousemove',onMove);
document.addEventListener('mouseup',onUp);

/* ═══ INIT ═══ */
document.querySelectorAll('.__pm9U').forEach(function(b){
  b.classList.toggle('__pm9On', b.getAttribute('data-u')===unit);
});
document.querySelectorAll('.__pm9BS').forEach(function(b){
  b.classList.toggle('active', b.getAttribute('data-s')===bindSide);
});
[tEl,rEl,bEl,lEl].forEach(function(el){ el.step=STEP[unit]; });
syncInputs();
updateAll();

})();
