/* GIFMP4 Format Workshop - per-tool page logic.
 * Dispatched from <body data-page="...">. All conversion via GifConverter core.
 */
(function () {
  'use strict';
  var T = function (k, v) { return window.GIFMP4I18N.t(k, v); };
  var C = window.GifConverter;
  var G = window.GIFMP4Stats;

  /* ---------- shared UI helpers ---------- */
  function $(sel) { return document.querySelector(sel); }
  function byId(id) { return document.getElementById(id); }
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }
  function showImgPreview(file) {
    var p = byId('sourcePreview');
    if (!p) return;
    if (file && (file.type.indexOf('image/') === 0 || /\.(gif|apng|webp|png|jpe?g|bmp)$/i.test(file.name))) {
      p.src = URL.createObjectURL(file);
      p.style.display = 'block';
      if (p.previousElementSibling && p.previousElementSibling.className.indexOf('preview-placeholder') === 0) {
        p.previousElementSibling.style.display = 'none';
      }
    }
  }
  function showVideoPreview(file, video) {
    if (!video) return;
    if (file) {
      video.src = URL.createObjectURL(file);
      video.style.display = 'block';
      if (video.previousElementSibling && video.previousElementSibling.className.indexOf('preview-placeholder') === 0) {
        video.previousElementSibling.style.display = 'none';
      }
    }
  }
  function setupDropZone(zone, input, onFiles) {
    zone.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { if (input.files && input.files.length) handleFiles(input.files); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('drag'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault(); zone.classList.remove('drag');
      if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });
    function handleFiles(list) {
      var arr = Array.prototype.slice.call(list || []);
      var total = 0, tooBig = null;
      for (var i = 0; i < arr.length; i++) {
        total += arr[i].size;
        if (arr[i].size > MAX_INPUT_BYTES && !tooBig) tooBig = arr[i];
      }
      lastInputBytes = total;
      if (tooBig) {
        hideError();
        showError('file_too_large', { size: fmtSize(tooBig.size), max: '200MB' });
        return;
      }
      onFiles(list);
    }
  }
  function defaultFname(file, ext) {
    var base = file.name.replace(/\.[^.]+$/, '') || 'converted';
    return base + (ext.charAt(0) === '.' ? ext : '.' + ext);
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
  }
  function showError(key, extra) {
    var card = byId('errorCard');
    if (!card) return;
    card.classList.add('on');
    card.style.display = 'block';
    var msg = byId('errorMsg');
    if (msg) msg.textContent = T('err_' + key, extra);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function hideError() { var c = byId('errorCard'); if (c) { c.classList.remove('on'); c.style.display = 'none'; } }
  function showProgress(stageKey, pct) {
    var w = byId('progressWrap'); if (w) { w.classList.add('on'); w.style.display = 'block'; }
    var st = byId('progressStage'); if (st) st.textContent = T('stage_' + stageKey);
    var pp = byId('progressPct'); if (pp) pp.textContent = Math.round(Math.min(100, Math.max(0, pct * 100))) + '%';
    var bar = byId('progressBar'); if (bar) bar.style.width = Math.min(100, Math.max(0, pct * 100)) + '%';
  }
  function hideProgress() {
    var w = byId('progressWrap'); if (w) { w.classList.remove('on'); w.style.display = 'none'; }
    var pp = byId('progressPct'); if (pp) pp.textContent = '0%';
    var bar = byId('progressBar'); if (bar) bar.style.width = '0%';
  }
  function showResult(blob, name) {
    hideProgress();
    var r = byId('resultWrap'); if (r) r.classList.add('on');
    var fn = byId('fileName'); if (fn) fn.textContent = name;
    var fs = byId('fileSize'); if (fs) fs.textContent = fmtSize(blob.size);
    var dl = byId('downloadBtn');
    if (dl) { dl.href = URL.createObjectURL(blob); dl.download = name; }
    var img = byId('previewImg');
    if (img && (blob.type.indexOf('image') === 0)) {
      img.src = URL.createObjectURL(blob);
      img.style.display = 'block';
    } else if (img) { img.style.display = 'none'; }
    r && r.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function setBusy(busy, label) {
    var btn = byId('convertBtn');
    if (btn) { btn.disabled = busy; btn.textContent = busy ? (label || T('converting')) : T('convert_btn'); }
    var cancel = byId('cancelBtn');
    if (cancel) cancel.style.display = busy ? 'inline-block' : 'none';
    if (busy) {
      converting = true;
      userCancelled = false;
      startWatchdog(lastInputBytes);
    } else {
      converting = false;
      clearWatchdog();
    }
  }
  function numVal(id, fallback) { var v = parseInt(byId(id).value, 10); return isFinite(v) && v > 0 ? v : fallback; }

  /* AbortController holder per page */
  var currentAbort = null;
  function abortCurrent() { if (currentAbort) { currentAbort.abort(); currentAbort = null; } }

  /* ---------- shared safety net: size limit, timeout watchdog, crash fallback ---------- */
  var MAX_INPUT_BYTES = 200 * 1024 * 1024;      // hard prompt above 200MB
  var lastInputBytes = 0;                        // size of the files currently loaded
  var converting = false;                        // true while a conversion is running
  var userCancelled = false;                     // set when the user presses Cancel
  var watchdogTimer = null;

  function conversionTimeoutMs(bytes) {
    var mb = Math.max(1, (bytes || 1) / 1048576);
    var t = Math.round(mb * 6000);               // ~6s per MB of input, generous
    return Math.max(120000, Math.min(900000, t)); // 2 min .. 15 min
  }
  function clearWatchdog() {
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
  }
  function startWatchdog(bytes) {
    clearWatchdog();
    watchdogTimer = setTimeout(function () {
      watchdogTimer = null;
      if (!converting) return;
      converting = false;
      abortCurrent();
      hideProgress();
      showError('timeout');
      setBusy(false);
    }, conversionTimeoutMs(bytes));
  }
  function crashGuard() {
    if (!converting) return;
    if (userCancelled) {
      // user pressed Cancel; just reset the UI (the running task may never settle)
      converting = false; clearWatchdog(); hideProgress(); setBusy(false);
      return;
    }
    var card = byId('errorCard');
    if (card && card.style.display === 'block') return; // keep the visible message
    converting = false;
    clearWatchdog();
    try { abortCurrent(); } catch (e) {}
    hideProgress();
    showError('crash');
    setBusy(false);
  }
  window.addEventListener('error', function (e) {
    if (e && e.message && /Script error/i.test(e.message)) return;   // cross-origin noise
    var f = e && e.filename ? String(e.filename) : '';
    if (f && f.indexOf(window.location.origin) !== 0) return;        // third-party script noise
    crashGuard();
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    if (!r) return;
    if (r.name === 'AbortError' || (r.message && r.message === 'Aborted')) return; // intentional
    // Only surface rejections that come from our own scripts or conversion errors.
    var stack = r.stack ? String(r.stack) : '';
    var msg = r.message ? String(r.message) : '';
    if (stack && stack.indexOf(window.location.origin) === -1 && !/NoFrames|BadVideo|BadImage|OutputTooLarge|NoRecorder/i.test(msg)) return;
    crashGuard();
  });
  function bindRetry() {
    var rb = byId('retryBtn'), cb = byId('convertBtn');
    if (rb && cb) rb.addEventListener('click', function () { cb.click(); });
  }

  /* ---------- progress mapping helper ---------- */
  function progressCb(stage) {
    return function (pct, key) { showProgress(key || stage, pct); };
  }

  /* ================= video-to-gif ================= */
  function initVideoToGif() {
    var input = byId('videoInput'), zone = byId('uploadZone');
    var video = byId('sourceVideo');
    var file = null;
    var framesCache = null;

    setupDropZone(zone, input, function (files) {
      file = files[0];
      hideError();
      showVideoPreview(file, video);
      video.onerror = function () {
        showError('badvideo');
        byId('fileNameHint') && (byId('fileNameHint').textContent = '');
      };
      video.addEventListener('loadedmetadata', function () {
        var w = byId('outWidth'); if (w) w.value = Math.min(480, video.videoWidth);
        var est = byId('estimate');
        if (est) est.textContent = T('estimate', { frames: estFrames(), w: w ? w.value : 480, h: 'auto' });
      });
      byId('fileNameHint') && (byId('fileNameHint').textContent = file.name + ' (' + fmtSize(file.size) + ')');
    });
    function estFrames() {
      var fps = numVal('fps', 10);
      if (!video.duration || !isFinite(video.duration)) return '?';
      return Math.min(numVal('maxFrames', 300), Math.floor(video.duration * fps));
    }
    ['fps', 'maxFrames', 'outWidth'].forEach(function (id) {
      var i = byId(id); if (i) i.addEventListener('input', function () {
        var est = byId('estimate');
        if (est) est.textContent = T('estimate', { frames: estFrames(), w: byId('outWidth').value, h: 'auto' });
      });
    });

    var convertBtn = byId('convertBtn');
    convertBtn.addEventListener('click', async function () {
      hideError();
      if (!file) { showError('badvideo'); return; }
      if (video.readyState < 1 || !isFinite(video.duration) || !video.duration) { showError('badvideo'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        var fps = numVal('fps', 10);
        var maxF = Math.min(numVal('maxFrames', 300), 600);
        var width = Math.min(numVal('outWidth', 480), 800);
        var lightweight = byId('lightMode') && byId('lightMode').checked;
        if (lightweight) { width = 320; fps = 5; }
        var dur = isFinite(video.duration) ? video.duration : 0;
        var startSec = numVal('startSec', 0);
        var endSec = numVal('endSec', 0);
        var span = (endSec > startSec ? endSec : dur) - startSec;
        if (span < 0.05) { showError('badvideo'); setBusy(false); return; }
        var count = Math.min(maxF, Math.floor(span * fps));
        if (count > 300) {
          var ok = await confirmWarn(count);
          if (!ok) { setBusy(false); return; }
          if (count > 400) { fps = Math.max(4, Math.floor(fps * 300 / count)); count = Math.min(300, Math.floor(span * fps)); }
        }
        showProgress('extracting', 0.02);
        var ex = await C.videoExtractFrames(video, {
          maxWidth: width, count: count, fps: fps,
          startSec: startSec, endSec: endSec > startSec ? endSec : 0,
          onProgress: progressCb('extracting'), signal: ac.signal
        });
        framesCache = ex.frames;
        showProgress('encoding', 0.5);
        var outFmt = byId('outFormat') ? byId('outFormat').value : 'gif';
        var res = outFmt === 'apng'
          ? await C.encodeApng(ex.frames, { signal: ac.signal })
          : await C.encodeGif(ex.frames, { onProgress: progressCb('encoding'), signal: ac.signal });
        var ext = outFmt === 'apng' ? '.apng' : '.gif';
        finishConversion(res.blob, defaultFname(file, ext), file.size);
      } catch (err) {
        handleErr(err);
      } finally {
        setBusy(false); currentAbort = null;
      }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  /* ================= gif-maker (images -> GIF) ================= */
  function initGifMaker() {
    var input = byId('imgInput'), zone = byId('uploadZone');
    var files = [];
    var th = byId('thumbs');
    setupDropZone(zone, input, function (list) {
      files = Array.prototype.slice.call(list);
      th.innerHTML = '';
      files.forEach(function (f, i) {
        var url = URL.createObjectURL(f);
        var img = document.createElement('img');
        img.src = url; img.className = 'preview thumb';
        img.title = f.name;
        th.appendChild(img);
      });
      byId('fileNameHint') && (byId('fileNameHint').textContent = T('hero_tools') + ': ' + files.length + ' files');
    });
    byId('convertBtn').addEventListener('click', async function () {
      hideError();
      if (!files.length) { showError('badimage'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        var width = Math.min(numVal('outWidth', 480), 800);
        var delay = numVal('frameDelay', 100);
        var lightweight = byId('lightMode') && byId('lightMode').checked;
        if (lightweight) { width = 320; }
        if (files.length > 100) {
          var ok = await confirmWarn(files.length);
          if (!ok) { setBusy(false); return; }
        }
        var frames = [];
        showProgress('reading', 0.02);
        for (var i = 0; i < files.length; i++) {
          C.checkAbort(ac.signal);
          var f = await C.imageFileToFrame(files[i], width);
          f.delayMs = delay;
          frames.push(f);
          showProgress('reading', (i + 1) / files.length);
          if (i % 2 === 1) await C.yieldToMain();
        }
        frames = C.normalizeFrames(frames);
        frames = C.normalizeFrames(frames);
        showProgress('encoding', 0.55);
        var fmt = byId('outFormat') ? byId('outFormat').value : 'gif';
        var res = fmt === 'apng'
          ? await C.encodeApng(frames, { signal: ac.signal })
          : await C.encodeGif(frames, { onProgress: progressCb('encoding'), signal: ac.signal });
        finishConversion(res.blob, defaultFname(files[0], fmt === 'apng' ? '.apng' : '.gif'), files.reduce(function (a, b) { return a + b.size; }, 0));
      } catch (err) { handleErr(err); }
      finally { setBusy(false); currentAbort = null; }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  /* ================= gif-editor ================= */
  function initGifEditor() {
    var input = byId('gifInput'), zone = byId('uploadZone');
    var file = null, dec = null;
    setupDropZone(zone, input, function (files) {
      file = files[0];
      showImgPreview(files[0]);
      byId('fileNameHint') && (byId('fileNameHint').textContent = file.name + ' (' + fmtSize(file.size) + ')');
    });
    byId('convertBtn').addEventListener('click', async function () {
      hideError();
      if (!file) { showError('noframes'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        showProgress('reading', 0.05);
        dec = await C.gifDecodeFrames(file, { onProgress: progressCb('reading'), signal: ac.signal });
        var frames = dec.frames;
        var width = Math.min(numVal('outWidth', 480), 800);
        var every = numVal('everyN', 1);
        var speedF = numVal('speedFactor', 1);
        var rot = byId('rotate') ? parseInt(byId('rotate').value, 10) : 0;
        var flipH = byId('flipH') && byId('flipH').checked;
        var flipV = byId('flipV') && byId('flipV').checked;
        var rev = byId('reverse') && byId('reverse').checked;
        var cropPct = numVal('cropPct', 100);
        var lightweight = byId('lightMode') && byId('lightMode').checked;
        if (lightweight) width = 320;
        if (every > 1) frames = C.framesThin(frames, every);
        if (speedF !== 1) frames = C.framesSpeed(frames, speedF);
        if (rot || flipH || flipV) frames = C.transformFrames(frames, { rotate: rot, flipH: flipH, flipV: flipV });
        if (rev && frames.length > 1) frames = frames.slice().reverse();
        if (cropPct > 0 && cropPct < 100) frames = C.cropFrames(frames, cropPct / 100);
        if (width !== frames[0].width) {
          showProgress('scaling', 0.35);
          await C.scaleFramesInPlace(frames, width, progressCb('scaling'), ac.signal);
        }
        if (!frames.length) { showError('noframes'); setBusy(false); return; }
        showProgress('encoding', 0.55);
        var res = await C.encodeGif(frames, { onProgress: progressCb('encoding'), signal: ac.signal });
        finishConversion(res.blob, defaultFname(file, '.gif'), file.size);
      } catch (err) { handleErr(err); }
      finally { setBusy(false); currentAbort = null; }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  /* ================= gif-optimizer ================= */
  function initGifOptimizer() {
    var input = byId('gifInput'), zone = byId('uploadZone');
    var file = null;
    setupDropZone(zone, input, function (files) {
      file = files[0];
      showImgPreview(files[0]);
      byId('fileNameHint') && (byId('fileNameHint').textContent = file.name + ' (' + fmtSize(file.size) + ')');
    });
    byId('convertBtn').addEventListener('click', async function () {
      hideError();
      if (!file) { showError('noframes'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        showProgress('reading', 0.05);
        var dec = await C.gifDecodeFrames(file, { onProgress: progressCb('reading'), signal: ac.signal });
        var frames = dec.frames;
        var width = Math.min(numVal('outWidth', 480), 800);
        var every = numVal('everyN', 1);
        var sampleFac = byId('quality') && byId('quality').value === 'low' ? 20 : (byId('quality').value === 'high' ? 5 : 10);
        if (width !== dec.width) {
          showProgress('scaling', 0.35);
          await C.scaleFramesInPlace(frames, width, progressCb('scaling'), ac.signal);
        }
        if (every > 1) frames = C.framesThin(frames, every);
        showProgress('encoding', 0.55);
        var res = await C.encodeGif(frames, { onProgress: progressCb('encoding'), sampleFac: sampleFac, signal: ac.signal });
        finishConversion(res.blob, defaultFname(file, '.gif'), file.size);
      } catch (err) { handleErr(err); }
      finally { setBusy(false); currentAbort = null; }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  /* ================= format converter ================= */
  function guessType(f) {
    var n = (f.name || '').toLowerCase();
    var t = (f.type || '');
    if (t.indexOf('video') === 0 || /\.(mp4|webm|mov|avi|mkv)$/.test(n)) return 'video';
    if (t === 'image/gif' || /\.gif$/.test(n)) return 'gif';
    if (t === 'image/png' || /\.png$/.test(n)) return 'png';
    if (t === 'image/jpeg' || /\.jpe?g$/.test(n)) return 'jpg';
    if (t === 'image/webp' || /\.webp$/.test(n)) return 'webp';
    if (t === 'image/apng' || /\.apng$/.test(n)) return 'apng';
    if (t.indexOf('image') === 0) return 'image';
    return 'image';
  }
  function defaultTarget(src) {
    switch (src) {
      case 'video': return 'gif';
      case 'gif': return 'mp4';
      case 'png': case 'jpg': case 'webp': return 'gif';
      default: return 'gif';
    }
  }
  function initFormatConverter() {
    var input = byId('convInput'), zone = byId('uploadZone');
    var file = null;
    setupDropZone(zone, input, function (files) {
      file = files[0];
      showImgPreview(files[0]);
      byId('fileNameHint') && (byId('fileNameHint').textContent = file.name + ' (' + fmtSize(file.size) + ')');
      var srcType = guessType(file);
      var sel = byId('toFormat');
      if (sel) {
        // pick sensible default target
        var def = defaultTarget(srcType);
        if (def) sel.value = def;
      }
    });
    byId('convertBtn').addEventListener('click', async function () {
      hideError();
      if (!file) { showError('unknown'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        var to = byId('toFormat').value;
        var src = guessType(file);
        var result = await runConversion(file, src, to, ac.signal);
        if (!result) { showError('unknown'); setBusy(false); return; }
        var ext = to === 'jpg' ? '.jpg' : '.' + to;
        finishConversion(result.blob, defaultFname(file, ext), file.size);
      } catch (err) { handleErr(err); }
      finally { setBusy(false); currentAbort = null; }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  async function runConversion(file, src, to, signal, onProgress) {
    var Tf = function (k, v) { return T(k, v); };
    function prog(stage) { return onProgress ? function (p) { onProgress(p, stage); } : null; }
    // image -> gif
    if ((src === 'png' || src === 'jpg' || src === 'webp' || src === 'image') && to === 'gif') {
      var f = await C.imageFileToFrame(file, 480);
      f.delayMs = 100;
      var res = await C.encodeGif([f], { signal: signal });
      return { blob: res.blob };
    }
    // image -> apng
    if ((src === 'png' || src === 'jpg' || src === 'webp' || src === 'image') && to === 'apng') {
      var fa = await C.imageFileToFrame(file, 480);
      fa.delayMs = 100;
      var blobA = await C.encodeApng([fa], { signal: signal });
      return { blob: blobA };
    }
    // image -> png/jpg/webp
    if ((src === 'png' || src === 'jpg' || src === 'webp' || src === 'image') && (to === 'png' || to === 'jpg' || to === 'webp')) {
      var img = await C.loadImage(file);
      var canvas = C.createCanvas(img.naturalWidth, img.naturalHeight);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var mime = to === 'jpg' ? 'image/jpeg' : to === 'webp' ? 'image/webp' : 'image/png';
      var b = await C.canvasToBlob(canvas, mime, 0.92);
      return { blob: b };
    }
    // gif -> apng
    if (src === 'gif' && to === 'apng') {
      var g1 = await C.gifDecodeFrames(file, { signal: signal, onProgress: prog('reading') });
      if (g1.frames.length === 0) { showError('noframes'); return null; }
      var b1 = await C.encodeApng(g1.frames, { signal: signal });
      return { blob: b1 };
    }
    // gif -> png/jpg/webp (first frame)
    if (src === 'gif' && (to === 'png' || to === 'jpg' || to === 'webp')) {
      var g2 = await C.gifDecodeFrames(file, { signal: signal, onProgress: prog('reading') });
      if (!g2.frames.length) { showError('noframes'); return null; }
      var c2 = C.createCanvas(g2.width, g2.height);
      var cx2 = c2.getContext('2d');
      var tmp2 = cx2.createImageData(g2.width, g2.height);
      tmp2.data.set(g2.frames[0].rgba);
      cx2.putImageData(tmp2, 0, 0);
      var m2 = to === 'jpg' ? 'image/jpeg' : to === 'webp' ? 'image/webp' : 'image/png';
      var b2 = await C.canvasToBlob(c2, m2, 0.92);
      return { blob: b2 };
    }
    // gif -> mp4/webm (animate on canvas, record)
    if (src === 'gif' && (to === 'mp4' || to === 'webm')) {
      var g3 = await C.gifDecodeFrames(file, { signal: signal, onProgress: prog('reading') });
      if (!g3.frames.length) { showError('noframes'); return null; }
      if (to === 'mp4' && !MediaRecorder.isTypeSupported('video/mp4')) {
        // fall back to webm with a note
        var r3 = await C.framesToVideo(g3.frames, { signal: signal, onProgress: prog('recording') });
        return { blob: r3.blob, note: 'webm' };
      }
      var r4 = await C.framesToVideo(g3.frames, { signal: signal, onProgress: prog('recording') });
      return { blob: r4.blob };
    }
    // video -> gif
    if (src === 'video' && to === 'gif') {
      var vid = document.createElement('video');
      vid.muted = true;
      var url = URL.createObjectURL(file);
      vid.src = url;
      await new Promise(function (res, rej) {
        vid.addEventListener('loadedmetadata', res, { once: true });
        vid.addEventListener('error', rej, { once: true });
        setTimeout(res, 5000);
      });
      var ex = await C.videoExtractFrames(vid, { maxWidth: 480, count: Math.min(300, Math.floor((isFinite(vid.duration) ? vid.duration : 5) * 10)), fps: 10, signal: signal, onProgress: prog('extracting') });
      var enc = await C.encodeGif(ex.frames, { signal: signal, onProgress: prog('encoding') });
      URL.revokeObjectURL(url);
      return { blob: enc.blob };
    }
    // video -> apng
    if (src === 'video' && to === 'apng') {
      var vid2 = document.createElement('video');
      vid2.muted = true;
      var url2 = URL.createObjectURL(file);
      vid2.src = url2;
      await new Promise(function (res, rej) {
        vid2.addEventListener('loadedmetadata', res, { once: true });
        vid2.addEventListener('error', rej, { once: true });
        setTimeout(res, 5000);
      });
      var ex2 = await C.videoExtractFrames(vid2, { maxWidth: 480, count: Math.min(300, Math.floor((isFinite(vid2.duration) ? vid2.duration : 5) * 10)), fps: 10, signal: signal, onProgress: prog('extracting') });
      var b2 = await C.encodeApng(ex2.frames, { signal: signal });
      URL.revokeObjectURL(url2);
      return { blob: b2 };
    }
    // video -> webm (re-record via canvas)
    if (src === 'video' && (to === 'webm' || to === 'mp4')) {
      var vid3 = document.createElement('video');
      vid3.muted = true;
      var url3 = URL.createObjectURL(file);
      vid3.src = url3;
      await new Promise(function (res, rej) {
        vid3.addEventListener('loadedmetadata', res, { once: true });
        vid3.addEventListener('error', rej, { once: true });
        setTimeout(res, 5000);
      });
      var ex3 = await C.videoExtractFrames(vid3, { maxWidth: 480, count: Math.min(300, Math.floor((isFinite(vid3.duration) ? vid3.duration : 5) * 10)), fps: 10, signal: signal, onProgress: prog('extracting') });
      var r3 = await C.framesToVideo(ex3.frames, { signal: signal, onProgress: prog('recording') });
      URL.revokeObjectURL(url3);
      return { blob: r3.blob };
    }
    // apng -> gif
    if (src === 'apng' && to === 'gif') {
      // decode APNG via canvas animation (simplified: first frame)
      var img4 = await C.loadImage(file);
      var c4 = C.createCanvas(img4.naturalWidth, img4.naturalHeight);
      var ctx4 = c4.getContext('2d');
      ctx4.drawImage(img4, 0, 0);
      var id4 = ctx4.getImageData(0, 0, c4.width, c4.height);
      var fr = { rgba: id4.data, width: c4.width, height: c4.height, delayMs: 100 };
      var e4 = await C.encodeGif([fr], { signal: signal });
      return { blob: e4.blob };
    }
    return null;
  }

  /* ================= image processor ================= */
  function initImageProcessor() {
    var input = byId('imgInput'), zone = byId('uploadZone');
    var file = null;
    setupDropZone(zone, input, function (files) {
      file = files[0];
      showImgPreview(files[0]);
      byId('fileNameHint') && (byId('fileNameHint').textContent = file.name + ' (' + fmtSize(file.size) + ')');
    });
    byId('convertBtn').addEventListener('click', async function () {
      hideError();
      if (!file) { showError('badimage'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        var width = Math.min(numVal('outWidth', 1024), 4096);
        var to = byId('toFormat').value;
        var cropPct = Math.min(99, Math.max(10, numVal('cropPct', 100))) / 100;
        var q = byId('imgQuality') ? byId('imgQuality').value : 'high';
        var quality = q === 'low' ? 0.7 : q === 'med' ? 0.85 : 0.95;
        var img = await C.loadImage(file);
        var canvas = C.createCanvas(img.naturalWidth, img.naturalHeight);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        if (cropPct < 0.99) {
          var sw = Math.max(2, Math.round(img.naturalWidth * cropPct));
          var sh = Math.max(2, Math.round(img.naturalHeight * cropPct));
          var sx = Math.round((img.naturalWidth - sw) / 2);
          var sy = Math.round((img.naturalHeight - sh) / 2);
          canvas.width = sw; canvas.height = sh;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        }
        if (canvas.width > width) {
          var scale = width / canvas.width;
          var tw = Math.max(2, Math.round(canvas.width * scale));
          var th = Math.max(2, Math.round(canvas.height * scale));
          var c2 = C.createCanvas(tw, th);
          var x2 = c2.getContext('2d');
          x2.drawImage(canvas, 0, 0, tw, th);
          canvas = c2; ctx = x2;
        }
        var mime = to === 'jpg' ? 'image/jpeg' : to === 'webp' ? 'image/webp' : to === 'gif' ? 'image/gif' : 'image/png';
        if (to === 'gif') {
          var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
          var fr = { rgba: id.data, width: canvas.width, height: canvas.height, delayMs: 100 };
          var resG = await C.encodeGif([fr], { signal: ac.signal });
          finishConversion(resG.blob, defaultFname(file, '.gif'), file.size);
          setBusy(false); currentAbort = null; return;
        }
        var blob = await C.canvasToBlob(canvas, mime, quality);
        finishConversion(blob, defaultFname(file, '.' + to), file.size);
      } catch (err) { handleErr(err); }
      finally { setBusy(false); currentAbort = null; }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  /* ================= add text ================= */
  function initAddText() {
    var input = byId('srcInput'), zone = byId('uploadZone');
    var file = null;
    var decodedGif = null;
    setupDropZone(zone, input, function (files) {
      file = files[0];
      showImgPreview(files[0]);
      byId('fileNameHint') && (byId('fileNameHint').textContent = file.name + ' (' + fmtSize(file.size) + ')');
    });
    function drawTextOnFrame(canvas, ctx, text, size, color, pos) {
      ctx.font = '700 ' + size + 'px "Arial", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var w = canvas.width, h = canvas.height;
      var x = w / 2, y = h / 2;
      if (pos === 'top') y = Math.max(size, size * 1.2);
      else if (pos === 'bottom') y = h - Math.max(size, size * 1.2);
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    }
    byId('convertBtn').addEventListener('click', async function () {
      hideError();
      if (!file) { showError('badimage'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        var text = byId('textContent').value || 'Text';
        var size = numVal('textSize', 48);
        var color = byId('textColor').value;
        var pos = byId('textPos').value;
        var to = byId('toFormat').value;
        var isGif = (file.type === 'image/gif') || /\.gif$/.test(file.name.toLowerCase());
        var frames;
        if (isGif && to !== 'png' && to !== 'jpg') {
          showProgress('reading', 0.05);
          var dec = await C.gifDecodeFrames(file, { onProgress: progressCb('reading'), signal: ac.signal });
          frames = dec.frames;
          showProgress('composing', 0.5);
          for (var i = 0; i < frames.length; i++) {
            C.checkAbort(ac.signal);
            var c = C.createCanvas(frames[i].width, frames[i].height);
            var x = c.getContext('2d');
            var tmp = x.createImageData(frames[i].width, frames[i].height);
            tmp.data.set(frames[i].rgba);
            x.putImageData(tmp, 0, 0);
            drawTextOnFrame(c, x, text, size, color, pos);
            frames[i].rgba = x.getImageData(0, 0, c.width, c.height).data;
            if (i % 3 === 2) await C.yieldToMain();
          }
          if (to === 'apng') {
            var ba = await C.encodeApng(frames, { signal: ac.signal });
            finishConversion(ba, defaultFname(file, '.apng'), file.size);
          } else {
            var bg = await C.encodeGif(frames, { onProgress: progressCb('encoding'), signal: ac.signal });
            finishConversion(bg.blob, defaultFname(file, '.gif'), file.size);
          }
        } else {
          // single image
          var img = await C.loadImage(file);
          var canvas = C.createCanvas(img.naturalWidth, img.naturalHeight);
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          drawTextOnFrame(canvas, ctx, text, size, color, pos);
          if (to === 'gif') {
            var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var fr = { rgba: id.data, width: canvas.width, height: canvas.height, delayMs: 100 };
            var rg = await C.encodeGif([fr], { signal: ac.signal });
            finishConversion(rg.blob, defaultFname(file, '.gif'), file.size);
          } else {
            var mime = to === 'png' ? 'image/png' : to === 'jpg' ? 'image/jpeg' : 'image/webp';
            var b = await C.canvasToBlob(canvas, mime, 0.92);
            finishConversion(b, defaultFname(file, '.' + to), file.size);
          }
        }
      } catch (err) { handleErr(err); }
      finally { setBusy(false); currentAbort = null; }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  /* ================= gif splitter (GIF -> frames ZIP) ================= */
  function initGifSplitter() {
    var input = byId('gifInput'), zone = byId('uploadZone');
    var file = null;
    setupDropZone(zone, input, function (files) {
      file = files[0];
      showImgPreview(files[0]);
      byId('fileNameHint') && (byId('fileNameHint').textContent = file.name + ' (' + fmtSize(file.size) + ')');
    });
    byId('convertBtn').addEventListener('click', async function () {
      hideError();
      if (!file) { showError('noframes'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        var every = numVal('everyN', 1);
        showProgress('reading', 0.05);
        var dec = await C.gifDecodeFrames(file, { onProgress: progressCb('reading'), signal: ac.signal });
        var frames = dec.frames;
        if (every > 1) frames = C.framesThin(frames, every);
        if (!frames.length) { showError('noframes'); setBusy(false); return; }
        var base = (file.name || 'gif').replace(/\.[a-z0-9]+$/i, '');
        var entries = [];
        showProgress('composing', 0.3);
        for (var i = 0; i < frames.length; i++) {
          C.checkAbort(ac.signal);
          var pngAB = window.UPNG.encode([frames[i].rgba], frames[i].width, frames[i].height, 256, [100]);
          var nm = (i < 9 ? '0' : '') + (i + 1);
          entries.push({ name: base + '-frame-' + nm + '.png', data: new Uint8Array(pngAB) });
          showProgress('composing', 0.3 + 0.6 * ((i + 1) / frames.length));
          if (i % 3 === 2) await C.yieldToMain();
        }
        showProgress('encoding', 0.95);
        var zip = C.makeZip(entries);
        finishConversion(zip, base + '-frames.zip', file.size);
      } catch (err) { handleErr(err); }
      finally { setBusy(false); currentAbort = null; }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  /* ================= bulk GIF optimizer ================= */
  function initBulkOptimizer() {
    var input = byId('bulkInput'), zone = byId('uploadZone');
    var files = [];
    setupDropZone(zone, input, function (fl) {
      files = [];
      for (var i = 0; i < fl.length; i++) {
        var f = fl[i];
        if (f && (f.type === 'image/gif' || /\.gif$/i.test(f.name || ''))) files.push(f);
      }
      var list = byId('bulkList');
      if (list) {
        var h = '';
        for (var k = 0; k < files.length; k++) {
          h += '<div class="bulk-item">' + (k + 1) + '. ' + files[k].name + ' (' + fmtSize(files[k].size) + ')</div>';
        }
        list.innerHTML = h || '<p class="muted" data-i18n="bulk_none"></p>';
      }
      byId('fileNameHint') && (byId('fileNameHint').textContent = files.length + ' x GIF');
    });
    byId('convertBtn').addEventListener('click', async function () {
      hideError();
      if (!files.length) { showError('noframes'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        var width = Math.min(numVal('bulkWidth', 480), 800);
        var thin = byId('thinBulk') && byId('thinBulk').checked;
        var q = byId('quality') ? byId('quality').value : 'med';
        var sampleFac = q === 'low' ? 20 : (q === 'high' ? 5 : 10);
        var n = files.length, entries = [];
        var w = byId('progressWrap'); if (w) w.classList.add('on');
        var bar = byId('progressBar'); if (bar) bar.style.width = '2%';
        var st = byId('progressStage');
        for (var i = 0; i < n; i++) {
          C.checkAbort(ac.signal);
          var f = files[i];
          if (st) st.textContent = T('bulk_i', { i: i + 1, n: n });
          var dec = await C.gifDecodeFrames(f, { signal: ac.signal });
          var frames = dec.frames;
          if (!frames || !frames.length) continue;
          if (thin && frames.length > 1) frames = C.framesDedup(frames);
          if (width && frames[0] && width !== frames[0].width) {
            await C.scaleFramesInPlace(frames, width, null, ac.signal);
          }
          var res = await C.encodeGif(frames, { sampleFac: sampleFac, signal: ac.signal });
          var outName = (f.name || 'gif').replace(/\.gif$/i, '') + '-opt.gif';
          entries.push({ name: outName, data: new Uint8Array(await res.blob.arrayBuffer()) });
          if (bar) bar.style.width = Math.round(((i + 1) / n) * 95) + '%';
          await C.yieldToMain();
        }
        if (!entries.length) { showError('noframes'); setBusy(false); return; }
        if (st) st.textContent = T('composing');
        if (bar) bar.style.width = '98%';
        var zip = C.makeZip(entries);
        finishConversion(zip, 'gif-bulk-optimized.zip', files[0].size);
      } catch (err) { handleErr(err); }
      finally { setBusy(false); currentAbort = null; }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  /* ================= video editor (cut / resize / speed -> MP4/WebM) ================= */
  function initVideoEditor() {
    var input = byId('videoInput'), zone = byId('uploadZone');
    var video = byId('sourceVideo');
    var file = null;
    setupDropZone(zone, input, function (files) {
      file = files[0];
      hideError();
      showVideoPreview(file, video);
      video.onerror = function () { showError('badvideo'); byId('fileNameHint') && (byId('fileNameHint').textContent = ''); };
      video.addEventListener('loadedmetadata', function () {
        var w = byId('outWidth'); if (w) w.value = Math.min(480, video.videoWidth);
        var end = byId('endSec');
        if (end && isFinite(video.duration) && !end.value) end.value = Math.round(video.duration);
      });
      byId('fileNameHint') && (byId('fileNameHint').textContent = file.name + ' (' + fmtSize(file.size) + ')');
    });
    byId('convertBtn').addEventListener('click', async function () {
      hideError();
      if (!file) { showError('badvideo'); return; }
      if (video.readyState < 1 || !isFinite(video.duration) || !video.duration) { showError('badvideo'); return; }
      abortCurrent();
      var ac = new AbortController(); currentAbort = ac;
      setBusy(true);
      try {
        var width = Math.min(numVal('outWidth', 480), 800);
        var startSec = numVal('startSec', 0);
        var endSec = numVal('endSec', 0);
        var span = (endSec > startSec ? endSec : video.duration) - startSec;
        if (span < 0.05) { showError('badvideo'); setBusy(false); return; }
        var speedF = byId('speedFactor') ? parseFloat(byId('speedFactor').value) : 1;
        var fps = 15;
        var count = Math.min(400, Math.floor(span * fps));
        showProgress('extracting', 0.02);
        var ex = await C.videoExtractFrames(video, {
          maxWidth: width, count: count, fps: fps,
          startSec: startSec, endSec: endSec > startSec ? endSec : 0,
          onProgress: progressCb('extracting'), signal: ac.signal
        });
        var frames = ex.frames;
        if (speedF !== 1) frames = C.framesSpeed(frames, speedF);
        showProgress('recording', 0.5);
        var res = await C.framesToVideo(frames, { onProgress: progressCb('recording'), signal: ac.signal });
        var ext = (res.blob.type || '').indexOf('mp4') >= 0 ? '.mp4' : '.webm';
        finishConversion(res.blob, defaultFname(file, ext), file.size);
      } catch (err) { handleErr(err); }
      finally { setBusy(false); currentAbort = null; }
    });
    byId('cancelBtn') && byId('cancelBtn').addEventListener('click', function () { userCancelled = true; abortCurrent(); hideProgress(); setBusy(false); });
  }

  /* ---------- shared finish/error ---------- */
  function finishConversion(blob, name, origBytes) {
    showResult(blob, name);
    G.track(origBytes);
  }
  function handleErr(err) {
    if (err && err.name === 'AbortError') { hideProgress(); setBusy(false); return; }
    var key = 'unknown';
    var msg = err && err.message ? String(err.message) : '';
    if (msg === 'NoFrames') key = 'noframes';
    else if (msg === 'BadVideo') key = 'badvideo';
    else if (msg === 'BadImage') key = 'badimage';
    else if (msg === 'OutputTooLarge') key = 'too_large';
    else if (msg === 'NoRecorder') key = 'norecorder';
    else if (err instanceof RangeError || /alloc|out of memory|too large/i.test(msg)) key = 'too_large';
    showError(key);
  }
  function confirmWarn(n) {
    var card = byId('warnCard');
    if (!card) return Promise.resolve(true);
    card.classList.add('on');
    card.style.display = 'block';
    var msg = byId('warnMsg');
    if (msg) msg.textContent = T('warning_frames', { n: n });
    return new Promise(function (resolve) {
      var yes = byId('warnYes'), no = byId('warnNo');
      yes.onclick = function () { card.classList.remove('on'); card.style.display = 'none'; resolve(true); };
      no.onclick = function () { card.classList.remove('on'); card.style.display = 'none'; resolve(false); };
    });
  }

  /* ---------- dispatch ---------- */
  window.GIFMP4Tools = {
    initAll: function () { },
    runConversion: runConversion,
    guessType: guessType,
    defaultTarget: defaultTarget,
    finish: finishConversion,
    ui: {
      fmtSize: fmtSize,
      showError: showError,
      hideError: hideError,
      showProgress: showProgress,
      hideProgress: hideProgress,
      showResult: showResult,
      setBusy: setBusy,
      setInputBytes: function (b) { lastInputBytes = b || 0; },
      handleErr: handleErr,
      confirmWarn: confirmWarn,
      downloadBlob: downloadBlob,
      defaultFname: defaultFname,
      progressCb: progressCb,
      maxInputBytes: MAX_INPUT_BYTES
    }
  };
  function dispatch() {
    bindRetry();
    var page = document.body.getAttribute('data-page');
    if (page === 'video-to-gif') initVideoToGif();
    else if (page === 'gif-maker') initGifMaker();
    else if (page === 'gif-editor') initGifEditor();
    else if (page === 'gif-optimizer') initGifOptimizer();
    else if (page === 'format-converter') initFormatConverter();
    else if (page === 'image-processor') initImageProcessor();
    else if (page === 'add-text') initAddText();
    else if (page === 'gif-splitter') initGifSplitter();
    else if (page === 'bulk-optimizer') initBulkOptimizer();
    else if (page === 'video-editor') initVideoEditor();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dispatch);
  else dispatch();
})();
