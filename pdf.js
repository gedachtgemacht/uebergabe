/* übergabe. Kleiner PDF-Schreiber: Helvetica mit WinAnsiEncoding, JPEG über DCTDecode, Pfade, A4.
   Ohne Bibliothek, läuft in Node und im Browser. Lizenz AGPL-3.0. */
(function (wurzel, fabrik) {
  const L = typeof module === 'object' && module.exports ? require('./logik.js') : wurzel.Logik;
  const m = fabrik(L);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else wurzel.Pdf = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L) {
  'use strict';

  const A4 = [595, 842];

  /* ---------- WinAnsi ---------- */

  // Codepunkte 0x80 bis 0x9F in WinAnsi (Windows-1252), der Rest von 0xA0 bis 0xFF entspricht Latin-1.
  const CP1252 = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
    0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
    0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
    0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
  };

  // Ein Zeichen zu seinem WinAnsi-Code. Zeichen ohne Abbildung werden zu "?" (0x3F).
  function winAnsi(ch) {
    const c = ch.codePointAt(0);
    if (c === 9) return 0x20;
    if (c >= 0x20 && c <= 0x7e) return c;
    if (c >= 0xa0 && c <= 0xff) return c;
    if (CP1252[c]) return CP1252[c];
    return 0x3f;
  }

  function winAnsiCodes(text) {
    const out = [];
    for (const ch of String(text)) out.push(winAnsi(ch));
    return out;
  }

  /* ---------- Helvetica-Breiten (AFM, Einheiten je 1000) nach WinAnsi-Code ---------- */

  const W = new Uint16Array(256);
  (function breiten() {
    const ascii = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
      556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
      1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
      667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
      333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
      556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
    for (let i = 0; i < ascii.length; i++) W[0x20 + i] = ascii[i];
    const hoch = [556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
      0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
      278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
      400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
      667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
      722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
      556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
      556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500];
    for (let i = 0; i < hoch.length; i++) W[0x80 + i] = hoch[i];
  })();

  // Breite in Punkt. Fett wird mit den normalen Breiten um 6 % verbreitert geschätzt (nur für kurze Überschriften).
  function textBreite(text, groesse, fett) {
    let s = 0;
    for (const c of winAnsiCodes(text)) s += W[c] || 556;
    return (s / 1000) * groesse * (fett ? 1.06 : 1);
  }

  // Bricht an Leerzeichen, nie mitten im Wort, außer ein Wort ist allein zu breit. Zeilenumbrüche im Text bleiben.
  function umbrechen(text, breite, groesse) {
    const zeilen = [];
    for (const absatz of String(text == null ? '' : text).split(/\r?\n/)) {
      const woerter = absatz.split(/ +/).filter((w) => w.length);
      if (!woerter.length) { zeilen.push(''); continue; }
      let zeile = '';
      for (let w of woerter) {
        const probe = zeile ? zeile + ' ' + w : w;
        if (textBreite(probe, groesse) <= breite) { zeile = probe; continue; }
        if (zeile) { zeilen.push(zeile); zeile = ''; }
        while (textBreite(w, groesse) > breite) {
          let n = 1;
          const zeichen = Array.from(w);
          while (n < zeichen.length && textBreite(zeichen.slice(0, n + 1).join(''), groesse) <= breite) n++;
          zeilen.push(zeichen.slice(0, n).join(''));
          w = zeichen.slice(n).join('');
        }
        zeile = w;
      }
      zeilen.push(zeile);
    }
    return zeilen;
  }

  /* ---------- JPEG ---------- */

  // Liest Breite, Höhe und Farbkomponenten aus dem SOF-Segment. null, wenn kein JPEG.
  function jpegGroesse(b) {
    if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const mk = b[i + 1];
      if (mk === 0xff) { i++; continue; }
      if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
        return { hoehe: (b[i + 5] << 8) | b[i + 6], breite: (b[i + 7] << 8) | b[i + 8], komponenten: b[i + 9] };
      }
      i += 2 + len;
    }
    return null;
  }

  /* ---------- Bytes ---------- */

  function latin1(s) {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
    return out;
  }

  // PDF-Stringliteral, nur ASCII: Klammern und Backslash maskiert, alles außerhalb 32..126 oktal.
  function pdfText(text) {
    let s = '(';
    for (const c of winAnsiCodes(text)) {
      if (c === 0x28 || c === 0x29 || c === 0x5c) s += '\\' + String.fromCharCode(c);
      else if (c < 0x20 || c > 0x7e) s += '\\' + c.toString(8).padStart(3, '0');
      else s += String.fromCharCode(c);
    }
    return s + ')';
  }

  const z = (n) => (Math.round(n * 100) / 100).toString();

  /* ---------- Schreiber ---------- */

  // seiten: [{ inhalt: string (Content-Stream, ASCII) }], bilder: [{ name, bytes, breite, hoehe, komponenten }]
  function pdfSchreiben(seiten, bilder, info) {
    const teile = [];
    const offsets = [];
    let pos = 0;
    const schreib = (x) => {
      const b = typeof x === 'string' ? latin1(x) : x;
      teile.push(b);
      pos += b.length;
    };
    const obj = (nr, kopf, strom) => {
      offsets[nr] = pos;
      schreib(nr + ' 0 obj\n');
      schreib(kopf);
      if (strom) {
        schreib('\nstream\n');
        schreib(strom);
        schreib('\nendstream');
      }
      schreib('\nendobj\n');
    };

    const nBild = 5;
    const nSeite = nBild + bilder.length;
    const seitenNr = seiten.map((_, i) => nSeite + i * 2);
    const nInfo = nSeite + seiten.length * 2;

    schreib('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + seitenNr.map((n) => n + ' 0 R').join(' ') + '] /Count ' + seiten.length + ' >>');
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    bilder.forEach((b, i) => {
      const farbe = b.komponenten === 1 ? '/DeviceGray' : b.komponenten === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';
      obj(nBild + i, '<< /Type /XObject /Subtype /Image /Width ' + b.breite + ' /Height ' + b.hoehe +
        ' /ColorSpace ' + farbe + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + b.bytes.length + ' >>', b.bytes);
    });
    const xo = bilder.map((b, i) => '/' + b.name + ' ' + (nBild + i) + ' 0 R').join(' ');
    const res = '<< /Font << /F1 3 0 R /F2 4 0 R >>' + (xo ? ' /XObject << ' + xo + ' >>' : '') + ' >>';
    seiten.forEach((s, i) => {
      const inhalt = latin1(s.inhalt);
      obj(seitenNr[i], '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + A4[0] + ' ' + A4[1] + '] /Resources ' + res +
        ' /Contents ' + (seitenNr[i] + 1) + ' 0 R >>');
      obj(seitenNr[i] + 1, '<< /Length ' + inhalt.length + ' >>', inhalt);
    });
    obj(nInfo, '<< /Title ' + pdfText((info && info.titel) || 'Übergabeprotokoll') + ' /Producer ' + pdfText('übergabe.') + ' >>');

    const xref = pos;
    const anzahl = nInfo + 1;
    let x = 'xref\n0 ' + anzahl + '\n0000000000 65535 f \n';
    for (let i = 1; i < anzahl; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    schreib(x);
    schreib('trailer\n<< /Size ' + anzahl + ' /Root 1 0 R /Info ' + nInfo + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');

    const out = new Uint8Array(pos);
    let o = 0;
    for (const t of teile) { out.set(t, o); o += t.length; }
    return out;
  }

  /* ---------- Satz: Seiten füllen ---------- */

  const RAND = 48;
  const OBEN = 790;
  const UNTEN = 60;
  const BREITE = A4[0] - 2 * RAND;

  function Satz() {
    this.seiten = [];
    this.neueSeite();
  }
  Satz.prototype.neueSeite = function () {
    this.ops = [];
    this.seiten.push(this.ops);
    this.y = OBEN;
  };
  Satz.prototype.platz = function (h) {
    if (this.y - h < UNTEN) this.neueSeite();
  };
  Satz.prototype.text = function (t, x, y, groesse, fett, grau) {
    this.ops.push((grau ? '0.4 0.4 0.45 rg ' : '0 0 0 rg ') + 'BT /' + (fett ? 'F2' : 'F1') + ' ' + groesse + ' Tf ' +
      z(x) + ' ' + z(y) + ' Td ' + pdfText(t) + ' Tj ET');
  };
  Satz.prototype.zeile = function (t, groesse, fett, einzug, grau) {
    const h = groesse * 1.35;
    this.platz(h);
    this.y -= h;
    this.text(t, RAND + (einzug || 0), this.y + groesse * 0.25, groesse, fett, grau);
  };
  Satz.prototype.absatz = function (t, groesse, einzug, grau) {
    for (const z1 of umbrechen(t, BREITE - (einzug || 0), groesse)) this.zeile(z1, groesse, false, einzug, grau);
  };
  // Beschriftung links, Wert rechts daneben, Wert umbrochen
  Satz.prototype.feld = function (label, wert) {
    const lb = 120;
    const zeilen = umbrechen(wert || ' ', BREITE - lb, 10);
    zeilen.forEach((t, i) => {
      this.platz(13.5);
      this.y -= 13.5;
      if (i === 0) this.text(label, RAND, this.y + 2.5, 9, false, true);
      this.text(t, RAND + lb, this.y + 2.5, 10);
    });
  };
  Satz.prototype.ueberschrift = function (t) {
    this.platz(48);
    this.y -= 14;
    this.zeile(t, 13, true);
    this.ops.push('0.75 0.75 0.8 RG 0.6 w ' + RAND + ' ' + z(this.y - 3) + ' m ' + (RAND + BREITE) + ' ' + z(this.y - 3) + ' l S');
    this.y -= 7;
  };
  Satz.prototype.luecke = function (h) { this.y -= h; };
  Satz.prototype.bild = function (name, x, y, b, h) {
    this.ops.push('q ' + z(b) + ' 0 0 ' + z(h) + ' ' + z(x) + ' ' + z(y) + ' cm /' + name + ' Do Q');
    this.ops.push('0.8 0.8 0.84 RG 0.5 w ' + z(x) + ' ' + z(y) + ' ' + z(b) + ' ' + z(h) + ' re S');
  };
  // Striche 0..1000 in ein Rechteck (x, y unten links), y im Strich zeigt nach unten.
  Satz.prototype.unterschrift = function (striche, x, y, b, h) {
    const p = ['q 0.05 0.05 0.15 RG 1.3 w 1 J 1 j'];
    for (const s of striche || []) {
      if (!s.length) continue;
      const pt = (q) => z(x + (q[0] / 1000) * b) + ' ' + z(y + h - (q[1] / 1000) * h);
      p.push(pt(s[0]) + ' m');
      if (s.length === 1) p.push(pt(s[0]) + ' l');
      for (let i = 1; i < s.length; i++) p.push(pt(s[i]) + ' l');
      p.push('S');
    }
    p.push('Q');
    this.ops.push(p.join('\n'));
  };

  // Fotos in Reihen zu je drei, Höhe nach Seitenverhältnis, höchstens 150 pt.
  function fotoReihen(satz, ids, bilder, einzug) {
    const spalten = 3, abstand = 8;
    const b = (BREITE - einzug - abstand * (spalten - 1)) / spalten;
    for (let i = 0; i < ids.length; i += spalten) {
      const reihe = ids.slice(i, i + spalten).map((id) => bilder[id]).filter(Boolean);
      if (!reihe.length) continue;
      const hs = reihe.map((bi) => Math.min(150, b * bi.hoehe / bi.breite));
      const h = Math.max(...hs);
      satz.platz(h + abstand);
      satz.y -= h + abstand / 2;
      reihe.forEach((bi, j) => {
        const bb = Math.min(b, hs[j] * bi.breite / bi.hoehe);
        satz.bild(bi.name, RAND + einzug + j * (b + abstand), satz.y + (h - hs[j]), bb, hs[j]);
      });
      satz.y -= abstand / 2;
    }
  }

  /* ---------- Protokoll als PDF ---------- */

  // p: Protokoll, fotos: { fotoId: Uint8Array JPEG }, summe: volle Prüfsumme hex
  function protokollPdf(p, fotos, summe) {
    const bilder = {};
    const liste = [];
    for (const id of L.fotoIds(p)) {
      if (bilder[id] || !fotos[id]) continue;
      const g = jpegGroesse(fotos[id]);
      if (!g) continue;
      const b = Object.assign({ name: 'Im' + (liste.length + 1), bytes: fotos[id] }, g);
      bilder[id] = b;
      liste.push(b);
    }

    const s = new Satz();
    const art = p.art === 'auszug' ? 'Auszug' : 'Einzug';
    s.zeile('Übergabeprotokoll ' + art, 20, true);
    s.luecke(2);
    s.zeile(L.zeitpunktAnzeige(p.zeitpunkt) + (p.beispiel ? '   Beispiel, erfundene Daten' : ''), 10, false, 0, true);
    if (!L.gesperrt(p)) s.zeile('Entwurf, nicht unterschrieben', 10, true);

    s.ueberschrift('Wohnung und Beteiligte');
    s.feld('Adresse', p.adresse || 'nicht angegeben');
    if (p.lage) s.feld('Lage', p.lage);
    s.feld('Vermieter', (p.vermieter && p.vermieter.name) || 'nicht angegeben');
    s.feld('Mieter', (p.mieter && p.mieter.name) || 'nicht angegeben');
    const anw = (p.anwesende || []).filter((a) => a && a.trim());
    if (anw.length) s.feld('Weitere Anwesende', anw.join(', '));

    s.ueberschrift('Räume');
    if (!(p.raeume || []).length) s.absatz('Keine Räume erfasst.', 10, 0, true);
    for (const r of p.raeume || []) {
      s.platz(40);
      s.luecke(4);
      s.zeile((r.name || 'Raum') + ':  ' + (L.ZUSTAND[r.zustand] || r.zustand), 11, true);
      if (!(r.maengel || []).length && r.zustand === 'maengel') s.absatz('Keine Mängel einzeln erfasst.', 10, 12, true);
      (r.maengel || []).forEach((m, i) => {
        // Beschreibung und erste Fotoreihe bleiben auf einer Seite
        s.platz(30 + ((m.fotos || []).some((f) => bilder[f]) ? 158 : 0));
        const zeilen = umbrechen((i + 1) + '. ' + (m.text || 'ohne Beschreibung'), BREITE - 12, 10);
        zeilen.forEach((t) => s.zeile(t, 10, false, 12));
        const meta = [m.ort ? 'Ort: ' + m.ort : '', 'Einstufung: ' + (L.STUFEN[m.stufe] || m.stufe),
          m.vorbestehend ? 'vorhanden bei Einzug' : 'neu', (m.fotos || []).length ? (m.fotos.length === 1 ? '1 Foto' : m.fotos.length + ' Fotos') : '']
          .filter(Boolean).join('  ·  ');
        s.absatz(meta, 9, 24, true);
        fotoReihen(s, m.fotos || [], bilder, 24);
      });
    }

    s.ueberschrift('Zähler');
    if (!(p.zaehler || []).length) s.absatz('Keine Zähler erfasst.', 10, 0, true);
    for (const zz of p.zaehler || []) {
      const typ = (L.ZAEHLER_TYPEN[zz.typ] || { name: zz.typ || 'Zähler' }).name;
      const stand = typeof zz.stand === 'number' ? L.zahlSchreiben(zz.stand) + ' ' + (zz.einheit || '') : 'kein Stand';
      s.platz(30 + (zz.foto && bilder[zz.foto] ? 158 : 0));
      s.zeile(typ + ':  ' + stand, 10, true);
      s.absatz('Zählernummer: ' + (zz.nummer || 'nicht angegeben'), 9, 12, true);
      if (zz.foto && bilder[zz.foto]) fotoReihen(s, [zz.foto], bilder, 12);
    }

    s.ueberschrift('Schlüssel');
    if (!(p.schluessel || []).length) s.absatz('Keine Schlüssel erfasst.', 10, 0, true);
    for (const k of p.schluessel || []) {
      const art2 = L.SCHLUESSEL_ARTEN[k.art] || k.art || 'Schlüssel';
      s.absatz(String(k.anzahl || 0) + ' ×  ' + art2 + (k.bemerkung ? ',  ' + k.bemerkung : ''), 10);
    }
    s.zeile('Summe: ' + L.schluesselSumme(p.schluessel) + ' Schlüssel', 10, true);

    s.ueberschrift('Vereinbarungen');
    s.absatz(p.vereinbarungen && p.vereinbarungen.trim() ? p.vereinbarungen : 'Keine.', 10);

    s.ueberschrift('Prüfsumme');
    s.absatz('SHA-256 über den Inhalt ohne Unterschriften, Fotos als ihre SHA-256:', 9, 0, true);
    s.zeile(summe, 9);
    s.zeile('Kurz: ' + L.pruefsummeKurz(summe), 11, true);

    s.ueberschrift('Unterschriften');
    const sig = p.unterschriften || [];
    const kb = (BREITE - 20) / 2, kh = kb / 3;
    s.platz(kh + 50);
    s.y -= kh + 8;
    ['vermieter', 'mieter'].forEach((rolle, i) => {
      const x = RAND + i * (kb + 20);
      const u = sig.find((q) => q.rolle === rolle);
      s.ops.push('0.6 0.6 0.65 RG 0.6 w ' + z(x) + ' ' + z(s.y) + ' m ' + z(x + kb) + ' ' + z(s.y) + ' l S');
      if (u) s.unterschrift(u.striche, x, s.y + 2, kb, kh);
      s.text((rolle === 'vermieter' ? 'Vermieter' : 'Mieter') + ': ' + (u ? u.name : 'nicht unterschrieben'), x, s.y - 12, 9, !!u);
      if (u) s.text(L.zeitpunktAnzeige(u.zeit), x, s.y - 24, 8, false, true);
    });
    s.y -= 34;
    s.luecke(8);
    s.absatz('Die Unterschriften sind Bilder vom Display, keine qualifizierte elektronische Signatur. ' +
      'Die Prüfsumme zeigt, dass dieses PDF und die Datei .uebergabe.json denselben Inhalt haben.', 8, 0, true);

    // Fußzeile mit Seitenzahl
    const n = s.seiten.length;
    const seiten = s.seiten.map((ops, i) => {
      const fuss = 'übergabe.  ·  Prüfsumme ' + L.pruefsummeKurz(summe) + '  ·  Seite ' + (i + 1) + ' von ' + n;
      const t = new Satz();
      t.ops = [];
      t.text(fuss, RAND, 32, 8, false, true);
      return { inhalt: ops.concat(t.ops).join('\n') };
    });
    return pdfSchreiben(seiten, liste, { titel: 'Übergabeprotokoll ' + art + ' ' + (p.adresse || '') });
  }

  return { A4, winAnsi, winAnsiCodes, textBreite, umbrechen, jpegGroesse, pdfText, pdfSchreiben, protokollPdf };
});
