// ═══════════════════════════════════════════════════════════════════════════════
// [兼容线 — 已冻结，不再作为主线扩展]
// projectQuoteStore 对应旧 /api/project-quotes 链路，现已退场。
// 项目型报价主线已迁移至 /api/quotes（pricingMode=project_based）。
// 本模块保留仅为兼容旧数据，新需求禁止在此扩展。
// ═══════════════════════════════════════════════════════════════════════════════

const { getSupabaseConfig } = require("../supabaseConfig");
const { supabaseRequest } = require("../supabaseClient");

function mapRemoteProject(row) {
  return {
    id: row.id,
    name: row.name,
    client: row.client || "",
    eventDate: row.event_date ? String(row.event_date).slice(0, 10) : "",
    venue: row.venue || "",
    paxCount: Number(row.pax_count || 0),
    currency: row.currency || "EUR",
    status: row.status || "draft",
    notes: row.notes || "",
    projectGroup: row.project_group || "mixed",
    items: [],
  };
}

function mapRemoteProjectItem(row) {
  return {
    id: String(row.id),
    projectId: row.project_id,
    groupName: row.group_name || "",
    nameZh: row.name_zh,
    nameEn: row.name_en || "",
    unit: row.unit,
    quantity: Number(row.quantity || 1),
    costPrice: Number(row.cost_price || 0),
    sellPrice: Number(row.sell_price || 0),
    supplier: row.supplier || "",
    notes: row.notes || "",
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order || 0),
  };
}

async function listRemoteProjects(config) {
  const rows = await supabaseRequest(config, "quotation_projects?select=*&order=created_at.desc");
  return Array.isArray(rows) ? rows.map(mapRemoteProject) : [];
}

async function listRemoteProjectItems(config, projectId) {
  const rows = await supabaseRequest(
    config,
    `quotation_project_items?select=*&project_id=eq.${encodeURIComponent(projectId)}&order=sort_order.asc`,
  );
  return Array.isArray(rows) ? rows.map(mapRemoteProjectItem) : [];
}

async function getRemoteProjectWithItems(config, projectId) {
  const [projects, items] = await Promise.all([
    supabaseRequest(config, `quotation_projects?select=*&id=eq.${encodeURIComponent(projectId)}`),
    listRemoteProjectItems(config, projectId),
  ]);
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error("项目型报价不存在。");
  }
  const project = mapRemoteProject(projects[0]);
  project.items = items;
  return project;
}

async function saveRemoteProject(config, project) {
  await supabaseRequest(config, "quotation_projects", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: project.id,
      name: project.name,
      client: project.client || "",
      event_date: project.eventDate || null,
      venue: project.venue || "",
      pax_count: project.paxCount || 0,
      currency: project.currency || "EUR",
      status: project.status || "draft",
      notes: project.notes || "",
      project_group: project.projectGroup || "mixed",
      updated_at: new Date().toISOString(),
    }),
  });

  // Replace items: delete old, insert new
  await supabaseRequest(
    config,
    `quotation_project_items?project_id=eq.${encodeURIComponent(project.id)}`,
    { method: "DELETE" },
  );

  if (Array.isArray(project.items) && project.items.length > 0) {
    const rows = project.items.map((item, index) => ({
      project_id: project.id,
      group_name: item.groupName || "",
      name_zh: item.nameZh,
      name_en: item.nameEn || "",
      unit: item.unit,
      quantity: Number(item.quantity || 1),
      cost_price: Number(item.costPrice || 0),
      sell_price: Number(item.sellPrice || 0),
      supplier: item.supplier || "",
      notes: item.notes || "",
      is_active: item.isActive !== false,
      sort_order: item.sortOrder !== undefined ? item.sortOrder : index,
    }));
    await supabaseRequest(config, "quotation_project_items", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
  }

  return getRemoteProjectWithItems(config, project.id);
}

async function deleteRemoteProject(config, projectId) {
  await supabaseRequest(config, `quotation_projects?id=eq.${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
  return true;
}

function createProjectQuoteStore({ data, saveData }) {
  const config = getSupabaseConfig();

  if (!Array.isArray(data.projectQuotes)) {
    data.projectQuotes = [];
  }

  return {
    async listProjectQuotes() {
      if (config.enabled) {
        try {
          const projects = await listRemoteProjects(config);
          return { projects, source: "supabase" };
        } catch (error) {
          console.error("项目型报价列表加载失败，回退到本地 JSON。", error.message);
        }
      }
      return { projects: data.projectQuotes.map((p) => ({ ...p })), source: "local_json" };
    },

    async getProjectQuoteById(projectId) {
      if (config.enabled) {
        try {
          const project = await getRemoteProjectWithItems(config, projectId);
          return { project };
        } catch (error) {
          if (error.message.includes("不存在")) throw error;
          console.error("项目型报价加载失败，回退到本地 JSON。", error.message);
        }
      }
      const project = data.projectQuotes.find((p) => p.id === projectId);
      if (!project) throw new Error("项目型报价不存在。");
      return { project: { ...project, items: Array.isArray(project.items) ? project.items.slice() : [] } };
    },

    async saveProjectQuote(project) {
      if (config.enabled) {
        try {
          const saved = await saveRemoteProject(config, project);
          return { project: saved };
        } catch (error) {
          console.error("项目型报价保存失败，回退到本地 JSON。", error.message);
        }
      }
      const index = data.projectQuotes.findIndex((p) => p.id === project.id);
      if (index >= 0) {
        data.projectQuotes[index] = project;
      } else {
        data.projectQuotes.push(project);
      }
      saveData(data);
      return { project: { ...project } };
    },

    async deleteProjectQuote(projectId) {
      if (config.enabled) {
        try {
          await deleteRemoteProject(config, projectId);
          return { deleted: true };
        } catch (error) {
          console.error("项目型报价删除失败，回退到本地 JSON。", error.message);
        }
      }
      const index = data.projectQuotes.findIndex((p) => p.id === projectId);
      if (index < 0) return { deleted: false };
      data.projectQuotes.splice(index, 1);
      saveData(data);
      return { deleted: true };
    },
  };
}

module.exports = { createProjectQuoteStore };
