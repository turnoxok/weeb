// Simulador mínimo de los servicios de Google que usa Codigo.gs (para probar la lógica sin Google).
const fs = require('fs'), vm = require('vm'), path = require('path');
function crear(opts = {}) {
  const hojas = {}; let uuid = 0;
  const mails = [], cache = {}, props = {}, triggers = [];
  const tokens = opts.tokens || {};
  function Hoja(nombre) {
    const h = { nombre, filas: [[]], frozen: 0, formatos: {} };
    const maxCols = () => Math.max(1, ...h.filas.map(f => f.length));
    return Object.assign(h, {
      getLastRow() { let l = 0; h.filas.forEach((f, i) => { if (f.some(x => x !== '' && x != null)) l = i + 1; }); return l; },
      getMaxRows() { return 1000; },
      setFrozenRows(n) { h.frozen = n; },
      appendRow(a) { h.filas[h.getLastRow()] = a.slice(); },
      deleteRow(r) { h.filas.splice(r - 1, 1); },
      getRange(r, c, nr = 1, nc = 1) {
        return {
          getValues() { const o = []; for (let i = 0; i < nr; i++) { const f = h.filas[r - 1 + i] || []; const row = []; for (let j = 0; j < nc; j++) row.push(f[c - 1 + j] === undefined ? '' : f[c - 1 + j]); o.push(row); } return o; },
          setValues(v) { for (let i = 0; i < nr; i++) { const f = (h.filas[r - 1 + i] = h.filas[r - 1 + i] || []); for (let j = 0; j < nc; j++) f[c - 1 + j] = v[i][j]; } },
          setNumberFormat(fm) { h.formatos[c] = fm; }
        };
      }
    });
  }
  const ss = {
    getSheetByName: n => hojas[n] || null,
    insertSheet: n => (hojas[n] = Hoja(n)),
    getId: () => 'SS1', getName: () => 'Hoja de prueba'
  };
  const ctx = {
    console, Date, JSON, Math, Number, String, Object, Array, RegExp, Error, isFinite, parseInt,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss, getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => [...require('crypto').createHash('sha256').update(s, 'utf8').digest()].map(b => (b > 127 ? b - 256 : b)),
      computeHmacSha256Signature: (s, k) => [...require('crypto').createHmac('sha256', k).update(s, 'utf8').digest()].map(b => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: s => Buffer.from(s, 'utf8').toString('base64url'),
      base64DecodeWebSafe: s => [...Buffer.from(s, 'base64url')],
      newBlob: b => ({ getDataAsString: () => Buffer.from(b).toString('utf8') }),
      getUuid: () => 'u' + String(++uuid).padStart(8, '0') + '-aaaa-bbbb-cccc-' + Math.random().toString(16).slice(2, 14),
      formatDate: (d, tz, f) => {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
        return f === 'yyyy-MM-dd' ? `${p.year}-${p.month}-${p.day}` : f === 'HH:mm' ? `${p.hour}:${p.minute}` : f;
      }
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; }, getContent() { return s; } }) },
    MailApp: { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 100 },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: f => { const t = { getHandlerFunction: () => f, f }; const b = { timeBased: () => b, everyMinutes: () => b, everyDays: () => b, atHour: () => b, create: () => { triggers.push(t); return t; } }; return b; } },
    DriveApp: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Codigo.gs'), 'utf8'), ctx, { filename: 'Codigo.gs' });
  const api = {
    ctx, ss, hojas, mails, triggers, cache,
    // llamar como lo haría el navegador
    get(params) { return JSON.parse(ctx.doGet({ parameter: params }).getContent()); },
    post(body) { return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()); },
    setNow(ms) { ctx.RELOJ.now = () => ms; },
    run(f) { return vm.runInContext(f, ctx); }
  };
  return api;
}
module.exports = { crear };
