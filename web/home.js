async function bootstrap() {
  const dashboard = await window.AppUtils.fetchJson("/api/dashboard", null, "首页数据加载失败，请稍后重试");
  const currentOrigin = window.location.origin;

  const runtimeInfoEl = document.getElementById("runtime-info");
  runtimeInfoEl.innerHTML = `
    <div class="runtime-row">
      <span>当前访问地址</span>
      <strong>${currentOrigin}</strong>
    </div>
    <div class="runtime-row">
      <span>首页地址</span>
      <a href="${currentOrigin}/">${currentOrigin}/</a>
    </div>
  `;

  const metricsEl = document.getElementById("metrics");
  metricsEl.innerHTML = `
    <div class="metrics-grid">
      <div class="metric"><span>报价数</span><strong>${dashboard.metrics.quoteCount}</strong></div>
      <div class="metric"><span>模板数</span><strong>${dashboard.metrics.templateCount || 0}</strong></div>
      <div class="metric"><span>接待任务</span><strong>${dashboard.metrics.receptionTaskCount}</strong></div>
      <div class="metric"><span>累计毛利</span><strong>${window.AppUtils.formatCurrency(dashboard.metrics.totalGrossProfit, dashboard.defaultCurrency)}</strong></div>
    </div>
  `;

  const frontendEntryEl = document.getElementById("frontend-entry");
  frontendEntryEl.innerHTML = `
    <div class="table-row table-row-wide">
      <span>首页</span>
      <a class="button-link small-link" href="${currentOrigin}/">${currentOrigin}/</a>
    </div>
    <div class="table-row table-row-wide">
      <span>报价管理</span>
      <a class="button-link small-link" href="${currentOrigin}/quotes.html">${currentOrigin}/quotes.html</a>
    </div>
    <div class="table-row table-row-wide">
      <span>报价模板</span>
      <a class="button-link small-link" href="${currentOrigin}/templates.html">${currentOrigin}/templates.html</a>
    </div>
    <div class="table-row table-row-wide">
      <span>接待任务</span>
      <a class="button-link small-link" href="${currentOrigin}/receptions.html">${currentOrigin}/receptions.html</a>
    </div>
    <div class="table-row table-row-wide">
      <span>文档源数据</span>
      <a class="button-link small-link" href="${currentOrigin}/documents.html">${currentOrigin}/documents.html</a>
    </div>
    <div class="table-row table-row-wide">
      <span>项目主档中心</span>
      <a class="button-link small-link" href="${currentOrigin}/projects.html">${currentOrigin}/projects.html</a>
    </div>
  `;
}

bootstrap().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#a33;">${error.message}</pre>`;
});
