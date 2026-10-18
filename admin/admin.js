// Admin-panel for Melissa sin verden.
// Samme fil brukes i begge versjonene av siden:
//  - GitHub Pages: lagrer innhold og bilder direkte i repoet via GitHub sitt API.
//  - PHP: lagrer i SQL-databasen via ../api/admin.php  (<body data-backend="php">)

(() => {
  const BACKEND = document.body.dataset.backend === 'php' ? 'php' : 'github';
  const SETTINGS_KEY = 'mv-admin-github';
  const DATA_PATH = 'data/site.json';
  const UPLOAD_DIR = 'bilder/uploads';
  const MAX_IMAGE = 2000;

  const app = document.getElementById('app');
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let gh = loadSettings();
  let data = null;
  let view = 'general';
  let dirty = false;
  let busy = 0;
  const previews = {}; // bildesti -> lokal blob-URL, så nye bilder vises før Pages er oppdatert

  // ---------- Innstillinger ----------

  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) {}
    if (!s.owner && location.hostname.endsWith('.github.io')) {
      s.owner = location.hostname.split('.')[0];
      const first = location.pathname.split('/').filter(Boolean)[0];
      s.repo = first && first !== 'admin' ? first : `${s.owner}.github.io`;
    }
    return { owner: '', repo: '', branch: 'main', folder: '', token: '', ...s };
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(gh)); } catch (e) {}
  }

  // ---------- GitHub API ----------

  const repoPath = (p) => [gh.folder.replace(/^\/+|\/+$/g, ''), p].filter(Boolean).join('/');
  const apiUrl = (p) => `https://api.github.com/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}${p}`;

  async function api(path, opts = {}) {
    const res = await fetch(apiUrl(path), {
      ...opts,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${gh.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
    });
    if (res.status === 404 && opts.allow404) return null;
    if (!res.ok) {
      let msg = `GitHub svarte ${res.status}`;
      try { const j = await res.json(); if (j.message) msg += `: ${j.message}`; } catch (e) {}
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.json();
  }

  const contentsPath = (p) => `/contents/${repoPath(p).split('/').map(encodeURIComponent).join('/')}`;

  async function getFile(p) {
    return api(`${contentsPath(p)}?ref=${encodeURIComponent(gh.branch)}&t=${Date.now()}`, { allow404: true });
  }

  // Alle skriv går i kø, ett om gangen, så GitHub ikke får to commits samtidig.
  let queue = Promise.resolve();
  function putFile(p, base64, message) {
    const job = queue.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const existing = await getFile(p);
        try {
          return await api(contentsPath(p), {
            method: 'PUT',
            body: JSON.stringify({ message, content: base64, branch: gh.branch, ...(existing ? { sha: existing.sha } : {}) }),
          });
        } catch (e) {
          if ((e.status === 409 || e.status === 422) && attempt < 2) { await new Promise((r) => setTimeout(r, 800)); continue; }
          throw e;
        }
      }
    });
    queue = job.catch(() => {});
    return job;
  }

  function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const textToBase64 = (s) => bytesToBase64(new TextEncoder().encode(s));
  const base64ToText = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

  // ---------- Data ----------

  const i18n = (v) => (v && typeof v === 'object' ? { no: v.no || '', en: v.en || '' } : { no: v || '', en: '' });

  function normalize(d) {
    d.site = d.site || {};
    ['title', 'tagline', 'intro'].forEach((k) => (d.site[k] = i18n(d.site[k])));
    d.about = d.about || {};
    d.about.text = i18n(d.about.text);
    d.about.facts = (d.about.facts || []).map(normFact);
    d.characters = (d.characters || []).map((c) => ({
      id: '', name: '', emoji: '', status: 'ready', image: '', avatar: '', accent: '#c21a2b', accent2: '#7a44c9', ...c,
      species: i18n(c.species), tagline: i18n(c.tagline), bio: i18n(c.bio),
      palette: c.palette || [], facts: (c.facts || []).map(normFact),
      gallery: (c.gallery || []).map((g) => ({ src: g.src || '', caption: i18n(g.caption) })),
    }));
    return d;
  }
  function normFact(f) { return { label: i18n(f.label), value: i18n(f.value) }; }

  function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), data); }
  function setPath(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const obj = keys.reduce((o, k) => o[k], data);
    obj[last] = value;
  }

  const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'karakter';

  function markDirty() { dirty = true; updateStatus(); }

  // ---------- Bilder ----------

  async function compress(file) {
    if (file.type === 'image/gif') return { blob: file, ext: 'gif' }; // beholder animasjon
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.88));
    if (blob && blob.type === 'image/webp') return { blob, ext: 'webp' };
    const png = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    return { blob: png, ext: 'png' };
  }

  async function uploadImage(file, nameHint) {
    if (!/^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(file.type)) throw new Error(`${file.name} er ikke et bilde som støttes (PNG, JPG, WebP eller GIF)`);
    busy++; updateStatus(`Laster opp ${file.name} …`);
    try {
      const { blob, ext } = await compress(file);
      const base = slug(nameHint || file.name.replace(/\.[^.]+$/, ''));
      const path = await backend.upload(blob, base, ext);
      previews[path] = URL.createObjectURL(blob);
      return path;
    } finally {
      busy--; updateStatus();
    }
  }

  const imgSrc = (p) => !p ? '' : previews[p] || (/^(https?:)?\/\//.test(p) ? p : `../${p}`);

  function pickFiles(multiple) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.multiple = multiple;
      input.onchange = () => resolve([...input.files]);
      input.click();
    });
  }

  // ---------- Lagring: GitHub Pages ----------

  const githubBackend = {
    publishedMsg: 'Publisert! Siden oppdateres om ca. ett minutt ♥',

    start() {
      if (gh.token && gh.owner && gh.repo) {
        app.innerHTML = '<p class="center">Kobler til GitHub …</p>';
        this.connect().catch((err) => this.renderConnect(friendlyError(err)));
      } else {
        this.renderConnect();
      }
    },

    renderConnect(error) {
      app.innerHTML = `
        <div class="connect">
          <h1 style="font-size:2rem">Admin ♥</h1>
          <p class="muted">Koble til GitHub-repoet der siden ligger. Dette gjør du bare én gang per nettleser.</p>
          <div class="box">
            ${error ? `<div class="error">${esc(error)}</div>` : ''}
            <form id="connectForm">
              <div class="grid2">
                <div class="field"><label for="owner">GitHub-brukernavn</label><input type="text" id="owner" value="${esc(gh.owner)}" required autocomplete="off"></div>
                <div class="field"><label for="repo">Repo</label><input type="text" id="repo" value="${esc(gh.repo)}" required autocomplete="off" placeholder="brukernavn.github.io"></div>
                <div class="field"><label for="branch">Branch</label><input type="text" id="branch" value="${esc(gh.branch)}" required></div>
                <div class="field"><label for="folder">Mappe i repoet (valgfritt)</label><input type="text" id="folder" value="${esc(gh.folder)}" placeholder="tom = roten av repoet"></div>
              </div>
              <div class="field"><label for="token">Tilgangsnøkkel (token)</label><input type="password" id="token" value="${esc(gh.token)}" required autocomplete="off"></div>
              <button class="primary" type="submit" style="width:100%">Koble til</button>
            </form>
            <h3>Slik lager du nøkkelen</h3>
            <ol class="small">
              <li>Gå til <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a></li>
              <li>Gi den et navn, f.eks. <code>Admin furry-side</code>, og velg en utløpsdato.</li>
              <li>Under <b>Repository access</b>: velg <b>Only select repositories</b> og velg repoet til siden.</li>
              <li>Under <b>Permissions → Repository permissions</b>: sett <b>Contents</b> til <b>Read and write</b>.</li>
              <li>Trykk <b>Generate token</b>, kopier den og lim den inn her.</li>
            </ol>
            <p class="small muted">Nøkkelen lagres bare i denne nettleseren. Del den aldri med noen.</p>
          </div>
        </div>`;
      $('#connectForm').onsubmit = async (e) => {
        e.preventDefault();
        gh = {
          owner: $('#owner').value.trim(), repo: $('#repo').value.trim(), branch: $('#branch').value.trim() || 'main',
          folder: $('#folder').value.trim(), token: $('#token').value.trim(),
        };
        const btn = e.submitter; btn.disabled = true; btn.textContent = 'Kobler til …';
        try {
          await this.connect();
          saveSettings();
        } catch (err) {
          this.renderConnect(friendlyError(err));
        }
      };
    },

    async connect() {
      const repo = await api('');
      if (repo.permissions && !repo.permissions.push) {
        const e = new Error('Nøkkelen kan ikke skrive til repoet.'); e.status = 403; throw e;
      }
      const file = await getFile(DATA_PATH);
      if (file) return ready(JSON.parse(base64ToText(file.content)));
      // Første gang: start med det som ligger på siden nå.
      const res = await fetch(`../${DATA_PATH}?v=${Date.now()}`);
      if (!res.ok) { const e = new Error(`Fant ikke ${repoPath(DATA_PATH)} i repoet.`); e.status = 404; throw e; }
      ready(await res.json(), true);
    },

    async save(content) {
      await putFile(DATA_PATH, textToBase64(JSON.stringify(content, null, 2) + '\n'), 'Oppdater innhold fra admin-panelet');
    },

    async upload(blob, base, ext) {
      const path = `${UPLOAD_DIR}/${base}-${Date.now().toString(36)}.${ext}`;
      await putFile(path, bytesToBase64(new Uint8Array(await blob.arrayBuffer())), `Last opp bilde ${path}`);
      return path;
    },

    settingsHTML() {
      return `
        <div class="card">
          <p>Koblet til <b>${esc(gh.owner)}/${esc(gh.repo)}</b> (branch <code>${esc(gh.branch)}</code>${gh.folder ? `, mappe <code>${esc(gh.folder)}</code>` : ''}).</p>
          <p class="small muted">Hver gang du publiserer blir det lagret en ny versjon i GitHub. Du kan se alle tidligere versjoner under
            <a href="https://github.com/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/commits/${encodeURIComponent(gh.branch)}" target="_blank" rel="noopener">Commits på GitHub</a>.</p>
          <button class="danger" data-act="disconnect">Logg ut (glem nøkkelen i denne nettleseren)</button>
        </div>`;
    },

    logout() {
      gh.token = '';
      saveSettings();
      this.renderConnect();
    },
  };

  // ---------- Lagring: PHP + SQL ----------

  const phpBackend = {
    publishedMsg: 'Lagret! Endringene er ute på siden nå ♥',
    csrf: '',
    username: '',

    async call(action, { body, form } = {}) {
      const res = await fetch(`../api/admin.php?action=${action}`, {
        method: body || form ? 'POST' : 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-CSRF-Token': this.csrf, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: form || (body ? JSON.stringify(body) : undefined),
      });
      let json = {};
      try { json = await res.json(); } catch (e) {}
      if (!res.ok || json.error) {
        const err = new Error(json.error || `Serveren svarte ${res.status}`);
        err.status = res.status;
        err.serverMessage = json.error;
        throw err;
      }
      return json;
    },

    async start() {
      app.innerHTML = '<p class="center">Laster …</p>';
      try {
        const s = await this.call('session');
        this.csrf = s.csrf || '';
        if (!s.installed) return this.renderLogin('Siden er ikke installert ennå. Åpne install.php først.');
        if (!s.loggedIn) return this.renderLogin();
        this.username = s.username;
        await this.load();
      } catch (err) {
        this.renderLogin(friendlyError(err));
      }
    },

    renderLogin(error) {
      app.innerHTML = `
        <div class="connect">
          <h1 style="font-size:2rem">Admin ♥</h1>
          <p class="muted">Logg inn for å redigere siden.</p>
          <div class="box">
            ${error ? `<div class="error">${esc(error)}</div>` : ''}
            <form id="loginForm">
              <div class="field"><label for="username">Brukernavn</label><input type="text" id="username" required autocomplete="username"></div>
              <div class="field"><label for="password">Passord</label><input type="password" id="password" required autocomplete="current-password"></div>
              <button class="primary" type="submit" style="width:100%">Logg inn</button>
            </form>
          </div>
        </div>`;
      $('#username').focus();
      $('#loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.submitter; btn.disabled = true; btn.textContent = 'Logger inn …';
        try {
          const r = await this.call('login', { body: { username: $('#username').value.trim(), password: $('#password').value } });
          this.csrf = r.csrf;
          this.username = r.username;
          await this.load();
        } catch (err) {
          this.renderLogin(friendlyError(err));
        }
      };
    },

    async load() {
      const r = await this.call('data');
      ready(r.data);
      // Holder økten i live mens admin er åpent, og henter ny CSRF-nøkkel hvis du har logget inn i en annen fane.
      clearInterval(this.ping);
      this.ping = setInterval(() => this.call('session').then((s) => { if (s.csrf) this.csrf = s.csrf; }).catch(() => {}), 5 * 60 * 1000);
    },

    async save(content) {
      await this.call('save', { body: { data: content } });
    },

    async upload(blob, base, ext) {
      const form = new FormData();
      form.append('file', blob, `${base}.${ext}`);
      return (await this.call('upload', { form })).path;
    },

    settingsHTML() {
      return `
        <div class="card">
          <p>Logget inn som <b>${esc(this.username)}</b>. Innholdet lagres i databasen på serveren.</p>
          <button class="danger" data-act="disconnect">Logg ut</button>
        </div>
        <div class="card">
          <h3 style="margin-top:0">Bytt passord</h3>
          <form id="pwForm">
            <div class="field"><label for="pwCurrent">Nåværende passord</label><input type="password" id="pwCurrent" required autocomplete="current-password"></div>
            <div class="grid2">
              <div class="field"><label for="pwNew">Nytt passord (minst 10 tegn)</label><input type="password" id="pwNew" required minlength="10" autocomplete="new-password"></div>
              <div class="field"><label for="pwNew2">Gjenta nytt passord</label><input type="password" id="pwNew2" required minlength="10" autocomplete="new-password"></div>
            </div>
            <button class="primary" type="submit">Bytt passord</button>
          </form>
        </div>`;
    },

    afterSettings() {
      $('#pwForm').onsubmit = async (e) => {
        e.preventDefault();
        if ($('#pwNew').value !== $('#pwNew2').value) return toast('De nye passordene er ikke like.', true);
        try {
          await this.call('password', { body: { current: $('#pwCurrent').value, new: $('#pwNew').value } });
          e.target.reset();
          toast('Passordet er byttet ♥');
        } catch (err) {
          toast(friendlyError(err), true);
        }
      };
    },

    async logout() {
      clearInterval(this.ping);
      try { await this.call('logout', { body: {} }); } catch (e) {}
      this.csrf = '';
      this.renderLogin();
    },
  };

  const backend = BACKEND === 'php' ? phpBackend : githubBackend;

  function friendlyError(err) {
    if (err.serverMessage) return err.serverMessage;
    if (BACKEND === 'github') {
      if (err.status === 401) return 'Nøkkelen er ugyldig eller utløpt. Lag en ny.';
      if (err.status === 403) return 'Nøkkelen mangler tilgang. Sjekk at «Contents» er satt til «Read and write».';
      if (err.status === 404) return 'Fant ikke repoet eller filen. Sjekk brukernavn, repo, branch og mappe, og at nøkkelen har tilgang til dette repoet.';
    }
    if (err instanceof TypeError) return 'Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.';
    return err.message || String(err);
  }

  function ready(content, isDirty = false) {
    data = normalize(content);
    dirty = isDirty;
    renderShell();
  }

  // ---------- Hovedvisning ----------

  function renderShell() {
    app.innerHTML = `
      <div class="shell">
        <aside class="side" id="side">
          <div class="logo"><img src="../bilder/asarayja-hode.webp" alt="">Admin</div>
          <nav id="sideNav"></nav>
        </aside>
        <div class="content">
          <div class="topbar">
            <div class="row">
              <button class="menu-toggle icon" id="menuToggle" aria-label="Meny">☰</button>
              <span class="status" id="status"><span class="dot"></span><span id="statusText"></span></span>
            </div>
            <div class="row">
              <a class="btn" href="../" target="_blank" rel="noopener">Se siden ↗</a>
              <button class="primary" id="publishBtn">Publiser</button>
            </div>
          </div>
          <div class="editor" id="editor"></div>
        </div>
      </div>`;
    $('#publishBtn').onclick = publish;
    $('#menuToggle').onclick = () => $('#side').classList.toggle('open');
    $('#side').addEventListener('click', (e) => { if (e.target === $('#side')) $('#side').classList.remove('open'); });
    const editor = $('#editor');
    editor.addEventListener('input', onInput);
    editor.addEventListener('change', onInput);
    editor.addEventListener('click', onAction);
    editor.addEventListener('dragover', (e) => { const dz = e.target.closest('.dropzone'); if (dz) { e.preventDefault(); dz.classList.add('over'); } });
    editor.addEventListener('dragleave', (e) => e.target.closest('.dropzone')?.classList.remove('over'));
    editor.addEventListener('drop', onDrop);
    $('#sideNav').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.view === 'new') return addCharacter();
      view = b.dataset.view; renderNav(); renderEditor(); $('#side').classList.remove('open');
      window.scrollTo(0, 0);
    });
    renderNav(); renderEditor(); updateStatus();
  }

  function renderNav() {
    const item = (v, label) => `<button data-view="${v}" class="${view === v ? 'active' : ''}">${label}</button>`;
    $('#sideNav').innerHTML = `
      ${item('general', '🏠 Forside')}
      ${item('about', '💬 Om meg')}
      <div class="group">Karakterer</div>
      ${data.characters.map((c, i) => item(`char:${i}`, `${esc(c.emoji || '✨')} ${esc(c.name || 'Uten navn')}${c.status === 'hidden' ? ' <span class="muted small">(skjult)</span>' : c.status === 'wip' ? ' <span class="muted small">(WIP)</span>' : ''}`)).join('')}
      <button data-view="new" class="add">＋ Ny karakter</button>
      <div class="group">Annet</div>
      ${item('settings', '⚙️ Innstillinger')}`;
  }

  function updateStatus(msg) {
    const el = $('#status'); if (!el) return;
    el.className = 'status' + (busy ? ' busy' : dirty ? ' dirty' : '');
    $('#statusText').textContent = msg || (busy ? 'Jobber …' : dirty ? 'Ulagrede endringer' : 'Alt er publisert');
    $('#publishBtn').disabled = busy > 0;
  }

  // ---------- Feltbyggere ----------

  const textField = (label, path, attrs = '') => `
    <div class="field"><label>${label}</label><input type="text" data-path="${path}" value="${esc(getPath(path))}" ${attrs}></div>`;

  const langField = (label, path, multiline) => {
    const input = (l) => multiline
      ? `<textarea data-path="${path}.${l}">${esc(getPath(`${path}.${l}`))}</textarea>`
      : `<input type="text" data-path="${path}.${l}" value="${esc(getPath(`${path}.${l}`))}">`;
    return `<div class="field"><label>${label}</label><div class="pair">
      <div><div class="lang">🇳🇴 NORSK</div>${input('no')}</div>
      <div><div class="lang">🇬🇧 ENGLISH</div>${input('en')}</div></div></div>`;
  };

  const imageField = (label, path, hint = '') => {
    const v = getPath(path);
    return `<div class="field"><label>${label}</label>
      <div class="image-field">
        <div class="thumb ${v ? 'has' : ''}" style="${v ? `background-image:url('${esc(imgSrc(v))}')` : ''}">${v ? '' : '🖼️'}</div>
        <div class="row">
          <button type="button" data-act="upload" data-path="${path}">${v ? 'Bytt bilde' : 'Last opp bilde'}</button>
          ${v ? `<button type="button" class="danger" data-act="clear" data-path="${path}">Fjern</button>` : ''}
        </div>
        ${hint ? `<p class="small muted" style="margin:0;flex-basis:100%">${hint}</p>` : ''}
      </div></div>`;
  };

  const factsEditor = (path) => {
    const list = getPath(path);
    return `<div class="field">
      ${list.map((f, i) => `
        <div class="list-item">
          <div><label>Hva (NO / EN)</label><div class="pair">
            <input type="text" data-path="${path}.${i}.label.no" value="${esc(f.label.no)}" placeholder="Favorittmat">
            <input type="text" data-path="${path}.${i}.label.en" value="${esc(f.label.en)}" placeholder="Favourite food"></div></div>
          <div><label>Svar (NO / EN)</label><div class="pair">
            <input type="text" data-path="${path}.${i}.value.no" value="${esc(f.value.no)}">
            <input type="text" data-path="${path}.${i}.value.en" value="${esc(f.value.en)}"></div></div>
          <div class="tools">
            <button class="icon" data-act="move" data-path="${path}" data-i="${i}" data-d="-1" aria-label="Flytt opp" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon" data-act="move" data-path="${path}" data-i="${i}" data-d="1" aria-label="Flytt ned" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="icon danger" data-act="remove" data-path="${path}" data-i="${i}" aria-label="Slett">✕</button>
          </div>
        </div>`).join('')}
      <button data-act="add-fact" data-path="${path}">＋ Legg til fakta</button>
    </div>`;
  };

  // ---------- Sider i admin ----------

  function renderEditor() {
    const ed = $('#editor');
    if (view === 'general') {
      ed.innerHTML = `
        <h2>Forside</h2>
        <div class="card">
          ${langField('Navn på siden', 'site.title')}
          ${langField('Undertittel', 'site.tagline', true)}
          ${langField('Tekst over karakterene', 'site.intro', true)}
          ${imageField('Stort bilde på forsiden', 'site.heroImage', 'Et høyt bilde (stående) passer best.')}
        </div>`;
    } else if (view === 'about') {
      ed.innerHTML = `
        <h2>Om meg</h2>
        <div class="card">
          ${imageField('Bilde', 'about.image')}
          ${langField('Tekst om deg', 'about.text', true)}
        </div>
        <div class="card">
          <h3 style="margin-top:0">Fakta</h3>
          <p class="small muted">Den første (Navn) brukes som overskrift på Om meg-siden.</p>
          ${factsEditor('about.facts')}
        </div>`;
    } else if (view.startsWith('char:')) {
      renderCharacter(+view.slice(5));
    } else if (view === 'settings') {
      ed.innerHTML = `<h2>Innstillinger</h2>${backend.settingsHTML()}`;
      backend.afterSettings?.();
    }
  }

  function renderCharacter(i) {
    const c = data.characters[i];
    if (!c) { view = 'general'; renderNav(); return renderEditor(); }
    const p = `characters.${i}`;
    $('#editor').innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:12px">
        <h2 style="margin:0">${esc(c.emoji)} ${esc(c.name || 'Ny karakter')}</h2>
        <div class="row">
          <button class="icon" data-act="move-char" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} title="Flytt opp i rekkefølgen">↑</button>
          <button class="icon" data-act="move-char" data-i="${i}" data-d="1" ${i === data.characters.length - 1 ? 'disabled' : ''} title="Flytt ned i rekkefølgen">↓</button>
          <a class="btn" href="../#/k/${encodeURIComponent(c.id)}" target="_blank" rel="noopener">Se ↗</a>
        </div>
      </div>

      <div class="card">
        <div class="grid2">
          ${textField('Navn', `${p}.name`)}
          ${textField('Emoji', `${p}.emoji`, 'maxlength="8"')}
          ${textField('Nettadresse-navn (id)', `${p}.id`, 'pattern="[a-z0-9-]+"')}
          <div class="field"><label>Status</label>
            <select data-path="${p}.status">
              <option value="ready" ${c.status === 'ready' ? 'selected' : ''}>Ferdig – vises vanlig</option>
              <option value="wip" ${c.status === 'wip' ? 'selected' : ''}>Under arbeid – vises som silhuett</option>
              <option value="hidden" ${c.status === 'hidden' ? 'selected' : ''}>Skjult – vises ikke</option>
            </select></div>
        </div>
        ${langField('Art', `${p}.species`)}
        ${langField('Kort beskrivelse (på kortet)', `${p}.tagline`)}
        ${langField('Om karakteren', `${p}.bio`, true)}
      </div>

      <div class="card">
        <h3 style="margin-top:0">Bilder</h3>
        <div class="grid2">
          ${imageField('Hovedbilde / referanse', `${p}.image`, 'Helfigur, gjerne med gjennomsiktig bakgrunn.')}
          ${imageField('Kortbilde (valgfritt)', `${p}.avatar`, 'Vises på forsiden. Tomt = hovedbildet brukes.')}
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0">Farger</h3>
        <div class="row" style="margin-bottom:16px">
          <div><label>Hovedfarge på siden</label><input type="color" data-path="${p}.accent" value="${esc(c.accent)}"></div>
          <div><label>Ekstrafarge</label><input type="color" data-path="${p}.accent2" value="${esc(c.accent2)}"></div>
        </div>
        <label>Fargepalett (vises som fargeprøver)</label>
        <div class="swatches">
          ${c.palette.map((col, j) => `
            <div class="swatch-edit">
              <input type="color" data-path="${p}.palette.${j}" value="${esc(col)}">
              <button class="danger" data-act="remove" data-path="${p}.palette" data-i="${j}" aria-label="Fjern farge">✕</button>
            </div>`).join('')}
          <button data-act="add-color" data-path="${p}.palette">＋ Farge</button>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0">Fakta</h3>
        ${factsEditor(`${p}.facts`)}
      </div>

      <div class="card">
        <h3 style="margin-top:0">Galleri</h3>
        <div class="gallery-edit">
          ${c.gallery.map((g, j) => `
            <div class="g-item">
              <div class="img" style="background-image:url('${esc(imgSrc(g.src))}')"></div>
              <div class="body">
                <input type="text" data-path="${p}.gallery.${j}.caption.no" value="${esc(g.caption.no)}" placeholder="Bildetekst (norsk)">
                <input type="text" data-path="${p}.gallery.${j}.caption.en" value="${esc(g.caption.en)}" placeholder="Caption (English)">
                <div class="tools">
                  <div class="row" style="gap:4px">
                    <button class="icon" data-act="move" data-path="${p}.gallery" data-i="${j}" data-d="-1" ${j === 0 ? 'disabled' : ''} aria-label="Flytt til venstre">←</button>
                    <button class="icon" data-act="move" data-path="${p}.gallery" data-i="${j}" data-d="1" ${j === c.gallery.length - 1 ? 'disabled' : ''} aria-label="Flytt til høyre">→</button>
                  </div>
                  <button class="icon danger" data-act="remove" data-path="${p}.gallery" data-i="${j}" aria-label="Fjern bilde">✕</button>
                </div>
              </div>
            </div>`).join('')}
          <div class="dropzone" data-act="add-gallery" data-path="${p}.gallery" tabindex="0" role="button">
            <div><div style="font-size:2rem">＋</div>Klikk eller dra bilder hit</div>
          </div>
        </div>
      </div>

      <div class="card" style="border-color:rgba(194,26,43,.4)">
        <h3 style="margin-top:0">Slett karakter</h3>
        <p class="small muted">Vil du bare skjule karakteren en stund? Bruk «Skjult» under Status i stedet.</p>
        <button class="danger" data-act="delete-char" data-i="${i}">Slett ${esc(c.name || 'karakteren')}</button>
      </div>`;
  }

  // ---------- Hendelser ----------

  function onInput(e) {
    const el = e.target;
    const path = el.dataset.path;
    if (!path) return;
    let value = el.value;
    if (path.endsWith('.id')) {
      value = slug(value);
      if (e.type === 'change') el.value = value;
    }
    if (getPath(path) === value) return;
    setPath(path, value);
    markDirty();
    if (/\.(name|emoji|status)$/.test(path)) {
      renderNav();
      if (view.startsWith('char:') && e.type === 'change') renderEditor();
    }
  }

  async function onAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const { act, path } = btn.dataset;
    const i = +btn.dataset.i;
    const d = +btn.dataset.d;
    const list = path ? getPath(path) : null;
    const refresh = () => { markDirty(); renderNav(); renderEditor(); };

    switch (act) {
      case 'upload': {
        const [file] = await pickFiles(false);
        if (!file) return;
        try {
          setPath(path, await uploadImage(file, imageHint(path)));
          refresh();
        } catch (err) { toast(friendlyError(err), true); }
        break;
      }
      case 'clear': setPath(path, ''); refresh(); break;
      case 'add-fact': list.push({ label: { no: '', en: '' }, value: { no: '', en: '' } }); refresh(); break;
      case 'add-color': list.push('#ffffff'); refresh(); break;
      case 'remove':
        if (path.endsWith('.gallery') && !confirm('Fjerne bildet fra galleriet?')) return;
        list.splice(i, 1); refresh(); break;
      case 'move': {
        const j = i + d;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]]; refresh(); break;
      }
      case 'move-char': {
        const j = i + d;
        const chars = data.characters;
        [chars[i], chars[j]] = [chars[j], chars[i]];
        view = `char:${j}`; refresh(); break;
      }
      case 'add-gallery': {
        const files = await pickFiles(true);
        await addToGallery(path, files);
        break;
      }
      case 'delete-char': {
        const c = data.characters[i];
        if (!confirm(`Slette ${c.name || 'karakteren'} for godt? (Du kan fortsatt hente den tilbake fra GitHub-historikken.)`)) return;
        data.characters.splice(i, 1);
        view = 'general'; refresh(); break;
      }
      case 'disconnect':
        if (dirty && !confirm('Du har ulagrede endringer. Logge ut likevel?')) return;
        dirty = false; data = null; backend.logout(); break;
    }
  }

  function imageHint(path) {
    const m = path.match(/^characters\.(\d+)/);
    return m ? data.characters[+m[1]].id || 'karakter' : path.split('.')[0];
  }

  async function addToGallery(path, files) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    const list = getPath(path);
    let done = 0;
    for (const file of images) {
      try {
        const src = await uploadImage(file, imageHint(path));
        list.push({ src, caption: { no: '', en: '' } });
        done++;
        markDirty(); renderEditor();
      } catch (err) { toast(friendlyError(err), true); }
    }
    if (done) toast(`${done} bilde${done > 1 ? 'r' : ''} lastet opp. Husk å trykke Publiser!`);
  }

  function onDrop(e) {
    const dz = e.target.closest('.dropzone');
    if (!dz) return;
    e.preventDefault();
    dz.classList.remove('over');
    addToGallery(dz.dataset.path, [...e.dataTransfer.files]);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList?.contains('dropzone')) e.target.click();
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && data) { e.preventDefault(); publish(); }
  });

  function addCharacter() {
    const n = data.characters.length + 1;
    data.characters.push({
      id: `karakter-${n}`, name: 'Ny karakter', emoji: '✨', status: 'hidden',
      species: { no: '', en: '' }, tagline: { no: '', en: '' }, bio: { no: '', en: '' },
      image: '', avatar: '', accent: '#7a44c9', accent2: '#c21a2b', palette: [], facts: [], gallery: [],
    });
    view = `char:${data.characters.length - 1}`;
    markDirty(); renderNav(); renderEditor();
    toast('Ny karakter lagt til som «Skjult» – bytt status når den er klar.');
  }

  // ---------- Publisering ----------

  function validate() {
    const ids = new Set();
    for (const c of data.characters) {
      if (!c.name.trim()) return 'En karakter mangler navn.';
      if (!c.id) return `${c.name} mangler nettadresse-navn (id).`;
      if (ids.has(c.id)) return `To karakterer har samme id: «${c.id}». Gi dem forskjellige.`;
      ids.add(c.id);
    }
    return null;
  }

  async function publish() {
    if (busy) return;
    const problem = validate();
    if (problem) return toast(problem, true);
    busy++; updateStatus('Publiserer …');
    try {
      await backend.save(data);
      dirty = false;
      toast(backend.publishedMsg);
    } catch (err) {
      toast(friendlyError(err), true);
    } finally {
      busy--; updateStatus();
    }
  }

  window.addEventListener('beforeunload', (e) => {
    if (dirty || busy) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- Toast ----------

  let toastTimer;
  function toast(msg, isErr) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), isErr ? 6000 : 3500);
  }

  // ---------- Start ----------

  backend.start();
})();
