const $ = (id) => document.getElementById(id);
const fmt = (n) => '₦' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });

function render(cache) {
  if (!cache) {
    $('updated').textContent = 'Could not load rates';
    return;
  }
  $('usd').textContent = fmt(cache.rates.USD);
  $('eur').textContent = fmt(cache.rates.EUR);
  $('gbp').textContent = fmt(cache.rates.GBP);
  $('updated').textContent = 'Updated ' + new Date(cache.fetchedAt).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function loadRates(force = false) {
  try {
    render(await chrome.runtime.sendMessage({ type: 'getRates', force }));
  } catch (e) {
    render(null);
  }
}

(async () => {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  $('toggle').checked = enabled;
  $('toggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ enabled: e.target.checked });
  });

  $('refresh').addEventListener('click', async () => {
    $('refresh').disabled = true;
    await loadRates(true);
    $('refresh').disabled = false;
  });

  loadRates();
})();
