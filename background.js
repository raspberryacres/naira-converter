const API_URL = 'https://open.er-api.com/v6/latest/USD';
const TTL_MS = 60 * 60 * 1000; // refresh rates at most once an hour

// Returns { fetchedAt, rates: { USD, EUR, GBP } } where each value is "how many NGN per 1 unit".
async function getRates(force = false) {
  const { ratesCache } = await chrome.storage.local.get('ratesCache');
  if (!force && ratesCache && Date.now() - ratesCache.fetchedAt < TTL_MS) {
    return ratesCache;
  }

  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (data.result !== 'success') throw new Error('Rate API returned an error');

    const { NGN, EUR, GBP } = data.rates; // all quoted against USD
    const cache = {
      fetchedAt: Date.now(),
      rates: { USD: NGN, EUR: NGN / EUR, GBP: NGN / GBP },
    };
    await chrome.storage.local.set({ ratesCache: cache });
    return cache;
  } catch (err) {
    console.error('Rate fetch failed, falling back to cached rates', err);
    return ratesCache || null; // stale rates beat no rates
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getRates') {
    getRates(msg.force).then(sendResponse);
    return true; // keep the channel open for the async response
  }
});
