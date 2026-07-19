(() => {
  const list = document.querySelector('#adv-list');
  const search = document.querySelector('#adv-search');
  const message = document.querySelector('#adv-message');
  let rows = [];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const authHeaders = () => ({ Authorization: `Bearer ${window.AuthStore?.getToken() || ''}` });
  function render() {
    const query = search.value.toLowerCase();
    list.innerHTML = rows.filter((row) => `${row.quoteNumber} ${row.clientName} ${row.projectName}`.toLowerCase().includes(query)).map((row) => `<a class="advertising-quote-card" href="/advertising-quote.html?id=${encodeURIComponent(row.id)}"><strong>${esc(row.quoteNumber)}</strong><span>${esc(row.clientName || '未填写客户')} · ${esc(row.projectName || '未填写项目')}</span><b>${Number(row.totals?.totalIncludingVat || row.calculationSnapshot?.totalIncludingVat || 0).toFixed(2)} ${esc(row.currency || 'EUR')}</b></a>`).join('') || '<p class="empty-state">暂无广告报价</p>';
  }
  async function load() {
    try {
      const response = await fetch('/api/advertising/quotes', { headers: authHeaders() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '广告报价加载失败。');
      rows = payload;
      render();
    } catch (error) {
      message.classList.remove('hidden');
      message.textContent = error.message;
    }
  }
  search.addEventListener('input', render);
  if (window.__AUTH_READY__) load();
  else document.addEventListener('authReady', load, { once: true });
})();
