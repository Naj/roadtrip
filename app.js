/* =====================================================================
   ROADTRIP — application
   Deux modes :
   - réel  : config.js rempli (Supabase + VAPID) → données partagées, notifications
   - démo  : config.js vide, ou adresse terminée par #demo → données d'exemple en mémoire
   ===================================================================== */
(() => {
  'use strict';

  const CFG = Object.assign(
    { TRAVELER_NAME: 'Le voyageur', TRIP_START: null, TRIP_DAYS: 183, REFERENTS: [] },
    window.OSCC_CONFIG || {}
  );
  const DEMO = !!window.OSCC_FORCE_DEMO || !CFG.SUPABASE_URL || location.hash === '#demo' || !window.supabase;

  // ---------------------------------------------------------------------
  // Référentiels
  // ---------------------------------------------------------------------
  const POKES = [
    { id: 'pense',   emo: '💭', label: 'Je pense à toi',       verb: 'pense à toi' },
    { id: 'cafe',    emo: '☕', label: 'Café',                 verb: "t'offre un café" },
    { id: 'calin',   emo: '🤗', label: 'Câlin',                verb: "t'envoie un câlin" },
    { id: 'courage', emo: '💪', label: 'Courage',              verb: "t'envoie du courage" },
    { id: 'bureau',  emo: '😂', label: 'Tu manques au bureau', verb: 'dit que tu manques au bureau' },
  ];
  const POKE = Object.fromEntries(POKES.map((p) => [p.id, p]));

  // Numéros d'urgence — à revérifier avant le départ sur diplomatie.gouv.fr (Conseils aux voyageurs)
  const COUNTRIES = {
    TH: { name: 'Thaïlande',    tz: 'Asia/Bangkok',      nums: [['Police touristique', '1155'], ['Police', '191'], ['Ambulance', '1669']] },
    LA: { name: 'Laos',         tz: 'Asia/Vientiane',    nums: [['Police', '191'], ['Pompiers', '190'], ['Ambulance', '195']] },
    VN: { name: 'Vietnam',      tz: 'Asia/Ho_Chi_Minh',  nums: [['Police', '113'], ['Pompiers', '114'], ['Ambulance', '115']] },
    KH: { name: 'Cambodge',     tz: 'Asia/Phnom_Penh',   nums: [['Police', '117'], ['Pompiers', '118'], ['Ambulance', '119']] },
    MY: { name: 'Malaisie',     tz: 'Asia/Kuala_Lumpur', nums: [['Urgences', '999'], ['Urgences depuis un mobile', '112']] },
    SG: { name: 'Singapour',    tz: 'Asia/Singapore',    nums: [['Police', '999'], ['Ambulance et pompiers', '995']] },
    ID: { name: 'Indonésie',    tz: 'Asia/Jakarta',      nums: [['Urgences', '112'], ['Police', '110'], ['Ambulance', '118']] },
    PH: { name: 'Philippines',  tz: 'Asia/Manila',       nums: [['Urgences', '911']] },
    CN: { name: 'Chine',        tz: 'Asia/Shanghai',     nums: [['Police', '110'], ['Pompiers', '119'], ['Ambulance', '120']] },
    JP: { name: 'Japon',        tz: 'Asia/Tokyo',        nums: [['Police', '110'], ['Ambulance et pompiers', '119']] },
    KR: { name: 'Corée du Sud', tz: 'Asia/Seoul',        nums: [['Police', '112'], ['Ambulance et pompiers', '119']] },
    IN: { name: 'Inde',         tz: 'Asia/Kolkata',      nums: [['Urgences', '112']] },
    NP: { name: 'Népal',        tz: 'Asia/Kathmandu',    nums: [['Police', '100'], ['Ambulance', '102'], ['Police touristique', '1144']] },
    LK: { name: 'Sri Lanka',    tz: 'Asia/Colombo',      nums: [['Police', '119'], ['Ambulance', '1990']] },
  };
  const CRISIS = { label: 'Centre de crise et de soutien (France)', num: '+33 1 53 59 11 00' };

  // ---------------------------------------------------------------------
  // Icônes
  // ---------------------------------------------------------------------
  const I = {
    fil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="M12 8v5M12 16.5v.5"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 20 4l-6 16-3-7z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };
  const LOGO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2F66"/><stop offset=".55" stop-color="#C9466A"/><stop offset="1" stop-color="#F29A4A"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#s)"/><circle cx="256" cy="228" r="92" fill="#F8C35E"/><path d="M0 330C40 300 62 228 92 236c26 7 30 64 58 66 22 2 28-52 56-50 26 2 30 60 62 60s42-98 76-94 38 82 68 82 40-50 64-46 30 36 36 46v212H0z" fill="#2F8F7E"/><path d="M0 372c52-20 90-72 126-64 34 8 44 52 88 52 48 0 76-30 116-26 50 6 90 42 182 26v152H0z" fill="#1B5E57"/><path d="M256 330c6 30 44 42 44 70 0 36-90 44-104 112h120c10-60 52-80 36-120-12-30-76-40-84-62z" fill="#F7E7C6"/></svg>')}`;

  // ---------------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------------
  const CLOCK = { shift: 0 }; // décalage d'horloge, utilisé par la démo pour simuler le 1er du mois
  const nowMs = () => Date.now() + CLOCK.shift;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
  };
  const fmtTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  function ago(d) {
    const s = (nowMs() - new Date(d)) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    const days = Math.floor(s / 86400);
    return days === 1 ? 'hier' : `il y a ${days} jours`;
  }
  function dayLabel(d) {
    const date = new Date(d); const today = new Date();
    const y = new Date(); y.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (date.toDateString() === y.toDateString()) return 'Hier';
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  const coordTxt = (lat, lng) => `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'O'}`;
  const mapUrl = (lat, lng) => `https://www.google.com/maps?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
  function localTime(country) {
    const c = COUNTRIES[country]; if (!c) return null;
    try {
      const parts = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: c.tz }).formatToParts(new Date());
      const h = +parts.find((p) => p.type === 'hour').value;
      const m = parts.find((p) => p.type === 'minute').value;
      return { text: `${String(h).padStart(2, '0')}:${m}`, hour: h };
    } catch { return null; }
  }
  function getPosition(timeout = 10000) {
    return new Promise((resolve) => {
      try {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout, maximumAge: 60000 }
        );
      } catch { resolve(null); }
    });
  }
  async function getBattery() {
    try { const b = await navigator.getBattery(); return Math.round(b.level * 100); } catch { return null; }
  }
  async function compress(file, max = 1600, quality = 0.8) {
    let img;
    try { img = await createImageBitmap(file); } catch {
      img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    }
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
  }
  function b64ToU8(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  let toastTimer;
  function toast(text) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }
  async function copyText(text, fallbackEl) {
    try { await navigator.clipboard.writeText(text); toast('Texte copié'); }
    catch {
      if (fallbackEl) { const r = document.createRange(); r.selectNodeContents(fallbackEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      toast('Sélectionne le texte et copie-le');
    }
  }

  // ---------------------------------------------------------------------
  // Données : mode démo (en mémoire)
  // ---------------------------------------------------------------------
  function demoPhoto(palette, caption) {
    const c = document.createElement('canvas'); c.width = 800; c.height = 560;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 560);
    sky.addColorStop(0, palette[0]); sky.addColorStop(0.6, palette[1]); sky.addColorStop(1, palette[2]);
    g.fillStyle = sky; g.fillRect(0, 0, 800, 560);
    g.fillStyle = palette[3]; g.beginPath(); g.arc(520, 250, 70, 0, Math.PI * 2); g.fill();
    const ridge = (base, amp, color, seed) => {
      g.fillStyle = color; g.beginPath(); g.moveTo(0, 560);
      for (let x = 0; x <= 800; x += 20) g.lineTo(x, base - Math.abs(Math.sin(x / 60 + seed)) * amp - Math.sin(x / 23 + seed) * 12);
      g.lineTo(800, 560); g.closePath(); g.fill();
    };
    ridge(380, 120, palette[4], 1); ridge(440, 70, palette[5], 3);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 470, 800, 90);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '600 22px system-ui, sans-serif'; g.fillText(caption, 24, 530);
    return c.toDataURL('image/jpeg', 0.82);
  }

  function DemoStore() {
    const now = nowMs(), H = 3600e3;
    const travelerName = CFG.TRAVELER_NAME || 'Antoine';
    const crew = ['Sophie', 'Karim', 'Julie', 'Marc', 'Inès', 'Thomas', 'Léa', 'Yanis', 'Camille', 'Hugo', 'Sarah', 'Nicolas', 'Emma', 'Mehdi', 'Laura', 'Romain', 'Chloé', 'Paul'];
    const members = [
      { id: 'u-me', name: 'Toi', role: 'groupe', is_admin: true },
      { id: 'u-trav', name: travelerName, role: 'voyageur' },
      ...crew.map((n, i) => ({ id: `u-${i}`, name: n, role: 'groupe' })),
    ];
    const by = (id) => members.find((m) => m.id === id);
    // Dates d'exemple calées sur les mois réels : le mois dernier est déjà ouvert, le mois en cours est sous enveloppe
    const nd = new Date(now), Y = nd.getUTCFullYear(), M = nd.getUTCMonth();
    const monthStart = Date.UTC(Y, M, 1);
    const prev = (day, hour = 10) => Date.UTC(Y, M - 1, day, hour);
    const cur = (f) => Math.round(monthStart + f * (now - monthStart));
    const recent = (h, f) => Math.max(now - h * H, cur(f));
    let seq = 0;
    const mk = (author_id, ts, fields) => ({ id: `d${++seq}`, author_id, created_at: new Date(ts).toISOString(), kind: 'texte', body: null, poke: null, photo_url: null, reply_to: null, lat: null, lng: null, accuracy: null, battery: null, country: null, ...fields });
    const P = {
      thai: demoPhoto(['#22285A', '#B5487A', '#F2A65A', '#FFD38A', '#3B2E5A', '#21183A'], 'Marché de nuit, Bangkok'),
      mekong: demoPhoto(['#F6C77A', '#F3986B', '#C9667A', '#FFF0C2', '#5B8F7E', '#2E5E58'], 'Lever de soleil sur le Mékong'),
      plante: demoPhoto(['#CFE8D8', '#E6F2E8', '#F7F4EA', '#FFF3C4', '#6BAA7E', '#3F7A55'], 'Ta plante verte, en pleine forme'),
      pot: demoPhoto(['#3A2E5C', '#6E4A8E', '#E58F65', '#FFE1A8', '#8C5A7E', '#4A2F4E'], 'Le pot de rentrée'),
      team: demoPhoto(['#9DD3E8', '#CDE9F2', '#F5F1E6', '#FFE9A8', '#7DB59B', '#4E8C74'], "Photo d'équipe du vendredi"),
      halong: demoPhoto(['#5A86B5', '#9CC2D8', '#D9EAEF', '#FFFFFF', '#2F7A6E', '#1E5650'], "Baie d'Ha Long"),
    };
    const T = 'u-trav';
    const prevName = new Date(prev(10)).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
    const msgs = [];
    const add = (...a) => { const m = mk(...a); msgs.push(m); return m; };
    // Le mois dernier (courrier déjà ouvert le 1er)
    add(T, prev(5, 12), { kind: 'checkin', body: 'Bangkok', country: 'TH', lat: 13.7563, lng: 100.5018, accuracy: 18, battery: 92 });
    add(T, prev(5, 14), { kind: 'photo', body: 'Premier pad thaï au marché de nuit, je valide.', photo_url: P.thai });
    add('u-0', prev(6, 8), { body: 'Bon voyage Antoine ! Le bureau est déjà beaucoup trop calme sans toi.' });
    add('u-1', prev(6, 9), { kind: 'poke', poke: 'cafe' });
    add('u-2', prev(9, 16), { kind: 'photo', body: 'On arrose ta plante tous les lundis. Elle te passe le bonjour.', photo_url: P.plante });
    add('u-3', prev(12, 11), { body: 'Tu nous dois une carte postale de chaque pays. Une vraie, avec un timbre !' });
    add(T, prev(13, 9), { kind: 'checkin', body: 'Chiang Mai', country: 'TH', lat: 18.7883, lng: 98.9853, accuracy: 22, battery: 71 });
    add('u-4', prev(15, 18), { kind: 'poke', poke: 'calin' });
    add('u-6', prev(18, 10), { kind: 'poke', poke: 'courage' });
    add(T, prev(22, 7), { kind: 'checkin', body: 'Luang Prabang', country: 'LA', lat: 19.8856, lng: 102.1347, accuracy: 30, battery: 64 });
    const mekong = add(T, prev(22, 8), { kind: 'photo', body: 'Lever de soleil sur le Mékong. 5 h du matin, ça valait le coup.', photo_url: P.mekong });
    add('u-5', prev(23, 9), { body: "Ce lever de soleil… Je l'ai mis en fond d'écran, toute l'équipe est jalouse.", reply_to: mekong.id });
    add('u-7', prev(25, 15), { kind: 'poke', poke: 'bureau' });
    add('u-8', prev(26, 9), { kind: 'poke', poke: 'cafe' });
    add('u-9', prev(27, 17), { kind: 'photo', body: 'Le pot de rentrée, version sans toi. On a gardé ta chaise.', photo_url: P.pot });
    const firstMonth = add('u-0', prev(28, 18), { body: 'Premier mois bouclé ! Profite de chaque jour, on a hâte de lire la suite.' });
    // Le mois en cours (sous enveloppe pour Antoine)
    add(T, cur(0.04), { body: `Je viens d'ouvrir le courrier de ${prevName}. J'ai eu les larmes aux yeux, merci à tous 🙏`, reply_to: firstMonth.id });
    add(T, cur(0.25), { kind: 'checkin', body: 'Hanoï', country: 'VN', lat: 21.0278, lng: 105.8342, accuracy: 15, battery: 80 });
    add('u-1', cur(0.35), { body: 'On a gagné le challenge du trimestre ! On te garde ta part de gâteau 🎂' });
    add('u-2', cur(0.45), { kind: 'poke', poke: 'calin' });
    add('u-10', cur(0.55), { body: 'Le distributeur de café du 2e est enfin réparé. On a pensé à toi au premier expresso.' });
    add('u-0', cur(0.65), { kind: 'photo', body: "La photo d'équipe de vendredi. Tu étais là en carton 😄", photo_url: P.team });
    add('u-5', cur(0.75), { kind: 'poke', poke: 'bureau' });
    add('u-12', cur(0.8), { kind: 'poke', poke: 'courage' });
    add(T, recent(5, 0.85), { kind: 'checkin', body: "Baie d'Ha Long", country: 'VN', lat: 20.9101, lng: 107.1839, accuracy: 25, battery: 58 });
    const halong = add(T, recent(4.8, 0.86), { kind: 'photo', body: 'Nuit sur un bateau au milieu des pitons. Irréel.', photo_url: P.halong });
    add('u-13', recent(1, 0.95), { body: 'Ha Long, sérieusement ? Garde-moi une place sur le bateau.', reply_to: halong.id });
    add('u-3', recent(0.5, 0.97), { kind: 'poke', poke: 'cafe' });
    msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const decorate = (m) => ({ ...m, author_name: by(m.author_id)?.name ?? '?', author_role: by(m.author_id)?.role ?? 'groupe' });

    const listeners = new Set();
    let role = store.get('oscc-demo-role') || 'groupe';
    const meFor = (r) => (r === 'voyageur' ? by('u-trav') : by('u-me'));
    let pushOn = false;
    const removed = new Map();
    const codes = { groupe: 'GRP-7F3A91C2', voyageur: 'VOY-4B8E2D10', admin: 'ADM-9C61F5A7' };

    return {
      demo: true,
      tripStart: new Date(prev(5)).toISOString().slice(0, 10),
      get me() { return meFor(role); },
      setRole(r) { role = r; store.set('oscc-demo-role', r); },
      async init() { return meFor(role); },
      isRemoved: (id) => removed.has(id),
      async members() { return members.filter((m) => !removed.has(m.id)); },
      async list() { return msgs.map(decorate); },
      onMessage(cb) { listeners.add(cb); },
      async send(fields) {
        const me = meFor(role);
        let photo_url = null;
        if (fields.file) {
          const blob = await compress(fields.file);
          photo_url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
        }
        const { file, ...rest } = fields;
        const m = { ...mk(me.id, nowMs(), rest), photo_url };
        msgs.push(m);
        const d = decorate(m);
        listeners.forEach((cb) => cb(d));
        return d;
      },
      pushStatus: async () => (pushOn ? 'on' : 'off'),
      async enablePush() { pushOn = true; },
      async sealedSummary() { return null; },
      async join(code) { role = /^VOY/i.test(String(code).trim()) ? 'voyageur' : 'groupe'; store.set('oscc-demo-role', role); return meFor(role); },
      async signOut() { pushOn = false; },
      async adminStatus() {
        const ago2 = new Date(nowMs() - 2 * 3600e3).toISOString();
        return {
          st: { schema: true, bucket: true, realtime: true, webhook: true, pg_cron: true, pg_net: true, cron_job: null, cron_last: null,
            traveler: !removed.has('u-trav'), members: members.length - removed.size, devices: 14 + (pushOn ? 1 : 0),
            events: { webhook: { at: ago2, ok: true, detail: 'Message reçu' } } },
          ping: { ok: true, vapid: true, vapidMatch: true, secret: true },
        };
      },
      async adminMembers() {
        return members.map((m, i) => ({ ...m, is_admin: !!m.is_admin, created_at: new Date(Date.UTC(2026, 9, 2 + (i % 9), 9)).toISOString(),
          removed_at: removed.get(m.id) || null, devices: m.id === 'u-me' ? (pushOn ? 1 : 0) : removed.has(m.id) ? 0 : i % 4 === 0 ? 0 : 1 }));
      },
      async adminRemove(id) { removed.set(id, new Date(nowMs()).toISOString()); },
      async adminRestore(id) { removed.delete(id); },
      async adminCodes() { return Object.entries(codes).map(([role, code]) => ({ role, code })); },
      async adminRegenerate(r) { codes[r] = `${{ groupe: 'GRP', voyageur: 'VOY', admin: 'ADM' }[r]}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`; return codes[r]; },
      async adminReset() { /* démo : rien n'est effacé */ },
      async adminTestPush() { return pushOn ? { sent: 1, total: 1 } : { sent: 0, total: 0 }; },
    };
  }

  // ---------------------------------------------------------------------
  // Données : mode réel (Supabase)
  // ---------------------------------------------------------------------
  // Traduit l'erreur de connexion de Supabase en consigne claire
  function explainAuthError(error) {
    const msg = String(error?.message || '');
    const status = error?.status;
    if (/anonymous sign-ins are disabled/i.test(msg)) return "Connexions anonymes désactivées : active « Allow anonymous sign-ins » dans Authentication > Sign In / Providers, puis clique sur Save changes en bas de la page.";
    if (/captcha/i.test(msg)) return "La protection captcha bloque la connexion : désactive-la dans Authentication > Attack Protection.";
    if (status === 429 || /rate limit|too many/i.test(msg)) return "Trop de tentatives de connexion pour l'instant. Attends une heure, ou augmente la limite dans Authentication > Rate Limits.";
    if (status === 401 || /invalid api key|jwt|apikey/i.test(msg)) return "La clé SUPABASE_ANON_KEY de config.js est refusée. Recopie la clé « anon public » (elle commence par eyJ) depuis Project Settings > API.";
    if (!status || /failed to fetch|network|load failed/i.test(msg)) return "Impossible de joindre Supabase. Vérifie SUPABASE_URL dans config.js et que le projet n'est pas en pause.";
    return `Connexion impossible (${status || '?'}) : ${msg}`;
  }

  function SupaStore() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const SELECT = '*, author:members(name, role)';
    let me = null;
    const listeners = new Set();
    const signed = new Map();

    async function withPhotos(rows) {
      const paths = rows.filter((r) => r.photo_path && !signed.has(r.photo_path)).map((r) => r.photo_path);
      if (paths.length) {
        const { data } = await sb.storage.from('photos').createSignedUrls(paths, 60 * 60 * 24);
        (data || []).forEach((d) => d.signedUrl && signed.set(d.path, d.signedUrl));
      }
      return rows.map((r) => ({ ...r, photo_url: r.photo_path ? signed.get(r.photo_path) ?? null : null, author_name: r.author?.name ?? '?', author_role: r.author?.role ?? 'groupe' }));
    }

    return {
      demo: false,
      tripStart: CFG.TRIP_START,
      get me() { return me; },
      async init() {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;
        const { data } = await sb.from('members').select('id, name, role, is_admin, removed_at').eq('id', session.user.id).maybeSingle();
        me = data && !data.removed_at ? data : null;
        return me;
      },
      async join(code, name) {
        const { data: { session } } = await sb.auth.getSession();
        if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(CFG.SUPABASE_URL)) {
          throw new Error("SUPABASE_URL est mal écrite dans config.js. Format attendu : https://xxxx.supabase.co (sans / à la fin).");
        }
        if (!session) {
          const { error } = await sb.auth.signInAnonymously();
          if (error) throw new Error(explainAuthError(error));
        }
        const { error } = await sb.rpc('join_group', { p_code: code, p_name: name });
        if (error) throw new Error(/function|schema cache/i.test(error.message)
          ? "La base n'est pas prête : exécute supabase/schema.sql dans le SQL Editor."
          : error.message);
        return this.init();
      },
      async members() {
        const { data } = await sb.from('members').select('id, name, role, removed_at');
        return (data || []).filter((m) => !m.removed_at);
      },
      async list() {
        const { data, error } = await sb.from('messages').select(SELECT).order('created_at', { ascending: false }).limit(400);
        if (error) throw error;
        return withPhotos((data || []).reverse());
      },
      onMessage(cb) {
        listeners.add(cb);
        if (listeners.size > 1) return;
        sb.channel('messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async ({ new: row }) => {
            const { data } = await sb.from('messages').select(SELECT).eq('id', row.id).single();
            if (!data) return;
            const [m] = await withPhotos([data]);
            listeners.forEach((fn) => fn(m));
          })
          .subscribe();
      },
      async send(fields) {
        const { file, ...rest } = fields;
        if (file) {
          const blob = await compress(file);
          const path = `${me.id}/${crypto.randomUUID()}.jpg`;
          const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
          if (error) throw new Error("La photo n'a pas pu être envoyée.");
          rest.photo_path = path;
        }
        const { data, error } = await sb.from('messages').insert({ ...rest, author_id: me.id }).select(SELECT).single();
        if (error) throw new Error(error.message);
        const [m] = await withPhotos([data]);
        return m;
      },
      async pushStatus() {
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
        if (Notification.permission === 'denied') return 'denied';
        if (Notification.permission !== 'granted') return 'off';
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg && (await reg.pushManager.getSubscription());
        return sub ? 'on' : 'off';
      },
      async enablePush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Ce navigateur ne gère pas les notifications. Utilise Chrome.');
        if (!CFG.VAPID_PUBLIC_KEY) throw new Error('Clé VAPID manquante dans config.js.');
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') throw new Error('Notifications refusées. Autorise-les dans les réglages du site.');
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(CFG.VAPID_PUBLIC_KEY) });
        const j = sub.toJSON();
        const { error } = await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, member_id: me.id }, { onConflict: 'endpoint' });
        if (error) throw new Error("L'abonnement n'a pas pu être enregistré.");
      },
      // Pour le voyageur : nombre de messages encore sous enveloppe (sans leur contenu)
      async signOut() {
        try {
          const reg = await navigator.serviceWorker?.getRegistration();
          const sub = reg && (await reg.pushManager.getSubscription());
          if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
        } catch { /* on continue la déconnexion */ }
        await sb.auth.signOut();
        me = null;
      },
      async adminStatus() {
        const [st, ping] = await Promise.all([
          sb.rpc('admin_status'),
          sb.functions.invoke('send-push', { body: { type: 'PING', vapidPublic: CFG.VAPID_PUBLIC_KEY } }).catch((error) => ({ error })),
        ]);
        let pingErr = null, pingDetail = '';
        if (ping.error) {
          const status = ping.error.context?.status;
          try { pingDetail = String(await ping.error.context?.text?.() || '').slice(0, 160); } catch { /* corps illisible */ }
          pingErr = status === 401 || /Accès refusé/.test(pingDetail) ? 'old'
            : status === 404 ? 'missing'
            : status ? `http-${status}` : 'blocked';
        }
        return { st: st.data, stErr: st.error?.message, ping: ping.data, pingErr, pingDetail };
      },
      async adminMembers() { const { data, error } = await sb.rpc('admin_members'); if (error) throw error; return data; },
      async adminRemove(id) { const { error } = await sb.rpc('admin_remove_member', { p_id: id }); if (error) throw error; },
      async adminRestore(id) { const { error } = await sb.rpc('admin_restore_member', { p_id: id }); if (error) throw error; },
      async adminCodes() { const { data, error } = await sb.rpc('admin_codes'); if (error) throw error; return data; },
      async adminRegenerate(r) { const { data, error } = await sb.rpc('admin_regenerate_code', { p_role: r }); if (error) throw error; return data; },
      async adminTestPush() {
        const { data, error } = await sb.functions.invoke('send-push', { body: { type: 'TEST_PUSH' } });
        if (error) throw new Error('La fonction send-push n\'a pas répondu : consulte l\'état de l\'installation.');
        return data;
      },
      async adminReset(confirm) {
        // Photos d'abord (un dossier par membre), puis les données
        const bucket = sb.storage.from('photos');
        const { data: folders } = await bucket.list('', { limit: 1000 });
        for (const f of folders || []) {
          const { data: files } = await bucket.list(f.name, { limit: 1000 });
          const paths = (files || []).map((x) => `${f.name}/${x.name}`);
          if (paths.length) await bucket.remove(paths);
        }
        const { error } = await sb.rpc('admin_reset', { p_confirm: confirm });
        if (error) throw error;
      },
      async sealedSummary() {
        if (me?.role !== 'voyageur') return null;
        const { data } = await sb.rpc('sealed_summary');
        const r = data?.[0];
        return r ? { texts: r.texts, photos: r.photos, pokes: r.pokes, total: r.texts + r.photos + r.pokes, senders: r.senders } : null;
      },
    };
  }

  // ---------------------------------------------------------------------
  // État
  // ---------------------------------------------------------------------
  const db = DEMO ? DemoStore() : SupaStore();
  const S = {
    me: null, members: [], messages: [], tab: 'pays', adm: { loading: false, checks: null, members: [], codes: [], ask: null }, expanded: null, writeOpen: false, replyTo: null, draft: '',
    country: store.get('oscc-country') || '', push: 'off', sos: { phase: 'idle' }, installEvt: null,
  };
  const isTraveler = () => S.me?.role === 'voyageur';
  const traveler = () => S.members.find((m) => m.role === 'voyageur') || { id: null, name: CFG.TRAVELER_NAME };
  const travelerName = () => traveler().name || CFG.TRAVELER_NAME;
  const travelerMsgs = () => S.messages.filter((m) => m.author_role === 'voyageur');
  const lastTravelerMsg = () => travelerMsgs().at(-1);
  const currentCountry = () => {
    const withC = travelerMsgs().filter((m) => m.country);
    return withC.at(-1)?.country || (isTraveler() ? S.country : '') || '';
  };
  const lastPlace = () => travelerMsgs().filter((m) => m.kind === 'checkin' && m.body).at(-1)?.body;
  function activeSos() {
    const t = travelerMsgs();
    const sosIdx = t.map((m) => m.kind).lastIndexOf('sos');
    if (sosIdx < 0) return null;
    const sos = t[sosIdx];
    const cleared = t.slice(sosIdx + 1).some((m) => m.kind === 'checkin' || m.reply_to === sos.id);
    if (cleared || nowMs() - new Date(sos.created_at) > 72 * 3600e3) return null;
    const helpers = S.messages.filter((m) => m.reply_to === sos.id && m.author_role === 'groupe').map((m) => m.author_name);
    return { sos, helpers: [...new Set(helpers)] };
  }
  function tripDay() {
    const start = db.tripStart ? new Date(db.tripStart) : null;
    if (!start || isNaN(start)) return null;
    const d = Math.floor((nowMs() - start) / 86400e3);
    return { d, total: CFG.TRIP_DAYS || 183 };
  }

  // ---------------------------------------------------------------------
  // Rendu : bandeau
  // ---------------------------------------------------------------------
  const app = $('#app');
  app.innerHTML = '<header id="hdr"></header><div id="bnr"></div><main id="main"></main><footer id="ftr"></footer>';

  function renderHeader() {
    const name = travelerName();
    const last = lastTravelerMsg();
    const place = lastPlace();
    const country = COUNTRIES[currentCountry()];
    const lt = localTime(currentCountry());
    const td = tripDay();
    const where = place ? `${esc(place)}${country ? `, ${country.name}` : ''}` : country ? country.name : '';
    const news = isTraveler()
      ? (where ? `En ce moment : ${where}` : 'Bon voyage !')
      : (where ? `Dernière étape partagée : ${where}` : last ? 'En voyage' : 'Pas encore parti');
    let dayLine = '';
    if (td) {
      dayLine = td.d < 0 ? `Départ dans ${-td.d} jour${-td.d > 1 ? 's' : ''}` : `J+${td.d} / ${td.total}`;
      if (lt) dayLine += ` · ${isTraveler() ? 'heure locale' : 'chez lui'} ${lt.text}`;
    }
    const pct = td ? Math.max(0, Math.min(100, (td.d / td.total) * 100)) : 0;
    $('#hdr').innerHTML = `
      <div class="sky">
        <div class="brand">
          <img src="${LOGO}" alt="" width="30" height="30">
          <h1>ROADTRIP<small>${DEMO ? 'Mode démo' : isTraveler() ? 'Espace voyageur' : `${S.members.length || ''} membres`}</small></h1>
          ${DEMO ? `<div class="pill-switch" role="group" aria-label="Voir l'appli en tant que">
            <button type="button" data-role="groupe" aria-pressed="${!isTraveler()}">Groupe</button>
            <button type="button" data-role="voyageur" aria-pressed="${isTraveler()}">Voyageur</button></div>` : ''}
        </div>
        <div class="traveler">
          <div class="avatar" aria-hidden="true">${esc((name || '?').charAt(0).toUpperCase())}</div>
          <div class="traveler-meta">
            <strong>${esc(name)}</strong>
            <span>${news}</span>
            ${dayLine ? `<span class="day-count">${dayLine}</span><div class="trip-bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></div>` : ''}
          </div>
        </div>
      </div>`;
  }

  function renderBanners() {
    const out = [];
    if (DEMO) out.push(`<p class="banner demo">Démo : données d'exemple, rien n'est envoyé. Bascule Groupe / Voyageur en haut.</p>`);
    const act = activeSos();
    if (act && !isTraveler()) {
      const help = act.helpers.length ? ` · ${esc(act.helpers.join(', '))} s'en occupe` : ' · personne ne s\'en occupe encore';
      out.push(`<p class="banner sos" role="alert">🚨 SOS de ${esc(travelerName())} ${ago(act.sos.created_at)}${help}<button type="button" data-goto="${act.sos.id}">Voir</button></p>`);
    }
    if (!isTraveler() && S.push !== 'on' && S.push !== 'unsupported') {
      const txt = S.push === 'denied'
        ? 'Notifications bloquées : autorise-les dans les réglages du site, puis recharge.'
        : 'Sois prévenu en cas d\'alerte SOS.';
      out.push(`<p class="banner warn"><span>${txt}</span>${S.push === 'denied' ? '' : '<button type="button" class="btn small jade" data-act="push">Activer les notifications</button>'}</p>`);
    }
    $('#bnr').innerHTML = out.join('');
  }

  // ---------------------------------------------------------------------
  // Rendu : fil
  // ---------------------------------------------------------------------
  function msgHtml(m) {
    const mine = m.author_id === S.me?.id;
    const t = fmtTime(m.created_at);
    if (m.kind === 'poke') {
      const p = POKE[m.poke] || POKE.pense;
      const who = mine ? 'Tu' : esc(m.author_name);
      const text = isTraveler() ? `<b>${who}</b> ${p.verb}` : `<b>${who}</b> → ${esc(travelerName())} : ${p.label.toLowerCase()}`;
      return `<div class="poke-line" id="m-${m.id}"><span class="emo" aria-hidden="true">${p.emo}</span><span>${text}</span><time>${t}</time>${sealTag(m, true)}</div>`;
    }
    if (m.kind === 'checkin') {
      const c = COUNTRIES[m.country];
      const place = m.body || c?.name || 'Position partagée';
      const meta = [fmtDate(m.created_at).toUpperCase() + ' · ' + t, m.lat != null ? coordTxt(m.lat, m.lng) : null].filter(Boolean).join('<br>');
      return `<div class="stamp" id="m-${m.id}">
        <span class="st-top">${esc(m.author_name)} va bien</span>
        <span class="st-place">${esc(place)}${c && m.body ? ` · ${c.name}` : ''}</span>
        <span class="st-meta">${meta}</span></div>`;
    }
    if (m.kind === 'sos') {
      const helpers = S.messages.filter((x) => x.reply_to === m.id && x.author_role === 'groupe').map((x) => x.author_name);
      const actions = isTraveler()
        ? `<button type="button" class="btn small" data-act="false-alarm" data-id="${m.id}">Fausse alerte, tout va bien</button>`
        : `<button type="button" class="btn small jade" data-act="take" data-id="${m.id}">Je m'en occupe</button><button type="button" class="btn small" data-tab="urgence">Numéros d'urgence</button>`;
      return `<div class="sos-card" id="m-${m.id}" role="group" aria-label="Alerte SOS">
        <h3>🚨 SOS de ${esc(m.author_name)}</h3>
        <span>${dayLabel(m.created_at)} à ${t}${m.battery != null ? ` · batterie ${m.battery} %` : ''}</span>
        ${m.lat != null
          ? `<span class="coords">${coordTxt(m.lat, m.lng)} (± ${Math.round(m.accuracy || 0)} m)</span><a href="${mapUrl(m.lat, m.lng)}" target="_blank" rel="noopener">Ouvrir la position dans Google Maps</a>`
          : '<span>Position non disponible au moment de l\'alerte.</span>'}
        ${helpers.length ? `<span><b>${esc([...new Set(helpers)].join(', '))}</b> s'en occupe.</span>` : ''}
        <div class="row">${actions}</div></div>`;
    }
    const cls = ['msg', mine ? 'mine' : '', m.author_role === 'voyageur' ? 'traveler' : ''].join(' ');
    const parent = m.reply_to ? S.messages.find((x) => x.id === m.reply_to) : null;
    const quote = parent ? `<div class="quote">${esc(parent.author_name)} : ${esc(parent.body || (parent.kind === 'photo' ? 'Photo' : parent.kind === 'sos' ? 'Alerte SOS' : ''))}</div>` : '';
    return `<div class="${cls}" id="m-${m.id}">
      ${mine ? '' : `<span class="who">${esc(m.author_name)}</span>`}
      <div class="bubble">${quote}${m.photo_url ? `<div class="photo"><img src="${esc(m.photo_url)}" alt="${esc(m.body || 'Photo')}" loading="lazy"></div>` : ''}${m.body ? esc(m.body).replace(/\n/g, '<br>') : ''}</div>
      <div class="msg-foot"><time>${t}</time>${sealTag(m)}<button type="button" class="link-btn" data-act="reply" data-id="${m.id}">Répondre</button></div>
    </div>`;
  }

  function sealTag(m, short = false) {
    if (isTraveler() || !isMail(m)) return '';
    const k = openingOf(m.created_at);
    if (isSealed(m)) return `<span class="seal-tag" title="Part dans le courrier du ${openShort(k)}">${I.lock}${short ? '' : `<span>Courrier du ${openShort(k)}</span>`}</span>`;
    return short ? '' : `<span class="seal-tag open">Distribué le ${openShort(k)}</span>`;
  }

  function feedHtml() {
    if (!S.messages.length) {
      return `<div class="pane"><div class="card"><strong>Le fil est vide pour l'instant.</strong><p class="fine">${isTraveler() ? 'Envoie une première photo ou un « Je vais bien » pour donner de tes nouvelles.' : `Envoie un premier mot ou un poke à ${esc(travelerName())}.`}</p></div></div>`;
    }
    let lastDay = '';
    const parts = [];
    for (const m of S.messages) {
      const d = new Date(m.created_at).toDateString();
      if (d !== lastDay) { parts.push(`<div class="day-sep">${dayLabel(m.created_at)}</div>`); lastDay = d; }
      parts.push(msgHtml(m));
    }
    return `<div class="feed" id="feed">${parts.join('')}</div>`;
  }

  // ---------------------------------------------------------------------
  // Courrier mensuel : le voyageur découvre les messages du groupe le 1er de chaque mois
  // ---------------------------------------------------------------------
  // Un message du groupe envoyé en octobre s'ouvre le 1er novembre à 0 h UTC (7 h au Vietnam, 1 h à Paris).
  // Exception : les réponses à une alerte SOS passent tout de suite.
  const openingOf = (iso) => { const d = new Date(iso); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); };
  const nextOpening = () => { const d = new Date(nowMs()); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); };
  const isSosReply = (m) => !!m.reply_to && S.messages.some((p) => p.id === m.reply_to && p.kind === 'sos');
  const isMail = (m) => m.author_role === 'groupe' && !isSosReply(m);
  const isSealed = (m) => isMail(m) && nowMs() < openingOf(m.created_at);
  const fmtUtc = (ms, opts) => new Date(ms).toLocaleDateString('fr-FR', { ...opts, timeZone: 'UTC' }).replace(/(^|\s)1(?=\s)/, (_, a) => `${a}1er`);
  const openLong = (ms) => fmtUtc(ms, { weekday: 'long', day: 'numeric', month: 'long' });
  const openShort = (ms) => fmtUtc(ms, { day: 'numeric', month: 'long' });
  const monthName = (ms) => new Date(ms).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const deName = (n) => (/^[aeiouyàâäéèêëîïôöûüh]/i.test(n) ? `d'${n}` : `de ${n}`);
  const plural = (n, one, many) => (n ? `${n} ${n > 1 ? many : one}` : '');
  const joinFr = (parts) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} et ${parts.at(-1)}`);

  function mailStats(list) {
    const photos = list.filter((m) => m.kind === 'photo').length;
    const pokes = list.filter((m) => m.kind === 'poke').length;
    const texts = list.length - photos - pokes;
    return { texts, photos, pokes, total: list.length, senders: new Set(list.map((m) => m.author_id)).size };
  }
  function sealedStats() {
    const sealed = S.messages.filter(isSealed);
    if (!sealed.length && S.sealedRemote) return S.sealedRemote;
    return mailStats(sealed);
  }
  const statsLine = (st) => joinFr([plural(st.texts, 'message', 'messages'), plural(st.photos, 'photo', 'photos'), plural(st.pokes, 'poke', 'pokes')].filter(Boolean));

  function postcardHtml(m, i) {
    const parent = m.reply_to ? S.messages.find((x) => x.id === m.reply_to) : null;
    const re = parent
      ? `<p class="pc-re">En réponse à ${parent.kind === 'photo' ? 'ta photo' : 'ton message'} du ${fmtDate(parent.created_at)}${parent.body ? ` : « ${esc(parent.body.length > 60 ? parent.body.slice(0, 60) + '…' : parent.body)} »` : ''}</p>`
      : '';
    return `<article class="postcard" id="m-${m.id}" style="--tilt:${i % 2 ? 0.7 : -0.7}deg">
      ${m.photo_url ? `<div class="pc-photo"><img src="${esc(m.photo_url)}" alt="${esc(m.body || 'Photo')}" loading="lazy"></div>` : ''}
      <div class="pc-back">
        <div class="pc-msg">${re}${m.body ? `<p class="pc-text">${esc(m.body).replace(/\n/g, '<br>')}</p>` : ''}<p class="pc-sign">${esc(m.author_name)}</p></div>
        <div class="pc-side" aria-hidden="true">
          <span class="pc-stamp"><img src="${LOGO}" alt=""></span>
          <span class="pc-postmark">${fmtDate(m.created_at).toUpperCase()}</span>
          <span class="pc-addr">${esc(travelerName())}<br>quelque part en Asie</span>
        </div>
      </div>
      <div class="pc-foot"><button type="button" class="link-btn" data-act="reply" data-id="${m.id}">Répondre à ${esc(m.author_name)}</button></div>
    </article>`;
  }

  function pokeSummaryHtml(list) {
    if (!list.length) return '';
    const byType = new Map();
    list.forEach((m) => { const k = POKE[m.poke] ? m.poke : 'pense'; (byType.get(k) || byType.set(k, []).get(k)).push(m.author_name); });
    const rows = [...byType.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, names]) =>
      `<li><span aria-hidden="true">${POKE[k].emo}</span><b>${POKE[k].label} × ${names.length}</b><small>${esc([...new Set(names)].join(', '))}</small></li>`).join('');
    return `<ul class="poke-sum" aria-label="Pokes du mois">${rows}</ul>`;
  }

  // Cartes postales, côté voyageur : une fonction discrète, rien n'est imposé.
  // Le courrier arrive le 1er du mois ; il ne s'ouvre que si le voyageur le décide.
  const OPENED_KEY = 'rt-opened';
  const openedSet = () => { try { return new Set(JSON.parse(store.get(OPENED_KEY) || '[]')); } catch { return new Set(); } };
  function markOpened(k) { const s = openedSet(); s.add(String(k)); store.set(OPENED_KEY, JSON.stringify([...s])); }

  function cartesHtml() {
    const next = nextOpening();
    const opened = openedSet();
    const open = S.messages.filter((m) => isMail(m) && !isSealed(m));
    const groups = new Map();
    open.forEach((m) => { const k = openingOf(m.created_at); (groups.get(k) || groups.set(k, []).get(k)).push(m); });
    const batches = [...groups.entries()].sort((a, b) => b[0] - a[0]);

    const rows = batches.map(([k, list]) => {
      const st = mailStats(list);
      const isOpen = S.expanded === k;
      const read = opened.has(String(k));
      const label = `Courrier ${deName(monthName(k - 86400e3))}`;
      const head = `<div class="mail-row${read ? ' read' : ''}" id="batch-${k}">
          <span class="mail-seal" aria-hidden="true">${read ? I.mail : 'RT'}</span>
          <div class="mail-meta"><strong>${cap(label)}</strong><span>${cap(statsLine(st))}${read ? ' · lu' : ''}</span></div>
          <button type="button" class="btn small${read ? '' : ' jade'}" data-act="${isOpen ? 'close-batch' : 'open-batch'}" data-k="${k}">${isOpen ? 'Refermer' : read ? 'Relire' : 'Ouvrir'}</button>
        </div>`;
      if (!isOpen) return head;
      const cards = list.filter((m) => m.kind !== 'poke').map(postcardHtml).join('');
      return `<section class="batch">${head}${pokeSummaryHtml(list.filter((m) => m.kind === 'poke'))}<div class="cards">${cards}</div></section>`;
    }).join('');

    const notif = S.push === 'on'
      ? '<span class="fine">Prévenu à l\'arrivée du courrier.</span>'
      : S.push === 'unsupported' || S.push === 'denied' ? '' : '<button type="button" class="link-btn" data-act="push">Me prévenir quand le courrier arrive</button>';

    return `<div class="mailbox">
      <p class="mail-intro">Le groupe glisse ici quelques mots de temps en temps. Le courrier arrive le 1er du mois et t'attend : tu l'ouvres quand tu veux, ou pas du tout. Aucune réponse n'est attendue.</p>
      ${rows || `<p class="card fine">Pas encore de courrier. Le premier arrivera le ${openShort(next)}.</p>`}
      <div class="mail-options">
        ${S.writeOpen || S.replyTo ? '' : '<button type="button" class="link-btn" data-act="write">Écrire un mot au groupe</button>'}
        ${notif}
      </div>
      <p class="fine mail-next">Prochain courrier le ${openLong(next)}.</p>
      ${DEMO ? `<div class="demo-row">${CLOCK.shift
        ? '<button type="button" class="btn small" data-act="demo-reset">Démo : revenir à aujourd\'hui</button>'
        : `<button type="button" class="btn small" data-act="demo-skip">Démo : passer au ${openShort(next)}</button>`}</div>` : ''}
    </div>`;
  }

  function sosRepliesHtml() {
    const act = activeSos();
    if (!act) return '';
    const reps = S.messages.filter((m) => m.reply_to === act.sos.id && m.author_role === 'groupe');
    return `<div class="card" role="status"><strong>Réponses du groupe à ton alerte</strong>
      ${reps.length
        ? `<ul class="tips">${reps.map((r) => `<li><b>${esc(r.author_name)}</b> : ${esc(r.body || '')}</li>`).join('')}</ul>`
        : '<p class="fine">Personne n\'a encore répondu. Les réponses s\'affichent ici dès qu\'elles arrivent, sans attendre le courrier du mois.</p>'}
      <button type="button" class="btn small" data-act="false-alarm" data-id="${act.sos.id}">Fausse alerte, tout va bien</button></div>`;
  }

  // ---------------------------------------------------------------------
  // Rendu : l'essentiel sur le pays et la région
  // ---------------------------------------------------------------------
  // Saisons, mois par mois : s = sec et agréable, c = chaud, p = pluies/mousson, f = frais
  const SEASON = { s: 'Sec, idéal', c: 'Très chaud', p: 'Pluies', f: 'Frais' };
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const INFO = {
    TH: {
      capital: 'Bangkok', lang: 'Thaï', money: 'Baht (THB)', pay: 'Espèces pour la rue et les marchés, carte dans les hôtels et centres commerciaux. Les distributeurs prennent environ 220 THB de frais fixes par retrait.',
      plugs: 'A, B, C, O', volt: 220, water: false,
      seasons: 'sscccpppppss', seasonNote: 'Sur la côte est du golfe (Koh Samui, Koh Phangan), les pluies tombent plutôt d\'octobre à décembre.',
      phrases: [['Bonjour', 'Sawasdee khrap (homme) / kha (femme)'], ['Merci', 'Khop khun khrap / kha'], ['Combien ?', 'Tao rai ?'], ['Pas épicé', 'Mai phet']],
      etiquette: ['Ne jamais critiquer la famille royale, même en plaisantant : la loi punit lourdement le crime de lèse-majesté.', 'Ne pas toucher la tête de quelqu\'un ni pointer les pieds vers une personne ou un Bouddha.', 'Épaules et genoux couverts, chaussures retirées dans les temples.'],
      health: ['Dengue présente toute l\'année : répulsif le jour comme le soir.', 'Chiens errants : en cas de morsure, consulter le jour même (rage).'],
      safety: ['Si quelqu\'un affirme que le Grand Palais est fermé, c\'est le début d\'une arnaque au tuk-tuk.', 'Scooter : permis international avec catégorie moto et casque, sinon l\'assurance ne couvre rien.'],
      tip: 'Pas obligatoire. On arrondit ou on laisse 20 à 50 THB au restaurant.',
    },
    LA: {
      capital: 'Vientiane', lang: 'Lao', money: 'Kip (LAK)', pay: 'Pays très majoritairement en espèces. Bahts et dollars acceptés dans les zones touristiques. Distributeurs rares hors des villes.',
      plugs: 'A, B, C, E, F', volt: 230, water: false,
      seasons: 'sscc' + 'pppppsss', seasonNote: 'Dans le nord, les nuits de décembre et janvier peuvent descendre sous 10 °C.',
      phrases: [['Bonjour', 'Sabaidee'], ['Merci', 'Khop jai'], ['Combien ?', 'Tao dai ?'], ['Pas de souci', 'Bo pen nyang']],
      etiquette: ['Tenue couverte dans les temples, chaussures retirées.', 'Ne pas toucher un moine. Une femme ne lui tend rien directement.', 'Garder son calme en toutes circonstances : hausser le ton fait perdre la face.'],
      health: ['Dengue et paludisme dans certaines zones rurales : demander l\'avis d\'un médecin du voyage.', 'Structures médicales limitées : les cas sérieux sont souvent évacués vers la Thaïlande.'],
      safety: ['Bombes non explosées dans les campagnes : ne jamais quitter les sentiers balisés.', 'Routes de montagne dangereuses la nuit et en saison des pluies.'],
      tip: 'Pas d\'usage établi, mais un petit pourboire est apprécié.',
    },
    VN: {
      capital: 'Hanoï', lang: 'Vietnamien', money: 'Dong (VND)', pay: 'Espèces partout. Paiement par carte et QR code dans les villes. Attention aux billets de 10 000 et 100 000, faciles à confondre.',
      plugs: 'A, C, F', volt: 220, water: false,
      seasons: 'fffsccpppssf', seasonNote: 'Saisons données pour le nord (Hanoï, Ha Long, Sapa). Le centre (Hué, Hoi An) subit des typhons de septembre à novembre, le sud est pluvieux de mai à novembre.',
      phrases: [['Bonjour', 'Xin chào'], ['Merci', 'Cảm ơn'], ['Combien ?', 'Bao nhiêu ?'], ['Pas épicé', 'Không cay']],
      etiquette: ['Ne pas planter ses baguettes à la verticale dans le riz : c\'est un geste funéraire.', 'Tenue correcte dans les pagodes et au mausolée de Hô Chi Minh.', 'Marchander avec le sourire, sans jamais s\'énerver.'],
      health: ['Dengue fréquente, surtout en saison des pluies : répulsif.', 'Pollution de l\'air forte à Hanoï l\'hiver : un masque FFP2 aide.'],
      safety: ['Taxis : préférer l\'appli Grab, prix fixé à l\'avance.', 'Vols à l\'arraché depuis des scooters : téléphone côté mur, sac en bandoulière devant soi.'],
      tip: 'Pas obligatoire, apprécié dans le tourisme (guides, chauffeurs).',
    },
    KH: {
      capital: 'Phnom Penh', lang: 'Khmer', money: 'Riel (KHR) et dollar américain', pay: 'Le dollar est utilisé partout, la monnaie est rendue en riels. Les billets abîmés ou déchirés sont refusés.',
      plugs: 'A, C, G', volt: 230, water: false,
      seasons: 'ssccc' + 'ppppp' + 'ss', seasonNote: 'Novembre à janvier est la période la plus agréable pour Angkor.',
      phrases: [['Bonjour', 'Sous-dey'], ['Merci', 'Arkoun'], ['Combien ?', 'Thlay ponmann ?'], ['Non merci', 'Ot te, arkoun']],
      etiquette: ['Épaules et genoux couverts pour visiter Angkor, sinon l\'accès aux temples est refusé.', 'Ne pas toucher la tête, ne pas pointer les pieds.', 'Aborder la période des Khmers rouges avec tact.'],
      health: ['Dengue et paludisme en zone forestière : avis d\'un médecin du voyage.', 'Chaleur extrême en avril : visiter tôt le matin.'],
      safety: ['Mines encore présentes dans certaines campagnes : rester sur les chemins.', 'Vols à l\'arraché à Phnom Penh, notamment en tuk-tuk : sac sur les genoux.'],
      tip: 'Apprécié : 1 ou 2 dollars pour un guide ou un chauffeur.',
    },
    MY: {
      capital: 'Kuala Lumpur', lang: 'Malais, anglais très courant', money: 'Ringgit (MYR)', pay: 'Carte acceptée largement, paiement sans contact courant. Espèces utiles pour les marchés de nuit.',
      plugs: 'G', volt: 240, water: false,
      seasons: 'ssspssssspps', seasonNote: 'Saisons pour la côte ouest. La côte est (îles Perhentian) est fermée par la mousson de novembre à février.',
      phrases: [['Bonjour', 'Selamat pagi'], ['Merci', 'Terima kasih'], ['Combien ?', 'Berapa ?'], ['Pas épicé', 'Tak pedas']],
      etiquette: ['Pays majoritairement musulman : tenue couverte dans les mosquées et les zones rurales.', 'Donner et manger de la main droite.', 'Pendant le ramadan, éviter de manger en public dans la journée.'],
      health: ['Dengue présente : répulsif.', 'Fumées de brûlis venues d\'Indonésie certaines années, entre août et octobre.'],
      safety: ['Vols à l\'arraché à Kuala Lumpur.', 'Est du Sabah (Bornéo) : consignes particulières, à vérifier avant d\'y aller.'],
      tip: 'Souvent inclus (frais de service de 10 %). Sinon, on arrondit.',
    },
    SG: {
      capital: 'Singapour', lang: 'Anglais, mandarin, malais, tamoul', money: 'Dollar de Singapour (SGD)', pay: 'Carte sans contact partout, y compris dans le métro.',
      plugs: 'G', volt: 230, water: true,
      seasons: 'psssccccc' + 'spp', seasonNote: 'Chaud et humide toute l\'année. De novembre à janvier, averses plus fréquentes.',
      phrases: [['Bonjour', 'Hello (anglais partout)'], ['Merci', 'Thank you'], ['Combien ?', 'How much?'], ['Ça marche ?', 'Can or not? (singlish)']],
      etiquette: ['Amendes élevées : interdit de manger ou boire dans le métro, de traverser hors des passages, de jeter un déchet.', 'La vente de chewing-gum est interdite.', 'Le durian est interdit dans les transports.'],
      health: ['L\'eau du robinet est potable.', 'Dengue présente malgré tout : répulsif.'],
      safety: ['L\'un des pays les plus sûrs au monde.', 'Peines très lourdes pour les stupéfiants, y compris la simple consommation.'],
      tip: 'Pas d\'usage. Frais de service de 10 % souvent inclus.',
    },
    ID: {
      capital: 'Jakarta', lang: 'Indonésien', money: 'Roupie indonésienne (IDR)', pay: 'Espèces dominantes hors des grandes villes. Bien compter les zéros : les billets montent à 100 000.',
      plugs: 'C, F', volt: 230, water: false,
      seasons: 'pppss' + 'sssss' + 'pp', seasonNote: 'Saisons pour Java et Bali. Les Moluques et la Papouasie suivent un autre rythme.',
      phrases: [['Bonjour', 'Selamat pagi'], ['Merci', 'Terima kasih'], ['Combien ?', 'Berapa ?'], ['Pas épicé', 'Tidak pedas']],
      etiquette: ['Sarong obligatoire dans les temples de Bali, souvent prêté à l\'entrée.', 'Donner et recevoir de la main droite.', 'Tenue couverte hors des plages, surtout pendant le ramadan.'],
      health: ['Ne jamais boire d\'alcool local non étiqueté (arak) : des cas d\'intoxication mortelle au méthanol.', 'Dengue fréquente : répulsif.'],
      safety: ['Volcans actifs : suivre les zones d\'exclusion et les alertes locales.', 'Peines extrêmement lourdes pour les stupéfiants.'],
      tip: 'Pas obligatoire, on arrondit. Apprécié pour les guides et chauffeurs.',
    },
    PH: {
      capital: 'Manille', lang: 'Filipino, anglais très courant', money: 'Peso philippin (PHP)', pay: 'Espèces indispensables sur les îles. Distributeurs parfois à sec sur les petites îles : prévoir une réserve.',
      plugs: 'A, B, C', volt: 220, water: false,
      seasons: 'ssccc' + 'pppppp' + 's', seasonNote: 'Typhons surtout de juillet à octobre : les bateaux entre îles sont alors souvent annulés.',
      phrases: [['Bonjour', 'Kumusta'], ['Merci', 'Salamat po'], ['Combien ?', 'Magkano ?'], ['Oui (poli)', 'Opo']],
      etiquette: ['Ajouter « po » en fin de phrase pour les aînés, signe de respect.', 'On ne refuse pas une invitation à manger sans raison.', 'Éviter de faire perdre la face en public.'],
      health: ['Dengue fréquente : répulsif.', 'Prudence avec la glace dans les boissons hors des lieux touristiques.'],
      safety: ['Certaines zones du sud (ouest de Mindanao, archipel de Sulu) sont formellement déconseillées.', 'Ne pas accepter de boisson d\'inconnus dans les bars.'],
      tip: 'Environ 10 % apprécié s\'il n\'y a pas de frais de service.',
    },
    CN: {
      capital: 'Pékin', lang: 'Mandarin', money: 'Yuan (CNY)', pay: 'Le paiement mobile domine : installer Alipay ou WeChat Pay et y lier sa carte avant d\'arriver. Les espèces dépannent.',
      plugs: 'A, C, I', volt: 220, water: false,
      seasons: 'fffss' + 'cpcss' + 'ff', seasonNote: 'Saisons pour l\'est et le centre (Pékin, Shanghai, Xi\'an). Le Yunnan est doux toute l\'année, le sud a des typhons en été.',
      phrases: [['Bonjour', 'Nǐ hǎo'], ['Merci', 'Xièxie'], ['Combien ?', 'Duōshǎo qián ?'], ['Pas épicé', 'Bú yào là']],
      etiquette: ['Éviter les sujets politiques sensibles (Tibet, Taïwan, Tiananmen).', 'Passeport demandé pour les trains, les hôtels et certains sites : l\'avoir toujours sur soi.', 'Les pourboires ne se font pas.'],
      health: ['Pollution de l\'air forte l\'hiver dans le nord : masque FFP2.', 'Eau bouillie ou en bouteille uniquement.'],
      safety: ['Google, WhatsApp et Instagram sont bloqués : installer un VPN avant d\'entrer. Les notifications Android de l\'appli ne passeront pas sans lui.', 'Arnaque du « salon de thé » : des inconnus sympathiques invitent à une dégustation facturée une fortune.'],
      tip: 'Pas d\'usage, parfois refusé.',
    },
    JP: {
      capital: 'Tokyo', lang: 'Japonais', money: 'Yen (JPY)', pay: 'Carte acceptée de plus en plus, mais beaucoup de petits lieux restent en espèces. Retraits faciles aux distributeurs des konbini.',
      plugs: 'A, B', volt: 100, water: true,
      seasons: 'ffsss' + 'pccps' + 'sf', seasonNote: 'Saison des pluies en juin, typhons possibles en septembre. Les cerisiers fleurissent fin mars, les érables rougissent en novembre.',
      phrases: [['Bonjour', 'Konnichiwa'], ['Merci', 'Arigatō gozaimasu'], ['Combien ?', 'Ikura desu ka ?'], ['Pardon / excusez-moi', 'Sumimasen']],
      etiquette: ['Pas de pourboire : il peut gêner.', 'Silence au téléphone dans les transports.', 'Tatouages souvent refusés dans les bains (onsen) : se renseigner avant.'],
      health: ['L\'eau du robinet est potable.', 'Soins excellents mais chers : l\'assurance voyage est indispensable.'],
      safety: ['Très sûr. Séismes possibles : installer l\'appli officielle « Safety Tips ».', 'Objet perdu : il est presque toujours rapporté au poste de police de quartier (kōban).'],
      tip: 'Ne pas en laisser.',
    },
    KR: {
      capital: 'Séoul', lang: 'Coréen', money: 'Won (KRW)', pay: 'Carte acceptée partout. Une carte de transport T-money s\'achète en supérette.',
      plugs: 'C, F', volt: 220, water: true,
      seasons: 'fffss' + 'spcss' + 'ff', seasonNote: 'Mousson fin juin à juillet, été chaud et humide, hiver très froid à Séoul.',
      phrases: [['Bonjour', 'Annyeonghaseyo'], ['Merci', 'Gamsahamnida'], ['Combien ?', 'Eolmayeyo ?'], ['Excusez-moi', 'Sillyehamnida']],
      etiquette: ['Donner et recevoir à deux mains, surtout avec les aînés.', 'Ne pas écrire le nom de quelqu\'un à l\'encre rouge.', 'Laisser les places réservées dans le métro, même vides.'],
      health: ['L\'eau du robinet est potable.', 'Particules fines au printemps : consulter l\'indice de qualité de l\'air.'],
      safety: ['Très sûr.', 'Naver Map et KakaoMap fonctionnent mieux que Google Maps pour s\'orienter.'],
      tip: 'Pas d\'usage.',
    },
    IN: {
      capital: 'New Delhi', lang: 'Hindi, anglais, et de nombreuses langues régionales', money: 'Roupie indienne (INR)', pay: 'Espèces très utiles, petites coupures surtout. Carte dans les hôtels et grandes enseignes.',
      plugs: 'C, D, M', volt: 230, water: false,
      seasons: 'sssccc' + 'pppsss', seasonNote: 'Saisons pour le nord (Delhi, Rajasthan). Le Kerala reçoit la mousson dès juin et une seconde en octobre-novembre.',
      phrases: [['Bonjour', 'Namaste'], ['Merci', 'Dhanyavaad'], ['Combien ?', 'Kitna hai ?'], ['Pas épicé', 'Teekha nahi']],
      etiquette: ['Manger et donner de la main droite.', 'Tenue couverte, chaussures retirées dans les temples et maisons.', 'Les gestes d\'affection en public sont mal vus.'],
      health: ['Eau en bouteille scellée uniquement, pas de glaçons ni de crudités douteuses.', 'Pollution de l\'air très forte à Delhi en novembre et décembre.'],
      safety: ['Arnaques aux taxis et fausses agences de tourisme près des gares : réserver par appli.', 'Circulation chaotique : prudence en traversant.'],
      tip: 'Environ 10 % au restaurant, apprécié pour guides et chauffeurs.',
    },
    NP: {
      capital: 'Katmandou', lang: 'Népali', money: 'Roupie népalaise (NPR)', pay: 'Espèces indispensables, surtout en trek. Retirer assez d\'argent à Katmandou ou Pokhara.',
      plugs: 'C, D, M', volt: 230, water: false,
      seasons: 'fsssc' + 'pppp' + 'ssf', seasonNote: 'Octobre et novembre sont les meilleurs mois pour le trek, avec un ciel dégagé sur l\'Himalaya.',
      phrases: [['Bonjour', 'Namaste'], ['Merci', 'Dhanyabad'], ['Combien ?', 'Kati ho ?'], ['Doucement', 'Bistarai']],
      etiquette: ['Tourner autour des stupas et des moulins à prières dans le sens des aiguilles d\'une montre.', 'Main droite pour donner et manger.', 'Ne pas toucher la tête de quelqu\'un.'],
      health: ['Mal aigu des montagnes : monter progressivement, redescendre aux premiers signes sérieux.', 'Eau filtrée ou traitée en trek.'],
      safety: ['Un guide agréé est désormais exigé sur de nombreux treks : vérifier avant de partir.', 'Assurance couvrant l\'évacuation en hélicoptère indispensable.'],
      tip: 'Environ 10 % dans le tourisme. Pourboire d\'usage pour guides et porteurs en fin de trek.',
    },
    LK: {
      capital: 'Colombo (Sri Jayawardenepura Kotte, capitale administrative)', lang: 'Cinghalais, tamoul, anglais courant', money: 'Roupie srilankaise (LKR)', pay: 'Espèces pour les tuk-tuks et petites échoppes, carte dans les hôtels.',
      plugs: 'D, G, M', volt: 230, water: false,
      seasons: 'ssss' + 'ppppppp' + 's', seasonNote: 'Saisons pour le sud et l\'ouest. La côte est (Trincomalee, Arugam Bay) est idéale d\'avril à septembre.',
      phrases: [['Bonjour', 'Ayubowan'], ['Merci', 'Sthuthi'], ['Combien ?', 'Kiyada ?'], ['Bonjour (tamoul)', 'Vanakkam']],
      etiquette: ['Ne jamais poser dos à une statue de Bouddha pour une photo. Un tatouage de Bouddha visible peut entraîner une expulsion.', 'Tenue couverte et de préférence claire dans les temples.', 'Hocher la tête de côté veut souvent dire oui.'],
      health: ['Dengue fréquente : répulsif.', 'Courants très forts sur certaines plages : respecter les drapeaux.'],
      safety: ['Tuk-tuk : fixer le prix avant de monter ou utiliser une appli (PickMe, Uber).', 'Éléphants sauvages sur certaines routes la nuit.'],
      tip: 'Frais de service souvent inclus. Sinon, environ 10 %.',
    },
  };

  // Repères pour quelques étapes classiques (recherche par nom d'étape)
  const REGIONS = [
    { keys: ['bangkok'], text: 'Se déplacer en métro aérien (BTS, MRT) ou avec Grab plutôt qu\'en tuk-tuk hélé dans la rue. Bateaux express sur la Chao Phraya pour les temples.' },
    { keys: ['chiang mai', 'chiang rai', 'pai'], text: 'De février à avril, les brûlis agricoles rendent l\'air très pollué : prévoir un masque FFP2. Nuits fraîches de décembre à janvier.' },
    { keys: ['phuket', 'krabi', 'phi phi', 'koh lanta'], text: 'Drapeau rouge = baignade interdite : les courants de mousson sont mortels. Photographier un jet-ski avant de le louer.' },
    { keys: ['luang prabang'], text: 'Aumône des moines à l\'aube : rester à distance, sans flash. La ville s\'endort tôt, la plupart des lieux ferment avant minuit.' },
    { keys: ['vang vieng'], text: 'Tubing et sauts dans la rivière ont causé de nombreux accidents : jamais après avoir bu, jamais sans connaître la profondeur.' },
    { keys: ['hanoi'], text: 'Pour traverser, avancer lentement et à vitesse constante : les scooters vous contournent. Ne jamais s\'arrêter ni reculer brusquement.' },
    { keys: ['ha long', 'halong', 'lan ha', 'cat ba'], text: 'Les autorités annulent les croisières en cas d\'alerte météo, parfois au dernier moment : garder une journée de marge avant un vol.' },
    { keys: ['sapa', 'ha giang'], text: 'Routes de montagne étroites et glissantes : éviter de conduire soi-même un scooter sans expérience. Brouillard fréquent l\'hiver.' },
    { keys: ['hoi an', 'hue', 'da nang'], text: 'Octobre et novembre : crues fréquentes dans la vieille ville d\'Hoi An et typhons sur la côte. Suivre les alertes locales.' },
    { keys: ['ho chi minh', 'saigon'], text: 'Vols à l\'arraché depuis des scooters : téléphone côté mur, sac porté devant soi.' },
    { keys: ['siem reap', 'angkor'], text: 'Pass Angkor à acheter uniquement au guichet officiel. Épaules et genoux couverts pour monter aux temples.' },
    { keys: ['phnom penh'], text: 'Visites du S-21 et de Choeung Ek éprouvantes : prévoir un moment calme après. Sac sur les genoux en tuk-tuk.' },
    { keys: ['bali', 'ubud', 'canggu'], text: 'Sarong obligatoire dans les temples. Jamais d\'alcool local non étiqueté. Circulation dense : un chauffeur vaut mieux qu\'un scooter.' },
    { keys: ['kathmandu', 'katmandou', 'pokhara'], text: 'Air pollué à Katmandou : masque utile. Pour les treks, se renseigner sur le guide et les permis exigés.' },
    { keys: ['tokyo', 'kyoto', 'osaka'], text: 'Une carte IC (Suica, Pasmo, Icoca) sur le téléphone sert pour tous les transports et les konbini.' },
  ];
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const regionTip = (place) => { const p = norm(place); return p ? REGIONS.find((r) => r.keys.some((k) => p.includes(k))) : null; };

  function tzOffsetMin(tz, d = new Date()) {
    try {
      const a = new Date(d.toLocaleString('en-US', { timeZone: tz }));
      const b = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
      return Math.round((a - b) / 60000);
    } catch { return null; }
  }
  function gapWithFrance(tz) {
    const a = tzOffsetMin(tz), b = tzOffsetMin('Europe/Paris');
    if (a == null || b == null) return null;
    const m = a - b, h = Math.floor(Math.abs(m) / 60), mm = Math.abs(m) % 60;
    if (m === 0) return 'même heure qu\'en France';
    return `${m > 0 ? '+' : '−'}${h} h${mm ? ` ${mm}` : ''} par rapport à la France`;
  }
  function plugVerdict(info) {
    const p = info.plugs.split(/\s*,\s*/);
    if (info.volt < 200) return 'Adaptateur indispensable. Tension 100 V : la plupart des chargeurs l\'acceptent.';
    if (p.includes('E') || p.includes('F')) return 'Les prises françaises passent, adaptateur inutile la plupart du temps.';
    if (p.includes('C')) return 'Les fiches fines (type C) passent, un adaptateur universel reste utile.';
    return 'Adaptateur indispensable (fiches françaises incompatibles).';
  }

  function paysHtml() {
    const current = currentCountry();
    const code = S.paysCountry || current || 'VN';
    const c = COUNTRIES[code], info = INFO[code];
    const isHere = code === current;
    const place = isHere ? lastPlace() : null;
    const region = isHere ? regionTip(place) : null;
    const lt = localTime(code);
    const gap = gapWithFrance(c.tz);
    const month = new Date().getMonth();
    const now = info.seasons[month];
    const who = isTraveler() ? 'Tu es' : `${esc(travelerName())} est`;
    const months = info.seasons.split('').map((k, i) => `<li class="m m-${k}${i === month ? ' now' : ''}" title="${MONTHS[i]} : ${SEASON[k]}"><span>${MONTHS[i].charAt(0).toUpperCase()}</span></li>`).join('');
    const list = (items) => `<ul class="tips">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    return `<div class="pane pays">
      <label class="field" for="pays-country">Pays<select id="pays-country">${countryOptions(code).replace('<option value="">Choisir un pays…</option>', '')}</select></label>

      <div class="pays-head">
        <span class="pays-code" aria-hidden="true">${code}</span>
        <div>
          <h2>${c.name}</h2>
          <p>${isHere ? `${who} ici${place ? ` · ${esc(place)}` : ''}` : 'Pour préparer la suite du voyage'}${lt ? ` · <b>${lt.text}</b> sur place` : ''}</p>
        </div>
      </div>

      <dl class="facts">
        <div><dt>Décalage</dt><dd>${gap ? gap.replace(' par rapport à la France', '') : '—'}<small>par rapport à la France</small></dd></div>
        <div><dt>Monnaie</dt><dd>${esc(info.money)}</dd></div>
        <div><dt>Langue</dt><dd>${esc(info.lang)}</dd></div>
        <div><dt>Prises</dt><dd>Type ${info.plugs} · ${info.volt} V<small>${plugVerdict(info)}</small></dd></div>
        <div><dt>Eau du robinet</dt><dd>${info.water ? 'Potable' : 'Non potable'}<small>${info.water ? '' : 'Bouteille scellée ou eau filtrée.'}</small></dd></div>
        <div><dt>Capitale</dt><dd>${esc(info.capital)}</dd></div>
      </dl>

      ${region ? `<div class="card region"><span class="eyebrow">À savoir sur l'étape${place ? ` · ${esc(place)}` : ''}</span><p>${esc(region.text)}</p></div>` : ''}

      <section class="card">
        <span class="eyebrow">Météo de saison</span>
        <p class="now-line"><b>En ${MONTHS[month]} :</b> ${SEASON[now].toLowerCase()}.</p>
        <ol class="months" aria-label="Saisons mois par mois">${months}</ol>
        <div class="legend">${Object.entries(SEASON).filter(([k]) => info.seasons.includes(k)).map(([k, v]) => `<span><i class="m-${k}"></i>${v}</span>`).join('')}</div>
        <p class="fine">${esc(info.seasonNote)}</p>
      </section>

      <section class="card">
        <span class="eyebrow">Phrases utiles</span>
        <table class="phrases"><tbody>${info.phrases.map(([fr, loc]) => `<tr><th scope="row">${fr}</th><td>${esc(loc)}</td></tr>`).join('')}</tbody></table>
      </section>

      <section class="card"><span class="eyebrow">Savoir-vivre</span>${list(info.etiquette)}</section>
      <section class="card"><span class="eyebrow">Santé</span>${list(info.health)}</section>
      <section class="card"><span class="eyebrow">Sécurité et arnaques</span>${list(info.safety)}</section>
      <section class="card"><span class="eyebrow">Argent et pourboires</span>${list([info.pay, `Pourboire : ${info.tip}`])}</section>

      <button type="button" class="btn block" data-tab="${isTraveler() ? 'securite' : 'urgence'}">Numéros d'urgence du pays</button>
      <p class="fine">Repères généraux. Formalités d'entrée, santé et zones déconseillées : vérifier avant chaque frontière sur la page « Conseils aux voyageurs » de diplomatie.gouv.fr. Le passeport doit en général rester valide 6 mois après la sortie du pays.</p>
    </div>`;
  }

  // ---------------------------------------------------------------------
  // Rendu : sécurité (voyageur) et urgence (groupe)
  // ---------------------------------------------------------------------
  function numbersHtml(code) {
    const c = COUNTRIES[code];
    const rows = (c ? c.nums : []).map(([label, num]) => `<a href="tel:${num}"><span>${esc(label)}</span><b>${num}</b></a>`).join('');
    return `<div class="numbers">${rows || '<p class="fine">Choisis un pays pour voir ses numéros d\'urgence.</p>'}
      <a href="tel:${CRISIS.num.replace(/\s/g, '')}"><span>${CRISIS.label}</span><b>${CRISIS.num}</b></a></div>
      <p class="fine">Numéros à revérifier avant le départ sur la page « Conseils aux voyageurs » du site diplomatie.gouv.fr.</p>`;
  }
  const countryOptions = (sel) => `<option value="">Choisir un pays…</option>` + Object.entries(COUNTRIES).map(([k, c]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${c.name}</option>`).join('');
  function referentsHtml() {
    const refs = CFG.REFERENTS || [];
    if (!refs.length) return '<p class="fine">Aucun référent configuré dans config.js.</p>';
    return `<div class="numbers">${refs.map((r) => `<a href="tel:${esc(r.phone)}"><span>${esc(r.name)}</span><b>${esc(r.phone)}</b></a>`).join('')}</div>`;
  }
  function sosText(pos, batt) {
    const where = pos ? `Position : ${mapUrl(pos.lat, pos.lng)} (± ${pos.accuracy} m).` : 'Position indisponible.';
    return `SOS ${travelerName()} : j'ai besoin d'aide. ${where}${batt != null ? ` Batterie ${batt} %.` : ''} ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`;
  }
  function smsHref(text) {
    const phones = (CFG.REFERENTS || []).map((r) => r.phone).join(',');
    return `sms:${phones}?body=${encodeURIComponent(text)}`;
  }
  function installCard() {
    const standalone = matchMedia('(display-mode: standalone)').matches;
    if (DEMO || standalone) return '';
    return `<div class="card"><strong>Installer l'appli sur l'écran d'accueil</strong>
      <p class="fine">Indispensable pour recevoir les notifications de façon fiable.</p>
      ${S.installEvt ? '<button type="button" class="btn jade" data-act="install">Installer</button>' : '<p class="fine">Dans Chrome : menu ⋮ puis « Ajouter à l\'écran d\'accueil ».</p>'}</div>`;
  }

  function sosResultHtml() {
    const st = S.sos;
    if (st.phase === 'sent') {
      return `<div class="card" id="sos-result" role="status"><strong>Alerte envoyée à ${st.count} personne${st.count > 1 ? 's' : ''} à ${fmtTime(st.at)}.</strong>
        <p class="fine">Si tu peux, appelle aussi les secours locaux ci-dessous.</p>
        <a class="btn" href="${smsHref(st.text)}">Envoyer aussi par SMS aux référents</a></div>`;
    }
    if (st.phase === 'failed') {
      return `<div class="card" id="sos-result" role="alert"><strong>L'alerte n'est pas partie : pas de connexion internet.</strong>
        <p class="fine">Envoie-la par SMS, ça passe avec le réseau téléphonique seul.</p>
        <a class="btn jade" href="${smsHref(st.text)}">Envoyer le SOS par SMS</a>
        <p class="fine" id="sos-copy-text">${esc(st.text)}</p>
        <button type="button" class="btn small" data-act="copy-sos">Copier le texte</button></div>`;
    }
    return '';
  }

  function securiteHtml() {
    const sosLabel = { idle: 'Maintiens 3 secondes', holding: 'Continue d\'appuyer…', sending: 'Envoi en cours…', sent: 'Alerte envoyée', failed: 'Échec de l\'envoi' }[S.sos.phase];
    return `<div class="pane">
      <h2 class="section-title">Alerte</h2>
      <div class="sos-zone">
        <button type="button" class="sos-btn" id="sos-btn" aria-describedby="sos-help" ${S.sos.phase === 'sending' ? 'disabled' : ''}><span class="core"><b>SOS</b><small>${sosLabel}</small></span></button>
        <p class="fine" id="sos-help">Prévient tout le groupe avec ta position et ta batterie. Sans internet, l'appli te propose un SMS.</p>
        <p class="sos-status" aria-live="assertive">${S.sos.phase === 'sending' ? 'Récupération de la position…' : ''}</p>
      </div>
      ${sosResultHtml()}
      ${sosRepliesHtml()}
      <h2 class="section-title">Numéros d'urgence${COUNTRIES[S.country] ? ` · ${COUNTRIES[S.country].name}` : ''}</h2>
      ${numbersHtml(S.country)}
      <h2 class="section-title">Référents en France</h2>
      ${referentsHtml()}
      <h2 class="section-title">Partager ma position (facultatif)</h2>
      <div class="card">
        <p class="fine">Seulement si tu en as envie : le groupe voit ton étape et le pays s'affiche dans l'onglet Pays.</p>
        <label class="field" for="ok-place">Où es-tu ?<input id="ok-place" type="text" maxlength="60" placeholder="Ex. Luang Prabang" autocomplete="off"></label>
        <label class="field" for="ok-country">Pays actuel<select id="ok-country">${countryOptions(S.country)}</select></label>
        <button type="button" class="btn jade" data-act="checkin">Je vais bien, partager mon étape</button>
      </div>
      ${installCard()}
      ${accountHtml()}
    </div>`;
  }

  function urgenceHtml() {
    const code = S.urgenceCountry || currentCountry();
    return `<div class="pane">
      <div class="card"><strong>Si une alerte SOS arrive</strong>
        <ol class="fine" style="margin:0;padding-left:1.2em;display:grid;gap:4px">
          <li>Ouvre l'alerte et note la position et l'heure.</li>
          <li>Appuie sur « Je m'en occupe » pour que les autres sachent qui agit.</li>
          <li>Appelle ${esc(travelerName())}, puis un référent.</li>
          <li>Sans réponse : police locale du pays, puis le Centre de crise.</li>
        </ol></div>
      <label class="field" for="urg-country">Pays<select id="urg-country">${countryOptions(code)}</select></label>
      ${numbersHtml(code)}
      <h2 class="section-title">Référents</h2>
      ${referentsHtml()}
      ${installCard()}
      ${accountHtml()}
    </div>`;
  }

  function renderMain(opts = {}) {
    const main = $('#main');
    const nearBottom = main.scrollHeight - main.scrollTop - main.clientHeight < 120;
    const keep = main.scrollTop;
    if (S.tab === 'fil') main.innerHTML = feedHtml();
    else if (S.tab === 'cartes') main.innerHTML = cartesHtml();
    else if (S.tab === 'pays') main.innerHTML = paysHtml();
    else if (S.tab === 'admin') main.innerHTML = adminHtml();
    else main.innerHTML = isTraveler() ? securiteHtml() : urgenceHtml();
    if (S.tab === 'fil' && (opts.toBottom || nearBottom)) {
      main.scrollTop = main.scrollHeight;
      // Les photos se chargent après coup : on reste collé en bas du fil
      const until = Date.now() + 3000;
      main.querySelectorAll('img').forEach((img) => img.complete || img.addEventListener('load', () => { if (Date.now() < until) main.scrollTop = main.scrollHeight; }, { once: true }));
    }
    else if (!opts.top) main.scrollTop = keep;
    if (S.tab === 'securite') bindSos();
  }

  // ---------------------------------------------------------------------
  // Rendu : pied (composeur + onglets)
  // ---------------------------------------------------------------------
  function renderFooter() {
    const tabs = isTraveler()
      ? [['pays', 'Pays', I.globe], ['securite', 'Sécurité', I.shield], ['cartes', 'Carte postale', I.mail]]
      : [['pays', 'Pays', I.globe], ['urgence', 'Urgence', I.shield], ['fil', 'Cartes postales', I.mail]];
    let composer = '';
    if (S.tab === 'fil' || (S.tab === 'cartes' && (S.writeOpen || S.replyTo))) {
      const parent = S.replyTo ? S.messages.find((m) => m.id === S.replyTo) : null;
      const pending = isTraveler() ? 0 : sealedStats().total;
      const hint = isTraveler() ? '' : `<p class="seal-hint">${I.lock}<span>Part dans le courrier du ${openLong(nextOpening())}${pending ? ` avec ${pending} autre${pending > 1 ? 's' : ''} envoi${pending > 1 ? 's' : ''}` : ''}. ${esc(travelerName())} l'ouvrira s'il le souhaite.</span></p>`;
      const chips = isTraveler()
        ? `<button type="button" class="chip" data-act="close-write">${I.close} Fermer</button>`
        : POKES.map((p) => `<button type="button" class="chip" data-poke="${p.id}"><span aria-hidden="true">${p.emo}</span>${p.label}</button>`).join('');
      composer = `<div class="composer">
        ${parent ? `<div class="reply-to"><span>Réponse à ${esc(parent.author_name)} : ${esc(parent.body || 'Photo')}</span><button type="button" class="link-btn" data-act="cancel-reply" aria-label="Annuler la réponse">${I.close}</button></div>` : ''}
        <div class="pokes" role="group" aria-label="Envois rapides">${chips}</div>
        ${hint}
        <form class="compose-row" id="compose">
          <label class="icon-btn" for="photo-input" title="Envoyer une photo" aria-label="Envoyer une photo">${I.camera}</label>
          <input id="photo-input" type="file" accept="image/*" hidden>
          <textarea id="draft" rows="1" placeholder="${isTraveler() ? 'Écris au groupe…' : `Un mot pour ${esc(travelerName())}…`}" aria-label="Message">${esc(S.draft)}</textarea>
          <button type="submit" class="icon-btn primary" aria-label="Envoyer">${I.send}</button>
        </form></div>`;
    }
    $('#ftr').innerHTML = `${composer}<nav class="tabs" role="tablist">${tabs.map(([id, label, ic]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${S.tab === id}" class="${id === 'securite' || id === 'urgence' ? 'danger' : ''}">${ic}${label}</button>`).join('')}</nav>`;
  }

  function renderAll(opts) { renderHeader(); renderBanners(); renderMain(opts); renderFooter(); }

  // ---------------------------------------------------------------------
  // Administration : état de l'installation, membres, codes, remise à zéro
  // ---------------------------------------------------------------------
  const ROLE_LABEL = { groupe: 'Groupe', voyageur: 'Voyageur', admin: 'Admin' };

  function buildChecks({ st, stErr, ping, pingErr, pingDetail }) {
    const list = [];
    const add = (group, label, state, detail) => list.push({ group, label, state, detail });
    const evAgo = (e) => (e?.at ? ago(e.at) : '');

    // Appli
    add('Appli', 'Fichier config.js', DEMO || (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) ? 'ok' : 'ko',
      DEMO || CFG.SUPABASE_URL ? 'Adresse et clé Supabase renseignées.' : 'SUPABASE_URL ou SUPABASE_ANON_KEY est vide (étape 5).');
    add('Appli', 'Connexion à Supabase', 'ok', 'Tu es connecté : les connexions anonymes fonctionnent.');

    // Base
    if (stErr || !st) {
      add('Base de données', 'Script schema.sql', 'ko', 'Les fonctions d\'administration manquent : relance la dernière version de supabase/schema.sql dans le SQL Editor.');
    } else {
      add('Base de données', 'Script schema.sql', 'ok', 'Tables, règles d\'accès et codes en place.');
      add('Base de données', 'Stockage des photos', st.bucket ? 'ok' : 'ko', st.bucket ? 'Le dossier « photos » existe.' : 'Le dossier « photos » manque : relance schema.sql.');
      add('Base de données', 'Mise à jour en direct', st.realtime ? 'ok' : 'warn', st.realtime ? 'Les nouveaux messages s\'affichent sans recharger.' : 'Relance schema.sql pour activer le temps réel.');
    }

    // Notifications
    add('Notifications', 'Clé publique dans config.js', DEMO || CFG.VAPID_PUBLIC_KEY ? 'ok' : 'ko', DEMO || CFG.VAPID_PUBLIC_KEY ? 'VAPID_PUBLIC_KEY renseignée.' : 'VAPID_PUBLIC_KEY est vide dans config.js (étape 5).');
    if (pingErr === 'old') add('Notifications', 'Fonction send-push', 'ko', 'Une ancienne version est déployée : recolle le nouveau index.ts dans la fonction et redéploie.');
    else if (pingErr === 'missing') add('Notifications', 'Fonction send-push', 'ko', 'Aucune fonction nommée exactement send-push : vérifie son nom dans Edge Functions (étape 3).');
    else if (pingErr?.startsWith('http-')) add('Notifications', 'Fonction send-push', 'ko', `La fonction plante (erreur ${pingErr.slice(5)}) : ouvre son onglet Logs. Cause fréquente : secrets VAPID absents ou mal copiés.${pingDetail ? ` Détail : ${pingDetail}` : ''}`);
    else if (pingErr || !ping) add('Notifications', 'Fonction send-push', 'ko', 'La fonction ne répond pas à l\'appli. Le plus souvent, l\'ancienne version est encore déployée : recolle le nouveau index.ts dans send-push et clique sur Deploy. Sinon, vérifie que son nom est exactement send-push.');
    else {
      add('Notifications', 'Fonction send-push', 'ok', 'Déployée et joignable.');
      add('Notifications', 'Clés VAPID dans les secrets', ping.vapid ? 'ok' : 'ko', ping.vapid ? 'Présentes et valides.' : `Absentes ou invalides (étape 3)${ping.vapidError ? ` : ${ping.vapidError}` : ''}.`);
      if (ping.vapidMatch === false) add('Notifications', 'Clés VAPID cohérentes', 'ko', 'La clé publique de config.js ne correspond pas au secret VAPID_PUBLIC_KEY : recopie la même clé aux deux endroits.');
      add('Notifications', 'Secret WEBHOOK_SECRET', ping.secret ? 'ok' : 'ko', ping.secret ? 'Présent.' : 'Absent des secrets de la fonction (étape 3).');
    }
    if (st) {
      add('Notifications', 'Webhook sur les messages', st.webhook ? 'ok' : 'ko', st.webhook ? 'Branché sur la table messages.' : 'Aucun webhook sur la table messages (étape 4).');
      const w = st.events?.webhook;
      if (!w) add('Notifications', 'Dernier appel du webhook', 'warn', 'Aucun appel reçu pour l\'instant. Envoie un poke pour tester.');
      else if (w.ok) add('Notifications', 'Dernier appel du webhook', 'ok', `Reçu et accepté ${evAgo(w)}.`);
      else add('Notifications', 'Dernier appel du webhook', 'ko', `Refusé ${evAgo(w)} : la phrase de l'en-tête x-webhook-secret est différente de WEBHOOK_SECRET (étape 4).`);
    }
    add('Notifications', 'Ce téléphone', S.push === 'on' ? 'ok' : 'warn',
      S.push === 'on' ? 'Notifications activées ici.' : S.push === 'denied' ? 'Notifications bloquées dans les réglages du navigateur.' : 'Notifications pas encore activées sur ce téléphone.');

    // Courrier du 1er (facultatif)
    if (st) {
      if (!st.pg_cron || !st.pg_net) add('Courrier du 1er (facultatif)', 'Extensions pg_cron et pg_net', 'warn', `${[!st.pg_cron && 'pg_cron', !st.pg_net && 'pg_net'].filter(Boolean).join(' et ')} à activer (étape 6, B).`);
      else add('Courrier du 1er (facultatif)', 'Extensions pg_cron et pg_net', 'ok', 'Activées.');
      const job = st.cron_job;
      if (!job) add('Courrier du 1er (facultatif)', 'Tâche planifiée', 'warn', 'Aucune tâche qui appelle send-push (étape 6, C).');
      else add('Courrier du 1er (facultatif)', 'Tâche planifiée', job.active ? 'ok' : 'warn', job.active ? `« ${job.name} », planifiée ${job.schedule === '5 0 1 * *' ? 'le 1er du mois à 0 h 05 UTC' : `selon « ${job.schedule} »`}.` : `« ${job.name} » est en pause : réactive-la dans Integrations > Cron.`);
      const m = st.events?.monthly;
      const last = st.cron_last;
      if (m && !m.ok) add('Courrier du 1er (facultatif)', 'Dernière levée', 'ko', `Refusée ${evAgo(m)} : la phrase de la tâche est différente de WEBHOOK_SECRET (étape 6, A).`);
      else if (m) add('Courrier du 1er (facultatif)', 'Dernière levée', 'ok', `${m.detail || 'Effectuée'} (${evAgo(m)}).`);
      else if (last && last.status === 'failed') add('Courrier du 1er (facultatif)', 'Dernière levée', 'ko', 'La dernière exécution a échoué : ouvre History dans Integrations > Cron.');
      else if (job) add('Courrier du 1er (facultatif)', 'Dernière levée', 'ok', 'Pas encore de 1er du mois depuis l\'installation.');
    }

    // Membres
    if (st) {
      add('Membres', 'Voyageur inscrit', st.traveler ? 'ok' : 'warn', st.traveler ? `${travelerName()} a rejoint avec son code.` : 'Personne n\'a encore rejoint avec le code VOY-.');
      add('Membres', 'Groupe', st.members > 1 ? 'ok' : 'warn', `${st.members} membre${st.members > 1 ? 's' : ''} actif${st.members > 1 ? 's' : ''}, ${st.devices} téléphone${st.devices > 1 ? 's' : ''} avec notifications.`);
    }
    return list;
  }

  const STATE_ICON = { ok: '✓', warn: '!', ko: '✕' };

  function adminHtml() {
    const A = S.adm;
    let checks = '<p class="fine">Vérification en cours…</p>';
    if (A.checks) {
      const ok = A.checks.filter((c) => c.state === 'ok').length;
      const ko = A.checks.filter((c) => c.state === 'ko').length;
      const groups = [...new Set(A.checks.map((c) => c.group))];
      checks = `<p class="adm-summary ${ko ? 'ko' : 'ok'}"><b>${ok} / ${A.checks.length}</b> ${ko ? `· ${ko} point${ko > 1 ? 's' : ''} à corriger` : '· tout ce qui est indispensable fonctionne'}</p>
        ${groups.map((g) => `<div class="adm-group"><span class="eyebrow">${g}</span><ul class="checks">${A.checks.filter((c) => c.group === g).map((c) =>
          `<li class="chk ${c.state}"><span class="chk-ic" aria-label="${c.state === 'ok' ? 'OK' : c.state === 'warn' ? 'À voir' : 'À corriger'}">${STATE_ICON[c.state]}</span><div><strong>${esc(c.label)}</strong><span>${esc(c.detail)}</span></div></li>`).join('')}</ul></div>`).join('')}`;
    }

    const ask = A.ask;
    const members = A.members.map((m) => {
      const self = m.id === S.me?.id;
      const role = m.is_admin ? 'admin' : m.role;
      const asking = ask?.type === 'remove' && ask.id === m.id;
      const action = self ? '<span class="fine">C\'est toi</span>'
        : m.removed_at ? `<button type="button" class="btn small" data-act="adm-restore" data-id="${m.id}">Réintégrer</button>`
          : `<button type="button" class="btn small" data-act="adm-ask-remove" data-id="${m.id}">Retirer</button>`;
      return `<li class="mem${m.removed_at ? ' removed' : ''}">
        <div class="mem-main"><strong>${esc(m.name)}</strong><span class="role-chip ${role}">${ROLE_LABEL[role]}</span>
          <span class="fine">${m.removed_at ? `Retiré le ${fmtDate(m.removed_at)}` : `Inscrit le ${fmtDate(m.created_at)} · ${m.devices ? `${m.devices} téléphone${m.devices > 1 ? 's' : ''} notifié${m.devices > 1 ? 's' : ''}` : 'sans notifications'}`}</span></div>
        ${asking ? '' : action}
        ${asking ? `<div class="confirm"><strong>Retirer ${esc(m.name)} ?</strong>
          <p class="fine">${role === 'voyageur' ? 'C\'est le voyageur : il ne pourra plus utiliser l\'appli, ni le bouton SOS. ' : ''}L'accès est coupé tout de suite et ses messages restent visibles. Pour qu'il ne puisse pas revenir depuis un autre téléphone, change ensuite le code ${ROLE_LABEL[m.role]}.</p>
          <div class="row"><button type="button" class="btn small danger-btn" data-act="adm-remove" data-id="${m.id}">Retirer</button><button type="button" class="btn small" data-act="adm-cancel">Annuler</button></div></div>` : ''}
      </li>`;
    }).join('');

    const codes = A.codes.map((c) => {
      const asking = ask?.type === 'regen' && ask.role === c.role;
      return `<li class="code-row">
        <div><span class="eyebrow">${c.role === 'groupe' ? 'Collègues' : c.role === 'voyageur' ? 'Voyageur' : 'Administrateur'}</span><code class="code" id="code-${c.role}">${esc(c.code)}</code></div>
        <div class="row"><button type="button" class="btn small" data-act="adm-copy" data-r="${c.role}" data-copy="${esc(c.code)}">Copier</button><button type="button" class="btn small" data-act="adm-ask-regen" data-r="${c.role}">Changer</button></div>
        ${asking ? `<div class="confirm"><strong>Changer le code ${ROLE_LABEL[c.role]} ?</strong><p class="fine">L'ancien code ne fonctionnera plus pour rejoindre. Les membres déjà inscrits ne sont pas concernés.</p>
          <div class="row"><button type="button" class="btn small danger-btn" data-act="adm-regen" data-r="${c.role}">Changer le code</button><button type="button" class="btn small" data-act="adm-cancel">Annuler</button></div></div>` : ''}
      </li>`;
    }).join('');

    return `<div class="pane admin">
      <div class="adm-top"><button type="button" class="link-btn" data-tab="${isTraveler() ? 'securite' : 'urgence'}">← Retour</button><h2>Administration</h2></div>

      <section class="card">
        <div class="adm-head"><h3>État de l'installation</h3><button type="button" class="btn small" data-act="adm-refresh"${A.loading ? ' disabled' : ''}>${A.loading ? 'Vérification…' : 'Relancer'}</button></div>
        ${checks}
        <button type="button" class="btn small jade" data-act="adm-test-push"${S.push === 'on' ? '' : ' disabled'}>M'envoyer une notification de test</button>
        ${S.push === 'on' ? '' : '<p class="fine">Active d\'abord les notifications sur ce téléphone (bandeau en haut de l\'appli).</p>'}
      </section>

      <section class="card">
        <h3>Membres</h3>
        <ul class="members">${members || '<li class="fine">Chargement…</li>'}</ul>
      </section>

      <section class="card">
        <h3>Codes d'invitation</h3>
        <ul class="codes">${codes || '<li class="fine">Chargement…</li>'}</ul>
        <p class="fine">Le code Administrateur te donne ces droits : garde-le pour toi.</p>
      </section>

      <section class="card reset">
        <h3>Remise à zéro</h3>
        <p class="fine">Efface tous les messages, photos, membres et abonnements, par exemple après les tests et avant le départ. Tu restes administrateur et les codes sont conservés. Chacun devra rejoindre à nouveau.</p>
        <label class="field" for="reset-confirm">Tape EFFACER pour confirmer<input id="reset-confirm" type="text" autocomplete="off" autocapitalize="characters" placeholder="EFFACER"></label>
        <button type="button" class="btn small danger-btn" data-act="adm-reset">Tout effacer</button>
      </section>
    </div>`;
  }

  async function loadAdmin() {
    S.adm.loading = true;
    if (S.tab === 'admin') renderMain();
    try {
      const [diag, members, codes] = await Promise.all([db.adminStatus(), db.adminMembers(), db.adminCodes()]);
      S.adm.checks = buildChecks(diag);
      S.adm.members = members || [];
      S.adm.codes = codes || [];
    } catch (err) {
      S.adm.checks = buildChecks({ stErr: err.message });
    }
    S.adm.loading = false;
    if (S.tab === 'admin') renderMain();
  }

  async function adminAction(act, t) {
    const A = S.adm;
    try {
      switch (act) {
        case 'adm-refresh': return loadAdmin();
        case 'adm-cancel': A.ask = null; return renderMain();
        case 'adm-ask-remove': A.ask = { type: 'remove', id: t.dataset.id }; return renderMain();
        case 'adm-ask-regen': A.ask = { type: 'regen', role: t.dataset.r }; return renderMain();
        case 'adm-remove': {
          const m = A.members.find((x) => x.id === t.dataset.id);
          await db.adminRemove(t.dataset.id); A.ask = null;
          toast(`${m?.name || 'Le membre'} est retiré. Pense à changer le code ${ROLE_LABEL[m?.role] || ''}.`);
          S.members = await db.members();
          return loadAdmin();
        }
        case 'adm-restore': await db.adminRestore(t.dataset.id); toast('Membre réintégré.'); S.members = await db.members(); return loadAdmin();
        case 'adm-regen': {
          const code = await db.adminRegenerate(t.dataset.r); A.ask = null;
          toast(`Nouveau code : ${code}`);
          A.codes = await db.adminCodes(); return renderMain();
        }
        case 'adm-copy': return copyText(t.dataset.copy, $(`#code-${t.dataset.r}`));
        case 'adm-test-push': {
          const r = await db.adminTestPush();
          toast(r.sent ? `Notification envoyée sur ${r.sent} téléphone${r.sent > 1 ? 's' : ''}.` : r.total ? `Échec de l'envoi (${(r.errors || []).join(', ') || 'erreur inconnue'}) : vérifie les clés VAPID.` : 'Aucun téléphone abonné : active les notifications ici.');
          return;
        }
        case 'adm-reset': {
          const v = ($('#reset-confirm')?.value || '').trim().toUpperCase();
          if (v !== 'EFFACER') { toast('Tape EFFACER dans le champ pour confirmer.'); $('#reset-confirm')?.focus(); return; }
          toast('Remise à zéro en cours…');
          await db.adminReset(v);
          S.members = await db.members(); S.messages = await db.list().catch(() => []);
          toast(DEMO ? 'Démo : rien n\'a été effacé pour de vrai.' : 'Toutes les données ont été effacées.');
          renderHeader();
          return loadAdmin();
        }
      }
    } catch (err) {
      toast(err.message || 'L\'opération a échoué.');
    }
  }

  function accountHtml() {
    const ask = S.ask;
    const confirmBox = (title, text, act, label) => `<div class="confirm" role="alertdialog" aria-label="${title}">
        <strong>${title}</strong><p class="fine">${text}</p>
        <div class="row"><button type="button" class="btn small danger-btn" data-act="${act}">${label}</button><button type="button" class="btn small" data-act="cancel-ask">Annuler</button></div>
      </div>`;
    return `<h2 class="section-title">Mon compte</h2>
      <div class="card account">
        <p class="fine">Connecté en tant que <b>${esc(S.me?.name || '')}</b> · ${isTraveler() ? 'voyageur' : S.me?.is_admin ? 'groupe, administrateur' : 'groupe'}</p>
        ${ask === 'logout' ? confirmBox('Se déconnecter ?', 'Pour revenir, il faudra le code d\'invitation et ton prénom. Tes messages restent dans le groupe. Ce téléphone ne recevra plus de notifications.', 'logout', 'Se déconnecter')
          : ask === 'raz' ? confirmBox('Réinitialiser l\'appli sur ce téléphone ?', 'Déconnexion, arrêt des notifications, effacement des réglages et des fichiers gardés hors ligne. Rien n\'est supprimé pour le groupe.', 'raz', 'Tout réinitialiser')
          : `<div class="row">${S.me?.is_admin ? '<button type="button" class="btn small jade" data-act="open-admin">Administration</button>' : ''}<button type="button" class="btn small" data-act="ask-logout">Se déconnecter</button><button type="button" class="btn small" data-act="ask-raz">RAZ de l'appli</button></div>`}
      </div>`;
  }

  async function logout() {
    await db.signOut().catch(() => {});
    S.me = null; S.ask = null; S.replyTo = null; S.writeOpen = false; S.expanded = null; S.tab = 'pays';
    renderJoin();
  }

  async function resetApp() {
    await db.signOut().catch(() => {});
    ['oscc-country', 'oscc-demo-role', 'rt-opened'].forEach((k) => { try { localStorage.removeItem(k); } catch { /* indisponible */ } });
    if (DEMO) {
      CLOCK.shift = 0;
      Object.assign(S, { me: null, ask: null, replyTo: null, writeOpen: false, expanded: null, tab: 'pays', country: '', draft: '' });
      toast('Démo réinitialisée.');
      return renderJoin();
    }
    try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* indisponible */ }
    try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch { /* indisponible */ }
    location.replace(location.pathname);
  }

  function renderJoin(error = '') {
    $('#hdr').innerHTML = `<div class="sky"><div class="brand"><img src="${LOGO}" alt="" width="30" height="30"><h1>ROADTRIP<small>Rejoindre le groupe</small></h1></div></div>`;
    $('#bnr').innerHTML = '';
    $('#ftr').innerHTML = '';
    $('#main').innerHTML = `<form class="join" id="join-form">
      <h2>Le road trip de ${esc(CFG.TRAVELER_NAME)} en Asie</h2>
      <p class="muted" style="margin:0">Entre ton prénom et le code d'invitation que t'a transmis l'organisateur.</p>
      ${DEMO ? '<p class="fine">Démo : tape n\'importe quel code commençant par GRP- (groupe), VOY- (voyageur) ou ADM- (administrateur).</p>' : ''}
      <label class="field" for="join-name">Prénom<input id="join-name" required maxlength="40" autocomplete="given-name"></label>
      <label class="field" for="join-code">Code d'invitation<input id="join-code" required autocomplete="off" autocapitalize="characters" placeholder="GRP-XXXXXXXX"></label>
      ${error ? `<p role="alert" style="color:var(--sos);margin:0">${esc(error)}</p>` : ''}
      <button type="submit" class="btn jade block">Rejoindre</button>
    </form>`;
    $('#join-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Connexion…';
      try { S.me = await db.join($('#join-code').value, $('#join-name').value); await start(); }
      catch (err) { renderJoin(err.message || 'Connexion impossible.'); }
    });
  }

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  function addMessage(m) {
    if (S.messages.some((x) => x.id === m.id)) return;
    S.messages.push(m);
    S.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    renderHeader(); renderBanners();
    if (S.sos.phase === 'holding' || S.sos.phase === 'sending') return;
    if (S.tab !== 'fil' || !$('#feed')) { if (!(isTraveler() && m.author_id === S.me?.id)) renderMain(); return; }
    renderMain({ toBottom: m.author_id === S.me?.id });
  }

  async function send(fields, okText) {
    try {
      const m = await db.send({ reply_to: S.replyTo || null, ...fields });
      addMessage(m);
      if (okText) toast(okText);
      return m;
    } catch (err) {
      toast(err.message || "L'envoi a échoué, réessaie.");
      throw err;
    }
  }

  async function doCheckin() {
    const place = $('#ok-place')?.value.trim() || '';
    toast('Récupération de ta position…');
    let pos = await getPosition(8000);
    if (!pos && DEMO) pos = { lat: 20.7276, lng: 107.0485, accuracy: 30 };
    const battery = await getBattery();
    await send({ kind: 'checkin', body: place || null, country: S.country || null, ...(pos || {}), battery, reply_to: null },
      pos ? 'Tout le monde sait que tu vas bien.' : 'Envoyé, sans position (GPS indisponible).');
    const inp = $('#ok-place'); if (inp) inp.value = '';
    renderAll();
  }

  async function triggerSos() {
    S.sos = { phase: 'sending' }; renderMain();
    let pos = await getPosition(10000);
    if (!pos && DEMO) pos = { lat: 20.7276, lng: 107.0485, accuracy: 40 };
    const battery = await getBattery();
    const text = sosText(pos, battery);
    const count = Math.max(0, S.members.length - 1);
    if (!navigator.onLine) { S.sos = { phase: 'failed', text }; renderMain(); return; }
    try {
      await db.send({ kind: 'sos', body: 'Alerte déclenchée depuis le bouton SOS.', country: S.country || null, ...(pos || {}), battery, reply_to: null });
      S.sos = { phase: 'sent', at: Date.now(), count, text };
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch {
      S.sos = { phase: 'failed', text };
    }
    // Recharge le fil pour y faire apparaître le SOS
    S.messages = await db.list().catch(() => S.messages);
    renderAll();
    $('#sos-result')?.scrollIntoView({ block: 'center' });
  }

  function bindSos() {
    const btn = $('#sos-btn');
    if (!btn) return;
    let raf = 0, t0 = 0, active = false;
    const HOLD = 3000;
    const label = () => btn.querySelector('small');
    const reset = () => { active = false; cancelAnimationFrame(raf); btn.style.setProperty('--p', 0); if (S.sos.phase === 'holding') { S.sos = { phase: 'idle' }; label().textContent = 'Maintiens 3 secondes'; } };
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / HOLD);
      btn.style.setProperty('--p', (p * 100).toFixed(1));
      if (p >= 1) { active = false; triggerSos(); return; }
      raf = requestAnimationFrame(tick);
    };
    const begin = (e) => {
      if (active || S.sos.phase === 'sending') return;
      e.preventDefault();
      active = true; t0 = performance.now(); S.sos = { phase: 'holding' }; label().textContent = "Continue d'appuyer…";
      if (navigator.vibrate) navigator.vibrate(40);
      raf = requestAnimationFrame(tick);
    };
    btn.addEventListener('pointerdown', (e) => { btn.setPointerCapture?.(e.pointerId); begin(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, () => active && reset()));
    btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) begin(e); });
    btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') active && reset(); });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  async function enablePush() {
    try {
      await db.enablePush();
      S.push = 'on';
      toast(DEMO ? 'Démo : notifications activées (simulation).' : 'Notifications activées.');
    } catch (err) {
      S.push = await db.pushStatus().catch(() => 'off');
      toast(err.message);
    }
    renderBanners();
  }

  function gotoMessage(id) {
    if (!id) return;
    const home = isTraveler() ? 'cartes' : 'fil';
    if (S.tab !== home) { S.tab = home; renderMain(); renderFooter(); }
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  // Délégation d'événements
  app.addEventListener('click', async (e) => {
    const t = e.target.closest('button, [data-tab]');
    if (!t) return;
    if (t.dataset.role && DEMO) {
      db.setRole(t.dataset.role); S.me = db.me; S.tab = 'pays'; S.replyTo = null; S.writeOpen = false; S.expanded = null; S.sos = { phase: 'idle' };
      if (isTraveler() && !S.country) S.country = currentCountry();
      S.push = await db.pushStatus(); renderAll({ toBottom: true, top: true }); if (isTraveler()) $('#main').scrollTop = 0; return;
    }
    if (t.dataset.tab) { S.tab = t.dataset.tab; renderMain({ toBottom: true, top: true }); if (S.tab !== 'fil') $('#main').scrollTop = 0; renderFooter(); return; }
    if (t.dataset.goto) { gotoMessage(t.dataset.goto); return; }
    if (t.dataset.poke) {
      const p = POKE[t.dataset.poke];
      await send({ kind: 'poke', poke: p.id, reply_to: null }, `${p.emo} Glissé dans le courrier ${deName(travelerName())}`).catch(() => {});
      return;
    }
    if (t.dataset.quick) { await send({ kind: 'texte', body: t.dataset.quick }).catch(() => {}); S.replyTo = null; renderFooter(); return; }
    if (t.dataset.act?.startsWith('adm-')) return adminAction(t.dataset.act, t);
    switch (t.dataset.act) {
      case 'push': return enablePush();
      case 'checkin': return doCheckin().catch(() => {});
      case 'reply': S.replyTo = t.dataset.id; renderFooter(); if (S.tab === 'cartes') renderMain(); $('#draft')?.focus(); return;
      case 'cancel-reply': S.replyTo = null; renderFooter(); if (S.tab === 'cartes') renderMain(); return;
      case 'write': S.writeOpen = true; renderMain(); renderFooter(); $('#draft')?.focus(); return;
      case 'close-write': S.writeOpen = false; S.replyTo = null; renderMain(); renderFooter(); return;
      case 'open-batch': {
        const k = Number(t.dataset.k);
        S.expanded = k; markOpened(k); renderMain();
        const el = document.getElementById(`batch-${k}`);
        if (el) { el.closest('.batch')?.classList.add('just-opened'); el.scrollIntoView({ block: 'start' }); }
        return;
      }
      case 'close-batch': S.expanded = null; renderMain(); return;
      case 'take':
        await send({ kind: 'texte', body: `Je m'en occupe, j'essaie de joindre ${travelerName()}.`, reply_to: t.dataset.id }, 'Le groupe sait que tu t\'en occupes.').catch(() => {});
        return;
      case 'false-alarm':
        await send({ kind: 'texte', body: 'Fausse alerte : tout va bien, désolé !', reply_to: t.dataset.id }, 'Le groupe est rassuré.').catch(() => {});
        S.sos = { phase: 'idle' }; renderAll();
        return;
      case 'demo-skip': {
        const k = nextOpening();
        const n = sealedStats().total;
        CLOCK.shift = k + 7 * 3600e3 - Date.now();
        renderAll({ top: true });
        toast(`📬 Courrier ${deName(monthName(k - 86400e3))} arrivé : ${n} envoi${n > 1 ? 's' : ''}, à ouvrir quand tu veux.`);
        return;
      }
      case 'demo-reset': CLOCK.shift = 0; renderAll({ top: true }); $('#main').scrollTop = 0; return;
      case 'ask-logout': S.ask = 'logout'; renderMain(); return;
      case 'ask-raz': S.ask = 'raz'; renderMain(); return;
      case 'cancel-ask': S.ask = null; renderMain(); return;
      case 'logout': return logout();
      case 'raz': return resetApp();
      case 'open-admin': S.tab = 'admin'; S.adm.ask = null; renderMain({ top: true }); $('#main').scrollTop = 0; renderFooter(); return loadAdmin();
      case 'copy-sos': return copyText(S.sos.text || '', $('#sos-copy-text'));
      case 'install':
        if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; renderMain(); }
        return;
    }
  });

  app.addEventListener('submit', async (e) => {
    if (e.target.id !== 'compose') return;
    e.preventDefault();
    const body = S.draft.trim();
    if (!body) return;
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    try {
      await send({ kind: 'texte', body }, isTraveler() ? 'Envoyé au groupe.' : null);
      S.draft = ''; S.replyTo = null; S.writeOpen = false; renderFooter(); if (S.tab === 'cartes') renderMain();
    } catch { /* message déjà affiché */ } finally { btn.disabled = false; }
  });

  app.addEventListener('input', (e) => {
    if (e.target.id === 'draft') {
      S.draft = e.target.value;
      e.target.style.height = 'auto'; e.target.style.height = `${Math.min(120, e.target.scrollHeight)}px`;
    }
  });

  app.addEventListener('keydown', (e) => {
    if (e.target.id === 'draft' && e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) {
      e.preventDefault(); $('#compose')?.requestSubmit();
    }
  });

  app.addEventListener('change', async (e) => {
    if (e.target.id === 'photo-input' && e.target.files[0]) {
      const file = e.target.files[0];
      toast('Envoi de la photo…');
      const body = S.draft.trim() || null;
      try {
        await send({ kind: 'photo', file, body }, 'Photo envoyée.');
        S.draft = ''; S.replyTo = null; renderFooter();
      } catch { /* toast déjà affiché */ }
    }
    if (e.target.id === 'ok-country') { S.country = e.target.value; store.set('oscc-country', S.country); renderMain(); }
    if (e.target.id === 'urg-country') { S.urgenceCountry = e.target.value; renderMain(); }
    if (e.target.id === 'pays-country') { S.paysCountry = e.target.value; renderMain(); $('#main').scrollTop = 0; }
  });

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; });

  // ---------------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------------
  async function refresh() {
    try { S.messages = await db.list(); renderAll(); } catch { /* hors ligne : on garde l'affichage */ }
  }

  async function start() {
    S.members = await db.members();
    S.messages = await db.list().catch(() => []);
    S.push = await db.pushStatus().catch(() => 'off');
    S.tab = 'pays';
    if (isTraveler() && !S.country) S.country = currentCountry();
    renderAll({ toBottom: true });
    if (!S.started) { S.started = true; db.onMessage(addMessage); setInterval(() => S.me && renderHeader(), 60000); }
    const hash = location.hash.match(/^#m-(.+)$/);
    if (hash) setTimeout(() => gotoMessage(hash[1]), 300);
  }

  (async () => {
    if (!DEMO && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'open') { const m = e.data.url.match(/#m-(.+)$/); refresh().then(() => m && gotoMessage(m[1])); }
      });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.me) refresh(); });
    }
    try {
      S.me = await db.init();
    } catch {
      S.me = null;
    }
    if (!S.me) return renderJoin();
    start();
  })();
})();
