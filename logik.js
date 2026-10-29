/* übergabe. Rechenlogik als reine Funktionen, ohne DOM. Läuft in Node und im Browser. Lizenz AGPL-3.0. */
(function (wurzel, fabrik) {
  const m = fabrik();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else wurzel.Logik = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FORMAT = 'uebergabe';
  const VERSION = 1;

  /* ---------- Zahlen ---------- */

  // Deutsche Zahl zu Number. Punkt trennt Tausender (nur in Dreiergruppen), Komma trennt Dezimalstellen.
  // "12.345,6" -> 12345.6, "0815" -> 815, "12,3,4" -> null, "" -> null
  function zahlLesen(text) {
    if (typeof text === 'number') return Number.isFinite(text) ? text : null;
    if (typeof text !== 'string') return null;
    const t = text.replace(/[\s ]/g, '');
    if (!/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(t)) return null;
    const n = Number(t.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  // Number zu deutscher Schreibweise mit Tausenderpunkt, Nachkommastellen so viele wie nötig (höchstens 6).
  function zahlSchreiben(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '';
    const neg = n < 0;
    const s = Math.abs(n).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    const [ganz, nach] = s.split('.');
    const g = ganz.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + g + (nach ? ',' + nach : '');
  }

  /* ---------- Bildgröße ---------- */

  // Zielgröße bei gleichem Seitenverhältnis, gerundet, nie vergrößern. Gibt [breite, hoehe].
  function skalieren(b, h, max) {
    const lang = Math.max(b, h);
    if (lang <= max) return [b, h];
    const f = max / lang;
    return [Math.round(b * f), Math.round(h * f)];
  }

  /* ---------- Schlüssel ---------- */

  function schluesselSumme(liste) {
    let s = 0;
    for (const k of liste || []) {
      const n = Number(k && k.anzahl);
      if (Number.isFinite(n) && n > 0) s += Math.floor(n);
    }
    return s;
  }

  /* ---------- SHA-256 (FIPS 180-4), synchron, ohne Abhängigkeiten ---------- */

  const K = new Uint32Array(64);
  const H0 = new Uint32Array(8);
  (function konstanten() {
    const primzahlen = [];
    for (let n = 2; primzahlen.length < 64; n++) {
      if (primzahlen.every((p) => n % p)) primzahlen.push(n);
    }
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) >>> 0;
    for (let i = 0; i < 64; i++) K[i] = frac(Math.cbrt(primzahlen[i]));
    for (let i = 0; i < 8; i++) H0[i] = frac(Math.sqrt(primzahlen[i]));
  })();

  function sha256(bytes) {
    if (typeof bytes === 'string') bytes = utf8(bytes);
    const l = bytes.length;
    const n = ((l + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(n);
    m.set(bytes);
    m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(n - 8, Math.floor(l / 536870912));
    dv.setUint32(n - 4, (l * 8) >>> 0);
    const H = Uint32Array.from(H0);
    const w = new Uint32Array(64);
    const ror = (x, r) => (x >>> r) | (x << (32 - r));
    for (let o = 0; o < n; o += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(o + t * 4);
      for (let t = 16; t < 64; t++) {
        const a = w[t - 15], b = w[t - 2];
        const s0 = ror(a, 7) ^ ror(a, 18) ^ (a >>> 3);
        const s1 = ror(b, 17) ^ ror(b, 19) ^ (b >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let t = 0; t < 64; t++) {
        const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    let hex = '';
    for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, '0');
    return hex;
  }

  function utf8(s) {
    return new TextEncoder().encode(s);
  }

  /* ---------- Base64 ---------- */

  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const B64R = new Int16Array(256).fill(-1);
  for (let i = 0; i < 64; i++) B64R[B64.charCodeAt(i)] = i;

  function base64Schreiben(bytes) {
    let s = '';
    let i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    const rest = bytes.length - i;
    if (rest === 1) {
      const n = bytes[i] << 16;
      s += B64[n >> 18] + B64[(n >> 12) & 63] + '==';
    } else if (rest === 2) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
      s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
    }
    return s;
  }

  function base64Lesen(s) {
    s = String(s).replace(/[\s=]/g, '');
    if (s.length % 4 === 1) return null;
    const out = new Uint8Array(Math.floor((s.length * 3) / 4));
    let bits = 0, puffer = 0, j = 0;
    for (let i = 0; i < s.length; i++) {
      const v = B64R[s.charCodeAt(i) & 255];
      if (v < 0 || s.charCodeAt(i) > 255) return null;
      puffer = (puffer << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out[j++] = (puffer >> bits) & 255;
      }
    }
    return out.subarray(0, j);
  }

  function dataUrlLesen(url) {
    const m = /^data:image\/jpeg;base64,(.*)$/s.exec(String(url || ''));
    return m ? base64Lesen(m[1]) : null;
  }

  function dataUrlSchreiben(bytes) {
    return 'data:image/jpeg;base64,' + base64Schreiben(bytes);
  }

  /* ---------- Kanonische Form und Prüfsumme ---------- */

  // JSON mit sortierten Schlüsseln, ohne Leerzeichen. undefined fällt weg wie bei JSON.stringify.
  function stabil(v) {
    if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : stabil(x))).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined)
        .map((k) => JSON.stringify(k) + ':' + stabil(v[k])).join(',') + '}';
    }
    const s = JSON.stringify(v);
    return s === undefined ? 'null' : s;
  }

  // Ohne pruefsumme und unterschriften, dazu ohne id und beispiel (gehören nicht zum Inhalt,
  // eine importierte Kopie behält so ihre Prüfsumme). Fotos werden durch ihre SHA-256 ersetzt.
  function kanonisch(p, fotoHash) {
    const h = (id) => (id == null ? null : (fotoHash && fotoHash[id]) || 'fehlt');
    const k = {};
    for (const key of Object.keys(p)) {
      if (key === 'pruefsumme' || key === 'unterschriften' || key === 'id' || key === 'beispiel' || key === 'fotos') continue;
      k[key] = p[key];
    }
    k.raeume = (p.raeume || []).map((r) => Object.assign({}, r, {
      maengel: (r.maengel || []).map((m) => Object.assign({}, m, { fotos: (m.fotos || []).map(h) })),
    }));
    k.zaehler = (p.zaehler || []).map((z) => Object.assign({}, z, { foto: h(z.foto) }));
    return stabil(k);
  }

  function pruefsumme(p, fotoHash) {
    return sha256(utf8(kanonisch(p, fotoHash)));
  }

  // Erste 16 Zeichen in Vierergruppen: "ba78 16bf 8f01 cfea"
  function pruefsummeKurz(hex) {
    return String(hex || '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');
  }

  /* ---------- Protokoll ---------- */

  const RAUM_VORSCHLAEGE = ['Flur', 'Küche', 'Bad', 'Wohnzimmer', 'Schlafzimmer', 'Balkon', 'Keller'];
  const ZAEHLER_TYPEN = {
    strom: { name: 'Strom', einheit: 'kWh' },
    gas: { name: 'Gas', einheit: 'm³' },
    wasser_kalt: { name: 'Wasser kalt', einheit: 'm³' },
    wasser_warm: { name: 'Wasser warm', einheit: 'm³' },
    waerme: { name: 'Wärme', einheit: 'kWh' },
    hkv: { name: 'Heizkostenverteiler', einheit: 'Einheiten' },
  };
  const SCHLUESSEL_ARTEN = {
    haustuer: 'Haustür', wohnung: 'Wohnung', briefkasten: 'Briefkasten', keller: 'Keller', sonstiges: 'Sonstiges',
  };
  const ZUSTAND = { ok: 'in Ordnung', maengel: 'Mängel', offen: 'nicht geprüft' };
  const STUFEN = { gering: 'gering', mittel: 'mittel', erheblich: 'erheblich' };

  function neueId(zufall) {
    const z = zufall || Math.random;
    let s = '';
    for (let i = 0; i < 12; i++) s += '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(z() * 36)];
    return s;
  }

  function neuesProtokoll(id, zeitpunkt, idGen) {
    const gen = idGen || (() => neueId());
    return {
      format: FORMAT, version: VERSION, id, beispiel: false,
      art: 'einzug', zeitpunkt, adresse: '', lage: '',
      vermieter: { name: '' }, mieter: { name: '' }, anwesende: [],
      raeume: ['Flur', 'Küche', 'Bad', 'Wohnzimmer', 'Schlafzimmer'].map((name) => ({ id: gen(), name, zustand: 'offen', maengel: [] })),
      zaehler: [], schluessel: [], vereinbarungen: '',
      pruefsumme: null, unterschriften: [],
    };
  }

  function gesperrt(p) {
    return !!(p && p.unterschriften && p.unterschriften.length);
  }

  function status(p) {
    return gesperrt(p) ? 'unterschrieben' : 'entwurf';
  }

  function fotoIds(p) {
    const ids = [];
    for (const r of p.raeume || []) for (const m of r.maengel || []) for (const f of m.fotos || []) ids.push(f);
    for (const z of p.zaehler || []) if (z.foto) ids.push(z.foto);
    return ids;
  }

  function kopie(x) {
    return JSON.parse(JSON.stringify(x));
  }

  // Schreibt alle Foto-Ids über eine Abbildung alt -> neu um.
  function fotoIdsUmschreiben(p, abb) {
    const q = kopie(p);
    for (const r of q.raeume || []) for (const m of r.maengel || []) m.fotos = (m.fotos || []).map((f) => abb[f] || f);
    for (const z of q.zaehler || []) if (z.foto) z.foto = abb[z.foto] || z.foto;
    return q;
  }

  // Auszug aus Einzug vorbereiten: neue Ids, Unterschriften weg, Mängel gelten als vorhanden.
  // Gibt das neue Protokoll und die Liste [altFotoId, neuFotoId] zum Kopieren der Bilder.
  function duplizieren(p, idGen, zeitpunkt) {
    const q = kopie(p);
    q.id = idGen();
    q.beispiel = false;
    if (q.art === 'einzug') q.art = 'auszug';
    q.zeitpunkt = zeitpunkt;
    q.pruefsumme = null;
    q.unterschriften = [];
    for (const r of q.raeume) {
      r.id = idGen();
      for (const m of r.maengel) { m.id = idGen(); m.vorbestehend = true; }
    }
    for (const z of q.zaehler) z.id = idGen();
    for (const k of q.schluessel) k.id = idGen();
    const abb = {};
    for (const f of fotoIds(q)) if (!abb[f]) abb[f] = idGen();
    return { protokoll: fotoIdsUmschreiben(q, abb), fotoKopien: Object.entries(abb) };
  }

  function uebersicht(p) {
    const u = { raeume: 0, ok: 0, maengelRaeume: 0, offen: 0, maengel: 0, gering: 0, mittel: 0, erheblich: 0, neu: 0, vorbestehend: 0, zaehler: 0, schluessel: 0, fotos: 0 };
    for (const r of p.raeume || []) {
      u.raeume++;
      if (r.zustand === 'ok') u.ok++; else if (r.zustand === 'maengel') u.maengelRaeume++; else u.offen++;
      for (const m of r.maengel || []) {
        u.maengel++;
        if (u[m.stufe] !== undefined) u[m.stufe]++;
        if (m.vorbestehend) u.vorbestehend++; else u.neu++;
      }
    }
    u.zaehler = (p.zaehler || []).length;
    u.schluessel = schluesselSumme(p.schluessel);
    u.fotos = fotoIds(p).length;
    return u;
  }

  /* ---------- Export und Import ---------- */

  function exportObjekt(p, fotoDataUrls) {
    const o = kopie(p);
    o.fotos = {};
    for (const id of fotoIds(p)) if (fotoDataUrls[id]) o.fotos[id] = fotoDataUrls[id];
    return o;
  }

  // Wirft einen Error mit deutscher Meldung, wenn die Datei nicht passt.
  function importPruefen(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('keine gültige Protokolldatei');
    if (o.format !== FORMAT) throw new Error('falsches Format, erwartet "uebergabe"');
    if (o.version !== VERSION) throw new Error('Version ' + o.version + ' wird nicht unterstützt, erwartet ' + VERSION);
    if (typeof o.id !== 'string' || !o.id) throw new Error('Protokoll ohne id');
    if (!Array.isArray(o.raeume) || !Array.isArray(o.zaehler) || !Array.isArray(o.schluessel)) throw new Error('Räume, Zähler oder Schlüssel fehlen');
    if (o.art !== 'einzug' && o.art !== 'auszug') throw new Error('unbekannte Art');
    for (const id of fotoIds(o)) {
      if (!o.fotos || !dataUrlLesen(o.fotos[id])) throw new Error('Foto ' + id + ' fehlt oder ist kein JPEG');
    }
    return true;
  }

  // Bereitet ein geprüftes Exportobjekt zum Speichern vor. Bei vorhandener id gibt es eine Kopie mit neuer id.
  // Foto-Ids werden immer neu vergeben, damit sich nichts mit vorhandenen Fotos überschneidet.
  function importVorbereiten(o, vorhandeneIds, idGen) {
    importPruefen(o);
    const p = kopie(o);
    const roh = p.fotos || {};
    delete p.fotos;
    if (vorhandeneIds.includes(p.id)) p.id = idGen();
    const abb = {};
    const fotos = [];
    for (const alt of fotoIds(p)) {
      if (abb[alt]) continue;
      abb[alt] = idGen();
      fotos.push({ id: abb[alt], bytes: dataUrlLesen(roh[alt]) });
    }
    return { protokoll: fotoIdsUmschreiben(p, abb), fotos };
  }

  /* ---------- Anzeige ---------- */

  // "2026-10-29T14:30" -> "29.10.2026, 14:30" (ohne Zeitzonenrechnung, so wie eingegeben)
  function zeitpunktAnzeige(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(iso || ''));
    if (!m) return '';
    return m[3] + '.' + m[2] + '.' + m[1] + (m[4] ? ', ' + m[4] + ':' + m[5] : '');
  }

  function groesseAnzeige(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' kB';
    return zahlSchreiben(Math.round(bytes / 1024 / 1024 * 10) / 10) + ' MB';
  }

  // Dateiname aus Datum und Adresse, nur ASCII.
  function dateiname(p, endung) {
    const datum = String(p.zeitpunkt || '').slice(0, 10);
    const ort = String(p.adresse || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return ['uebergabe', p.art, datum, ort].filter(Boolean).join('-') + endung;
  }

  return {
    FORMAT, VERSION, RAUM_VORSCHLAEGE, ZAEHLER_TYPEN, SCHLUESSEL_ARTEN, ZUSTAND, STUFEN,
    zahlLesen, zahlSchreiben, skalieren, schluesselSumme,
    sha256, utf8, base64Schreiben, base64Lesen, dataUrlLesen, dataUrlSchreiben,
    stabil, kanonisch, pruefsumme, pruefsummeKurz,
    neueId, neuesProtokoll, gesperrt, status, fotoIds, fotoIdsUmschreiben, duplizieren, uebersicht, kopie,
    exportObjekt, importPruefen, importVorbereiten,
    zeitpunktAnzeige, groesseAnzeige, dateiname,
  };
});
