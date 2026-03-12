function getFilteredReceptions() {
  const form = document.getElementById("reception-filter-form");
  const status = form.status.value;
  const assignee = form.assignee.value;
  const date = form.date.value;

  return state.receptions.filter((item) => {
    const matchesStatus = !status || item.status === status;
    const matchesAssignee = !assignee || item.assignee === assignee;
    const matchesDate = !date || String(item.dueTime).slice(0, 10) === date;
    return matchesStatus && matchesAssignee && matchesDate;
  });
}

function createOptionList(values, selectedValue, groupName) {
  return values.map((value) => {
    const label = groupName ? window.AppUi.getLabel(groupName, value) : value;
    const selected = value === selectedValue ? "selected" : "";
    return `<option value="${value}" ${selected}>${label}</option>`;
  }).join("");
}

const state = {
  meta: null,
  receptions: [],
};

function renderFilterOptions() {
  const form = document.getElementById("reception-filter-form");
  const assignees = Array.from(new Set(state.receptions.map((item) => item.assignee).filter(Boolean))).sort();
  form.assignee.innerHTML = `<option value="">全部负责人</option>${assignees.map((name) => `<option value="${name}">${name}</option>`).join("")}`;
}

function renderList() {
  const filtered = getFilteredReceptions();
  const container = document.getElementById("reception-list");
  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty">没有符合筛选条件的接待任务，请调整筛选条件或新建任务。</p>';
    return;
  }

  container.innerHTML = filtered.map((item) => `
    <article class="card">
      <div class="list-row list-row-top">
        <div>
          <h3>${item.title}</h3>
          <p class="meta">${window.AppUi.getLabel("receptionTaskTypeLabels", item.taskType)} / ${item.location}</p>
        </div>
        <div class="action-row">
          <button class="mini-button" data-edit-id="${item.id}">编辑</button>
          <button class="ghost mini-button" data-delete-id="${item.id}" data-name="${item.title}">删除</button>
        </div>
      </div>
      <div class="detail-grid">
        <div class="metric"><span>负责人</span><strong>${item.assignee}</strong></div>
        <div class="metric"><span>截止时间</span><strong>${item.dueTime.replace("T", " ")}</strong></div>
        <div class="metric"><span>任务状态</span><strong>${window.AppUi.getLabel("receptionStatusLabels", item.status)}</strong></div>
        <div class="metric"><span>备注</span><strong>${item.notes || "暂无"}</strong></div>
      </div>
    </article>
  `).join("");
}

function fillForm(item) {
  const form = document.getElementById("reception-form");
  form.id.value = item ? item.id : "";
  form.taskType.value = item ? item.taskType : "airport_pickup";
  form.title.value = item ? item.title : "";
  form.assignee.value = item ? item.assignee : "";
  form.dueTime.value = item ? item.dueTime : window.AppUtils.getNextHourDateTimeLocal();
  form.status.value = item ? item.status : "pending";
  form.location.value = item ? item.location : "Belgrade Nikola Tesla Airport T2";
  form.notes.value = item ? item.notes : "";
  document.getElementById("reception-mode").textContent = item ? `${item.id} 编辑中` : "新建";
}

async function reloadReceptions() {
  state.receptions = await window.AppUtils.fetchJson("/api/receptions", null, "接待任务列表加载失败，请稍后重试");
  renderFilterOptions();
  renderList();
}

function validateReceptionForm(form) {
  if (!form.reportValidity()) {
    return false;
  }
  if (!form.title.value.trim()) {
    window.AppUtils.showMessage("reception-message", "请填写任务标题。", "error");
    return false;
  }
  if (!form.assignee.value.trim()) {
    window.AppUtils.showMessage("reception-message", "请填写负责人。", "error");
    return false;
  }
  if (!form.location.value.trim()) {
    window.AppUtils.showMessage("reception-message", "请填写任务地点。", "error");
    return false;
  }
  return true;
}

async function bootstrap() {
  window.AppUtils.applyFlash("reception-message");
  const [meta, receptions] = await Promise.all([
    window.AppUtils.fetchJson("/api/meta", null, "页面初始化失败，请稍后重试"),
    window.AppUtils.fetchJson("/api/receptions", null, "接待任务列表加载失败，请稍后重试"),
  ]);
  state.meta = meta;
  state.receptions = receptions;

  const filterForm = document.getElementById("reception-filter-form");
  filterForm.innerHTML = `
    <label><span>状态</span><select name="status"><option value="">全部状态</option>${createOptionList(meta.supportedReceptionStatuses, "", "receptionStatusLabels")}</select></label>
    <label><span>负责人</span><select name="assignee"></select></label>
    <label><span>日期</span><input type="date" name="date" /></label>
    <div class="button-row filter-button-row"><button type="button" class="ghost" id="reset-filter">重置筛选</button></div>
  `;

  const form = document.getElementById("reception-form");
  form.innerHTML = `
    <input type="hidden" name="id" />
    <label><span>任务类型</span><select name="taskType">${createOptionList(meta.supportedReceptionTaskTypes, "airport_pickup", "receptionTaskTypeLabels")}</select></label>
    <label><span>任务标题</span><input name="title" placeholder="例如：VIP 接机 / 酒店入住 / 商务会议协助" required /></label>
    <label><span>负责人</span><input name="assignee" placeholder="填写执行人员姓名" required /></label>
    <label><span>截止时间</span><input type="datetime-local" name="dueTime" required /></label>
    <label><span>任务状态</span><select name="status">${createOptionList(meta.supportedReceptionStatuses, "pending", "receptionStatusLabels")}</select></label>
    <label><span>地点</span><input name="location" placeholder="例如：Belgrade Nikola Tesla Airport T2" required /></label>
    <label><span>备注</span><textarea name="notes" rows="4" placeholder="例如：提前 30 分钟到场，举接待牌，联系酒店前台"></textarea></label>
    <div class="button-row">
      <button type="submit">保存任务</button>
      <button type="button" class="ghost" id="reset-reception">清空表单</button>
    </div>
  `;

  window.AppUtils.setChineseValidity(form);
  filterForm.addEventListener("change", renderList);
  filterForm.addEventListener("input", renderList);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    window.AppUtils.hideMessage("reception-message");
    if (!validateReceptionForm(form)) {
      return;
    }

    try {
      const id = form.id.value.trim();
      const payload = {
        taskType: form.taskType.value,
        title: form.title.value.trim(),
        assignee: form.assignee.value.trim(),
        dueTime: form.dueTime.value,
        status: form.status.value,
        location: form.location.value.trim(),
        notes: form.notes.value.trim(),
      };
      const url = id ? `/api/receptions/${encodeURIComponent(id)}` : "/api/receptions";
      const method = id ? "PUT" : "POST";
      await window.AppUtils.fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, "保存接待任务失败，请稍后重试");
      window.AppUtils.showMessage("reception-message", id ? "接待任务已更新。" : "接待任务已保存。", "success");
      fillForm(null);
      await reloadReceptions();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      window.AppUtils.showMessage("reception-message", error.message, "error");
    }
  });

  document.body.addEventListener("click", async (event) => {
    const editId = event.target.getAttribute("data-edit-id");
    if (editId) {
      const item = state.receptions.find((entry) => entry.id === editId);
      if (item) {
        fillForm(item);
        window.AppUtils.showMessage("reception-message", `正在编辑任务：${item.title}`, "success");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }

    const deleteId = event.target.getAttribute("data-delete-id");
    if (deleteId) {
      const name = event.target.getAttribute("data-name") || "该任务";
      const confirmed = window.confirm(`确定删除「${name}」吗？`);
      if (!confirmed) {
        return;
      }
      try {
        window.AppUtils.hideMessage("reception-message");
        await window.AppUtils.fetchJson(`/api/receptions/${encodeURIComponent(deleteId)}`, { method: "DELETE" }, "删除接待任务失败，请稍后重试");
        window.AppUtils.showMessage("reception-message", "接待任务已删除。", "success");
        if (form.id.value === deleteId) {
          fillForm(null);
        }
        await reloadReceptions();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        window.AppUtils.showMessage("reception-message", error.message, "error");
      }
    }

    if (event.target.id === "reset-reception") {
      fillForm(null);
      window.AppUtils.showMessage("reception-message", "表单已重置，可继续录入新任务。", "success");
    }

    if (event.target.id === "reset-filter") {
      filterForm.reset();
      filterForm.assignee.value = "";
      renderList();
      window.AppUtils.showMessage("reception-message", "筛选条件已清空。", "success");
    }
  });

  renderFilterOptions();
  renderList();
  fillForm(null);
}

bootstrap().catch((error) => {
  window.AppUtils.showMessage("reception-message", error.message, "error");
});
