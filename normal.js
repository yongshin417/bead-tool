(function(){
"use strict";
const BT = window.BeadTool;
const $ = BT.$;
const N = 24;

/* ---------- state ---------- */
let grid = BT.makeGrid(N, BT.EMPTY_COLOR);
let undoRedoInfo = {undo:0, redo:0};

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
  generateBtn: $("#generateBtn"),
  cellInfo: $("#cellInfo"),
  undoBtn: $("#undoBtn"), redoBtn: $("#redoBtn"),
  showNumbers: $("#showNumbers"), showGrid: $("#showGrid"), showOverview: $("#showOverview"),
  overviewCard: $("#overviewCard"), overviewCanvas: $("#overviewCanvas"), gridCanvas: $("#gridCanvas"),
  replaceFrom: $("#replaceFrom"), replaceBtn: $("#replaceBtn"), selectedBadge: $("#selectedBadge"),
  palette: $("#palette"),
  customHexInput: $("#customHexInput"), addCustomColorBtn: $("#addCustomColorBtn"),
  fileName: $("#fileName"),
  exportPreviewBtn: $("#exportPreviewBtn"), exportTotalBtn: $("#exportTotalBtn"), saveProjectBtn: $("#saveProjectBtn"),
  exportHistory: $("#exportHistory"), historyCount: $("#historyCount"), clearHistoryBtn: $("#clearHistoryBtn"),
  status: $("#status"),
};

function setStatus(msg){ el.status.textContent = msg; }

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
      el.cropWrap.hidden = false;
      el.dropZone.hidden = true;
      el.generateBtn.disabled = false;
      el.sourceMeta.textContent = `${img.width}×${img.height} 已载入`;
      el.zoomRange.value = 100; el.zoomOut.textContent="100%";
      setStatus("图片已载入，调整裁剪后点击「生成 24×24 初稿」。");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
el.imageInput.addEventListener("change", (e)=>{ handleFile(e.target.files[0]); });
["dragover"].forEach(ev=> el.dropZone.addEventListener(ev,(e)=>{ e.preventDefault(); }));
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

el.generateBtn.addEventListener("click", ()=>{
  if(!crop.hasImage()) return;
  editor.pushUndo();
  setStatus("正在生成，请稍候…");
  el.generateBtn.disabled = true;
  requestAnimationFrame(()=>{
    const { ctx, size } = crop.getHiResContext(2000); // sample from a hi-res render, not the small preview
    grid = BT.sampleRegionToGrid(ctx, 0,0, size, size, N,
      el.modeSelect.value, +el.contrastRange.value, +el.saturationRange.value);
    editor.setGridRef(grid);
    editor.render();
    rebuildPaletteUI();
    el.generateBtn.disabled = false;
    setStatus("已生成 24×24 初稿，可在下方用画笔继续修正。");
  });
});

/* ---------- editor ---------- */
const editorImpl = BT.makeEditor({
  gridCanvas: el.gridCanvas,
  overviewCanvas: el.overviewCanvas,
  coordTop: $("#coordTop"), coordBottom: $("#coordBottom"),
  coordLeft: $("#coordLeft"), coordRight: $("#coordRight"),
  N,
  getGrid: ()=>grid,
  setGrid: (g)=>{ grid = g; },
  onChange: ()=>{ rebuildPaletteCounts(); },
  onHover: (r,c)=>{ el.cellInfo.textContent = (r==null) ? "R— C—" : `R${r+1} C${c+1}`; },
  onPick: (id)=>{ setSelected(id); },
  onHistoryChange: (u,r)=>{
    undoRedoInfo = {undo:u, redo:r};
    el.undoBtn.disabled = u===0; el.redoBtn.disabled = r===0;
  }
});
// small helper so generateBtn handler above reads nicely
const editor = Object.assign(editorImpl, { setGridRef:(g)=>{ grid=g; } });

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
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

/* ---------- palette ---------- */
let selected = 1;
function setSelected(id){
  selected = id;
  editor.setSelected(id);
  el.selectedBadge.textContent = "当前色 " + BT.pad2(id);
  $all(".swatch").forEach(s=>{
    s.classList.toggle("active", +s.dataset.id === id);
  });
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
  const from = +el.replaceFrom.value;
  editor.replaceColor(from, selected);
  rebuildPaletteCounts();
  setStatus(`已将 ${BT.pad2(from)} 全部替换为 ${BT.pad2(selected)}。`);
});

/* ---------- export ---------- */
function currentFileName(){
  return (el.fileName.value || "bead_pattern").trim().replace(/[\\/:*?"<>|]/g,"_");
}
el.exportPreviewBtn.addEventListener("click", ()=>{
  const c = BT.renderPatternCanvas(grid, N, N, 20, false);
  BT.download(c.toDataURL("image/png"), currentFileName()+"_preview.png");
  setStatus("已导出 PNG 预览。");
});
el.exportTotalBtn.addEventListener("click", ()=>{
  const pattern = BT.renderPatternCanvas(grid, N, N, 32, true);
  const counts = BT.countColors(grid, N, N);
  const legend = BT.renderLegendCanvas(counts, pattern.width);
  const full = BT.stackCanvases(pattern, legend, 16);
  const dataUrl = full.toDataURL("image/png");
  BT.download(dataUrl, currentFileName()+".png");
  pushHistory(dataUrl);
  setStatus("已导出图纸，并保存到本机历史。");
});
el.saveProjectBtn.addEventListener("click", ()=>{
  const proj = {
    type:"beadtool-normal", version:1, size:N,
    paletteMode: BT.getPaletteMode(),
    grid,
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
    id: Date.now(),
    type:"normal",
    thumb: dataUrl,
    fileName: currentFileName(),
    time: new Date().toLocaleString()
  });
  BT.saveHistory(list);
  renderHistory();
}
function renderHistory(){
  const list = BT.loadHistory().filter(h=>h.type!=="mosaic");
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
  const all = BT.loadHistory().filter(h=>h.type==="mosaic");
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
rebuildPaletteUI();
editor.render();
renderHistory();
})();
