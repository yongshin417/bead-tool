(function(){
"use strict";

/* ===================== Palette (40 fixed colors + 80-color extended) ===================== */
const PALETTE_40 = [
  {id:1,  hex:"#222222"}, {id:2,  hex:"#B4B4B4"}, {id:3,  hex:"#EAE7DE"}, {id:4,  hex:"#FFFFFF"},
  {id:5,  hex:"#D32F36"}, {id:6,  hex:"#9D0A00"}, {id:7,  hex:"#D60B4A"}, {id:8,  hex:"#E6968D"},
  {id:9,  hex:"#FF9875"}, {id:10, hex:"#F7D0BF"}, {id:11, hex:"#FCEFE9"}, {id:12, hex:"#FCF6E8"},
  {id:13, hex:"#DCD2C8"}, {id:14, hex:"#E2CEAB"}, {id:15, hex:"#D56422"}, {id:16, hex:"#D48C42"},
  {id:17, hex:"#F29900"}, {id:18, hex:"#F8C933"}, {id:19, hex:"#FCE599"}, {id:20, hex:"#B3B47A"},
  {id:21, hex:"#C1DA72"}, {id:22, hex:"#6C6E00"}, {id:23, hex:"#AA8B52"}, {id:24, hex:"#A98F74"},
  {id:25, hex:"#AA9228"}, {id:26, hex:"#3F2B12"}, {id:27, hex:"#74491F"}, {id:28, hex:"#534658"},
  {id:29, hex:"#7C8CD6"}, {id:30, hex:"#3F52A3"}, {id:31, hex:"#1F2E5C"}, {id:32, hex:"#8FD1D9"},
  {id:33, hex:"#3E9BA6"}, {id:34, hex:"#1F5C63"}, {id:35, hex:"#8FD98F"}, {id:36, hex:"#3F9E52"},
  {id:37, hex:"#1F5C2E"}, {id:38, hex:"#C58FD9"}, {id:39, hex:"#8A3F9E"}, {id:40, hex:"#4A4664"},
];
const EMPTY_COLOR = 4; // white, used to seed a blank grid

function hexToRgb(hex){
  const n = parseInt(hex.slice(1),16);
  return {r:(n>>16)&255, g:(n>>8)&255, b:n&255};
}
function hslToHex(h,s,l){
  const rgb = hslToRgb(h/360,s,l);
  return "#"+[rgb.r,rgb.g,rgb.b].map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();
}
// Build the "more colors" (80) palette: the same 40 curated colors (ids 1-40 stay
// identical so switching back is lossless) plus 40 systematically generated hues
// that fill in the gaps between them.
function buildExtendedPalette(){
  const extra=[];
  const hues=[0,20,40,60,80,100,130,160,190,220,250,280,310,340];
  const lights=[0.25,0.4,0.55,0.7,0.85];
  const sats=[0.45,0.75];
  let id=41;
  outer:
  for(const s of sats){
    for(const l of lights){
      for(const h of hues){
        if(extra.length>=120) break outer;
        extra.push({id:id++, hex:hslToHex(h,s,l)});
      }
    }
  }
  return PALETTE_40.concat(extra);
}
const PALETTE_MORE = buildExtendedPalette();
[PALETTE_40, PALETTE_MORE].forEach(pal=>{
  pal.forEach(p=>{ const c=hexToRgb(p.hex); p.r=c.r;p.g=c.g;p.b=c.b; p.luma = 0.299*c.r+0.587*c.g+0.114*c.b; });
});

let ACTIVE_PALETTE = PALETTE_40;
let ACTIVE_MODE = "40";

// "Redmean" weighted distance - much closer to human perception than plain
// Euclidean RGB distance, which was the cause of greys getting matched to
// warm/brown palette entries.
function nearestColorId(r,g,b){
  let best=1,bd=Infinity;
  for(const p of ACTIVE_PALETTE){
    const rmean = (p.r+r)/2;
    const dr=p.r-r, dg=p.g-g, db=p.b-b;
    const d = (2+rmean/256)*dr*dr + 4*dg*dg + (2+(255-rmean)/256)*db*db;
    if(d<bd){bd=d;best=p.id;}
  }
  return best;
}
function paletteById(id){ return ACTIVE_PALETTE[id-1] || ACTIVE_PALETTE[0]; }
function getPalette(){ return ACTIVE_PALETTE; }
function getPaletteMode(){ return ACTIVE_MODE; }
function setPaletteMode(mode){
  ACTIVE_MODE = mode==="more" ? "more" : "40";
  ACTIVE_PALETTE = ACTIVE_MODE==="more" ? PALETTE_MORE : PALETTE_40;
}
// Remap every cell of a grid (drawn from `fromPalette`) to the nearest color in
// whichever palette is currently active. Call setPaletteMode() first, then this.
function remapGridToActivePalette(grid, N, fromPalette){
  for(let r=0;r<N;r++){
    for(let c=0;c<N;c++){
      const old = fromPalette[grid[r][c]-1] || fromPalette[0];
      grid[r][c] = nearestColorId(old.r, old.g, old.b);
    }
  }
}
// Lets the person type any #RRGGBB and add it to the currently active palette
// (appended with the next free id) so they're not limited to the curated/generated
// swatches. Returns {id, isNew, error}.
function addCustomColor(hexInput){
  let hex = String(hexInput||"").trim();
  if(!hex.startsWith("#")) hex = "#"+hex;
  if(!/^#[0-9a-fA-F]{6}$/.test(hex)) return {error:"格式需为 #RRGGBB，例如 #3F8CFF"};
  hex = "#"+hex.slice(1).toUpperCase();
  const existing = ACTIVE_PALETTE.find(p=>p.hex===hex);
  if(existing) return {id:existing.id, isNew:false};
  const id = ACTIVE_PALETTE.length+1;
  const c = hexToRgb(hex);
  const p = {id, hex, r:c.r, g:c.g, b:c.b, luma:0.299*c.r+0.587*c.g+0.114*c.b, custom:true};
  ACTIVE_PALETTE.push(p);
  return {id, isNew:true};
}

/* ===================== Small helpers ===================== */
const $ = (sel,root)=> (root||document).querySelector(sel);
const $all = (sel,root)=> Array.from((root||document).querySelectorAll(sel));
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function pad2(n){ return String(n).padStart(2,"0"); }
function download(dataUrl, filename){
  const a=document.createElement("a");
  a.href=dataUrl; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
}
function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  let h=0,s=0,l=(max+min)/2;
  if(max!==min){
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  return {h,s,l};
}
function hslToRgb(h,s,l){
  let r,g,b;
  if(s===0){ r=g=b=l; }
  else{
    const hue2rgb=(p,q,t)=>{
      if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6) return p+(q-p)*6*t;
      if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return {r:Math.round(r*255), g:Math.round(g*255), b:Math.round(b*255)};
}
function adjustPixel(r,g,b,contrast,saturation){
  // contrast: -30..30  saturation: -50..50
  const c = contrast*4;
  const factor = (259*(c+255))/(255*(259-c));
  r = clamp(factor*(r-128)+128,0,255);
  g = clamp(factor*(g-128)+128,0,255);
  b = clamp(factor*(b-128)+128,0,255);
  if(saturation!==0){
    const hsl = rgbToHsl(r,g,b);
    let s = hsl.s*(1+saturation/50);
    s = clamp(s,0,1);
    const rgb = hslToRgb(hsl.h,s,hsl.l);
    r=rgb.r;g=rgb.g;b=rgb.b;
  }
  return [r,g,b];
}

/* ===================== Grid helpers ===================== */
function makeGrid(size, fill){
  const g=[];
  for(let r=0;r<size;r++){ g.push(new Array(size).fill(fill)); }
  return g;
}
function cloneGrid(g){ return g.map(row=>row.slice()); }

/* Sample a square region of a canvas into an NxN palette-id grid */
function sampleRegionToGrid(ctx, sx, sy, sw, sh, N, mode, contrast, saturation){
  // A small baked-in clarity boost, independent of the user's manual sliders,
  // so cell colors separate more decisively instead of reading muddy/blurry.
  // Capped at the sliders' own max so an already-maxed manual value can't runaway.
  const effContrast = Math.min(30, contrast + 14);
  const effSaturation = Math.min(50, saturation + 10);
  const grid = makeGrid(N, EMPTY_COLOR);
  const cw = sw/N, ch = sh/N;
  for(let r=0;r<N;r++){
    for(let c=0;c<N;c++){
      const bx = Math.floor(sx + c*cw), by = Math.floor(sy + r*ch);
      const bw = Math.max(1,Math.round(cw)), bh = Math.max(1,Math.round(ch));
      let data;
      try{ data = ctx.getImageData(bx,by,bw,bh).data; }
      catch(e){ grid[r][c]=EMPTY_COLOR; continue; }
      let sumR=0,sumG=0,sumB=0,count=0;
      const tally = new Map();
      for(let i=0;i<data.length;i+=4){
        let [pr,pg,pb] = adjustPixel(data[i],data[i+1],data[i+2],effContrast,effSaturation);
        sumR+=pr; sumG+=pg; sumB+=pb; count++;
        const pid = nearestColorId(pr,pg,pb);
        tally.set(pid,(tally.get(pid)||0)+1);
      }
      if(count===0){ grid[r][c]=EMPTY_COLOR; continue; }
      const avgId = nearestColorId(sumR/count, sumG/count, sumB/count);
      let domId=avgId, domCount=0;
      tally.forEach((v,k)=>{ if(v>domCount){domCount=v;domId=k;} });
      const domShare = domCount/count;
      let chosen;
      if(mode==="dominant") chosen=domId;
      else if(mode==="average") chosen=avgId;
      else chosen = domShare>=0.15 ? domId : avgId; // hybrid - favor a solid dominant color over a blended/muddy average whenever one color has a reasonable lead, which reads much crisper at low pixel-art resolution
      grid[r][c]=chosen;
    }
  }
  return grid;
}

/* ===================== History (localStorage) ===================== */
const HISTORY_KEY = "beadtool_history_v1";
function loadHistory(){
  try{ return JSON.parse(localStorage.getItem(HISTORY_KEY))||[]; }catch(e){ return []; }
}
function saveHistory(list){
  try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0,24))); }catch(e){}
}

/* ===================== Crop / source image controller ===================== */
function makeCropController(opts){
  const canvas = opts.canvas;
  const ctx = canvas.getContext("2d");
  const size = canvas.width; // square canvas
  let img=null, baseScale=1, zoom=1, offX=0, offY=0, fitMode="cover";
  let dragging=false, dragStart=null;
  let overlayRows=0, overlayCols=0; // block-boundary preview grid (mosaic mode only)

  function draw(){
    ctx.fillStyle="#ffffff";
    ctx.fillRect(0,0,size,size);
    if(img){
      const scale = baseScale*zoom;
      const w = img.width*scale, h = img.height*scale;
      const x = size/2 - w/2 + offX;
      const y = size/2 - h/2 + offY;
      ctx.drawImage(img, x, y, w, h);
    }
    if(overlayRows>0 && overlayCols>0){
      ctx.save();
      ctx.strokeStyle="rgba(255,255,255,0.85)";
      ctx.lineWidth=1;
      ctx.shadowColor="rgba(0,0,0,0.6)";
      ctx.shadowBlur=1;
      for(let c=1;c<overlayCols;c++){
        const x=Math.round(size*c/overlayCols)+0.5;
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,size); ctx.stroke();
      }
      for(let r=1;r<overlayRows;r++){
        const y=Math.round(size*r/overlayRows)+0.5;
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(size,y); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function setOverlayGrid(rows, cols){
    overlayRows=rows||0; overlayCols=cols||0;
    draw();
  }
  function computeBase(mode){
    if(!img) return 1;
    return mode==="contain" ? Math.min(size/img.width, size/img.height)
                             : Math.max(size/img.width, size/img.height);
  }
  function setImage(image){
    img=image; fitMode="cover";
    baseScale=computeBase("cover");
    zoom=1; offX=0; offY=0;
    draw();
  }
  function setZoomPercent(pct){
    zoom = clamp(pct,100,400)/100;
    draw();
  }
  function reset(){
    fitMode="cover"; baseScale=computeBase("cover"); zoom=1; offX=0; offY=0;
    draw();
    return 100;
  }
  function fit(){
    fitMode="contain"; baseScale=computeBase("contain"); zoom=1; offX=0; offY=0;
    draw();
    return 100;
  }
  // Renders the exact same crop/pan/zoom framing as the on-screen preview,
  // but onto an off-screen canvas at a much higher resolution - used right
  // before generating the grid so fine detail (text, thin lines) survives
  // the downsampling instead of being pre-blurred by the small preview.
  function getHiResContext(targetSize){
    const hc = document.createElement("canvas");
    hc.width = targetSize; hc.height = targetSize;
    const hctx = hc.getContext("2d", {willReadFrequently:true});
    hctx.fillStyle="#ffffff";
    hctx.fillRect(0,0,targetSize,targetSize);
    if(img){
      const f = targetSize/size;
      const scale = baseScale*zoom*f;
      const w = img.width*scale, h = img.height*scale;
      const x = targetSize/2 - w/2 + offX*f;
      const y = targetSize/2 - h/2 + offY*f;
      hctx.drawImage(img, x, y, w, h);
    }
    return { ctx:hctx, size:targetSize };
  }
  canvas.addEventListener("pointerdown",(e)=>{
    if(!img) return;
    dragging=true; dragStart={x:e.clientX,y:e.clientY,offX,offY};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove",(e)=>{
    if(!dragging) return;
    const rect=canvas.getBoundingClientRect();
    const ratioX = size/rect.width, ratioY = size/rect.height;
    offX = dragStart.offX + (e.clientX-dragStart.x)*ratioX;
    offY = dragStart.offY + (e.clientY-dragStart.y)*ratioY;
    draw();
  });
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>{
    canvas.addEventListener(ev,()=>{ dragging=false; });
  });
  canvas.addEventListener("wheel",(e)=>{
    if(!img) return;
    e.preventDefault();
    const pct = clamp(Math.round(zoom*100 - e.deltaY*0.15),100,400);
    if(opts.onWheelZoom) opts.onWheelZoom(pct);
    setZoomPercent(pct);
  },{passive:false});

  return { setImage, setZoomPercent, reset, fit, draw,
    hasImage:()=>!!img,
    getContext:()=>ctx,
    getSize:()=>size,
    getHiResContext,
    setOverlayGrid };
}

/* ===================== Editor (grid painting) controller ===================== */
function makeEditor(opts){
  // opts: gridCanvas, overviewCanvas, N (grid size in cells), getGrid(), setGrid(), onChange()
  const gridCanvas = opts.gridCanvas;
  const gctx = gridCanvas.getContext("2d");
  const overviewCanvas = opts.overviewCanvas;
  const octx = overviewCanvas ? overviewCanvas.getContext("2d") : null;
  const N = opts.N;
  const cell = gridCanvas.width / N;

  let tool="paint";
  let selected=1;
  let showNumbers=true, showGrid=true;
  let painting=false;
  let strokeSaved=false;
  let rowOffset=0, colOffset=0; // for mosaic mode: global position of this block within the full canvas
  const undoStack=[], redoStack=[];

  function populateCoords(){
    if(!opts.coordTop) return;
    const top=[], bottom=[], left=[], right=[];
    for(let i=0;i<N;i++){
      top.push(`<span>${colOffset+i+1}</span>`);
      bottom.push(`<span>${colOffset+i+1}</span>`);
      left.push(`<span>${rowOffset+i+1}</span>`);
      right.push(`<span>${rowOffset+i+1}</span>`);
    }
    opts.coordTop.innerHTML = top.join("");
    opts.coordBottom.innerHTML = bottom.join("");
    opts.coordLeft.innerHTML = left.join("");
    opts.coordRight.innerHTML = right.join("");
  }
  populateCoords();

  function grid(){ return opts.getGrid(); }

  function render(){
    const g = grid();
    gctx.clearRect(0,0,gridCanvas.width,gridCanvas.height);
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        const id = g[r][c];
        const p = paletteById(id);
        gctx.fillStyle = p.hex;
        gctx.fillRect(c*cell, r*cell, cell, cell);
      }
    }
    if(showGrid){
      gctx.strokeStyle="rgba(60,60,70,0.18)";
      gctx.lineWidth=1;
      for(let i=0;i<=N;i++){
        gctx.beginPath(); gctx.moveTo(i*cell,0); gctx.lineTo(i*cell,gridCanvas.height); gctx.stroke();
        gctx.beginPath(); gctx.moveTo(0,i*cell); gctx.lineTo(gridCanvas.width,i*cell); gctx.stroke();
      }
    }
    if(showNumbers && cell>=14){
      gctx.font = "600 "+Math.max(10,Math.floor(cell*0.4))+"px -apple-system, \"Segoe UI\", system-ui, sans-serif";
      gctx.textAlign="center"; gctx.textBaseline="middle";
      for(let r=0;r<N;r++){
        for(let c=0;c<N;c++){
          const id=g[r][c]; const p=paletteById(id);
          gctx.fillStyle = p.luma>150 ? "#000000b3" : "#ffffffcc";
          gctx.fillText(pad2(id), c*cell+cell/2, r*cell+cell/2);
        }
      }
    }
    renderOverview();
    if(opts.onChange) opts.onChange();
  }
  function renderOverview(){
    if(!octx) return;
    const g = grid();
    const ow = overviewCanvas.width, oh = overviewCanvas.height;
    const oc = ow/N;
    octx.clearRect(0,0,ow,oh);
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        octx.fillStyle = paletteById(g[r][c]).hex;
        octx.fillRect(c*oc, r*oc, oc+0.6, oc+0.6);
      }
    }
  }

  function cellFromEvent(e){
    const rect = gridCanvas.getBoundingClientRect();
    const ratioX = gridCanvas.width/rect.width, ratioY = gridCanvas.height/rect.height;
    const x = (e.clientX-rect.left)*ratioX;
    const y = (e.clientY-rect.top)*ratioY;
    const c = clamp(Math.floor(x/cell),0,N-1);
    const r = clamp(Math.floor(y/cell),0,N-1);
    return {r,c};
  }
  function pushUndo(){
    undoStack.push(cloneGrid(grid()));
    if(undoStack.length>60) undoStack.shift();
    redoStack.length=0;
    if(opts.onHistoryChange) opts.onHistoryChange(undoStack.length,redoStack.length);
  }
  function undo(){
    if(!undoStack.length) return;
    redoStack.push(cloneGrid(grid()));
    const g = undoStack.pop();
    opts.setGrid(g);
    render();
    if(opts.onHistoryChange) opts.onHistoryChange(undoStack.length,redoStack.length);
  }
  function redo(){
    if(!redoStack.length) return;
    undoStack.push(cloneGrid(grid()));
    const g = redoStack.pop();
    opts.setGrid(g);
    render();
    if(opts.onHistoryChange) opts.onHistoryChange(undoStack.length,redoStack.length);
  }
  function floodFill(r0,c0,newId){
    const g = grid();
    const oldId = g[r0][c0];
    if(oldId===newId) return;
    const stack=[[r0,c0]];
    const seen=new Set();
    while(stack.length){
      const [r,c]=stack.pop();
      const key=r+"_"+c;
      if(seen.has(key)) continue;
      if(r<0||c<0||r>=N||c>=N) continue;
      if(g[r][c]!==oldId) continue;
      seen.add(key);
      g[r][c]=newId;
      stack.push([r-1,c],[r+1,c],[r,c-1],[r,c+1]);
    }
  }

  function pointerDown(e){
    if(!grid()) return;
    const {r,c} = cellFromEvent(e);
    if(opts.onHover) opts.onHover(r,c);
    if(tool==="picker"){
      selected = grid()[r][c];
      if(opts.onPick) opts.onPick(selected);
      return;
    }
    pushUndo(); strokeSaved=true;
    if(tool==="fill"){
      floodFill(r,c,selected);
      render();
      return;
    }
    painting=true;
    grid()[r][c]=selected;
    render();
    gridCanvas.setPointerCapture(e.pointerId);
  }
  function pointerMove(e){
    const {r,c} = cellFromEvent(e);
    if(opts.onHover) opts.onHover(r,c);
    if(!painting || tool!=="paint") return;
    if(grid()[r][c]!==selected){ grid()[r][c]=selected; render(); }
  }
  function pointerUp(){ painting=false; strokeSaved=false; }

  gridCanvas.addEventListener("pointerdown", pointerDown);
  gridCanvas.addEventListener("pointermove", pointerMove);
  gridCanvas.addEventListener("pointerup", pointerUp);
  gridCanvas.addEventListener("pointerleave", ()=>{ if(!painting) { if(opts.onHover) opts.onHover(null,null);} });
  gridCanvas.addEventListener("pointercancel", pointerUp);

  return {
    render, renderOverview, undo, redo, pushUndo,
    setTool:(t)=>{ tool=t; },
    setSelected:(id)=>{ selected=id; },
    getSelected:()=>selected,
    setShowNumbers:(v)=>{ showNumbers=v; render(); },
    setShowGrid:(v)=>{ showGrid=v; render(); },
    canUndo:()=>undoStack.length>0,
    canRedo:()=>redoStack.length>0,
    resetHistory:()=>{
      undoStack.length=0; redoStack.length=0;
      if(opts.onHistoryChange) opts.onHistoryChange(0,0);
    },
    setCoordOffset:(r,c)=>{ rowOffset=r; colOffset=c; populateCoords(); },
    replaceColor:(fromId,toId)=>{
      pushUndo();
      const g=grid();
      for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(g[r][c]===fromId) g[r][c]=toId;
      render();
    },
    N, cell
  };
}

/* ===================== Rendering full pattern (export) ===================== */
// rows/cols = grid dimensions in cells (square grids pass the same value for both)
function renderPatternCanvas(grid, rows, cols, cellPx, withNumbers){
  const c = document.createElement("canvas");
  c.width = cols*cellPx; c.height = rows*cellPx;
  const ctx = c.getContext("2d");
  for(let r=0;r<rows;r++){
    for(let col=0;col<cols;col++){
      const id = grid[r][col];
      ctx.fillStyle = paletteById(id).hex;
      ctx.fillRect(col*cellPx, r*cellPx, cellPx, cellPx);
    }
  }
  ctx.strokeStyle="rgba(0,0,0,0.25)"; ctx.lineWidth=1;
  for(let i=0;i<=cols;i++){ ctx.beginPath(); ctx.moveTo(i*cellPx,0); ctx.lineTo(i*cellPx,c.height); ctx.stroke(); }
  for(let i=0;i<=rows;i++){ ctx.beginPath(); ctx.moveTo(0,i*cellPx); ctx.lineTo(c.width,i*cellPx); ctx.stroke(); }
  if(withNumbers && cellPx>=14){
    ctx.font = "600 "+Math.max(10,Math.floor(cellPx*0.4))+"px -apple-system, \"Segoe UI\", system-ui, sans-serif";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    for(let r=0;r<rows;r++){
      for(let col=0;col<cols;col++){
        const id=grid[r][col]; const p=paletteById(id);
        ctx.fillStyle = p.luma>150 ? "#000000b3" : "#ffffffcc";
        ctx.fillText(pad2(id), col*cellPx+cellPx/2, r*cellPx+cellPx/2);
      }
    }
  }
  return c;
}
function countColors(grid, rows, cols){
  const counts = new Map();
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const id=grid[r][c]; counts.set(id,(counts.get(id)||0)+1);
  }
  return counts;
}
// Stitch a rows x cols matrix of NxN block-grids into one big grid
function composeBlocks(blocksData, N){
  const rows = blocksData.length, cols = blocksData[0].length;
  const big = [];
  for(let br=0;br<rows;br++){
    for(let ir=0;ir<N;ir++){
      const rowArr=[];
      for(let bc=0;bc<cols;bc++){
        const block = blocksData[br][bc];
        for(let ic=0;ic<N;ic++) rowArr.push(block[ir][ic]);
      }
      big.push(rowArr);
    }
  }
  return { grid: big, rows: rows*N, cols: cols*N };
}
function renderLegendCanvas(counts, widthPx){
  const used = getPalette().filter(p=>counts.get(p.id));
  const cols = Math.max(4, Math.floor(widthPx/130));
  const rows = Math.ceil(used.length/cols);
  const cellW = widthPx/cols, cellH=40;
  const c = document.createElement("canvas");
  c.width = widthPx; c.height = rows*cellH + 20;
  const ctx = c.getContext("2d");
  ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height);
  ctx.font="12px monospace";
  used.forEach((p,i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const x=col*cellW+10, y=row*cellH+16;
    ctx.fillStyle=p.hex; ctx.fillRect(x,y-10,20,20);
    ctx.strokeStyle="#00000030"; ctx.strokeRect(x,y-10,20,20);
    ctx.fillStyle="#15171c";
    ctx.fillText(pad2(p.id)+" "+p.hex+" ×"+counts.get(p.id), x+26, y);
  });
  return c;
}
function stackCanvases(top, bottom, gap){
  const c=document.createElement("canvas");
  c.width=Math.max(top.width,bottom.width);
  c.height=top.height+ (gap||10) +bottom.height;
  const ctx=c.getContext("2d");
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
  ctx.drawImage(top,0,0);
  ctx.drawImage(bottom,0,top.height+(gap||10));
  return c;
}

window.BeadTool = {
  PALETTE_40, PALETTE_MORE, paletteById, nearestColorId, EMPTY_COLOR,
  getPalette, getPaletteMode, setPaletteMode, remapGridToActivePalette, addCustomColor,
  makeGrid, cloneGrid, sampleRegionToGrid,
  makeCropController, makeEditor,
  renderPatternCanvas, countColors, renderLegendCanvas, stackCanvases, composeBlocks,
  loadHistory, saveHistory, HISTORY_KEY,
  download, clamp, pad2, $, $all
};
})();
