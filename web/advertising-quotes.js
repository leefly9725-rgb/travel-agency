(() => {
  const list = document.querySelector('#adv-list');
  const search = document.querySelector('#adv-search');
  const message = document.querySelector('#adv-message');
  let rows = [];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const authHeaders = () => ({ Authorization: `Bearer ${window.AuthStore?.getToken() || ''}` });
  function render() {
    const query = search.value.toLowerCase();
    const visibleRows = rows.filter((row) => `${row.quoteNumber} ${row.clientName} ${row.projectName}`.toLowerCase().includes(query));
    list.innerHTML = visibleRows.map((row) => {
      const total = Number(row.totals?.totalIncludingVat || row.calculationSnapshot?.totalIncludingVat || 0).toFixed(2);
      const mode = row.mode === 'project' ? '项目组合' : '普通产品';
      return `<a class="advertising-quote-card" href="/advertising-quote.html?id=${encodeURIComponent(row.id)}">
        <div class="adv-quote-card-main">
          <span class="adv-quote-number">${esc(row.quoteNumber)}</span>
          <h3>${esc(row.projectName || '未填写项目')}</h3>
          <p>${esc(row.clientName || '未填写客户')}</p>
        </div>
        <div class="adv-quote-card-meta"><span>${mode}</span><span>${esc(row.status || '草稿')}</span></div>
        <div class="adv-quote-card-total"><small>含税总额</small><strong>${total} ${esc(row.currency || 'EUR')}</strong><span>查看详情 →</span></div>
      </a>`;
    }).join('') || `<div class="adv-empty-state">
      <span class="adv-section-kicker">Ready when you are</span>
      <h3>${query ? '没有匹配的报价' : '还没有广告报价'}</h3>
      <p>${query ? '请调整搜索关键词后重试。' : '从普通产品或项目组合报价开始，建立第一份广告制作报价。'}</p>
      ${query ? '' : '<a class="adv-button adv-button-primary" href="/advertising-quote.html?mode=standard">新建普通产品报价</a>'}
    </div>`;
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
