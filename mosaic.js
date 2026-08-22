(function(){
"use strict";
const BT = window.BeadTool;
const N = 24; // each block is always 24x24

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

/* ---------- state ---------- */
let blocksData = null;      // rows x cols matrix of 24x24 grids, null until generated
let active = null;          // {r,c} of block currently loaded in the editor
let grid = BT.makeGrid(N, BT.EMPTY_COLOR); // grid currently bound to the editor

/* ---------- elements ---------- */
const el = {
  helpBtn: $("#helpBtn"), helpPanel: $("#helpPanel"),
  imageInput: $("#imageInput"), dropZone: $("#dropZone"),
  sourceMeta: $("#sourceMeta"), cropWrap: $("#cropWrap"), sourceCanvas: $("#sourceCanvas"),
  removeImageBtn: $("#removeImageBtn"),
  zoomRange: $("#zoomRange"), zoomOut: $("#zoomOut"),
  resetCropBtn: $("#resetCropBtn"), fitSubjectBtn: $("#fitSubjectBtn"),
  modeSelect: $("#modeSelect"),
  contrastRange: $("#contrastRange"), contrastOut: $("#contrastOut"),
  saturationRange: $("#saturationRange"), saturationOut: $("#saturationOut"),
  layoutColsSelect: $("#layoutColsSelect"), layoutRowsSelect: $("#layoutRowsSelect"),
  generateBtn: $("#generateBtn"),
  overviewMeta: $("#overviewMeta"), blockGrid: $("#blockGrid"),
  activeBlockLabel: $("#activeBlockLabel"),
  cellInfo: $("#cellInfo"),
  undoBtn: $("#undoBtn"), redoBtn: $("#redoBtn"),
  showNumbers: $("#showNumbers"), showGrid: $("#showGrid"), showOverview: $("#showOverview"),
  overviewCard: $("#overviewCard"), overviewCanvas: $("#overviewCanvas"), gridCanvas: $("#gridCanvas"),
  replaceFrom: $("#replaceFrom"), replaceBtn: $("#replaceBtn"), selectedBadge: $("#selectedBadge"),
  palette: $("#palette"),
  customHexInput: $("#customHexInput"), addCustomColorBtn: $("#addCustomColorBtn"),
  fileName: $("#fileName"),
  previewBigBtn: $("#previewBigBtn"),
  bigPreviewOverlay: $("#bigPreviewOverlay"), bigPreviewCanvas: $("#bigPreviewCanvas"), bigPreviewCloseBtn: $("#bigPreviewCloseBtn"),
  exportPreviewBtn: $("#exportPreviewBtn"), exportTotalBtn: $("#exportTotalBtn"), saveProjectBtn: $("#saveProjectBtn"),
  exportHistory: $("#exportHistory"), historyCount: $("#historyCount"), clearHistoryBtn: $("#clearHistoryBtn"),
  status: $("#status"),
};

function setStatus(msg){ el.status.textContent = msg; }
function currentLayout(){ return { cols:+el.layoutColsSelect.value, rows:+el.layoutRowsSelect.value }; }

/* ---------- help panel ---------- */
el.helpBtn.addEventListener("click", ()=>{
  const hidden = el.helpPanel.hasAttribute("hidden");
  if(hidden) el.helpPanel.removeAttribute("hidden"); else el.helpPanel.setAttribute("hidden","");
  el.helpBtn.setAttribute("aria-expanded", hidden ? "true":"false");
});

/* ---------- crop controller ---------- */
const crop = BT.makeCropController({
  canvas: el.sourceCanvas,
  onWheelZoom: (pct)=>{ el.zoomRange.value = pct; el.zoomOut.textContent = pct+"%"; }
});

function handleFile(file){
  if(!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    const img = new Image();
    img.onload = ()=>{
      crop.setImage(img);
      const {rows,cols} = currentLayout();
      crop.setOverlayGrid(rows, cols); // preview the block boundaries right on the source image
      el.cropWrap.hidden = false;
      el.dropZone.hidden = true;
      el.generateBtn.disabled = false;
      el.sourceMeta.textContent = `${img.width}×${img.height} 已载入`;
      el.zoomRange.value = 100; el.zoomOut.textContent="100%";
      setStatus("图片已载入，调整裁剪与画板布局后点击「生成大图」。");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
el.imageInput.addEventListener("change", (e)=>{ handleFile(e.target.files[0]); });
el.dropZone.addEventListener("dragover", (e)=>{ e.preventDefault(); });
el.dropZone.addEventListener("drop",(e)=>{
  e.preventDefault();
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if(f) handleFile(f);
});
window.addEventListener("paste",(e)=>{
  const items = e.clipboardData && e.clipboardData.items;
  if(!items) return;
  for(const it of items){
    if(it.type.startsWith("image/")){ handleFile(it.getAsFile()); break; }
  }
});
el.removeImageBtn.addEventListener("click", ()=>{
  el.cropWrap.hidden = true; el.dropZone.hidden = false;
  el.generateBtn.disabled = true;
  el.sourceMeta.textContent = "尚未选择图片";
  el.imageInput.value = "";
});

el.zoomRange.addEventListener("input", ()=>{
  el.zoomOut.textContent = el.zoomRange.value+"%";
  crop.setZoomPercent(+el.zoomRange.value);
});
el.resetCropBtn.addEventListener("click", ()=>{
  const pct = crop.reset(); el.zoomRange.value=pct; el.zoomOut.textContent=pct+"%";
});
el.fitSubjectBtn.addEventListener("click", ()=>{
  const pct = crop.fit(); el.zoomRange.value=pct; el.zoomOut.textContent=pct+"%";
});
el.contrastRange.addEventListener("input", ()=> el.contrastOut.textContent = el.contrastRange.value);
el.saturationRange.addEventListener("input", ()=> el.saturationOut.textContent = el.saturationRange.value);

/* ---------- board layout ---------- */
function makeBlankBlocks(rows, cols){
  const arr=[];
  for(let r=0;r<rows;r++){
    const rowArr=[];
    for(let c=0;c<cols;c++) rowArr.push(BT.makeGrid(N, BT.EMPTY_COLOR));
    arr.push(rowArr);
  }
  return arr;
}
function invalidateBlocks(){
  // Reset to a fresh set of BLANK (paintable) blocks matching the new layout,
  // rather than nulling everything out - you can still draw by hand immediately
  // even without generating from a photo.
  const {rows,cols} = currentLayout();
  blocksData = makeBlankBlocks(rows, cols);
  crop.setOverlayGrid(rows, cols); // keep the preview grid in sync with the layout pickers
  active = null;
  grid = BT.makeGrid(N, BT.EMPTY_COLOR);
  editor.setGridRef(grid);
  editor.resetHistory();
  editor.setCoordOffset(0,0);
  setEditorEnabled(false);
  el.activeBlockLabel.textContent = "（未选择分块）";
  el.previewBigBtn.disabled = false;
  editor.render();
  renderBlockGridUI();
  updateOverviewMeta();
}
[el.layoutColsSelect, el.layoutRowsSelect].forEach(sel=>{
  sel.addEventListener("change", invalidateBlocks);
});

el.generateBtn.addEventListener("click", ()=>{
  if(!crop.hasImage()) return;
  const {rows,cols} = currentLayout();
  setStatus("正在生成，请稍候…");
  el.generateBtn.disabled = true;
  requestAnimationFrame(()=>{
    // sample from a hi-res render (scaled with block count) so fine detail survives
    const target = Math.min(3600, Math.max(2000, 450*Math.max(rows,cols)));
    const { ctx, size } = crop.getHiResContext(target);
    const bw = size/cols, bh = size/rows;
    blocksData = [];
    for(let r=0;r<rows;r++){
      const rowArr=[];
      for(let c=0;c<cols;c++){
        rowArr.push(BT.sampleRegionToGrid(ctx, c*bw, r*bh, bw, bh, N,
          el.modeSelect.value, +el.contrastRange.value, +el.saturationRange.value));
      }
      blocksData.push(rowArr);
    }
    updateOverviewMeta();
    renderBlockGridUI();
    selectBlock(0,0);
    el.generateBtn.disabled = false;
    el.previewBigBtn.disabled = false;
    setStatus(`已生成大图（${cols*N}×${rows*N}，共 ${rows*cols} 块），点击总览中的分块进行逐格修正。`);
  });
});

function updateOverviewMeta(){
  const {rows,cols} = currentLayout();
  el.overviewMeta.textContent = `${cols*N}×${rows*N} · ${cols}×${rows}画板 · ${rows*cols}张`;
}

/* ---------- block overview ---------- */
function drawThumb(canvas, g){
  const ctx = canvas.getContext("2d");
  const cs = canvas.width/N;
  for(let r=0;r<N;r++){
    for(let c=0;c<N;c++){
      ctx.fillStyle = BT.paletteById(g[r][c]).hex;
      ctx.fillRect(c*cs, r*cs, cs+0.6, cs+0.6);
    }
  }
}
function renderBlockGridUI(){
  const {rows,cols} = currentLayout();
  el.blockGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  el.blockGrid.innerHTML = "";
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const idx = r*cols + c + 1;
      const thumb = document.createElement("div");
      thumb.className = "block-thumb" + (active && active.r===r && active.c===c ? " active":"");
      thumb.style.aspectRatio = "1 / 1";
      const canvas = document.createElement("canvas");
      canvas.width = 96; canvas.height = 96;
      thumb.appendChild(canvas);
      const label = document.createElement("span");
      label.className = "idx"; label.textContent = BT.pad2(idx);
      thumb.appendChild(label);
      if(blocksData){
        drawThumb(canvas, blocksData[r][c]);
        thumb.addEventListener("click", ()=> selectBlock(r,c));
      }else{
        const cctx = canvas.getContext("2d");
        cctx.fillStyle = "#e7e8ee"; cctx.fillRect(0,0,96,96);
      }
      el.blockGrid.appendChild(thumb);
    }
  }
}
function selectBlock(r,c){
  active = {r,c};
  grid = blocksData[r][c];
  editor.setGridRef(grid);
  editor.resetHistory();
  setEditorEnabled(true);
  const {cols} = currentLayout();
  el.activeBlockLabel.textContent = `（分块 ${BT.pad2(r*cols+c+1)} · 第${r+1}行第${c+1}列）`;
  editor.setCoordOffset(r*N, c*N); // show this block's global 1..96 position, not local 1..24
  editor.render();
  rebuildPaletteUI();
  renderBlockGridUI();
  document.getElementById("editorBoardLayout").scrollIntoView({behavior:"smooth", block:"center"});
}
function setEditorEnabled(enabled){
  el.gridCanvas.style.pointerEvents = enabled ? "auto" : "none";
  el.gridCanvas.style.opacity = enabled ? "1" : "0.35";
}

/* ---------- editor (edits the currently active block) ---------- */
const editorImpl = BT.makeEditor({
  gridCanvas: el.gridCanvas,
  overviewCanvas: el.overviewCanvas,
  coordTop: $("#coordTop"), coordBottom: $("#coordBottom"),
  coordLeft: $("#coordLeft"), coordRight: $("#coordRight"),
  N,
  getGrid: ()=>grid,
  setGrid: (g)=>{
    grid = g;
    if(active) blocksData[active.r][active.c] = g;
  },
  onChange: ()=>{ rebuildPaletteCounts(); if(active) refreshActiveThumb(); },
  onHover: (r,c)=>{ el.cellInfo.textContent = (r==null) ? "R— C—" : `R${r+1} C${c+1}`; },
  onPick: (id)=>{ setSelected(id); },
  onHistoryChange: (u,r)=>{
    el.undoBtn.disabled = u===0; el.redoBtn.disabled = r===0;
  }
});
const editor = Object.assign(editorImpl, { setGridRef:(g)=>{ grid=g; } });
setEditorEnabled(false);

function refreshActiveThumb(){
  if(!active) return;
  const thumbs = el.blockGrid.children;
  const {cols} = currentLayout();
  const idx = active.r*cols + active.c;
  const canvas = thumbs[idx] && thumbs[idx].querySelector("canvas");
  if(canvas) drawThumb(canvas, grid);
}

el.undoBtn.addEventListener("click", ()=>editor.undo());
el.redoBtn.addEventListener("click", ()=>editor.redo());
el.showNumbers.addEventListener("change", ()=>editor.setShowNumbers(el.showNumbers.checked));
el.showGrid.addEventListener("change", ()=>editor.setShowGrid(el.showGrid.checked));
el.showOverview.addEventListener("change", ()=>{
  el.overviewCard.classList.toggle("hidden", !el.showOverview.checked);
});
$all(".tool[data-tool]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    $all(".tool[data-tool]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    editor.setTool(btn.dataset.tool);
  });
});

/* ---------- palette ---------- */
let selected = 1;
function setSelected(id){
  selected = id;
  editor.setSelected(id);
  el.selectedBadge.textContent = "当前色 " + BT.pad2(id);
  $all(".swatch").forEach(s=> s.classList.toggle("active", +s.dataset.id === id));
}
function rebuildPaletteUI(){
  const pal = BT.getPalette();
  el.palette.innerHTML = "";
  const counts = BT.countColors(grid, N, N);
  pal.forEach(p=>{
    const div = document.createElement("button");
    div.type = "button";
    div.className = "swatch" + (p.luma>150 ? " light-text":"");
    div.style.background = p.hex;
    div.dataset.id = p.id;
    div.innerHTML = `<b>${BT.pad2(p.id)}</b><span class="cnt">${counts.get(p.id)||0} 格</span>`;
    div.title = p.hex;
    div.addEventListener("click", ()=> setSelected(p.id));
    el.palette.appendChild(div);
  });
  rebuildReplaceDropdown();
  setSelected(Math.min(selected, pal.length));
}
function rebuildPaletteCounts(){
  const counts = BT.countColors(grid, N, N);
  $all(".swatch").forEach(s=>{
    const id = +s.dataset.id;
    const span = s.querySelector(".cnt");
    if(span) span.textContent = (counts.get(id)||0) + " 格";
  });
  rebuildReplaceDropdown();
}
function rebuildReplaceDropdown(){
  const pal = BT.getPalette();
  const counts = BT.countColors(grid, N, N);
  const prev = el.replaceFrom.value;
  el.replaceFrom.innerHTML = "";
  pal.forEach(p=>{
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${BT.pad2(p.id)} (${counts.get(p.id)||0}格)`;
    el.replaceFrom.appendChild(opt);
  });
  if(prev) el.replaceFrom.value = prev;
}
function addCustomColor(){
  const res = BT.addCustomColor(el.customHexInput.value);
  if(res.error){ setStatus(res.error); return; }
  rebuildPaletteUI();
  setSelected(res.id);
  const swatch = el.palette.querySelector(`.swatch[data-id="${res.id}"]`);
  if(swatch) swatch.scrollIntoView({block:"nearest"});
  el.customHexInput.value = "";
  setStatus(res.isNew ? `已添加自定义颜色 ${BT.pad2(res.id)}。` : `该颜色已存在，已选中 ${BT.pad2(res.id)}。`);
}
el.addCustomColorBtn.addEventListener("click", addCustomColor);
el.customHexInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter") addCustomColor(); });

el.replaceBtn.addEventListener("click", ()=>{
  if(!active){ setStatus("请先在总览中选择一个分块。"); return; }
  const from = +el.replaceFrom.value;
  editor.replaceColor(from, selected);
  rebuildPaletteCounts();
  refreshActiveThumb();
  setStatus(`已将当前分块中的 ${BT.pad2(from)} 全部替换为 ${BT.pad2(selected)}。`);
});

/* ---------- full picture preview ---------- */
function openBigPreview(){
  if(!blocksData) return;
  const {grid:big, rows, cols} = BT.composeBlocks(blocksData, N);
  const cellPx = Math.max(4, Math.min(10, Math.floor(680/cols/N)));
  const c = BT.renderPatternCanvas(big, rows, cols, cellPx, false);
  el.bigPreviewCanvas.width = c.width;
  el.bigPreviewCanvas.height = c.height;
  el.bigPreviewCanvas.getContext("2d").drawImage(c,0,0);
  el.bigPreviewOverlay.hidden = false;
}
el.previewBigBtn.addEventListener("click", openBigPreview);
el.bigPreviewCloseBtn.addEventListener("click", ()=>{ el.bigPreviewOverlay.hidden = true; });
el.bigPreviewOverlay.addEventListener("click", (e)=>{
  if(e.target === el.bigPreviewOverlay) el.bigPreviewOverlay.hidden = true;
});

/* ---------- export ---------- */
function currentFileName(){
  return (el.fileName.value || "bead_pattern_large").trim().replace(/[\\/:*?"<>|]/g,"_");
}
function requireBlocks(){
  if(!blocksData){ setStatus("请先点击「生成大图」。"); return false; }
  return true;
}
el.exportPreviewBtn.addEventListener("click", ()=>{
  if(!requireBlocks()) return;
  const {grid:big, rows, cols} = BT.composeBlocks(blocksData, N);
  const c = BT.renderPatternCanvas(big, rows, cols, 10, false);
  BT.download(c.toDataURL("image/png"), currentFileName()+"_preview.png");
  setStatus("已导出 PNG 预览。");
});
el.exportTotalBtn.addEventListener("click", ()=>{
  if(!requireBlocks()) return;
  const {grid:big, rows, cols} = BT.composeBlocks(blocksData, N);
  const pattern = BT.renderPatternCanvas(big, rows, cols, 24, true);
  const counts = BT.countColors(big, rows, cols);
  const legend = BT.renderLegendCanvas(counts, pattern.width);
  const full = BT.stackCanvases(pattern, legend, 16);
  const dataUrl = full.toDataURL("image/png");
  BT.download(dataUrl, currentFileName()+".png");
  pushHistory(dataUrl);
  setStatus("已导出整幅图纸，并保存到本机历史。");
});
el.saveProjectBtn.addEventListener("click", ()=>{
  if(!requireBlocks()) return;
  const {rows,cols} = currentLayout();
  const proj = {
    type:"beadtool-mosaic", version:1, blockSize:N, rows, cols,
    paletteMode: BT.getPaletteMode(),
    blocks: blocksData,
    settings:{
      mode: el.modeSelect.value,
      contrast:+el.contrastRange.value,
      saturation:+el.saturationRange.value
    },
    fileName: currentFileName()
  };
  const blob = new Blob([JSON.stringify(proj)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  BT.download(url, currentFileName()+".json");
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
  setStatus("已保存工程 JSON。");
});

/* ---------- history ---------- */
function pushHistory(dataUrl){
  const list = BT.loadHistory();
  list.unshift({
    id: Date.now(), type:"mosaic",
    thumb: dataUrl, fileName: currentFileName(), time: new Date().toLocaleString()
  });
  BT.saveHistory(list);
  renderHistory();
}
function renderHistory(){
  const list = BT.loadHistory().filter(h=>h.type==="mosaic");
  el.historyCount.textContent = list.length + " 份";
  el.clearHistoryBtn.disabled = list.length===0;
  el.exportHistory.innerHTML = "";
  if(list.length===0){
    el.exportHistory.innerHTML = `<div class="empty-hint">尚无记录。第一次导出图纸后会自动出现在这里。</div>`;
    return;
  }
  list.forEach(item=>{
    const card = document.createElement("div");
    card.className = "history-card";
    card.innerHTML = `<img src="${item.thumb}" alt="历史图纸缩略图">
      <div class="hc-meta">${item.fileName}<br>${item.time}</div>
      <button class="hc-del" title="删除">×</button>`;
    card.querySelector(".hc-del").addEventListener("click",(e)=>{
      e.stopPropagation();
      const all = BT.loadHistory().filter(h=>h.id!==item.id);
      BT.saveHistory(all);
      renderHistory();
      setStatus("已删除一条导出历史。");
    });
    el.exportHistory.appendChild(card);
  });
}
el.clearHistoryBtn.addEventListener("click", ()=>{
  const all = BT.loadHistory().filter(h=>h.type!=="mosaic");
  BT.saveHistory(all);
  renderHistory();
  setStatus("已清空导出历史。");
});

/* ---------- share link ---------- */
const shareLinkBtn = document.getElementById("shareLinkBtn");
if(shareLinkBtn){
  shareLinkBtn.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(window.location.href);
      setStatus("已复制页面链接，可以发送到你的其他设备打开。");
    }catch(e){
      setStatus("复制失败，请手动复制地址栏中的链接：" + window.location.href);
    }
  });
}

/* ---------- init ---------- */
BT.setPaletteMode("more"); // full color set, no 40/更多颜色 toggle anymore
{
  const initLayout = currentLayout();
  blocksData = makeBlankBlocks(initLayout.rows, initLayout.cols);
  crop.setOverlayGrid(initLayout.rows, initLayout.cols);
}
rebuildPaletteUI();
renderBlockGridUI();
updateOverviewMeta();
renderHistory();
selectBlock(0,0); // blank canvas is paintable right away, no photo required
})();
