/* GIFMP4 Format Workshop - Conversion Core (100% browser-side)
 * Encoder: omggif GifWriter + NeuQuant neural-net quantization
 * Decoder: omggif GifReader | APNG: UPNG | Video recording: canvas.captureStream + MediaRecorder
 * All processing happens locally in the visitor's browser. No uploads.
 */
(function () {
  'use strict';

  // Library globals are loaded via <script> tags in every page.
  var libs = { omggif: window.omggif, NeuQuant: window.NeuQuant, UPNG: window.UPNG };

  function checkAbort(signal) {
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
  }
  function yieldToMain() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  /* ---------- palette helper ---------- */
  // omggif expects palette as array of 0xRRGGBB integers (power-of-2 length).
  // NeuQuant returns a 256*3 rgb-triplet Uint8Array.
  function neuquantPalette(rgbMap) {
    var pal = new Array(256);
    for (var i = 0; i < 256; i++) {
      pal[i] = (rgbMap[i * 3] << 16) | (rgbMap[i * 3 + 1] << 8) | rgbMap[i * 3 + 2];
    }
    return pal;
  }

  /* ---------- frame helpers ---------- */
  function createCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function drawImageScaled(source, canvas, maxWidth) {
    var w = source.videoWidth || source.naturalWidth || source.width;
    var h = source.videoHeight || source.naturalHeight || source.height;
    if (!w || !h) return null;
    var scale = Math.min(1, maxWidth / w);
    var tw = Math.max(2, Math.round(w * scale / 2) * 2);
    var th = Math.max(2, Math.round(h * scale / 2) * 2);
    canvas.width = tw; canvas.height = th;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, tw, th);
    return ctx.getImageData(0, 0, tw, th);
  }

  function frameRGBAFromImageData(id) {
    return { rgba: id.data, width: id.width, height: id.height };
  }

  /* ---------- GIF encoding (streaming, per-frame palette) ---------- */
  // frames: [{rgba:Uint8Array(RGBA), width, height, delayMs}]
  async function encodeGif(frames, opts) {
    opts = opts || {};
    var sampleFac = opts.sampleFac || 10;
    var onProgress = opts.onProgress || null;
    var signal = opts.signal || null;
    var count = frames.length;
    if (count === 0) throw new Error('NoFrames');
    var w = frames[0].width, h = frames[0].height;

    // Preallocate 96MB output buffer; covers virtually all normal conversions.
    var cap = opts.bufferCap || (96 * 1024 * 1024);
    var buf = new Uint8Array(cap);
    var gif = new libs.omggif.GifWriter(buf, w, h, { loop: 0 });
    var GifWriterNS = libs.omggif.GifWriter;

    for (var i = 0; i < count; i++) {
      checkAbort(signal);
      var f = frames[i];
      if (!f || !f.rgba) continue;
      var nq = new libs.NeuQuant(f.rgba, sampleFac);
      nq.buildColormap();
      var pal = neuquantPalette(nq.getColormap());
      var px = f.width * f.height;
      var indices = new Uint8Array(px);
      for (var j = 0; j < px; j++) {
        indices[j] = nq.lookupRGB(f.rgba[j * 4], f.rgba[j * 4 + 1], f.rgba[j * 4 + 2]);
      }
      var delay = Math.max(1, Math.round((f.delayMs || 100) / 10));
      gif.addFrame(0, 0, f.width, f.height, indices, { palette: pal, delay: delay });
      f.rgba = null; // free memory as we go
      if (onProgress) onProgress((i + 1) / count, 'encoding');
      if (i % 3 === 2) await yieldToMain();
    }
    gif.end();
    var used = gif.end();
    if (used > cap) {
      // Overflow is essentially impossible at these sizes, but fail loudly.
      throw new Error('OutputTooLarge');
    }
    var blob = new Blob([buf.slice(0, used)], { type: 'image/gif' });
    return { blob: blob, width: w, height: h, frames: count };
  }

  /* ---------- GIF decoding (streaming read of frames) ---------- */
  async function gifDecodeFrames(fileOrArrayBuffer, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || null;
    var signal = opts.signal || null;
    var buf;
    if (fileOrArrayBuffer instanceof ArrayBuffer || ArrayBuffer.isView(fileOrArrayBuffer)) {
      buf = new Uint8Array(fileOrArrayBuffer);
    } else {
      buf = new Uint8Array(await fileOrArrayBuffer.arrayBuffer());
    }
    var reader = new libs.omggif.GifReader(buf);
    var count = reader.numFrames();
    var w = reader.width, h = reader.height;
    var rgba = new Uint8Array(w * h * 4);
    var frames = [];
    for (var i = 0; i < count; i++) {
      checkAbort(signal);
      var info = reader.frameInfo(i);
      reader.decodeAndBlitFrameRGBA(i, rgba);
      frames.push({ rgba: rgba.slice(), width: w, height: h, delayMs: Math.max(20, info.delay * 10) });
      if (onProgress) onProgress((i + 1) / count, 'reading');
      if (i % 4 === 3) await yieldToMain();
    }
    return { frames: frames, width: w, height: h, count: count };
  }

  /* ---------- frame transforms ---------- */
  function framesScale(frames, maxWidth) {
    var out = [];
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      var c = createCanvas(f.width, f.height);
      var ctx = c.getContext('2d', { willReadFrequently: true });
      var tmp = ctx.createImageData(f.width, f.height);
      tmp.data.set(f.rgba);
      ctx.putImageData(tmp, 0, 0);
      var id = drawImageScaled(c, createCanvas(8, 8), maxWidth);
      out.push({ rgba: id.data, width: id.width, height: id.height, delayMs: f.delayMs });
    }
    return out;
  }

  function framesThin(frames, every) {
    var out = [];
    for (var i = 0; i < frames.length; i += every) out.push(frames[i]);
    return out;
  }

  function framesSpeed(frames, factor) {
    var out = frames.slice();
    for (var i = 0; i < out.length; i++) out[i] = Object.assign({}, out[i], { delayMs: Math.max(20, out[i].delayMs * factor) });
    return out;
  }

  async function scaleFramesInPlace(frames, maxWidth, onProgress, signal) {
    for (var i = 0; i < frames.length; i++) {
      checkAbort(signal);
      var f = frames[i];
      if (f.width <= maxWidth && f.height <= maxWidth * 1.2) continue;
      var c = createCanvas(f.width, f.height);
      var ctx = c.getContext('2d', { willReadFrequently: true });
      var tmp = ctx.createImageData(f.width, f.height);
      tmp.data.set(f.rgba);
      ctx.putImageData(tmp, 0, 0);
      var id = drawImageScaled(c, createCanvas(2, 2), maxWidth);
      frames[i] = { rgba: id.data, width: id.width, height: id.height, delayMs: f.delayMs };
      if (onProgress) onProgress((i + 1) / frames.length, 'scaling');
      if (i % 3 === 2) await yieldToMain();
    }
  }

  /* ---------- video frame extraction (play + capture, fast) ---------- */
  function waitVideoTime(video, target, timeoutMs) {
    return new Promise(function (resolve) {
      var start = performance.now();
      var tries = 0;
      function tick() {
        tries++;
        if (video.currentTime >= target - 0.03 || video.ended || tries > 400) return resolve(video.currentTime);
        if (performance.now() - start > timeoutMs) return resolve(video.currentTime);
        requestAnimationFrame(tick);
      }
      tick();
    });
  }

  function seekVideo(video, t, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() { if (!done) { done = true; video.removeEventListener('seeked', onSeek); resolve(); } }
      function onSeek() { finish(); }
      video.addEventListener('seeked', onSeek);
      try { video.currentTime = t; } catch (e) { finish(); }
      setTimeout(finish, timeoutMs || 600);
    });
  }

  // Extract up to `count` frames from a <video> element that has metadata loaded.
  async function videoExtractFrames(video, opts) {
    opts = opts || {};
    var maxWidth = opts.maxWidth || 480;
    var count = opts.count || 100;
    var onProgress = opts.onProgress || null;
    var signal = opts.signal || null;
    var fps = opts.fps || 10;
    var dur = isFinite(video.duration) ? video.duration : 0;
    if (!dur || dur <= 0) throw new Error('BadVideo');
    var frames = [];
    var interval = dur / count;
    video.muted = true;
    video.loop = false;
    try {
      video.currentTime = 0.05;
      await seekVideo(video, 0.05, 800);
    } catch (e) { /* ignore */ }
    var playing = false;
    try { await video.play(); playing = true; } catch (e) { playing = false; }

    for (var i = 0; i < count; i++) {
      checkAbort(signal);
      var target = Math.min(dur - 0.01, interval * (i + 0.5));
      if (playing) {
        await waitVideoTime(video, target, 2000);
      } else {
        await seekVideo(video, target, 500);
      }
      var id = drawImageScaled(video, createCanvas(2, 2), maxWidth);
      if (id) frames.push({ rgba: id.data, width: id.width, height: id.height, delayMs: Math.max(20, Math.round(1000 / fps)) });
      if (onProgress) onProgress((i + 1) / count, 'extracting');
      if (i % 4 === 3) await yieldToMain();
    }
    try { video.pause(); } catch (e) {}
    if (frames.length === 0) throw new Error('NoFrames');
    return { frames: frames, width: frames[0].width, height: frames[0].height, count: frames.length };
  }

  /* ---------- image loading ---------- */
  async function loadImage(file) {
    var url = URL.createObjectURL(file);
    try {
      return await new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('BadImage')); };
        img.src = url;
      });
    } finally {
      // URL kept alive by caller if needed; we revoke after draw elsewhere.
    }
  }

  async function imageFileToFrame(file, maxWidth) {
    var img = await loadImage(file);
    var c = createCanvas(img.naturalWidth, img.naturalHeight);
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    var id = drawImageScaled(c, createCanvas(2, 2), maxWidth);
    return { rgba: id.data, width: id.width, height: id.height, delayMs: 100 };
  }

  /* ---------- UPNG (APNG) ---------- */
  async function encodeApng(frames, opts) {
    opts = opts || {};
    var signal = opts.signal || null;
    var imgs = [];
    var dels = [];
    for (var i = 0; i < frames.length; i++) {
      checkAbort(signal);
      imgs.push(frames[i].rgba);
      dels.push(frames[i].delayMs || 100);
    }
    var png = libs.UPNG.encode(imgs, frames[0].width, frames[0].height, 256, dels);
    return new Blob([png], { type: 'image/png' });
  }

  /* ---------- canvas -> video (WebM; MP4 on Safari) ---------- */
  function pickVideoMime() {
    var candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    if (typeof MediaRecorder === 'undefined') return null;
    for (var i = 0; i < candidates.length; i++) {
      try { if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i]; } catch (e) {}
    }
    return null;
  }

  // Animate frames on a canvas at their real delays while MediaRecorder records.
  async function framesToVideo(frames, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || null;
    var signal = opts.signal || null;
    var mime = pickVideoMime();
    if (!mime) throw new Error('NoRecorder');
    var w = frames[0].width, h = frames[0].height;
    var canvas = createCanvas(w, h);
    var ctx = canvas.getContext('2d');
    var stream = canvas.captureStream(30);
    var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6 * 1024 * 1024 });
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var stopped = new Promise(function (res) { rec.onstop = function () { res(); }; });

    var totalDelay = 0;
    for (var i = 0; i < frames.length; i++) totalDelay += frames[i].delayMs;

    rec.start(250);
    var t0 = performance.now();
    var idx = 0;
    var elapsed = 0;
    var frameIndex = 0;
    var render = frames[0];
    // Draw frame 0 immediately
    putFrame(render);

    function putFrame(f) {
      var tmp = ctx.createImageData(f.width, f.height);
      tmp.data.set(f.rgba);
      ctx.putImageData(tmp, 0, 0);
    }

    await new Promise(function (resolve) {
      function tick() {
        checkAbort(signal);
        var now = performance.now() - t0;
        elapsed = now;
        // advance frames according to cumulative delay
        var acc = 0;
        while (frameIndex < frames.length - 1 && acc + frames[frameIndex].delayMs <= elapsed) {
          acc += frames[frameIndex].delayMs;
          frameIndex++;
        }
        putFrame(frames[frameIndex]);
        if (onProgress) onProgress(Math.min(1, elapsed / totalDelay), 'recording');
        if (elapsed >= totalDelay + 150) return resolve();
        requestAnimationFrame(tick);
      }
      tick();
    });
    await new Promise(function (r) { setTimeout(r, 120); });
    rec.stop();
    stream.getTracks().forEach(function (t) { t.stop(); });
    await stopped;
    var type = rec.mimeType || mime;
    var blob = new Blob(chunks, { type: type });
    return { blob: blob, width: w, height: h };
  }

  /* ---------- single image export ---------- */
  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('EncodeFail')); }, mime, quality);
    });
  }

  /* ---------- public API ---------- */
  window.GifConverter = {
    checkAbort: checkAbort,
    yieldToMain: yieldToMain,
    encodeGif: encodeGif,
    gifDecodeFrames: gifDecodeFrames,
    videoExtractFrames: videoExtractFrames,
    imageFileToFrame: imageFileToFrame,
    encodeApng: encodeApng,
    framesToVideo: framesToVideo,
    framesScale: framesScale,
    framesThin: framesThin,
    framesSpeed: framesSpeed,
    scaleFramesInPlace: scaleFramesInPlace,
    drawImageScaled: drawImageScaled,
    createCanvas: createCanvas,
    canvasToBlob: canvasToBlob,
    pickVideoMime: pickVideoMime,
    loadImage: loadImage
  };
})();
