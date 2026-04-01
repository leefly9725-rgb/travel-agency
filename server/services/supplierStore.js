const { getSupabaseConfig } = require("../supabaseConfig");
const { supabaseRequest } = require("../supabaseClient");

function mapRemoteSupplier(row) {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact || "",
    // phone / email / is_active 当前 Supabase suppliers 表无此列（见 supabase-schema.sql）
    // 本地 seed.json 路径可正常读写；Supabase 路径安全降级为空值，不影响读取
    phone: row.phone || "",
    email: row.email || "",
    notes: row.notes || "",
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
  };
}

function mapRemoteItem(row) {
  return {
    // snake_case fields (API response & frontend)
    id: String(row.id),
    supplier_id: row.supplier_id,
    supplierName: row.suppliers?.name || row.supplier_id || "—",
    category: row.category,
    name_zh: row.name_zh,
    name_en: row.name_en || "",
    spec: row.spec || "",
    unit: row.unit,
    cost_price: Number(row.cost_price || 0),
    notes: row.notes || "",
    is_active: Boolean(row.is_active),
    // camelCase aliases — kept for computeBestPriceItems compatibility
    supplierId: row.supplier_id,
    nameZh: row.name_zh,
    nameEn: row.name_en || "",
    costPrice: Number(row.cost_price || 0),
    isActive: Boolean(row.is_active),
  };
}

async function listRemoteSuppliers(config) {
  const rows = await supabaseRequest(config, "suppliers?select=*&order=name.asc");
  return Array.isArray(rows) ? rows.map(mapRemoteSupplier) : [];
}

async function listRemoteItems(config, filters) {
  let qs = "supplier_items?select=*,suppliers(name)&order=category.asc,name_zh.asc";
  // 状态过滤：默认（未传或 active）只返回启用项，保持原有行为；all=全部；inactive=仅停用
  if (!filters.status || filters.status === "active") {
    qs += "&is_active=eq.true";
  } else if (filters.status === "inactive") {
    qs += "&is_active=eq.false";
  }
  // filters.status === "all" → 不加 is_active 过滤，返回全部
  if (filters.category) qs += `&category=eq.${encodeURIComponent(filters.category)}`;
  if (filters.supplierId) qs += `&supplier_id=eq.${encodeURIComponent(filters.supplierId)}`;
  const rows = await supabaseRequest(config, qs);
  return Array.isArray(rows) ? rows.map(mapRemoteItem) : [];
}

async function createRemoteItem(config, item) {
  const rows = await supabaseRequest(config, "supplier_items", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      supplier_id: item.supplierId,
      category: item.category,
      name_zh: item.nameZh,
      name_en: item.nameEn || "",
      unit: item.unit,
      cost_price: item.costPrice || 0,
      spec: item.spec || "",
      notes: item.notes || "",
      is_active: item.isActive !== false,
      updated_at: new Date().toISOString(),
    }),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return mapRemoteItem(row);
}

async function updateRemoteItem(config, item) {
  await supabaseRequest(config, `supplier_items?id=eq.${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      supplier_id: item.supplierId,
      category: item.category,
      name_zh: item.nameZh,
      name_en: item.nameEn || "",
      unit: item.unit,
      cost_price: item.costPrice || 0,
      spec: item.spec || "",
      notes: item.notes || "",
      is_active: item.isActive !== false,
      updated_at: new Date().toISOString(),
    }),
  });
  return item;
}

function computeBestPriceItems(items) {
  const groups = {};
  items.forEach((item) => {
    if (!item.isActive) return;
    const key = `${item.category}::${item.nameZh}`;
    const existing = groups[key];
    if (!existing) {
      groups[key] = item;
    } else if (item.costPrice > 0 && (existing.costPrice === 0 || item.costPrice < existing.costPrice)) {
      groups[key] = item;
    }
  });
  return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category) || a.nameZh.localeCompare(b.nameZh));
}

function createSupplierStore({ data, saveData }) {
  const config = getSupabaseConfig();

  if (!Array.isArray(data.suppliers)) data.suppliers = [];
  if (!Array.isArray(data.supplierItems)) data.supplierItems = [];

  function saveLocalSupplier(supplier) {
    const index = data.suppliers.findIndex((s) => s.id === supplier.id);
    if (index === -1) {
      data.suppliers.push(supplier);
    } else {
      data.suppliers[index] = supplier;
    }
    saveData(data);
    return supplier;
  }

  function deleteLocalSupplier(id) {
    const index = data.suppliers.findIndex((s) => s.id === id);
    if (index === -1) return false;
    data.suppliers.splice(index, 1);
    data.supplierItems = data.supplierItems.filter((item) => item.supplierId !== id);
    saveData(data);
    return true;
  }

  function saveLocalItem(item) {
    if (!item.id) {
      item = { ...item, id: String(Date.now()) };
      data.supplierItems.push(item);
    } else {
      const index = data.supplierItems.findIndex((i) => i.id === item.id);
      if (index === -1) {
        data.supplierItems.push(item);
      } else {
        data.supplierItems[index] = item;
      }
    }
    saveData(data);
    return item;
  }

  function deleteLocalItem(id) {
    const index = data.supplierItems.findIndex((i) => i.id === id);
    if (index === -1) return false;
    data.supplierItems.splice(index, 1);
    saveData(data);
    return true;
  }

  return {
    async listSuppliers() {
      if (!config.enabled) {
        return { suppliers: [...data.suppliers], source: "local_json" };
      }
      try {
        const suppliers = await listRemoteSuppliers(config);
        return { suppliers, source: "supabase" };
      } catch (error) {
        console.warn("供应商列表读取出错，回退到本地 JSON。", error.message);
        return { suppliers: [...data.suppliers], source: "local_json", fallbackReason: error.message };
      }
    },

    async saveSupplier(supplier) {
      if (!config.enabled) {
        return { supplier: saveLocalSupplier(supplier), source: "local_json" };
      }
      try {
        await supabaseRequest(config, "suppliers", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            id: supplier.id,
            name: supplier.name,
            contact: supplier.contact || "",
            notes: supplier.notes || "",
          }),
        });
        return { supplier, source: "supabase" };
      } catch (error) {
        console.warn("供应商保存出错，回退到本地 JSON。", error.message);
        return { supplier: saveLocalSupplier(supplier), source: "local_json", fallbackReason: error.message };
      }
    },

    async deleteSupplier(id) {
      if (!config.enabled) {
        return { deleted: deleteLocalSupplier(id), source: "local_json" };
      }
      try {
        await supabaseRequest(config, `suppliers?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        });
        return { deleted: true, source: "supabase" };
      } catch (error) {
        console.warn("供应商删除出错，回退到本地 JSON。", error.message);
        return { deleted: deleteLocalSupplier(id), source: "local_json", fallbackReason: error.message };
      }
    },

    async listSupplierItems(filters = {}) {
      if (!config.enabled) {
        let items = [...data.supplierItems];
        if (filters.category) items = items.filter((i) => i.category === filters.category);
        if (filters.supplierId) items = items.filter((i) => i.supplierId === filters.supplierId);
        // 状态过滤：默认（未传或 active）只返回启用项；all=全部；inactive=仅停用
        if (!filters.status || filters.status === "active") {
          items = items.filter((i) => i.isActive !== false);
        } else if (filters.status === "inactive") {
          items = items.filter((i) => i.isActive === false);
        }
        return { items, source: "local_json" };
      }
      try {
        const items = await listRemoteItems(config, filters);
        return { items, source: "supabase" };
      } catch (error) {
        console.warn("供应商物料读取出错，回退到本地 JSON。", error.message);
        let items = [...data.supplierItems];
        if (filters.category) items = items.filter((i) => i.category === filters.category);
        if (filters.supplierId) items = items.filter((i) => i.supplierId === filters.supplierId);
        if (!filters.status || filters.status === "active") {
          items = items.filter((i) => i.isActive !== false);
        } else if (filters.status === "inactive") {
          items = items.filter((i) => i.isActive === false);
        }
        return { items, source: "local_json", fallbackReason: error.message };
      }
    },

    async getBestPriceItems() {
      // 最低价只基于启用项计算；显式传 status:active 以兼容新的状态过滤逻辑
      const { items } = await this.listSupplierItems({ status: "active" });
      return { items: computeBestPriceItems(items), source: "supabase" };
    },

    async saveSupplierItem(item) {
      if (!config.enabled) {
        return { item: saveLocalItem(item), source: "local_json" };
      }
      try {
        const isNew = !item.id;
        const saved = isNew ? await createRemoteItem(config, item) : await updateRemoteItem(config, item);
        return { item: saved, source: "supabase" };
      } catch (error) {
        console.warn("供应商物料保存出错，回退到本地 JSON。", error.message);
        return { item: saveLocalItem(item), source: "local_json", fallbackReason: error.message };
      }
    },

    async deleteSupplierItem(id) {
      if (!config.enabled) {
        return { deleted: deleteLocalItem(id), source: "local_json" };
      }
      try {
        await supabaseRequest(config, `supplier_items?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        });
        return { deleted: true, source: "supabase" };
      } catch (error) {
        console.warn("供应商物料删除出错，回退到本地 JSON。", error.message);
        return { deleted: deleteLocalItem(id), source: "local_json", fallbackReason: error.message };
      }
    },
  };
}

module.exports = { createSupplierStore };
