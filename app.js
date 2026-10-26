/* Placeholder Image — everything is drawn locally on a <canvas> or written as an SVG string. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;
  var FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif';
  var MAX = 8000, PREVIEW = 1100;
  var PRESETS = [
    ["Web", [["Open Graph / link preview", 1200, 630], ["Hero 16:9 (Full HD)", 1920, 1080], ["HD 16:9", 1280, 720], ["Blog image 4:3", 800, 600], ["Thumbnail 3:2", 600, 400], ["Avatar", 256, 256]]],
    ["Social", [["Instagram square", 1080, 1080], ["Instagram portrait 4:5", 1080, 1350], ["Story / Reel 9:16", 1080, 1920], ["X / Twitter header", 1500, 500], ["LinkedIn banner", 1584, 396], ["YouTube thumbnail", 1280, 720]]],
    ["Ads (IAB)", [["Medium rectangle", 300, 250], ["Leaderboard", 728, 90], ["Wide skyscraper", 160, 600], ["Mobile banner", 320, 50], ["Half page", 300, 600], ["Billboard", 970, 250]]],
    ["Devices", [["iPhone 15 (screen)", 1179, 2556], ["Desktop 1440", 1440, 900], ["4K UHD", 3840, 2160]]]
  ];
  var DEF = { w: 1200, h: 630, bg: "#1f2937", fg: "#9ca3af", text: "", fs: 0, fw: "600", fmt: "png" };
  var st = Object.assign({}, DEF, S3.store("ph.settings") || {});
  var cv = $("#cv"), info = $("#info"), stats = $("#stats");

  // ---------- pure helpers ----------
  function normHex(v) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v).trim());
    if (!m) return null;
    var x = m[1].toLowerCase();
    if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
    return "#" + x;
  }
  function clampDim(v) { v = Math.round(+v); return isFinite(v) && v >= 1 ? Math.min(MAX, v) : null; }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function ratio(w, h) { var g = gcd(w, h); return w / g + ":" + h / g; }
  function label(s) { return s.text.trim() ? s.text.replace(/\\n/g, "\n") : s.w + " × " + s.h; }
  function lines(s) { return label(s).split("\n"); }

  var mctx = document.createElement("canvas").getContext("2d");
  function fontSize(s) {
    if (+s.fs > 0) return +s.fs;
    var ls = lines(s);
    mctx.font = s.fw + " 100px " + FONT;
    var wmax = Math.max.apply(null, ls.map(function (l) { return mctx.measureText(l).width; })) || 1;
    return Math.max(6, Math.floor(Math.min(100 * s.w * 0.62 / wmax, s.h * 0.42 / (ls.length * 1.2))));
  }

  function draw(canvas, s, scale) {
    var W = Math.max(1, Math.round(s.w * scale)), H = Math.max(1, Math.round(s.h * scale));
    canvas.width = W; canvas.height = H;
    var c = canvas.getContext("2d");
    c.fillStyle = s.bg; c.fillRect(0, 0, W, H);
    var fs = fontSize(s) * scale, ls = lines(s), lh = fs * 1.2;
    c.fillStyle = s.fg; c.font = s.fw + " " + fs + "px " + FONT;
    c.textAlign = "center"; c.textBaseline = "middle";
    ls.forEach(function (l, i) { c.fillText(l, W / 2, H / 2 + (i - (ls.length - 1) / 2) * lh); });
    return canvas;
  }

  function svg(s) {
    var fs = fontSize(s), ls = lines(s), lh = fs * 1.2, y0 = s.h / 2 - (ls.length - 1) * lh / 2;
    var spans = ls.map(function (l, i) { return '<tspan x="50%" y="' + +(y0 + i * lh).toFixed(2) + '">' + S3.esc(l) + "</tspan>"; }).join("");
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s.w + '" height="' + s.h + '" viewBox="0 0 ' + s.w + " " + s.h + '">' +
      '<rect width="100%" height="100%" fill="' + s.bg + '"/>' +
      '<text fill="' + s.fg + '" font-family="' + S3.esc(FONT) + '" font-size="' + fs + '" font-weight="' + s.fw +
      '" text-anchor="middle" dominant-baseline="central">' + spans + "</text></svg>";
  }

  var MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };
  var EXT = { png: "png", jpeg: "jpg", webp: "webp", svg: "svg" };
  function output(s) {
    if (s.fmt === "svg") {
      var text = svg(s);
      return Promise.resolve({ blob: new Blob([text], { type: MIME.svg }), uri: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text) });
    }
    var c = draw(document.createElement("canvas"), s, 1);
    var q = s.fmt === "png" ? undefined : 0.92;
    return new Promise(function (res, rej) {
      c.toBlob(function (b) {
        if (!b) return rej(new Error("Your browser could not encode this size"));
        // Some browsers (older Safari) silently fall back to PNG for WebP.
        res({ blob: b, uri: c.toDataURL(MIME[s.fmt], q), fellBack: b.type !== MIME[s.fmt] });
      }, MIME[s.fmt], q);
    });
  }

  // ---------- UI ----------
  function seg(el, value, onPick) {
    $$("button", el).forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === value));
      b.addEventListener("click", function () {
        $$("button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        onPick(b.dataset.v);
      });
    });
  }
  function stat(lbl, v) { return '<div class="stat"><b>' + S3.esc(v) + "</b><span>" + S3.esc(lbl) + "</span></div>"; }

  var sizeJob = S3.debounce(function () {
    var snap = Object.assign({}, st);
    output(snap).then(function (o) {
      if (JSON.stringify(snap) !== JSON.stringify(st)) return;
      var el = $("#sz"); if (el) el.textContent = S3.fmtBytes(o.blob.size);
    }, function () {});
  }, 350);

  function render() {
    S3.store("ph.settings", st);
    var scale = Math.min(1, PREVIEW / Math.max(st.w, st.h));
    draw(cv, st, scale);
    $("#text").placeholder = st.w + " × " + st.h;
    $("#fsLbl").textContent = +st.fs > 0 ? st.fs + " px" : "auto (" + fontSize(st) + " px)";
    info.textContent = st.w + " × " + st.h + " · " + EXT[st.fmt].toUpperCase();
    stats.innerHTML = stat("aspect ratio", ratio(st.w, st.h)) + stat("megapixels", (st.w * st.h / 1e6).toFixed(2)) +
      '<div class="stat"><b id="sz">…</b><span>file size</span></div>';
    $("#preset").value = PRESETS.reduce(function (hit, g) { return hit || g[1].reduce(function (h2, p) { return h2 || (p[1] === st.w && p[2] === st.h ? p[1] + "x" + p[2] : ""); }, ""); }, "");
    sizeJob();
  }

  function syncInputs() {
    $("#w").value = st.w; $("#h").value = st.h; $("#text").value = st.text; $("#fs").value = st.fs; $("#fw").value = st.fw;
    $("#bg").value = st.bg; $("#bgHex").value = st.bg; $("#fg").value = st.fg; $("#fgHex").value = st.fg;
    $$("#fmt button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === st.fmt)); });
  }

  var sel = $("#preset");
  PRESETS.forEach(function (g) {
    var og = S3.h("optgroup", { label: g[0] });
    g[1].forEach(function (p) { og.appendChild(S3.h("option", { value: p[1] + "x" + p[2], text: p[0] + " — " + p[1] + "×" + p[2] })); });
    sel.appendChild(og);
  });
  sel.addEventListener("change", function () {
    if (!sel.value) return;
    var d = sel.value.split("x"); st.w = +d[0]; st.h = +d[1]; syncInputs(); render();
  });
  ["w", "h"].forEach(function (k) {
    $("#" + k).addEventListener("input", function () { var v = clampDim(this.value); if (v) { st[k] = v; render(); } });
    $("#" + k).addEventListener("change", function () { this.value = st[k]; });
  });
  $("#swap").addEventListener("click", function () { var t = st.w; st.w = st.h; st.h = t; syncInputs(); render(); });
  [["bg", "bgHex"], ["fg", "fgHex"]].forEach(function (p) {
    $("#" + p[0]).addEventListener("input", function () { st[p[0]] = this.value; $("#" + p[1]).value = this.value; render(); });
    $("#" + p[1]).addEventListener("input", function () { var v = normHex(this.value); if (v) { st[p[0]] = v; $("#" + p[0]).value = v; render(); } });
    $("#" + p[1]).addEventListener("change", function () { this.value = st[p[0]]; });
  });
  $("#text").addEventListener("input", function () { st.text = this.value; render(); });
  $("#fs").addEventListener("input", function () { var v = +this.value; st.fs = v > 0 && v < 6 ? 6 : v; render(); });
  $("#fw").addEventListener("change", function () { st.fw = this.value; render(); });
  seg($("#fmt"), st.fmt, function (v) { st.fmt = v; render(); });

  function fileName() { return "placeholder-" + st.w + "x" + st.h + "." + EXT[st.fmt]; }
  function act(fn) {
    output(st).then(function (o) {
      if (o.fellBack) S3.toast("Your browser can't make " + EXT[st.fmt].toUpperCase() + " files, so this is a PNG", "error");
      fn(o); S3.done();
    }, function (e) { S3.toast(e.message, "error"); });
  }
  $("#dl").addEventListener("click", function () { act(function (o) { S3.download(o.blob, o.fellBack ? fileName().replace(/\.\w+$/, ".png") : fileName()); }); });
  $("#copyUri").addEventListener("click", function () { act(function (o) { S3.copy(o.uri, "Data URI copied (" + S3.fmtBytes(o.uri.length) + ")"); }); });
  $("#copyTag").addEventListener("click", function () {
    act(function (o) { S3.copy('<img src="' + o.uri + '" width="' + st.w + '" height="' + st.h + '" alt="">', "<img> tag copied"); });
  });

  syncInputs(); render();
  // Inter loads lazily; re-measure once it is in.
  if (document.fonts && document.fonts.load) document.fonts.load(st.fw + " 40px Inter").then(render, function () {});

  window.S3_DEMO = function () {
    st = Object.assign({}, DEF, { w: 1200, h: 630, bg: "#0e9f9a", fg: "#e6fffd", text: "Hero image\\n1200 × 630", fw: "800" });
    syncInputs(); render();
  };

  window.S3_SELFTEST = function () {
    var s = Object.assign({}, DEF, { w: 300, h: 150, bg: "#ff0000", fg: "#ffffff" });
    var a = svg(s);
    var b = svg(Object.assign({}, s, { text: '<b>&"x' }));
    var m = svg(Object.assign({}, s, { text: "one\\ntwo" }));
    var c = draw(document.createElement("canvas"), Object.assign({}, s, { w: 40, h: 20, fg: "#ff0000" }), 1);
    var px = c.getContext("2d").getImageData(0, 0, 1, 1).data;
    var half = draw(document.createElement("canvas"), s, 0.5);
    return a.indexOf('width="300" height="150"') > 0 && a.indexOf("300 × 150") > 0 && a.indexOf('fill="#ff0000"') > 0 &&
      b.indexOf("&lt;b&gt;&amp;&quot;x") > 0 && b.indexOf("<b>") < 0 &&
      (m.match(/<tspan/g) || []).length === 2 &&
      px[0] === 255 && px[1] === 0 && px[2] === 0 && px[3] === 255 &&
      half.width === 150 && half.height === 75 &&
      normHex("ABC") === "#aabbcc" && normHex("#12345") === null && ratio(1920, 1080) === "16:9" && ratio(1200, 630) === "40:21" &&
      clampDim("9000") === 8000 && clampDim("0") === null && clampDim("abc") === null &&
      c.toDataURL("image/png").indexOf("data:image/png;base64,") === 0;
  };
})();
