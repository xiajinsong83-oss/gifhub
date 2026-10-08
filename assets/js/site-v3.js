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
  function buildFooter() {
    var f = el('footer', 'site-footer', null);
    var inner = el('div', 'footer-inner', null);
    inner.appendChild(el('div', 'footer-brand', window.GIFMP4I18N.t('site_name')));
    var links = el('div', 'footer-links', null);
    var l1 = el('a', null, null); l1.href = '/privacy.html'; l1.textContent = window.GIFMP4I18N.t('privacy'); l1.setAttribute('data-i18n', 'privacy');
    var l2 = el('a', null, null); l2.href = '/about.html'; l2.textContent = window.GIFMP4I18N.t('about'); l2.setAttribute('data-i18n', 'about');
    var l3 = el('a', null, null); l3.href = '/contact.html'; l3.textContent = window.GIFMP4I18N.t('contact'); l3.setAttribute('data-i18n', 'contact');
    var l4 = el('a', null, null); l4.href = 'mailto:39918849@QQ.COM'; l4.textContent = window.GIFMP4I18N.t('contact_email');
    links.appendChild(l1); links.appendChild(l2); links.appendChild(l3); links.appendChild(l4);
    inner.appendChild(links);
    var stats = el('div', 'footer-stats', null);
    var st = el('div', 'stats-title', window.GIFMP4I18N.t('footer_stats'));
    st.setAttribute('data-i18n', 'footer_stats');
    stats.appendChild(st);
    var grid = el('div', 'stats-grid', null);
    grid.id = 'statsGrid';
    stats.appendChild(grid);
    stats.appendChild(el('div', 'stats-local', window.GIFMP4I18N.t('stat_local')));
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

  /* ---------- local conversion stats ---------- */
  var STAT_KEY = 'gifmp4_stats';
  function getStats() {
    try { var s = JSON.parse(localStorage.getItem(STAT_KEY)); if (s) return s; } catch (e) {}
    return { conv: 0, files: 0, mb: 0 };
  }
  function saveStats(s) { try { localStorage.setItem(STAT_KEY, JSON.stringify(s)); } catch (e) {} }
  function fmtMb(mb) { return mb >= 100 ? Math.round(mb) + ' MB' : mb.toFixed(1) + ' MB'; }
  function renderStats() {
    var grid = document.getElementById('statsGrid');
    if (!grid) return;
    var s = getStats();
    grid.innerHTML = '';
    var items = [
      [window.GIFMP4I18N.t('stat_total'), String(s.conv)],
      [window.GIFMP4I18N.t('stat_files'), String(s.files)],
      [window.GIFMP4I18N.t('stat_mb'), fmtMb(s.mb)]
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
    var s = getStats();
    s.conv++;
    s.files++;
    if (typeof fileBytes === 'number' && fileBytes > 0) s.mb += fileBytes / 1048576;
    saveStats(s);
    renderStats();
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
