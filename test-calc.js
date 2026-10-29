/* Tests für logik.js und pdf.js gegen die Handrechnungen und Testvektoren aus dem Scope. Start: node test-calc.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logik.js');
const P = require('./pdf.js');

test('zahlLesen: deutsche Zahlen', () => {
  assert.equal(L.zahlLesen('12.345,6'), 12345.6);
  assert.equal(L.zahlLesen('0815'), 815);
  assert.equal(L.zahlLesen('12,3,4'), null);
  assert.equal(L.zahlLesen(''), null);
  assert.equal(L.zahlLesen('abc'), null);
  assert.equal(L.zahlLesen('1.5'), null, 'Punkt nur als Tausendertrenner in Dreiergruppen');
  assert.equal(L.zahlLesen(' 4711,25 '), 4711.25);
  assert.equal(L.zahlLesen('1.234.567'), 1234567);
});

test('zahlSchreiben ist die Umkehrung', () => {
  assert.equal(L.zahlSchreiben(12345.6), '12.345,6');
  assert.equal(L.zahlSchreiben(815), '815');
  assert.equal(L.zahlLesen(L.zahlSchreiben(98765.432)), 98765.432);
});

test('skalieren: nie vergrößern, Seitenverhältnis bleibt', () => {
  assert.deepEqual(L.skalieren(4032, 3024, 1600), [1600, 1200]);
  assert.deepEqual(L.skalieren(3024, 4032, 1600), [1200, 1600]);
  assert.deepEqual(L.skalieren(800, 600, 1600), [800, 600]);
});

test('schluesselSumme', () => {
  assert.equal(L.schluesselSumme([{ anzahl: 2 }, { anzahl: 1 }, { anzahl: 3 }]), 6);
  assert.equal(L.schluesselSumme([]), 0);
});

test('SHA-256 Prüfvektoren', () => {
  assert.equal(L.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(L.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  // 56 Zeichen: Polsterung braucht einen zweiten Block (FIPS 180-2, Beispiel 2)
  assert.equal(L.sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  // eine Million "a" (FIPS 180-2, Beispiel 3)
  assert.equal(L.sha256(new Uint8Array(1000000).fill(97)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  assert.equal(L.pruefsummeKurz('ba7816bf8f01cfea414140de'), 'ba78 16bf 8f01 cfea');
});

test('base64 hin und zurück', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 255]) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 37) & 255);
    assert.deepEqual(L.base64Lesen(L.base64Schreiben(b)), b);
  }
  assert.equal(L.base64Schreiben(L.utf8('Mann')), 'TWFubg==');
});

// Testprotokoll mit erfundenen Daten
function muster() {
  return {
    format: 'uebergabe', version: 1, id: 'p1', beispiel: false,
    art: 'einzug', zeitpunkt: '2026-10-29T14:30', adresse: 'Musterweg 12, 12345 Beispielstadt', lage: '2. OG links',
    vermieter: { name: 'Erika Beispiel' }, mieter: { name: 'Max Muster' }, anwesende: ['Paula Probe'],
    raeume: [
      { id: 'r1', name: 'Küche', zustand: 'maengel', maengel: [
        { id: 'm1', text: 'Fliese über der Spüle gesprungen', ort: 'Wand links', stufe: 'mittel', vorbestehend: false, fotos: ['f1', 'f2'] }] },
      { id: 'r2', name: 'Bad', zustand: 'ok', maengel: [] },
    ],
    zaehler: [{ id: 'z1', typ: 'strom', nummer: '1ESY1160012345', stand: 12345.6, einheit: 'kWh', foto: 'f3' }],
    schluessel: [{ id: 's1', art: 'haustuer', anzahl: 2, bemerkung: '' }, { id: 's2', art: 'briefkasten', anzahl: 1, bemerkung: 'klemmt' }],
    vereinbarungen: 'Mieter streicht Flur bis 15.11.',
    pruefsumme: null, unterschriften: [],
  };
}

// Minimales JPEG: SOI, APP0, SOF0 mit Breite und Höhe, EOI. Reicht für Struktur und Größe.
function fakeJpeg(b, h, salz) {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, salz, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, b >> 8, b & 255, 3,
    1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
}
const FOTOS = { f1: fakeJpeg(1600, 1200, 1), f2: fakeJpeg(1200, 1600, 2), f3: fakeJpeg(800, 600, 3) };
const HASH = Object.fromEntries(Object.entries(FOTOS).map(([k, v]) => [k, L.sha256(v)]));

test('kanonisch: sortierte Schlüssel, ohne Prüfsumme und Unterschriften, Fotos als Hash', () => {
  const k = L.kanonisch(muster(), HASH);
  assert.ok(!k.includes('unterschriften'));
  assert.ok(!k.includes('pruefsumme'));
  assert.ok(k.includes(HASH.f1));
  assert.ok(!k.includes('"f1"'));
  assert.ok(k.startsWith('{"adresse":'));
  // Unterschrift ändert die Prüfsumme nicht
  const a = muster();
  const b = muster();
  b.unterschriften.push({ rolle: 'mieter', name: 'Max Muster', zeit: '2026-10-29T15:00', striche: [[[0, 0], [10, 10]]] });
  b.pruefsumme = 'x';
  assert.equal(L.pruefsumme(a, HASH), L.pruefsumme(b, HASH));
});

test('Prüfsumme: Schlüsselreihenfolge egal, geänderter Zählerstand nicht', () => {
  const a = muster();
  const umgedreht = {};
  for (const k of Object.keys(a).reverse()) umgedreht[k] = a[k];
  umgedreht.zaehler = a.zaehler.map((z) => Object.fromEntries(Object.entries(z).reverse()));
  assert.equal(L.pruefsumme(a, HASH), L.pruefsumme(umgedreht, HASH));
  const c = muster();
  c.zaehler[0].stand = 12345.7;
  assert.notEqual(L.pruefsumme(a, HASH), L.pruefsumme(c, HASH));
  const d = muster();
  const anderesFoto = Object.assign({}, HASH, { f1: L.sha256('anders') });
  assert.notEqual(L.pruefsumme(a, HASH), L.pruefsumme(d, anderesFoto), 'anderes Foto, andere Prüfsumme');
  assert.match(L.pruefsumme(a, HASH), /^[0-9a-f]{64}$/);
});

test('Export und Import ergibt dasselbe Protokoll und dieselbe Prüfsumme', () => {
  const p = muster();
  const summe = L.pruefsumme(p, HASH);
  p.pruefsumme = summe;
  p.unterschriften = [{ rolle: 'vermieter', name: 'Erika Beispiel', zeit: '2026-10-29T15:00', striche: [[[100, 500], [900, 500]]] }];
  const urls = Object.fromEntries(Object.entries(FOTOS).map(([k, v]) => [k, L.dataUrlSchreiben(v)]));
  const datei = JSON.stringify(L.exportObjekt(p, urls));

  // in leeren Speicher: id bleibt
  const r = L.importVorbereiten(JSON.parse(datei), [], () => 'neu' + Math.random());
  assert.equal(r.protokoll.id, 'p1');
  assert.equal(r.fotos.length, 3);
  const hashNeu = Object.fromEntries(r.fotos.map((f) => [f.id, L.sha256(f.bytes)]));
  assert.equal(L.pruefsumme(r.protokoll, hashNeu), summe);
  assert.deepEqual(r.protokoll.unterschriften, p.unterschriften);
  // ohne Foto-Ids ist alles gleich
  const ohne = (x) => L.kopie(Object.assign({}, x, { raeume: x.raeume.map((q) => Object.assign({}, q, { maengel: q.maengel.map((m) => Object.assign({}, m, { fotos: m.fotos.length })) })),
    zaehler: x.zaehler.map((z) => Object.assign({}, z, { foto: !!z.foto })) }));
  assert.deepEqual(ohne(r.protokoll), ohne(p));

  // gleiche id vorhanden: Kopie mit neuer id statt überschreiben
  let n = 0;
  const r2 = L.importVorbereiten(JSON.parse(datei), ['p1'], () => 'id' + (++n));
  assert.notEqual(r2.protokoll.id, 'p1');
  assert.equal(L.pruefsumme(r2.protokoll, Object.fromEntries(r2.fotos.map((f) => [f.id, L.sha256(f.bytes)]))), summe);
});

test('Import mit falscher Version oder falschem Format wird abgelehnt', () => {
  const p = muster();
  const urls = Object.fromEntries(Object.entries(FOTOS).map(([k, v]) => [k, L.dataUrlSchreiben(v)]));
  const o = L.exportObjekt(p, urls);
  assert.throws(() => L.importPruefen(Object.assign({}, o, { version: 2 })), /Version 2/);
  assert.throws(() => L.importPruefen(Object.assign({}, o, { format: 'andere' })), /Format/);
  assert.throws(() => L.importPruefen(Object.assign({}, o, { fotos: {} })), /Foto/);
  assert.throws(() => L.importPruefen(null));
  assert.equal(L.importPruefen(o), true);
});

test('duplizieren: Auszug aus Einzug, neue Ids, ohne Unterschriften', () => {
  const p = muster();
  p.unterschriften = [{ rolle: 'mieter', name: 'x', zeit: '', striche: [] }];
  p.pruefsumme = 'abc';
  let n = 0;
  const { protokoll: q, fotoKopien } = L.duplizieren(p, () => 'd' + (++n), '2027-03-01T10:00');
  assert.equal(q.art, 'auszug');
  assert.equal(q.unterschriften.length, 0);
  assert.equal(q.pruefsumme, null);
  assert.equal(q.raeume[0].maengel[0].vorbestehend, true);
  assert.equal(fotoKopien.length, 3);
  assert.ok(!L.fotoIds(q).some((f) => ['f1', 'f2', 'f3'].includes(f)));
  assert.equal(L.status(q), 'entwurf');
  assert.equal(L.status(p), 'unterschrieben');
});

test('uebersicht zählt Mängel nach Stufe', () => {
  const u = L.uebersicht(muster());
  assert.equal(u.raeume, 2);
  assert.equal(u.maengel, 1);
  assert.equal(u.mittel, 1);
  assert.equal(u.neu, 1);
  assert.equal(u.schluessel, 3);
  assert.equal(u.fotos, 3);
});

test('Anzeige und Dateiname', () => {
  assert.equal(L.zeitpunktAnzeige('2026-10-29T14:30'), '29.10.2026, 14:30');
  assert.equal(L.dateiname(muster(), '.pdf'), 'uebergabe-einzug-2026-10-29-musterweg-12-12345-beispielstadt.pdf');
});

test('winAnsi', () => {
  assert.equal(P.winAnsi('ä'), 0xe4);
  assert.equal(P.winAnsi('ß'), 0xdf);
  assert.equal(P.winAnsi('€'), 0x80);
  assert.equal(P.winAnsi('Ü'), 0xdc);
  assert.equal(P.winAnsi('→'), 0x3f);
  assert.equal(P.winAnsi('😀'), 0x3f);
});

test('textBreite: Bad in 10 pt = 17,79 pt', () => {
  assert.equal(Math.round(P.textBreite('Bad', 10) * 100) / 100, 17.79);
  assert.equal(P.textBreite('', 10), 0);
});

test('umbrechen: an Leerzeichen, lange Wörter notfalls geteilt', () => {
  const z = P.umbrechen('Fliese über der Spüle gesprungen', 60, 10);
  assert.ok(z.length > 1);
  for (const t of z) assert.ok(P.textBreite(t, 10) <= 60, t);
  assert.equal(z.join(' '), 'Fliese über der Spüle gesprungen', 'kein Wort wurde geteilt');
  const lang = P.umbrechen('Donaudampfschifffahrtsgesellschaft', 50, 10);
  assert.ok(lang.length > 1);
  assert.equal(lang.join(''), 'Donaudampfschifffahrtsgesellschaft');
  for (const t of lang) assert.ok(P.textBreite(t, 10) <= 50);
  assert.deepEqual(P.umbrechen('a\nb', 100, 10), ['a', 'b']);
});

test('jpegGroesse liest SOF', () => {
  assert.deepEqual(P.jpegGroesse(FOTOS.f1), { breite: 1600, hoehe: 1200, komponenten: 3 });
  assert.equal(P.jpegGroesse(new Uint8Array([1, 2, 3])), null);
});

test('PDF: Kopf, Ende, xref-Offsets zeigen auf "n 0 obj"', () => {
  const p = muster();
  p.unterschriften = [
    { rolle: 'vermieter', name: 'Erika Beispiel', zeit: '2026-10-29T15:00', striche: [[[50, 500], [300, 200], [600, 700], [950, 400]]] },
    { rolle: 'mieter', name: 'Max Muster', zeit: '2026-10-29T15:01', striche: [[[100, 600], [900, 300]], [[500, 500]]] },
  ];
  const summe = L.pruefsumme(p, HASH);
  const pdf = P.protokollPdf(p, FOTOS, summe);
  const s = Buffer.from(pdf).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(s)[1]);
  assert.ok(s.slice(startxref).startsWith('xref\n'));
  const kopf = /xref\n0 (\d+)\n/.exec(s.slice(startxref));
  const anzahl = Number(kopf[1]);
  const eintraege = s.slice(startxref + kopf[0].length).split('\n').slice(0, anzahl);
  assert.equal(eintraege[0], '0000000000 65535 f ');
  for (let i = 1; i < anzahl; i++) {
    const off = Number(eintraege[i].slice(0, 10));
    assert.ok(s.slice(off).startsWith(i + ' 0 obj'), 'Objekt ' + i + ' bei ' + off);
  }
  // drei Bilder als DCTDecode, Umlaute als WinAnsi-Oktal (ü = \374), Prüfsumme drin
  assert.equal((s.match(/\/DCTDecode/g) || []).length, 3);
  assert.ok(s.includes('(\\334bergabeprotokoll Einzug)'));
  assert.ok(s.includes(L.pruefsummeKurz(summe)));
  assert.ok(s.includes('/Encoding /WinAnsiEncoding'));
  // Längen der Streams stimmen
  for (const m of s.matchAll(/\/Length (\d+) >>\nstream\n/g)) {
    const start = m.index + m[0].length;
    assert.equal(s.slice(start + Number(m[1]), start + Number(m[1]) + 10), '\nendstream');
  }
});

test('PDF: viele Mängel ergeben mehrere Seiten', () => {
  const p = muster();
  for (let i = 0; i < 60; i++) p.raeume[1].maengel.push({ id: 'x' + i, text: 'Kratzer Nummer ' + i, ort: '', stufe: 'gering', vorbestehend: true, fotos: [] });
  const s = Buffer.from(P.protokollPdf(p, FOTOS, L.pruefsumme(p, HASH))).toString('latin1');
  const n = Number(/\/Count (\d+)/.exec(s)[1]);
  assert.ok(n >= 2);
  assert.ok(s.includes('Seite ' + n + ' von ' + n));
});
