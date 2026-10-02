/* GIFMP4 Format Workshop - Homepage quick converter.
 * Opens an in-page conversion panel so visitors can convert without leaving
 * the homepage (no navigation, no upload). Reuses the GifConverter core and
 * the shared UI helpers exposed by tools-v7.js. The panel markup uses the
 * same element IDs as the tool pages, so the shared helpers work as-is.
 */
(function () {
  'use strict';
  var C = window.GifConverter;
  var UI = (window.GIFMP4Tools && window.GIFMP4Tools.ui) || {};
  var T = function (k, v) { return window.GIFMP4I18N.t(k, v); };
  var MAX_INPUT_BYTES = (UI.maxInputBytes) || (200 * 1024 * 1024);

  var overlay = document.getElementById('homeConvertOverlay');
  var file = null;
  var currentAbort = null;

  function byId(id) { return document.getElementById(id); }

  /* ---------- file type routing (same rules as format-converter) ---------- */
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
  // Strict media check for the quick panel: anything that is not clearly a
  // video/image file gets a friendly "unsupported" prompt right away.
  function isSupportedMedia(f) {
    var n = (f.name || '').toLowerCase();
    var t = (f.type || '');
    if (t.indexOf('video') === 0 || /\.(mp4|webm|mov|avi|mkv)$/.test(n)) return true;
    if (t.indexOf('image') === 0 || /\.(gif|png|jpe?g|webp|apng|bmp|svg)$/i.test(n)) return true;
    return false;
  }
  function defaultTarget(src) {
    switch (src) {
      case 'video': return 'gif';
      case 'gif': return 'mp4';
      case 'png': case 'jpg': case 'webp': return 'gif';
      default: return 'gif';
    }
  }

  /* ---------- open / close ---------- */
  function open(f) {
    if (!overlay || !f) return;
    file = f;
    resetPanel();
    if (UI.hideError) UI.hideError();
    if (UI.hideProgress) UI.hideProgress();
    var rw = byId('resultWrap');
    if (rw) rw.classList.remove('on');
    var img = byId('previewImg');
    if (img) { img.style.display = 'none'; img.removeAttribute('src'); }
    var sp = byId('sourcePreview');
    if (sp) { sp.style.display = 'none'; sp.removeAttribute('src'); }
    var ph = byId('hcPlaceholder');
    if (ph) ph.style.display = 'block';

    var fi = byId('hcFileInfo');
    if (fi) fi.textContent = f.name + ' (' + (UI.fmtSize ? UI.fmtSize(f.size) : f.size + ' B') + ')';

    // File too large: prompt immediately, never start a doomed conversion.
    if (f.size > MAX_INPUT_BYTES) {
      showOverlay();
      if (UI.showError) UI.showError('file_too_large', { size: UI.fmtSize ? UI.fmtSize(f.size) : f.size, max: '200MB' });
      return;
    }
    var src = guessType(f);
    if (!isSupportedMedia(f)) {
      showOverlay();
      if (UI.showError) UI.showError('unsupported');
      return;
    }
    // sensible default target format
    var sel = byId('toFormat');
    if (sel) sel.value = defaultTarget(src);
    // image preview (videos show the file chip only)
    if (sp && (f.type.indexOf('image/') === 0 || /\.(gif|apng|webp|png|jpe?g|bmp)$/i.test(f.name))) {
      try { sp.src = URL.createObjectURL(f); } catch (e) { sp.src = ''; }
      sp.style.display = 'block';
      if (ph) ph.style.display = 'none';
    }
    showOverlay();
  }

  function showOverlay() {
    // Inline section: just reveal it in the document flow, no modal overlay,
    // no body scroll lock (keeps layout stable across all browser engines).
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    // Smoothly scroll the panel into view so the user notices it opened.
    try {
      overlay.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      try { overlay.scrollIntoView(); } catch (e2) {}
    }
  }
  function close() {
    if (!overlay) return;
    abortCurrent();
    resetPanel();
    if (UI.hideError) UI.hideError();
    if (UI.hideProgress) UI.hideProgress();
    if (UI.setBusy) UI.setBusy(false);
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    file = null;
  }
  function isOpen() { return overlay && !overlay.hidden; }
  function resetPanel() {
    var hint = byId('hcHint');
    if (hint) hint.style.display = '';
  }
  function abortCurrent() { if (currentAbort) { currentAbort.abort(); currentAbort = null; } }

  /* ---------- convert ---------- */
  async function convert() {
    if (!file) { if (UI.showError) UI.showError('unknown'); return; }
    if (UI.hideError) UI.hideError();
    abortCurrent();
    var ac = new AbortController();
    currentAbort = ac;
    if (UI.setInputBytes) UI.setInputBytes(file.size);
    if (UI.setBusy) UI.setBusy(true);
    try {
      var src = guessType(file);
      var to = byId('toFormat').value;
      var result = await window.GIFMP4Tools.runConversion(file, src, to, ac.signal, function (pct, key) {
        if (UI.showProgress) UI.showProgress(key, pct);
      });
      if (!result) { if (UI.showError) UI.showError('unknown'); return; }
      var ext = to === 'jpg' ? '.jpg' : '.' + to;
      var name = ((file.name || 'converted').replace(/\.[^.]+$/, '') || 'converted') + ext;
      window.GIFMP4Tools.finish(result.blob, name, file.size);
    } catch (err) {
      if (UI.handleErr) UI.handleErr(err);
    } finally {
      if (UI.setBusy) UI.setBusy(false);
      currentAbort = null;
    }
  }

  /* ---------- wire up ---------- */
  function bind() {
    if (!overlay) return;
    var closeBtn = byId('hcClose');
    if (closeBtn) closeBtn.addEventListener('click', close);
    // No click-outside-to-close: this is an inline section, not a modal.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });
    var cb = byId('convertBtn');
    if (cb) cb.addEventListener('click', convert);
    var cancel = byId('cancelBtn');
    if (cancel) cancel.addEventListener('click', function () {
      abortCurrent();
      if (UI.hideProgress) UI.hideProgress();
      if (UI.setBusy) UI.setBusy(false);
    });
    var pick = byId('hcPickBtn');
    var input = byId('hcFileInput');
    if (pick && input) pick.addEventListener('click', function () { input.click(); });
    if (input) input.addEventListener('change', function () { if (input.files && input.files[0]) open(input.files[0]); });
    var retry = byId('retryBtn');
    if (retry && cb) retry.addEventListener('click', function () { cb.click(); });
  }

  window.GIFMP4Home = {
    open: open,
    close: close,
    init: bind
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
