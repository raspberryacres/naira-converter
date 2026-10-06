(() => {
  const SKIP = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT',
    'OPTION', 'CODE', 'PRE', 'SVG', 'CANVAS', 'IFRAME',
  ]);
  const QUICK = /[$€£]|USD|EUR|GBP/;
  const WRAP = 'data-ngn-wrap';

  let rates = null;
  let observer = null;
  let active = false;
  let timer = null;
  const pending = new Set();

  function acceptable(textNode) {
    const p = textNode.parentElement;
    if (!p) return false;
    if (SKIP.has(p.tagName.toUpperCase())) return false;
    if (p.closest(`[${WRAP}]`)) return false;
    if (p.isContentEditable) return false;
    return true;
  }

  function convertNode(node) {
    if (!node.isConnected) return;
    const text = node.nodeValue;
    const hits = NGN.findPrices(text, rates);
    if (!hits.length) return;

    const frag = document.createDocumentFragment();
    let last = 0;
    for (const h of hits) {
      if (h.start > last) frag.append(text.slice(last, h.start));

      const wrap = document.createElement('span');
      wrap.setAttribute(WRAP, '');
      wrap.append(document.createTextNode(h.original));

      const badge = document.createElement('span');
      badge.className = 'ngn-badge';
      badge.textContent = ` ≈ ₦${NGN.formatNgn(h.ngn)}`;
      badge.title = `1 ${h.cur} = ₦${NGN.formatNgn(rates[h.cur])}`;
      badge.style.cssText =
        'color:#16a34a;font-weight:600;font-size:0.9em;white-space:nowrap;';
      wrap.append(badge);

      frag.append(wrap);
      last = h.end;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }

  function scan(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (acceptable(root) && QUICK.test(root.nodeValue)) convertNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (SKIP.has(root.tagName.toUpperCase()) || root.closest(`[${WRAP}]`)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        acceptable(n) && QUICK.test(n.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(convertNode);
  }

  function flush() {
    timer = null;
    const items = [...pending];
    pending.clear();
    items.forEach((n) => n.isConnected && scan(n));
    if (observer) observer.takeRecords(); // ignore the mutations we just made
  }

  function observe() {
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach((n) => pending.add(n));
        else if (m.type === 'characterData') pending.add(m.target);
      }
      if (!timer) timer = setTimeout(flush, 250);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function unwrapAll() {
    document.querySelectorAll(`[${WRAP}]`).forEach((w) => {
      w.replaceWith(document.createTextNode(w.firstChild.nodeValue));
    });
  }

  async function start() {
    if (active) return;
    try {
      const cache = await chrome.runtime.sendMessage({ type: 'getRates' });
      if (!cache || !cache.rates) return;
      rates = cache.rates;
    } catch (e) {
      return;
    }
    active = true;
    scan(document.body);
    observe();
  }

  function stop() {
    active = false;
    if (observer) observer.disconnect();
    observer = null;
    clearTimeout(timer);
    timer = null;
    pending.clear();
    unwrapAll();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) {
      changes.enabled.newValue === false ? stop() : start();
    } else if (changes.ratesCache && active) {
      // Rates refreshed: redo the page with the new numbers
      rates = changes.ratesCache.newValue.rates;
      stop();
      start();
    }
  });

  chrome.storage.local.get('enabled').then(({ enabled = true }) => {
    if (enabled) start();
  });
})();
