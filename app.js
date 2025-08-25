// Simple no-framework app to visualize image pixels in RGB color space (3D scatter)
// Behavior:
// - populate presets from the extracted `rgb_images/rgb_images/` directory
// - allow upload of an image
// - sample pixels with a step, convert pixel color to [0..1] R,G,B -> x,y,z
// - render points as a 3D scatter projection onto canvas with basic orbit controls

(function(){
  const presetSelect = document.getElementById('preset');
  const upload = document.getElementById('upload');
  const sourceImage = document.getElementById('sourceImage');
  const readCanvas = document.getElementById('readCanvas');
  const pointCountEl = document.getElementById('pointCount');
  const sampleButtons = Array.from(document.querySelectorAll('.sample-btn'));
  const thumb = document.getElementById('thumb');
  let currentStep = 4; // medium default
  const canvas = document.getElementById('plot');
  const ctx = canvas.getContext('2d');
  const resetBtn = document.getElementById('resetView');

  // Preload presets by fetching a directory listing (we'll try to fetch known files)
  const presetPath = 'rgb_images/rgb_images/';
  const presets = [
    'solid_red.png','solid_green.png','solid_blue.png','solid_white.png','solid_black.png',
    'gradient_red_to_blue.png','gradient_red_to_green.png','gradient_green_to_blue.png',
    'checkerboard_red_green.png','checkerboard_blue_yellow.png','checkerboard_black_white.png',
    'shades_red.png','shades_green.png','shades_blue.png','shades_gray.png',
    'solid_cyan.png','solid_magenta.png','solid_yellow.png'
  ];

  presets.forEach(name=>{
    const opt = document.createElement('option');
    opt.value = presetPath + name;
    opt.textContent = name;
    presetSelect.appendChild(opt);
  });

  // Keep app state
  let points = []; // [{x,y,z,color}]
  let view = {rx: -0.9, ry: 0.6, zoom: 1.6};

  // autoRender helper (called when image or sampling changes)
  function autoRender(){
    if(!sourceImage.src) return;
    samplePixelsAndBuildPoints(sourceImage, currentStep);
  }

  // sampling buttons behavior
  function setSampling(step, btn){
    currentStep = step;
    sampleButtons.forEach(b=>b.classList.toggle('active', b===btn));
    autoRender();
  }
  sampleButtons.forEach(b=>{
    b.addEventListener('click', ()=> setSampling(parseInt(b.dataset.step,10), b));
  });

  upload.addEventListener('change', e=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    sourceImage.src = url;
    sourceImage.onload = ()=>{
      URL.revokeObjectURL(url);
      thumb.src = sourceImage.src;
      autoRender();
    }
  });

  presetSelect.addEventListener('change', ()=>{
    sourceImage.src = presetSelect.value;
    sourceImage.onload = ()=>{ thumb.src = sourceImage.src; autoRender(); };
  });

  // Initial preset
  if(presetSelect.options.length) presetSelect.selectedIndex = 0;
  sourceImage.src = presetSelect.value;
  thumb.src = sourceImage.src;

  resetBtn.addEventListener('click', ()=>{ view = {rx:-0.9, ry:0.6, zoom:1.6}; draw(); });

  function samplePixelsAndBuildPoints(img, step){
    const w = img.naturalWidth; const h = img.naturalHeight;
    readCanvas.width = w; readCanvas.height = h;
    const rctx = readCanvas.getContext('2d');
    rctx.clearRect(0,0,w,h);
    rctx.drawImage(img,0,0,w,h);
    const data = rctx.getImageData(0,0,w,h).data;
    points = [];
    for(let y=0;y<h;y+=step){
      for(let x=0;x<w;x+=step){
        const i = (y*w + x)*4;
        const r = data[i]/255; const g = data[i+1]/255; const b = data[i+2]/255; const a = data[i+3]/255;
        if(a<0.01) continue;
        points.push({x:r,y:g,z:b,color:`rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},0.9)`});
      }
    }
    pointCountEl.textContent = points.length;
    // automatically adjust zoom to fit the sampled points
    autoZoom();
    draw();
  }

  // Adjust view.zoom so the current points fit comfortably in the canvas
  function autoZoom(){
    if(!points || points.length === 0) { view.zoom = 1; return; }
    const w = canvas.width, h = canvas.height;
    // measure projected extents at zoom = 1
    const oldZoom = view.zoom;
    view.zoom = 1;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for(let i=0;i<points.length;i++){
      const pr = project(points[i], w, h);
      if(pr.sx < minX) minX = pr.sx;
      if(pr.sy < minY) minY = pr.sy;
      if(pr.sx > maxX) maxX = pr.sx;
      if(pr.sy > maxY) maxY = pr.sy;
    }
    // restore zoom only for calculation -> we'll set new zoom below
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const span = Math.max(spanX, spanY);
    // target is to occupy about 70% of the smaller canvas dimension
    const target = Math.min(w, h) * 0.70;
    let newZoom = span > 0 ? (target / span) : oldZoom;
    // clamp to reasonable range
    newZoom = Math.max(0.2, Math.min(6, newZoom));
    view.zoom = newZoom;
  }

  // Basic 3D projection + orbit controls
  function project(p, w, h){
    // Orthographic-style projection: rotate the point then scale without heavy perspective.
    const sinX = Math.sin(view.rx), cosX = Math.cos(view.rx);
    const sinY = Math.sin(view.ry), cosY = Math.cos(view.ry);
    // center coordinates around 0
    let x = p.x - 0.5, y = p.y - 0.5, z = p.z - 0.5;
    // rotate around Y
    let x1 = cosY * x + sinY * z;
    let z1 = -sinY * x + cosY * z;
    // rotate around X
    let y1 = cosX * y - sinX * z1;
    let z2 = sinX * y + cosX * z1;
    // orthographic scale (independent of z) so navigation feels stable
    const base = Math.min(w, h) * 0.9 * view.zoom;
    const sx = x1 * base + w / 2;
    const sy = -y1 * base + h / 2; // invert y for screen coordinates
    const depth = z2; // keep depth for simple painter's ordering
    return {sx, sy, depth, base};
  }

  function draw(){
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0,0,w,h);
    // background
    ctx.fillStyle = '#061017'; ctx.fillRect(0,0,w,h);

  // Draw axes from origin (0,0,0) to pure-color corners so pure red/green/blue locations are clear.
  const origin = project({x:0,y:0,z:0}, w, h);
  const rCorner = project({x:1,y:0,z:0}, w, h); // pure red
  const gCorner = project({x:0,y:1,z:0}, w, h); // pure green
  const bCorner = project({x:0,y:0,z:1}, w, h); // pure blue
  // draw axes lines (subtle)
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(220,80,80,0.7)'; ctx.beginPath(); ctx.moveTo(origin.sx, origin.sy); ctx.lineTo(rCorner.sx, rCorner.sy); ctx.stroke();
  ctx.strokeStyle = 'rgba(80,220,120,0.7)'; ctx.beginPath(); ctx.moveTo(origin.sx, origin.sy); ctx.lineTo(gCorner.sx, gCorner.sy); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,140,240,0.8)'; ctx.beginPath(); ctx.moveTo(origin.sx, origin.sy); ctx.lineTo(bCorner.sx, bCorner.sy); ctx.stroke();
  // mark pure color corners with solid colored circles so users can compare
  ctx.beginPath(); ctx.fillStyle = 'rgb(255,0,0)'; ctx.arc(rCorner.sx, rCorner.sy, 6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.fillStyle = 'rgb(0,255,0)'; ctx.arc(gCorner.sx, gCorner.sy, 6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.fillStyle = 'rgb(0,0,255)'; ctx.arc(bCorner.sx, bCorner.sy, 6,0,Math.PI*2); ctx.fill();
  // labels
  ctx.fillStyle = 'rgba(230,235,240,0.95)'; ctx.font = '12px sans-serif';
  ctx.fillText('R (1,0,0)', rCorner.sx + 8, rCorner.sy + 4);
  ctx.fillText('G (0,1,0)', gCorner.sx + 8, gCorner.sy + 4);
  ctx.fillText('B (0,0,1)', bCorner.sx + 8, bCorner.sy + 4);

    // draw points sorted by depth (simple painter's algorithm)
    const sorted = points.map(p=>({p,pr:project(p,w,h)})).sort((a,b)=>a.pr.depth - b.pr.depth);
    for(let i=0;i<sorted.length;i++){
      const item = sorted[i];
      const pr = item.pr;
      const s = Math.max(0.9, 3 * (pr.base / Math.min(w,h)) * 0.6);
      // fill with original pixel color
      ctx.beginPath();
      ctx.fillStyle = item.p.color;
      ctx.globalAlpha = 0.95;
      ctx.arc(pr.sx, pr.sy, s, 0, Math.PI*2);
      ctx.fill();
      // stroke with contrasting color so points are visible against any background
      const lum = 0.299*item.p.x + 0.587*item.p.y + 0.114*item.p.z; // perceived luminance
      const strokeColor = lum > 0.6 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.95)';
      ctx.lineWidth = Math.max(1, s * 0.25);
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  // Interaction: drag to rotate, wheel to zoom
  let dragging = false, last = null;
  canvas.addEventListener('pointerdown', e=>{
    dragging=true; canvas.setPointerCapture(e.pointerId);
    last = {x:e.clientX,y:e.clientY};
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointerup', e=>{ dragging=false; last=null; canvas.releasePointerCapture(e.pointerId); canvas.style.cursor = 'default'; });
  canvas.addEventListener('pointercancel', e=>{ dragging=false; last=null; canvas.style.cursor = 'default'; });
  canvas.addEventListener('pointermove', e=>{
    if(!dragging || !last) return;
    // reduce sensitivity so dragging rotates smoothly
    const dx = (e.clientX - last.x) * 0.006;
    const dy = (e.clientY - last.y) * 0.006;
    view.ry += dx; view.rx += dy;
    // clamp x rotation to avoid flipping
    const limit = Math.PI/2 - 0.01;
    view.rx = Math.max(-limit, Math.min(limit, view.rx));
    last = {x:e.clientX,y:e.clientY};
    draw();
  });
  canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    // gentler zoom
    const delta = e.deltaY > 0 ? 1.04 : 0.96; view.zoom *= delta; view.zoom = Math.max(0.4, Math.min(4, view.zoom)); draw();
  }, {passive:false});

  // Resize canvas to device pixel ratio
  function resize(){
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    draw();
  }
  window.addEventListener('resize', resize);
  // set an initial size
  canvas.style.width = '800px'; canvas.style.height = '600px';
  resize();

  // auto-render initial preset once page loads
  window.addEventListener('load', ()=>{
    setTimeout(()=>{ autoRender(); }, 250);
  });
})();
