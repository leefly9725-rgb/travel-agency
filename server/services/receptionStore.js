const { getSupabaseConfig } = require("../supabaseConfig");
const { supabaseRequest } = require("../supabaseClient");

function mapRemoteReception(row) {
  return {
    id: row.id,
    projectId: row.project_id || "",
    taskType: row.task_type,
    title: row.title,
    assignee: row.assignee,
    dueTime: String(row.due_time || "").slice(0, 16),
    status: row.status,
    location: row.location,
    notes: row.notes || "",
  };
}

async function listRemoteReceptions(config) {
  const rows = await supabaseRequest(config, "receptions?select=*&order=due_time.asc");
  return Array.isArray(rows) ? rows.map(mapRemoteReception) : [];
}

async function getRemoteReceptionById(config, id) {
  const rows = await supabaseRequest(config, `receptions?select=*&id=eq.${encodeURIComponent(id)}`);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("接待任务不存在。");
  }
  return mapRemoteReception(rows[0]);
}

async function saveRemoteReception(config, reception) {
  await supabaseRequest(config, "receptions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: reception.id,
      project_id: reception.projectId || "",
      task_type: reception.taskType,
      title: reception.title,
      assignee: reception.assignee,
      due_time: reception.dueTime,
      status: reception.status,
      location: reception.location,
      notes: reception.notes || "",
      updated_at: new Date().toISOString(),
    }),
  });
  return reception;
}

async function deleteRemoteReception(config, id) {
  await supabaseRequest(config, `receptions?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  return true;
}

function createReceptionStore({ data, saveData }) {
  const config = getSupabaseConfig();

  function listLocalReceptions() {
    return Array.isArray(data.receptions) ? data.receptions : [];
  }

  function saveLocalReception(reception) {
    if (!Array.isArray(data.receptions)) data.receptions = [];
    const index = data.receptions.findIndex((item) => item.id === reception.id);
    if (index === -1) {
      data.receptions.unshift(reception);
    } else {
      data.receptions[index] = reception;
    }
    saveData(data);
    return reception;
  }

  function deleteLocalReception(id) {
    if (!Array.isArray(data.receptions)) return false;
    const index = data.receptions.findIndex((item) => item.id === id);
    if (index === -1) return false;
    data.receptions.splice(index, 1);
    saveData(data);
    return true;
  }

  return {
    async listReceptions() {
      if (!config.enabled) {
        return { receptions: listLocalReceptions(), source: "local_json" };
      }
      try {
        const receptions = await listRemoteReceptions(config);
        return { receptions, source: "supabase" };
      } catch (error) {
        console.warn("接待任务读取出错，回退到本地 JSON。", error.message);
        return { receptions: listLocalReceptions(), source: "local_json", fallbackReason: error.message };
      }
    },

    async getReceptionById(id) {
      if (!config.enabled) {
        const reception = listLocalReceptions().find((item) => item.id === id);
        if (!reception) throw new Error("接待任务不存在。");
        return { reception, source: "local_json" };
      }
      try {
        const reception = await getRemoteReceptionById(config, id);
        return { reception, source: "supabase" };
      } catch (error) {
        console.warn("接待任务查询出错，回退到本地 JSON。", error.message);
        const reception = listLocalReceptions().find((item) => item.id === id);
        if (!reception) throw new Error("接待任务不存在。");
        return { reception, source: "local_json", fallbackReason: error.message };
      }
    },

    async saveReception(reception) {
      if (!config.enabled) {
        return { reception: saveLocalReception(reception), source: "local_json" };
      }
      try {
        await saveRemoteReception(config, reception);
        return { reception, source: "supabase" };
      } catch (error) {
        console.warn("接待任务保存出错，回退到本地 JSON。", error.message);
        return { reception: saveLocalReception(reception), source: "local_json", fallbackReason: error.message };
      }
    },

    async deleteReception(id) {
      if (!config.enabled) {
        return { deleted: deleteLocalReception(id), source: "local_json" };
      }
      try {
        await deleteRemoteReception(config, id);
        return { deleted: true, source: "supabase" };
      } catch (error) {
        console.warn("接待任务删除出错，回退到本地 JSON。", error.message);
        return { deleted: deleteLocalReception(id), source: "local_json", fallbackReason: error.message };
      }
    },
  };
}

module.exports = { createReceptionStore };
