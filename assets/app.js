// Melissa sin verden – henter alt innhold fra data/site.json og tegner siden.

(() => {
  const UI = {
    no: {
      nav_home: 'Hjem', nav_gallery: 'Galleri', nav_about: 'Om meg',
      characters: 'Karakterene mine', characters_eyebrow: 'Møt gjengen',
      see_characters: 'Møt karakterene', about_me: 'Om meg',
      back: '← Tilbake', palette: 'Fargepalett', palette_hint: 'Klikk på en farge for å kopiere den',
      gallery: 'Galleri', all: 'Alle', no_images: 'Ingen bilder her ennå – de kommer snart!',
      wip: 'Under arbeid', copied: 'Kopiert', not_found: 'Fant ikke den siden.', go_home: 'Til forsiden',
      load_error: 'Klarte ikke å laste innholdet. Prøv å laste siden på nytt.',
      images: 'bilder', see_more: 'Se mer', hello: 'Velkommen inn', made_with: 'Laget med', to_light: 'Bytt til lyst tema', to_dark: 'Bytt til mørkt tema',
    },
    en: {
      nav_home: 'Home', nav_gallery: 'Gallery', nav_about: 'About me',
      characters: 'My characters', characters_eyebrow: 'Meet the crew',
      see_characters: 'Meet the characters', about_me: 'About me',
      back: '← Back', palette: 'Colour palette', palette_hint: 'Click a colour to copy it',
      gallery: 'Gallery', all: 'All', no_images: 'No pictures here yet – coming soon!',
      wip: 'Work in progress', copied: 'Copied', not_found: "Couldn't find that page.", go_home: 'Go home',
      load_error: "Couldn't load the content. Try reloading the page.",
      images: 'pictures', see_more: 'See more', hello: 'Welcome in', made_with: 'Made with', to_light: 'Switch to light theme', to_dark: 'Switch to dark theme',
    },
  };

  let data = null;
  let lang = 'no';
  try { lang = localStorage.getItem('lang') === 'en' ? 'en' : 'no'; } catch (e) {}

  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main');
  const t = (key) => UI[lang][key] || key;
  const tr = (v) => (v && typeof v === 'object') ? (v[lang] || v.no || v.en || '') : (v || '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeColor = (c) => /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#7a44c9';
  const paragraphs = (text) => esc(text).split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

  const visibleChars = () => (data.characters || []).filter((c) => c.status !== 'hidden');

  // ---------- Views ----------

  function cardHTML(c) {
    const art = c.avatar || c.image;
    const wip = c.status === 'wip';
    return `
      <a class="card ${wip ? 'wip' : ''}" href="#/k/${encodeURIComponent(c.id)}" style="--c:${safeColor(c.accent)}">
        <div class="card-art">
          ${art ? `<img src="${esc(art)}" alt="" loading="lazy">` : `<span class="emoji" aria-hidden="true">${esc(c.emoji || '✨')}</span>`}
        </div>
        <div class="card-body">
          <span class="tag">${wip ? t('wip') : esc(tr(c.species))}</span>
          <h3>${esc(c.name)}</h3>
          <p>${esc(tr(c.tagline))}</p>
        </div>
      </a>`;
  }

  function viewHome() {
    const s = data.site;
    const title = esc(tr(s.title));
    return `
      <section class="hero view">
        <div>
          <span class="eyebrow">${t('hello')} ♡</span>
          <h1>${title} <span class="heart" aria-hidden="true">♥</span></h1>
          <p class="lead">${esc(tr(s.tagline))}</p>
          <div class="btn-row">
            <a class="btn" href="#characters">${t('see_characters')}</a>
            <a class="btn ghost" href="#/om-meg">${t('about_me')}</a>
          </div>
        </div>
        ${s.heroImage ? `<div class="hero-art"><span class="sparkle" aria-hidden="true">✦</span><span class="sparkle" aria-hidden="true">♡</span><span class="sparkle" aria-hidden="true">✧</span><img src="${esc(s.heroImage)}" alt="${title}" fetchpriority="high"></div>` : ''}
      </section>

      <div class="section-head view" id="characters">
        <div>
          <span class="eyebrow">${t('characters_eyebrow')}</span>
          <h2>${t('characters')}</h2>
        </div>
        <p class="muted" style="margin:0;max-width:40ch">${esc(tr(s.intro))}</p>
      </div>
      <div class="cards view">${visibleChars().map(cardHTML).join('')}</div>`;
  }

  function factsHTML(facts) {
    if (!facts || !facts.length) return '';
    return `<dl class="facts">${facts.map((f) => `
      <div class="fact"><dt>${esc(tr(f.label))}</dt><dd>${esc(tr(f.value))}</dd></div>`).join('')}</dl>`;
  }

  function galleryHTML(items, emptyEmoji = '🖼️') {
    if (!items.length) return `<div class="empty"><span class="emoji">${esc(emptyEmoji)}</span>${t('no_images')}</div>`;
    return `<div class="gallery">${items.map((g, i) => `
      <figure tabindex="0" data-lb="${i}">
        <img src="${esc(g.src)}" alt="${esc(tr(g.caption))}" loading="lazy">
        ${tr(g.caption) ? `<figcaption>${esc(tr(g.caption))}</figcaption>` : ''}
      </figure>`).join('')}</div>`;
  }

  function viewCharacter(id) {
    const c = visibleChars().find((x) => x.id === id);
    if (!c) return viewNotFound();
    const wip = c.status === 'wip';
    const gallery = (c.gallery || []).filter((g) => g.src);
    const palette = (c.palette || []).filter(Boolean);

    const html = `
      <div class="view">
        <a class="back" href="#/">${t('back')}</a>
        <section class="char-hero">
          <div class="char-art ${wip ? 'wip' : ''}" ${c.image && !wip ? 'data-lb-main tabindex="0"' : ''}>
            ${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.name)}" ${wip ? 'style="filter:brightness(0) drop-shadow(0 0 24px var(--accent))"' : ''}>` : `<span class="emoji" aria-hidden="true">${esc(c.emoji || '✨')}</span>`}
          </div>
          <div class="char-info">
            <span class="tag" style="--c:${safeColor(c.accent)}">${wip ? t('wip') : esc(tr(c.species))}</span>
            <h1>${esc(c.name)}</h1>
            <p class="tagline">${esc(tr(c.tagline))}</p>
            <div class="bio">${paragraphs(tr(c.bio))}</div>
            ${factsHTML(c.facts)}
            ${palette.length ? `
              <h3>${t('palette')}</h3>
              <p class="muted" style="margin:0;font-size:.9rem">${t('palette_hint')}</p>
              <div class="palette">${palette.map((p) => `
                <button class="swatch" data-copy="${esc(p)}" style="--sw:${safeColor(p)}"><span class="c"></span>${esc(p)}</button>`).join('')}
              </div>` : ''}
          </div>
        </section>
        ${wip ? '' : `
          <div class="section-head"><h2>${t('gallery')}</h2><span class="muted">${gallery.length} ${t('images')}</span></div>
          ${galleryHTML(gallery, c.emoji)}`}
      </div>`;
    lbItems = gallery;
    lbMain = c.image && !wip ? { src: c.image, caption: { no: c.name, en: c.name } } : null;
    applyTheme(c);
    return html;
  }

  let galleryFilter = 'all';
  function viewGallery() {
    const chars = visibleChars().filter((c) => c.status !== 'wip' && (c.gallery || []).some((g) => g.src));
    const all = [];
    chars.forEach((c) => (c.gallery || []).forEach((g) => g.src && all.push({ ...g, char: c.id })));
    if (!chars.some((c) => c.id === galleryFilter)) galleryFilter = 'all';
    const items = galleryFilter === 'all' ? all : all.filter((g) => g.char === galleryFilter);
    lbItems = items;
    return `
      <div class="view">
        <div class="section-head" style="margin-top:0">
          <h2>${t('gallery')}</h2>
          <div class="chips" role="group">
            <button class="chip" data-filter="all" aria-pressed="${galleryFilter === 'all'}">${t('all')}</button>
            ${chars.map((c) => `<button class="chip" data-filter="${esc(c.id)}" aria-pressed="${galleryFilter === c.id}">${esc(c.emoji || '')} ${esc(c.name)}</button>`).join('')}
          </div>
        </div>
        ${galleryHTML(items)}
      </div>`;
  }

  function viewAbout() {
    const a = data.about || {};
    return `
      <section class="about view">
        ${a.image ? `<img src="${esc(a.image)}" alt="">` : ''}
        <div>
          <span class="eyebrow">${t('about_me')} ♡</span>
          <h1 style="font-size:clamp(2.4rem,6vw,3.6rem);margin-top:10px">${esc(tr((a.facts || [])[0]?.value) || t('about_me'))}</h1>
          <div class="bio">${paragraphs(tr(a.text))}</div>
          ${factsHTML((a.facts || []).slice(1))}
        </div>
      </section>`;
  }

  function viewNotFound() {
    return `<div class="empty view"><span class="emoji">🐾</span><p>${t('not_found')}</p><a class="btn" href="#/">${t('go_home')}</a></div>`;
  }

  // ---------- Theme ----------

  function applyTheme(c) {
    const root = document.documentElement.style;
    if (c) {
      root.setProperty('--accent', safeColor(c.accent));
      root.setProperty('--accent2', safeColor(c.accent2 || c.accent));
    } else {
      root.removeProperty('--accent');
      root.removeProperty('--accent2');
    }
  }

  // ---------- Router ----------

  let lbItems = [];
  let lbMain = null;

  function render() {
    if (!data) return;
    const hash = location.hash.replace(/^#/, '');
    const parts = hash.split('/').filter(Boolean);
    let route = 'home';
    let html;
    lbItems = []; lbMain = null;
    applyTheme(null);

    if (hash === 'characters') { html = viewHome(); }
    else if (!parts.length) html = viewHome();
    else if (parts[0] === 'k' && parts[1]) { route = 'char'; html = viewCharacter(decodeURIComponent(parts[1])); }
    else if (parts[0] === 'galleri') { route = 'gallery'; html = viewGallery(); }
    else if (parts[0] === 'om-meg') { route = 'about'; html = viewAbout(); }
    else html = viewNotFound();

    main.innerHTML = html;
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));

    const siteTitle = tr(data.site.title);
    const char = route === 'char' ? visibleChars().find((x) => x.id === decodeURIComponent(parts[1])) : null;
    document.title = char ? `${char.name} · ${siteTitle}` : siteTitle;

    if (hash === 'characters') $('#characters')?.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  function applyStaticText() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    $('#langBtn').textContent = lang === 'no' ? 'EN' : 'NO';
    $('#madeWith').textContent = t('made_with');
    updateThemeBtn();
    if (data) {
      $('#brandText').textContent = tr(data.site.title);
      $('#footerText').textContent = tr(data.site.title);
    }
  }

  // ---------- Events ----------

  main.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-copy]');
    if (sw) {
      const val = sw.dataset.copy;
      navigator.clipboard?.writeText(val).then(() => toast(`${t('copied')} ${val}`), () => toast(val));
      return;
    }
    const chip = e.target.closest('[data-filter]');
    if (chip) { galleryFilter = chip.dataset.filter; main.innerHTML = viewGallery(); return; }
    const fig = e.target.closest('[data-lb]');
    if (fig) { openLb(lbItems, +fig.dataset.lb); return; }
    if (e.target.closest('[data-lb-main]') && lbMain) openLb([lbMain], 0);
    const anchor = e.target.closest('a[href="#characters"]');
    if (anchor) { e.preventDefault(); $('#characters')?.scrollIntoView({ behavior: 'smooth' }); }
  });
  main.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const fig = e.target.closest('[data-lb], [data-lb-main]');
    if (fig) { e.preventDefault(); fig.click(); }
  });

  $('#langBtn').addEventListener('click', () => {
    lang = lang === 'no' ? 'en' : 'no';
    try { localStorage.setItem('lang', lang); } catch (e) {}
    applyStaticText();
    render();
  });

  // ---------- Lyst / mørkt tema ----------

  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
  function updateThemeBtn() {
    const dark = currentTheme() === 'dark';
    const btn = $('#themeBtn');
    btn.textContent = dark ? '☀' : '☾';
    btn.setAttribute('aria-label', t(dark ? 'to_light' : 'to_dark'));
    btn.title = t(dark ? 'to_light' : 'to_dark');
  }
  $('#themeBtn').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    updateThemeBtn();
  });
  darkQuery.addEventListener('change', updateThemeBtn);

  const menuBtn = $('#menuBtn');
  const nav = $('#nav');
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  });

  // ---------- Lightbox ----------

  const lb = $('#lightbox');
  let lbList = [];
  let lbIndex = 0;
  let lastFocus = null;

  function showLb() {
    const item = lbList[lbIndex];
    $('#lbImg').src = item.src;
    $('#lbImg').alt = tr(item.caption);
    $('#lbCap').textContent = tr(item.caption);
    const multi = lbList.length > 1;
    $('#lbPrev').hidden = !multi;
    $('#lbNext').hidden = !multi;
  }
  function openLb(list, i) {
    if (!list.length) return;
    lbList = list; lbIndex = i; lastFocus = document.activeElement;
    showLb();
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#lbClose').focus();
  }
  function closeLb() {
    lb.hidden = true;
    document.body.style.overflow = '';
    lastFocus?.focus();
  }
  const step = (d) => { lbIndex = (lbIndex + d + lbList.length) % lbList.length; showLb(); };
  $('#lbClose').onclick = closeLb;
  $('#lbPrev').onclick = () => step(-1);
  $('#lbNext').onclick = () => step(1);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  // ---------- Bildebeskyttelse ----------
  // Stopper høyreklikk og dra-og-slipp på bildene. Det hindrer ikke skjermbilder,
  // men gjør det vanskeligere å lagre dem.

  const isProtected = (el) => el instanceof Element && el.closest('main img, .lightbox, .char-art, .card-art, .gallery figure, .brand');
  document.addEventListener('contextmenu', (e) => {
    if (!isProtected(e.target)) return;
    e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => { if (isProtected(e.target)) e.preventDefault(); });

  // ---------- Toast ----------

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------- Start ----------

  $('#year').textContent = new Date().getFullYear();
  applyStaticText();

  // GitHub-versjonen leser data/site.json, PHP-versjonen leser fra databasen via api/site.php.
  const source = document.body.dataset.content || 'data/site.json';
  fetch(source + (source.includes('?') ? '&' : '?') + 'v=' + Date.now())
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((json) => {
      data = json;
      applyStaticText();
      render();
      window.addEventListener('hashchange', render);
    })
    .catch(() => {
      main.innerHTML = `<div class="empty"><span class="emoji">😿</span>${t('load_error')}</div>`;
    });
})();
