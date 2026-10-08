/* GIFMP4 Format Workshop - Site shell: nav/footer injection, ads (max 2 random),
 * local conversion stats, language selector, dynamic SEO.
 */
(function () {
  'use strict';
  var SITE_URL = 'https://www.laserportal.cn/';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* ---------- header ---------- */
  function buildHeader() {
    var lang = window.GIFMP4I18N.current();
    var sel = '<select id="langSelector" aria-label="Language">' +
      '<option value="en">English</option>' +
      '<option value="zh-CN">简体中文</option>' +
      '<option value="zh-TW">繁體中文</option>' +
      '<option value="ja">日本語</option>' +
      '<option value="ko">한국어</option>' +
      '<option value="es">Español</option>' +
      '<option value="fr">Français</option>' +
      '<option value="de">Deutsch</option>' +
      '<option value="pt">Português</option></select>';
    var nav = el('nav', 'site-nav', null);
    var logo = el('a', 'nav-logo', null);
    logo.href = '/';
    logo.setAttribute('data-i18n', 'site_name');
    logo.textContent = window.GIFMP4I18N.t('site_name');
    nav.appendChild(logo);
    var logoSub = el('div', 'nav-logo-sub', window.GIFMP4I18N.t('logo_sub'));
    logoSub.setAttribute('data-i18n', 'logo_sub');
    nav.appendChild(logoSub);
    var links = [['/', 'nav_home'], ['/video-to-gif.html', 'nav_video2gif'], ['/gif-maker.html', 'nav_gifmaker'],
      ['/gif-editor.html', 'nav_gifedit'], ['/gif-optimizer.html', 'nav_gifopt'],
      ['/format-converter.html', 'nav_convert'], ['/image-processor.html', 'nav_image'], ['/add-text.html', 'nav_text']];
    var ul = el('ul', 'nav-links');
    for (var i = 0; i < links.length; i++) {
      var li = el('li', null, null);
      var a = el('a', null, null);
      a.href = links[i][0];
      a.textContent = window.GIFMP4I18N.t(links[i][1]);
      a.setAttribute('data-i18n', links[i][1]);
      li.appendChild(a);
      ul.appendChild(li);
    }
    nav.appendChild(ul);
    var selWrap = el('div', 'lang-wrap', sel);
    nav.appendChild(selWrap);
    document.body.insertBefore(nav, document.body.firstChild);
    var ls = document.getElementById('langSelector');
    ls.value = lang;
    ls.addEventListener('change', function () { window.GIFMP4I18N.setLang(ls.value); });
  }

  /* ---------- footer ---------- */
  function showEmailPop() {
    var T = function (k) { return window.GIFMP4I18N.t(k); };
    var ov = el('div', 'email-overlay', null);
    ov.id = 'emailOverlay';
    var pop = el('div', 'email-pop', null);
    pop.appendChild(el('h3', null, T('email_title')));
    pop.appendChild(el('p', null, T('email_body')));
    var addr = el('a', 'email-addr', '39918849@QQ.COM');
    addr.href = 'mailto:39918849@QQ.COM';
    pop.appendChild(addr);
    var act = el('div', 'email-actions', null);
    var cp = el('button', 'btn', T('email_copy'));
    cp.type = 'button';
    cp.onclick = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = '39918849@QQ.COM';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        cp.textContent = T('email_copied');
        setTimeout(function () { cp.textContent = T('email_copy'); }, 1600);
      } catch (e) {}
    };
    var cl = el('button', 'btn ghost', T('email_close'));
    cl.type = 'button';
    cl.onclick = hideEmailPop;
    act.appendChild(cp); act.appendChild(cl);
    pop.appendChild(act);
    ov.appendChild(pop);
    ov.onclick = function (e) { if (e.target === ov) hideEmailPop(); };
    document.body.appendChild(ov);
  }
  function hideEmailPop() { var o = document.getElementById('emailOverlay'); if (o) o.parentNode.removeChild(o); }
  function buildFooter() {
    var f = el('footer', 'site-footer', null);
    var inner = el('div', 'footer-inner', null);
    inner.appendChild(el('div', 'footer-brand', window.GIFMP4I18N.t('site_name')));
    var links = el('div', 'footer-links', null);
    var l1 = el('a', null, null); l1.href = '/privacy.html'; l1.textContent = window.GIFMP4I18N.t('privacy'); l1.setAttribute('data-i18n', 'privacy');
    var lt = el('a', null, null); lt.href = '/terms.html'; lt.textContent = window.GIFMP4I18N.t('terms'); lt.setAttribute('data-i18n', 'terms');
    var l2 = el('a', null, null); l2.href = '/about.html'; l2.textContent = window.GIFMP4I18N.t('about'); l2.setAttribute('data-i18n', 'about');
    var l3 = el('a', null, null); l3.href = '/contact.html'; l3.textContent = window.GIFMP4I18N.t('contact'); l3.setAttribute('data-i18n', 'contact');
    var l4 = el('a', null, null); l4.href = 'javascript:void(0)'; l4.textContent = window.GIFMP4I18N.t('contact_email_link'); l4.setAttribute('data-i18n', 'contact_email_link');
    l4.addEventListener('click', showEmailPop);
    links.appendChild(l1); links.appendChild(lt); links.appendChild(l2); links.appendChild(l3); links.appendChild(l4);
    inner.appendChild(links);
    var stats = el('div', 'footer-stats', null);
    var st = el('div', 'stats-title', window.GIFMP4I18N.t('footer_stats'));
    st.setAttribute('data-i18n', 'footer_stats');
    stats.appendChild(st);
    var grid = el('div', 'stats-grid', null);
    grid.id = 'statsGrid';
    stats.appendChild(grid);
    var localNote = el('div', 'stats-local', window.GIFMP4I18N.t('stat_local'));
    localNote.setAttribute('data-i18n', 'stat_local');
    stats.appendChild(localNote);
    inner.appendChild(stats);
    var rights = el('div', 'footer-rights', window.GIFMP4I18N.t('rights'));
    rights.setAttribute('data-i18n', 'rights');
    inner.appendChild(rights);
    var rightsLine = el('div', 'footer-rights-line', window.GIFMP4I18N.t('rights_line'));
    rightsLine.setAttribute('data-i18n', 'rights_line');
    inner.appendChild(rightsLine);
    var maxFile = el('div', 'footer-maxfile', window.GIFMP4I18N.t('max_file'));
    maxFile.setAttribute('data-i18n', 'max_file');
    inner.appendChild(maxFile);
    f.appendChild(inner);
    document.body.appendChild(f);
    renderStats();
  }

  /* ---------- community-wide conversion stats (remote counter, refreshed daily) ----------
   * Numbers are site-wide totals shared by all visitors, not per-device.
   * We read the remote counter once per day (cached in localStorage) and
   * increment it fire-and-forget on each successful conversion. If the
   * remote endpoint is unreachable we fall back to the bundled stats.json
   * baseline plus the current session's local increments, so the footer
   * never breaks and never pretends to be a per-device counter.
   */
  var REMOTE_API = 'https://api.counterapi.dev/v1/laserportal-gifmp4';
  var CACHE_KEY = 'gifmp4_remote_stats_v1';
  var CACHE_TTL = 24 * 60 * 60 * 1000; // refresh once per day
  var BASELINE_URL = 'stats.json';

  // In-memory session state. `remote` = last known site-wide total from the
  // counter / baseline; `localExtra` = increments made on this device since
  // page load (so the number feels responsive right after a conversion).
  var remoteStats = { conv: 0, files: 0, mb: 0 };
  var localExtra = { conv: 0, files: 0, mb: 0 };
  var remoteLoaded = false;

  function fmtMb(mb) {
    if (!isFinite(mb) || mb < 0) mb = 0;
    return mb >= 100 ? Math.round(mb) + ' MB' : mb.toFixed(1) + ' MB';
  }

  function cachedStats() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (c && typeof c.t === 'number' && (Date.now() - c.t) < CACHE_TTL && c.s) return c.s;
    } catch (e) {}
    return null;
  }
  function saveCache(s) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), s: s })); } catch (e) {}
  }

  function fetchJson(url, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, ms || 4000);
      fetch(url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).then(function (j) {
        if (done) return; done = true; clearTimeout(timer); resolve(j);
      }).catch(function (err) {
        if (done) return; done = true; clearTimeout(timer); reject(err);
      });
    });
  }

  function loadBaseline() {
    // 1) Render instantly from today's cache (if any).
    var cached = cachedStats();
    if (cached) { remoteStats = cached; remoteLoaded = true; renderStats(); }

    // 2) Try the bundled stats.json baseline (always works offline / on the
    //    same origin). Used as the seed if the remote counter is empty.
    fetchJson(BASELINE_URL, 2500).then(function (j) {
      if (!j) return;
      var base = {
        conv: parseInt(j.conv, 10) || 0,
        files: parseInt(j.files, 10) || 0,
        mb: parseFloat(j.mb) || 0
      };
      if (!remoteLoaded) { remoteStats = base; renderStats(); }
      else {
        // Remote counter counts everything; only adopt the baseline if the
        // remote total is still zero / not yet seeded.
        if (remoteStats.conv === 0 && base.conv > 0) { remoteStats = base; renderStats(); saveCache(remoteStats); }
      }
    }).catch(function () {});

    // 3) Try the live remote counter. Take the max() against the bundled
    //    baseline so a freshly-created remote counter (starting from 0) never
    //    regresses the number below the seeded stats.json value.
    Promise.all([
      fetchJson(REMOTE_API + '/total-conversions/', 3500).catch(function () { return null; }),
      fetchJson(REMOTE_API + '/total-files/', 3500).catch(function () { return null; }),
      fetchJson(REMOTE_API + '/total-mb-tenths/', 3500).catch(function () { return null; })
    ]).then(function (res) {
      var conv = res[0] && typeof res[0].count === 'number' ? res[0].count : null;
      var files = res[1] && typeof res[1].count === 'number' ? res[1].count : null;
      var mbTenths = res[2] && typeof res[2].count === 'number' ? res[2].count : null;
      if (conv === null && files === null && mbTenths === null) return;
      // Re-read baseline to combine.
      var base = { conv: 0, files: 0, mb: 0 };
      try {
        var raw = localStorage.getItem(CACHE_KEY);
        // baseline was already loaded above; reuse remoteStats as it stands.
      } catch (e) {}
      remoteStats = {
        conv: Math.max(remoteStats.conv, conv || 0),
        files: Math.max(remoteStats.files, files || 0),
        mb: Math.max(remoteStats.mb, (mbTenths || 0) / 10)
      };
      remoteLoaded = true;
      saveCache(remoteStats);
      renderStats();
    }).catch(function () {});
  }

  function bumpRemote(convDelta, filesDelta, mbTenthsDelta) {
    // Fire-and-forget. Never blocks UI, never throws.
    try {
      if (convDelta > 0) fetch(REMOTE_API + '/total-conversions/up/', { method: 'GET', mode: 'no-cors' }).catch(function () {});
      if (filesDelta > 0) fetch(REMOTE_API + '/total-files/up/', { method: 'GET', mode: 'no-cors' }).catch(function () {});
      if (mbTenthsDelta > 0) {
        fetch(REMOTE_API + '/total-mb-tenths/up/' + mbTenthsDelta + '/', { method: 'GET', mode: 'no-cors' }).catch(function () {});
      }
    } catch (e) {}
  }

  function renderStats() {
    var grid = document.getElementById('statsGrid');
    if (!grid) return;
    var conv = remoteStats.conv + localExtra.conv;
    var files = remoteStats.files + localExtra.files;
    var mb = remoteStats.mb + localExtra.mb;
    grid.innerHTML = '';
    var items = [
      [window.GIFMP4I18N.t('stat_total'), String(conv)],
      [window.GIFMP4I18N.t('stat_files'), String(files)],
      [window.GIFMP4I18N.t('stat_mb'), fmtMb(mb)]
    ];
    for (var i = 0; i < items.length; i++) {
      var d = el('div', 'stat-item', null);
      var v = el('div', 'stat-value', items[i][1]);
      var k = el('div', 'stat-key', items[i][0]);
      k.setAttribute('data-i18n', i === 0 ? 'stat_total' : i === 1 ? 'stat_files' : 'stat_mb');
      d.appendChild(v); d.appendChild(k);
      grid.appendChild(d);
    }
  }
  function trackConversion(fileBytes) {
    // Counted globally: immediately bump the on-screen number for this
    // visitor, and asynchronously increment the shared remote counter.
    localExtra.conv += 1;
    localExtra.files += 1;
    var mbTenths = 0;
    if (typeof fileBytes === 'number' && fileBytes > 0) {
      var mb = fileBytes / 1048576;
      localExtra.mb += mb;
      mbTenths = Math.max(1, Math.round(mb * 10));
    }
    renderStats();
    bumpRemote(1, 1, mbTenths);
  }
  window.GIFMP4Stats = { track: trackConversion, render: renderStats };

  /* ---------- ads: 1-2 slots per page, stable per session ---------- */
  var AD_CLIENT = 'ca-pub-3866829862674413';
  function adPlan() {
    try {
      var k = 'gifmp4_adplan_' + window.location.pathname;
      var v = sessionStorage.getItem(k);
      if (v) return JSON.parse(v);
      var plan = Math.random() < 0.5 ? [0] : [0, 1];  // 50%: one ad, 50%: two ads
      sessionStorage.setItem(k, JSON.stringify(plan));
      return plan;
    } catch (e) { return [0]; }
  }
  function injectAds() {
    var plan = adPlan();
    var slots = document.querySelectorAll('.ad-slot');
    if (slots.length === 0) return;
    var used = [];
    for (var i = 0; i < plan.length && i < slots.length; i++) used.push(plan[i]);
    for (var j = 0; j < slots.length; j++) {
      if (used.indexOf(j) === -1) { slots[j].style.display = 'none'; continue; }
      var ins = el('ins', 'adsbygoogle', null);
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', AD_CLIENT);
      ins.setAttribute('data-ad-slot', '0000000000');
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      slots[j].appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    }
  }

  /* ---------- dynamic SEO (per-page via body data-seo) ---------- */
  function applySeo() {
    var key = document.body.getAttribute('data-seo');
    if (!key) return;
    var i = window.GIFMP4I18N;
    var title = i.t('seo_' + key + '_title');
    var desc = i.t('seo_' + key + '_desc');
    if (title && title !== 'seo_' + key + '_title') document.title = title;
    var md = document.querySelector('meta[name="description"]');
    if (md && desc && desc !== 'seo_' + key + '_desc') md.setAttribute('content', desc);
    var og = document.querySelector('meta[property="og:title"]');
    if (og && title) og.setAttribute('content', title);
    var ogd = document.querySelector('meta[property="og:description"]');
    if (ogd && desc) ogd.setAttribute('content', desc);
    var tw = document.querySelector('meta[name="twitter:title"]');
    if (tw && title) tw.setAttribute('content', title);
    var twd = document.querySelector('meta[name="twitter:description"]');
    if (twd && desc) twd.setAttribute('content', desc);
  }

  /* ---------- init ---------- */
  function init() {
    buildHeader();
    buildFooter();
    injectAds();
    applySeo();
    window.GIFMP4I18N.init();
    loadBaseline();
    // re-render stats on language change
    window.GIFMP4OnLangChange = function () { renderStats(); };
    // nav highlight
    var path = window.location.pathname.split('/').pop() || 'index.html';
    var navLinks = document.querySelectorAll('.nav-links a');
    for (var i = 0; i < navLinks.length; i++) {
      if (navLinks[i].getAttribute('href').indexOf(path) !== -1) navLinks[i].className = 'active';
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
