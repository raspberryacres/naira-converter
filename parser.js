// Price detection + conversion logic. No DOM access, so it can be unit tested in Node.
(function (root) {
  const NUM = '(?:\\d{1,3}(?:[,.]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
  // Optional magnitude: $5k, $2.5M, $1bn, "3 million"
  const SUF = '(?:(?:[kKmMbB]|bn|mn)(?![A-Za-z])|\\s(?:thousand|million|billion)(?![A-Za-z]))?';
  const PRE = 'US\\$|USD|EUR|GBP|[$€£]';
  const POST = 'USD|EUR|GBP|€|£';

  // Group 1-3: prefix style ($49.99, USD 49.99). Group 4-6: suffix style (49.99 EUR, 49,99€).
  const RE_SRC =
    `(?<![\\w.,])(?:(${PRE})\\s?(${NUM})(${SUF})|(${NUM})(${SUF})\\s?(${POST})(?![A-Za-z]))`;

  const CURRENCY = {
    '$': 'USD', 'US$': 'USD', USD: 'USD',
    '€': 'EUR', EUR: 'EUR',
    '£': 'GBP', GBP: 'GBP',
  };

  const MULT = {
    k: 1e3, thousand: 1e3,
    m: 1e6, mn: 1e6, million: 1e6,
    b: 1e9, bn: 1e9, billion: 1e9,
  };

  // Handles 1,234.56 / 1.234,56 / 12,50 / 1,234 / 1.234.567
  function parseNumber(s) {
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    let t;
    if (hasComma && hasDot) {
      const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
      const grp = dec === ',' ? '.' : ',';
      t = s.split(grp).join('').replace(dec, '.');
    } else if (hasComma || hasDot) {
      const sep = hasComma ? ',' : '.';
      const parts = s.split(sep);
      if (parts.length > 2) {
        t = parts.join('');
      } else {
        const [a, b] = parts;
        t = b.length === 3 && a.length <= 3 && a !== '0' ? a + b : a + '.' + b;
      }
    } else {
      t = s;
    }
    return parseFloat(t);
  }

  function findPrices(text, rates) {
    const out = [];
    const re = new RegExp(RE_SRC, 'g');
    for (const m of text.matchAll(re)) {
      const sym = m[1] || m[6];
      const rawNum = m[2] || m[4];
      const suffix = (m[3] || m[5] || '').trim().toLowerCase();
      const cur = CURRENCY[sym];
      const rate = rates && rates[cur];
      if (!cur || !rate) continue;
      const amount = parseNumber(rawNum) * (MULT[suffix] || 1);
      if (!isFinite(amount)) continue;
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        original: m[0],
        cur,
        amount,
        ngn: amount * rate,
      });
    }
    return out;
  }

  function formatNgn(n) {
    return n.toLocaleString('en-US', {
      maximumFractionDigits: n >= 1 ? 0 : 2,
    });
  }

  const api = { findPrices, formatNgn, parseNumber };
  root.NGN = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
