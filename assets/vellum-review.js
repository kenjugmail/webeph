/* ============================================================
   REVIEW — interactive before→after 3D/shader review.
   Two WebGL canvases (same program, uMode 0/1) revealed by a
   drag handle. A verdict panel flips as you cross the midpoint.
   mountReview(rootEl)
   ============================================================ */
(function () {
  const VERT = `
    attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }
  `;
  const FRAG = `
    precision highp float;
    uniform vec2 uRes; uniform float uTime; uniform float uMode;
    // hash + value noise
    float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    float noise(vec2 x){
      vec2 i = floor(x), f = fract(x);
      float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
      vec2 u = f*f*(3.-2.*f);
      return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
    }
    float fbm(vec2 p, float oct){
      float v=0., a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
      for(int i=0;i<6;i++){ if(float(i)>=oct) break; v += a*noise(p); p = m*p; a*=0.5; }
      return v;
    }
    vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(6.28318*(c*t+d)); }
    void main(){
      vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/min(uRes.x,uRes.y);
      float t = uTime*0.12;
      bool after = uMode > 0.5;
      float oct = after ? 4.0 : 2.0;
      // domain warp
      vec2 q = vec2(fbm(uv*2.0 + t, oct), fbm(uv*2.0 - t + 5.2, oct));
      vec2 r = vec2(fbm(uv*2.0 + 1.7*q + t*0.5, oct), fbm(uv*2.0 + 1.7*q + 9.1, oct));
      float f = fbm(uv*2.0 + 2.4*r, oct);
      float d = length(uv);
      if(after){
        // smooth, on-palette glow (amber→gold→cream) — Vellum warm scope
        vec3 col = pal(f + d*0.4 + t*0.2,
          vec3(0.30,0.20,0.10), vec3(0.55,0.42,0.24),
          vec3(1.0,1.0,1.0), vec3(0.0,0.16,0.34));
        col += vec3(0.60,0.36,0.10)*pow(max(0.,1.0-d),3.0);   // warm amber core bloom
        col *= 1.0 - 0.45*d;                                  // vignette
        col = pow(col, vec3(0.85));
        gl_FragColor = vec4(col, 1.0);
      } else {
        // banded, muddy, off-palette (the broken candidate)
        float band = floor(f*5.0)/5.0;
        vec3 col = mix(vec3(0.10,0.12,0.12), vec3(0.34,0.36,0.30), band);
        col += 0.04*hash(gl_FragCoord.xy);
        gl_FragColor = vec4(col, 1.0);
      }
    }
  `;

  function makeGL(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) return null;
    function sh(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const prog = gl.createProgram();
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return {
      gl, prog,
      uRes: gl.getUniformLocation(prog, 'uRes'),
      uTime: gl.getUniformLocation(prog, 'uTime'),
      uMode: gl.getUniformLocation(prog, 'uMode'),
    };
  }

  function mountVellumReview(root) {
    root.classList.add('review');
    root.innerHTML = `
      <div class="review-grid">
        <div class="review-stage" data-stage>
          <canvas class="review-canvas" data-after></canvas>
          <canvas class="review-canvas review-overlay" data-before></canvas>
          <div class="review-tag review-tag-before mono">before · candidate a</div>
          <div class="review-tag review-tag-after mono">after · candidate b ✓</div>
          <div class="review-handle" data-handle><span></span></div>
        </div>
        <div class="review-panel" data-panel>
          <div class="review-verdict" data-verdict>
            <span class="verdict-dot"></span>
            <span class="verdict-text mono" data-vtext>REJECTED</span>
          </div>
          <div class="review-aspects" data-aspects></div>
          <div class="review-metric">
            <div class="metric-row"><span>spatial metric</span><b class="mono" data-metric>0.41</b></div>
            <div class="metric-track"><i data-metricbar></i></div>
            <div class="metric-foot mono">compiles · headless render · no GPU in CI</div>
          </div>
        </div>
      </div>
    `;

    const ASPECTS = [
      { k: 'compiles',  w: 0.20, before: false, after: true },
      { k: 'metric ≥ 0.8', w: 0.30, before: false, after: true },
      { k: 'typecheck', w: 0.15, before: true,  after: true },
      { k: 'lint',      w: 0.15, before: true,  after: true },
      { k: 'vision aspect', w: 0.20, before: false, after: true },
    ];
    const aspectsEl = root.querySelector('[data-aspects]');
    ASPECTS.forEach(a => {
      const row = document.createElement('div');
      row.className = 'aspect';
      row.innerHTML = `<span class="aspect-k">${a.k}</span>
        <span class="aspect-w mono">×${a.w.toFixed(2)}</span>
        <span class="aspect-mark" data-k="${a.k}"></span>`;
      aspectsEl.appendChild(row);
    });

    const before = root.querySelector('[data-before]');
    const after = root.querySelector('[data-after]');
    const stage = root.querySelector('[data-stage]');
    const handle = root.querySelector('[data-handle]');
    const glB = makeGL(before), glA = makeGL(after);

    function size() {
      const r = stage.getBoundingClientRect();
      // 1.5 DPR cap: the FBM shader's cost scales with pixels and the warped-noise look
      // hides the difference; this halves fragment work on high-DPI displays.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      [before, after].forEach(c => { c.width = r.width * dpr; c.height = r.height * dpr; });
      if (glB) { glB.gl.viewport(0,0,before.width,before.height); }
      if (glA) { glA.gl.viewport(0,0,after.width,after.height); }
    }
    size();
    window.addEventListener('resize', size);

    let t0 = performance.now();
    function draw(now) {
      const t = (now - t0) / 1000;
      // base = AFTER (good/uMode 1); overlay = BEFORE (banded/uMode 0)
      if (glA) { glA.gl.uniform2f(glA.uRes, after.width, after.height); glA.gl.uniform1f(glA.uTime, t); glA.gl.uniform1f(glA.uMode, 1.0); glA.gl.drawArrays(glA.gl.TRIANGLES, 0, 3); }
      if (glB) { glB.gl.uniform2f(glB.uRes, before.width, before.height); glB.gl.uniform1f(glB.uTime, t); glB.gl.uniform1f(glB.uMode, 0.0); glB.gl.drawArrays(glB.gl.TRIANGLES, 0, 3); }
    }
    if (glB || glA) window.V3.visLoop(stage, draw);
    else stage.classList.add('no-webgl');

    // ---- slider / verdict ----
    const vEl = root.querySelector('[data-verdict]');
    const vText = root.querySelector('[data-vtext]');
    const metricEl = root.querySelector('[data-metric]');
    const metricBar = root.querySelector('[data-metricbar]');

    function setPct(pct) {
      pct = Math.max(0, Math.min(100, pct));
      // pct = divider position from left = width of the BEFORE region (overlay).
      // BEFORE (banded overlay) fills 0..pct; AFTER (base) shows pct..100.
      before.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      handle.style.left = pct + '%';
      const isAfter = pct < 50;           // after dominates when divider is left
      const afterFrac = (100 - pct) / 100;
      const m = (0.41 + (0.94 - 0.41) * afterFrac);
      metricEl.textContent = m.toFixed(2);
      metricBar.style.width = (m * 100) + '%';
      metricBar.style.background = isAfter ? 'var(--green)' : 'var(--red)';
      // aspects
      ASPECTS.forEach(a => {
        const mk = root.querySelector(`[data-k="${a.k}"]`);
        const pass = isAfter ? a.after : a.before;
        mk.textContent = pass ? '✓' : '✕';
        mk.className = 'aspect-mark ' + (pass ? 'pass' : 'fail');
      });
      vEl.className = 'review-verdict ' + (isAfter ? 'ok' : 'bad');
      vText.textContent = isAfter ? 'SELECTED' : 'REJECTED';
      root.querySelector('.review-tag-before').style.opacity = isAfter ? 0.4 : 1;
      root.querySelector('.review-tag-after').style.opacity = isAfter ? 1 : 0.4;
    }

    let dragging = false;
    function fromEvent(e) {
      const r = stage.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      setPct((x / r.width) * 100);
    }
    const down = (e) => { dragging = true; fromEvent(e); e.preventDefault(); };
    const move = (e) => { if (dragging) fromEvent(e); };
    const up = () => { dragging = false; };
    stage.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    stage.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);

    // intro: animate the wipe from before→after once, then settle
    setPct(22);
    let intro = true;
    function playIntro() {
      if (!intro) return; intro = false;
      let p = 22, dir = 1;
      const anim = setInterval(() => {
        p += dir * 2.4;
        if (p >= 78) dir = -1;
        if (p <= 44 && dir < 0) { clearInterval(anim); setPct(44); }
        else setPct(p);
      }, 26);
    }
    const io = new IntersectionObserver((ents) => {
      ents.forEach(e => { if (e.isIntersecting) playIntro(); });
    }, { threshold: 0.4 });
    io.observe(root);
    setTimeout(playIntro, 1800); // fallback for headless/background
  }

  window.mountVellumReview = mountVellumReview;
})();
