async function bootstrap() {
  window.AppUtils.applyFlash("project-message");
  try {
    const projects = await window.AppUtils.fetchJson("/api/projects", null, "项目列表加载失败，请稍后重试");
    const container = document.getElementById("project-list");
    if (projects.length === 0) {
      container.innerHTML = '<p class="empty">当前还没有可用的项目主档，请先创建报价或接待任务。</p>';
      return;
    }

    container.innerHTML = projects.map((project) => `
      <article class="card">
        <div class="list-row list-row-top">
          <div>
            <h3>${project.projectName}</h3>
            <p class="meta">${project.client}</p>
          </div>
          <a class="button-link small-link" href="/project-detail.html?id=${encodeURIComponent(project.id)}">查看档案</a>
        </div>
        <div class="detail-grid">
          <div class="metric"><span>日期范围</span><strong>${project.dateRange}</strong></div>
          <div class="metric"><span>PAX 人数</span><strong>${project.paxCount}</strong></div>
          <div class="metric"><span>项目状态</span><strong>${window.AppUi.getLabel("projectStatusLabels", project.status)}</strong></div>
          <div class="metric"><span>特殊要求</span><strong>${project.specialRequirements}</strong></div>
        </div>
      </article>
    `).join("");
  } catch (error) {
    window.AppUtils.showMessage("project-message", error.message, "error");
    document.getElementById("project-list").innerHTML = '<p class="empty">项目列表暂时无法显示，请稍后再试。</p>';
  }
}

bootstrap();
