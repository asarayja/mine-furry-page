// Melissa sin verden – henter alt innhold fra data/site.json og tegner siden.

(() => {
  const UI = {
    no: {
      nav_home: 'Hjem', nav_gallery: 'Galleri', nav_about: 'Om meg', nav_music: 'Musikk',
      music: 'Musikk', music_eyebrow: 'Sett på noe fint', play_all: 'Spill av', tracks: 'spor', track: 'spor',
      play: 'Spill av', pause: 'Pause', prev: 'Forrige', next: 'Neste', close_player: 'Lukk spilleren', volume: 'Lydstyrke', seek: 'Spol',
      characters: 'Karakterene mine', characters_eyebrow: 'Møt gjengen',
      see_characters: 'Møt karakterene', about_me: 'Om meg',
      back: '← Tilbake', palette: 'Fargepalett', palette_hint: 'Klikk på en farge for å kopiere den',
      gallery: 'Galleri', all: 'Alle', no_images: 'Ingen bilder her ennå – de kommer snart!',
      wip: 'Under arbeid', copied: 'Kopiert', not_found: 'Fant ikke den siden.', go_home: 'Til forsiden',
      load_error: 'Klarte ikke å laste innholdet. Prøv å laste siden på nytt.',
      images: 'bilder', see_more: 'Se mer', hello: 'Velkommen inn', made_with: 'Laget med', to_light: 'Bytt til lyst tema', to_dark: 'Bytt til mørkt tema',
    },
    en: {
      nav_home: 'Home', nav_gallery: 'Gallery', nav_about: 'About me', nav_music: 'Music',
      music: 'Music', music_eyebrow: 'Put something nice on', play_all: 'Play', tracks: 'tracks', track: 'track',
      play: 'Play', pause: 'Pause', prev: 'Previous', next: 'Next', close_player: 'Close player', volume: 'Volume', seek: 'Seek',
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
  // Album med minst én lydfil. Sporene filtreres likt her og i spilleren, så nummereringen stemmer.
  const playableTracks = (album) => (album.tracks || []).filter((tr) => tr.src);
  const musicAlbums = () => ((data && data.music && data.music.albums) || []).filter((a) => playableTracks(a).length);

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

  function viewMusic() {
    const albums = musicAlbums();
    if (!albums.length) return viewNotFound();
    return `
      <div class="view">
        <div class="section-head" style="margin-top:0">
          <div>
            <span class="eyebrow">${t('music_eyebrow')} ♪</span>
            <h2>${t('music')}</h2>
          </div>
        </div>
        <div class="albums">${albums.map((a, ai) => {
          const tracks = playableTracks(a);
          const meta = [a.artist, a.year, `${tracks.length} ${tracks.length === 1 ? t('track') : t('tracks')}`].filter(Boolean).map(esc).join(' · ');
          return `
            <section class="album glass">
              <div class="album-head">
                <div class="album-cover">${a.cover ? `<img src="${esc(a.cover)}" alt="" loading="lazy">` : '<span aria-hidden="true">♪</span>'}</div>
                <div class="album-info">
                  <h3>${esc(tr(a.title))}</h3>
                  <p class="muted album-meta">${meta}</p>
                  ${tr(a.description) ? `<div class="album-desc">${paragraphs(tr(a.description))}</div>` : ''}
                  <button class="btn" data-play-album="${ai}">${ICONS.play} ${t('play_all')}</button>
                </div>
              </div>
              <ol class="tracklist">${tracks.map((tk, ti) => `
                <li><button class="track" data-album="${ai}" data-track="${ti}">
                  <span class="num">${ti + 1}</span>
                  <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
                  <span class="t">${esc(tk.title || `${t('track')} ${ti + 1}`)}</span>
                </button></li>`).join('')}
              </ol>
            </section>`;
        }).join('')}</div>
      </div>`;
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
    else if (parts[0] === 'musikk') { route = musicAlbums().length ? 'music' : ''; html = viewMusic(); }
    else { route = ''; html = viewNotFound(); }

    main.innerHTML = html;
    markPlaying();
    document.querySelectorAll('.nav a, .footer-nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));

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
      document.querySelectorAll('[data-route="music"]').forEach((a) => { a.hidden = !musicAlbums().length; });
    }
    updatePlayerText();
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
    const playAll = e.target.closest('[data-play-album]');
    if (playAll) { playAlbum(+playAll.dataset.playAlbum, 0); return; }
    const trackBtn = e.target.closest('[data-track]');
    if (trackBtn) {
      const ai = +trackBtn.dataset.album, ti = +trackBtn.dataset.track;
      if (current && current.ai === ai && current.ti === ti) togglePlay();
      else playAlbum(ai, ti);
      return;
    }
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

  const isProtected = (el) => el instanceof Element && el.closest('main img, .lightbox, .char-art, .card-art, .gallery figure, .brand, .player-cover');
  document.addEventListener('contextmenu', (e) => {
    if (!isProtected(e.target)) return;
    e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => { if (isProtected(e.target)) e.preventDefault(); });

  // ---------- Musikkspiller ----------
  // Spilleren ligger utenfor <main>, så musikken fortsetter når man bytter side.

  const ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="2.5" height="12" rx="1"/><path d="M19 6.8v10.4a.8.8 0 0 1-1.25.66L10 12.66a.8.8 0 0 1 0-1.32l7.75-5.2A.8.8 0 0 1 19 6.8z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="16.5" y="6" width="2.5" height="12" rx="1"/><path d="M5 6.8v10.4a.8.8 0 0 0 1.25.66L14 12.66a.8.8 0 0 0 0-1.32L6.25 6.14A.8.8 0 0 0 5 6.8z"/></svg>',
  };

  const audio = new Audio();
  audio.preload = 'metadata';
  const player = $('#player');
  let queue = [];
  let current = null; // { ai, ti, album }

  try { const v = parseFloat(localStorage.getItem('volume')); if (v >= 0 && v <= 1) audio.volume = v; } catch (e) {}
  $('#plVol').value = audio.volume;
  $('#plPrev').innerHTML = ICONS.prev;
  $('#plNext').innerHTML = ICONS.next;

  const fmt = (sec) => {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  const absUrl = (p) => new URL(p, location.href).href;

  function playAlbum(ai, ti) {
    const album = musicAlbums()[ai];
    if (!album) return;
    queue = playableTracks(album);
    current = { ai, ti, album };
    loadTrack(true);
  }

  function loadTrack(autoplay) {
    const track = queue[current.ti];
    audio.src = track.src;
    if (autoplay) audio.play().catch(() => {});
    player.hidden = false;
    document.body.classList.add('has-player');
    const cover = current.album.cover;
    $('#plCover').hidden = !cover;
    $('#plCoverEmpty').hidden = !!cover;
    if (cover) $('#plCover').src = cover;
    updatePlayerText();
    markPlaying();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || `${t('track')} ${current.ti + 1}`,
        artist: current.album.artist || '',
        album: tr(current.album.title),
        artwork: cover ? [{ src: absUrl(cover) }] : [],
      });
    }
  }

  function updatePlayerText() {
    $('#plPlay').setAttribute('aria-label', t(audio.paused ? 'play' : 'pause'));
    $('#plPrev').setAttribute('aria-label', t('prev'));
    $('#plNext').setAttribute('aria-label', t('next'));
    $('#plClose').setAttribute('aria-label', t('close_player'));
    $('#plVol').setAttribute('aria-label', t('volume'));
    $('#plSeek').setAttribute('aria-label', t('seek'));
    if (!current) return;
    const track = queue[current.ti];
    $('#plTitle').textContent = track.title || `${t('track')} ${current.ti + 1}`;
    $('#plAlbum').textContent = [current.album.artist, tr(current.album.title)].filter(Boolean).join(' · ');
  }

  function markPlaying() {
    document.querySelectorAll('.track').forEach((b) => {
      const on = current && +b.dataset.album === current.ai && +b.dataset.track === current.ti;
      b.classList.toggle('playing', !!on);
      b.classList.toggle('paused', !!on && audio.paused);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }

  function togglePlay() {
    if (!current) return;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }
  function skip(d) {
    if (!current) return;
    if (d < 0 && audio.currentTime > 3) { audio.currentTime = 0; return; }
    const ti = current.ti + d;
    if (ti < 0 || ti >= queue.length) return;
    current.ti = ti;
    loadTrack(true);
  }
  function closePlayer() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    current = null;
    player.hidden = true;
    document.body.classList.remove('has-player');
    markPlaying();
  }

  function syncPlayState() {
    $('#plPlay').innerHTML = audio.paused ? ICONS.play : ICONS.pause;
    player.classList.toggle('is-playing', !audio.paused);
    updatePlayerText();
    markPlaying();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
  }
  audio.addEventListener('play', syncPlayState);
  audio.addEventListener('pause', syncPlayState);
  audio.addEventListener('ended', () => {
    if (current && current.ti < queue.length - 1) skip(1);
    else syncPlayState();
  });
  let seeking = false;
  audio.addEventListener('timeupdate', () => {
    if (seeking) return;
    const d = audio.duration;
    $('#plSeek').value = isFinite(d) && d ? (audio.currentTime / d) * 1000 : 0;
    $('#plSeek').style.setProperty('--p', `${$('#plSeek').value / 10}%`);
    $('#plTime').textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', () => { $('#plDur').textContent = fmt(audio.duration); });

  $('#plSeek').addEventListener('input', (e) => {
    seeking = true;
    e.target.style.setProperty('--p', `${e.target.value / 10}%`);
    if (isFinite(audio.duration)) $('#plTime').textContent = fmt((e.target.value / 1000) * audio.duration);
  });
  $('#plSeek').addEventListener('change', (e) => {
    if (isFinite(audio.duration)) audio.currentTime = (e.target.value / 1000) * audio.duration;
    seeking = false;
  });
  $('#plVol').addEventListener('input', (e) => {
    audio.volume = +e.target.value;
    e.target.style.setProperty('--p', `${audio.volume * 100}%`);
    try { localStorage.setItem('volume', audio.volume); } catch (err) {}
  });
  $('#plVol').style.setProperty('--p', `${audio.volume * 100}%`);
  $('#plPlay').addEventListener('click', togglePlay);
  $('#plPrev').addEventListener('click', () => skip(-1));
  $('#plNext').addEventListener('click', () => skip(1));
  $('#plClose').addEventListener('click', closePlayer);
  syncPlayState();

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => audio.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => skip(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => skip(1));
  }

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
