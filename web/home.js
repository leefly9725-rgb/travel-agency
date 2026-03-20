async function bootstrap() {
  const dashboard = await window.AppUtils.fetchJson("/api/dashboard", null, "首页数据加载失败，请稍后重试。");
  const currentOrigin = window.location.origin;

  const runtimeInfoEl = document.getElementById("runtime-info");
  runtimeInfoEl.innerHTML = `
    <div class="runtime-row">
      <span>当前访问地址</span>
      <strong>${currentOrigin}</strong>
    </div>
    <div class="runtime-row">
      <span>系统状态</span>
      <strong>运营模块已就绪</strong>
    </div>
    <div class="runtime-row runtime-row-link">
      <span>首页地址</span>
      <a href="${currentOrigin}/">${currentOrigin}/</a>
    </div>
  `;

  const metricsEl = document.getElementById("metrics");
  metricsEl.innerHTML = `
    <div class="metrics-grid home-metrics-grid">
      <div class="metric metric-highlight"><span>报价数</span><strong>${dashboard.metrics.quoteCount}</strong></div>
      <div class="metric"><span>模板数</span><strong>${dashboard.metrics.templateCount || 0}</strong></div>
      <div class="metric"><span>接待任务</span><strong>${dashboard.metrics.receptionTaskCount}</strong></div>
      <div class="metric"><span>累计毛利</span><strong>${window.AppUtils.formatCurrency(dashboard.metrics.totalGrossProfit, dashboard.defaultCurrency)}</strong></div>
    </div>
    <p class="hero-summary-note">当前工作台已接入报价、模板、接待、文档、项目主档与供应商价格库模块。</p>
  `;
}

bootstrap().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#a33;">${error.message}</pre>`;
});
