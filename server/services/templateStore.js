const { defaultQuoteTemplates } = require("./templateService");
const { getSupabaseConfig } = require("../supabaseConfig");

function cloneTemplate(template) {
  return {
    ...template,
    items: Array.isArray(template.items) ? template.items.map((item) => ({ ...item })) : [],
  };
}

function ensureLocalTemplates(data) {
  if (!Array.isArray(data.templates)) {
    data.templates = defaultQuoteTemplates.map(cloneTemplate);
  }
  return data.templates;
}

function getRemoteKey(config) {
  return config.serviceRoleKey || config.anonKey || config.publishableKey || "";
}

function buildHeaders(config, extraHeaders) {
  const key = getRemoteKey(config);
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

async function supabaseRequest(config, pathname, options = {}) {
  const key = getRemoteKey(config);
  if (!config.url || !key) {
    throw new Error("Supabase 未配置完整，暂不使用云端模板存储。");
  }

  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    method: options.method || "GET",
    headers: buildHeaders(config, options.headers),
    body: options.body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase 模板请求失败：${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function sortTemplateItems(items) {
  return [...items].sort((left, right) => (left.position || 0) - (right.position || 0));
}

function mapRemoteTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    isBuiltIn: Boolean(row.is_built_in),
    items: sortTemplateItems(row.template_items || []).map((item) => ({
      type: item.type,
      name: item.name,
      unit: item.unit,
      currency: item.currency,
      quantity: Number(item.quantity || 1),
      notes: item.notes || "",
    })),
  };
}

async function listRemoteTemplates(config) {
  const rows = await supabaseRequest(
    config,
    "templates?select=*,template_items(*)&order=name.asc",
    { headers: { Prefer: "return=representation" } }
  );

  return Array.isArray(rows) ? rows.map(mapRemoteTemplate) : [];
}

async function createRemoteTemplate(config, template) {
  await supabaseRequest(config, "templates", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: template.id,
      name: template.name,
      description: template.description,
      is_built_in: Boolean(template.isBuiltIn),
    }),
  });

  if (template.items.length > 0) {
    await supabaseRequest(config, "template_items", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(template.items.map((item, index) => ({
        template_id: template.id,
        type: item.type,
        name: item.name,
        unit: item.unit,
        currency: item.currency,
        quantity: item.quantity,
        notes: item.notes || "",
        position: index,
      }))),
    });
  }
}

async function seedRemoteDefaults(config) {
  for (const template of defaultQuoteTemplates.map(cloneTemplate)) {
    await createRemoteTemplate(config, template);
  }
  return defaultQuoteTemplates.map(cloneTemplate);
}

async function replaceRemoteTemplateItems(config, template) {
  await supabaseRequest(config, `template_items?template_id=eq.${encodeURIComponent(template.id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  if (template.items.length === 0) {
    return;
  }

  await supabaseRequest(config, "template_items", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(template.items.map((item, index) => ({
      template_id: template.id,
      type: item.type,
      name: item.name,
      unit: item.unit,
      currency: item.currency,
      quantity: item.quantity,
      notes: item.notes || "",
      position: index,
    }))),
  });
}

function createTemplateStore({ data, saveData }) {
  const config = getSupabaseConfig();

  function listLocalTemplates() {
    return ensureLocalTemplates(data).map(cloneTemplate);
  }

  function saveLocalTemplate(template) {
    const templates = ensureLocalTemplates(data);
    const index = templates.findIndex((entry) => entry.id === template.id);
    if (index === -1) {
      templates.unshift(cloneTemplate(template));
    } else {
      templates[index] = cloneTemplate(template);
    }
    saveData(data);
    return cloneTemplate(template);
  }

  function deleteLocalTemplate(templateId) {
    const templates = ensureLocalTemplates(data);
    const index = templates.findIndex((entry) => entry.id === templateId);
    if (index === -1) {
      return false;
    }
    templates.splice(index, 1);
    saveData(data);
    return true;
  }

  return {
    async listTemplates() {
      if (!config.enabled) {
        return { templates: listLocalTemplates(), source: "local_json" };
      }

      try {
        const templates = await listRemoteTemplates(config);
        if (templates.length === 0) {
          const seeded = await seedRemoteDefaults(config);
          return { templates: seeded, source: "supabase" };
        }
        return { templates, source: "supabase" };
      } catch (error) {
        console.warn("模板读取已回退到本地 JSON：", error.message);
        return { templates: listLocalTemplates(), source: "local_json", fallbackReason: error.message };
      }
    },

    async getTemplateById(templateId) {
      const result = await this.listTemplates();
      const template = result.templates.find((item) => item.id === templateId);
      if (!template) {
        throw new Error("模板不存在。");
      }
      return { template, source: result.source, fallbackReason: result.fallbackReason };
    },

    async saveTemplate(template) {
      if (!config.enabled) {
        return { template: saveLocalTemplate(template), source: "local_json" };
      }

      try {
        await supabaseRequest(config, "templates", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            id: template.id,
            name: template.name,
            description: template.description,
            is_built_in: Boolean(template.isBuiltIn),
          }),
        });
        await replaceRemoteTemplateItems(config, template);
        return { template: cloneTemplate(template), source: "supabase" };
      } catch (error) {
        console.warn("模板保存已回退到本地 JSON：", error.message);
        return { template: saveLocalTemplate(template), source: "local_json", fallbackReason: error.message };
      }
    },

    async deleteTemplate(templateId) {
      if (!config.enabled) {
        return { deleted: deleteLocalTemplate(templateId), source: "local_json" };
      }

      try {
        await supabaseRequest(config, `templates?id=eq.${encodeURIComponent(templateId)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        });
        return { deleted: true, source: "supabase" };
      } catch (error) {
        console.warn("模板删除已回退到本地 JSON：", error.message);
        return { deleted: deleteLocalTemplate(templateId), source: "local_json", fallbackReason: error.message };
      }
    },
  };
}

module.exports = {
  createTemplateStore,
  ensureLocalTemplates,
};

