const { getSupabaseConfig } = require("../supabaseConfig");
const { supabaseRequest } = require("../supabaseClient");

function mapRemoteSupplier(row) {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact || "",
    notes: row.notes || "",
  };
}

function mapRemoteItem(row) {
  return {
    id: String(row.id),
    supplierId: row.supplier_id,
    category: row.category,
    nameZh: row.name_zh,
    nameEn: row.name_en || "",
    unit: row.unit,
    costPrice: Number(row.cost_price || 0),
    spec: row.spec || "",
    notes: row.notes || "",
    isActive: Boolean(row.is_active),
  };
}

async function listRemoteSuppliers(config) {
  const rows = await supabaseRequest(config, "suppliers?select=*&order=name.asc");
  return Array.isArray(rows) ? rows.map(mapRemoteSupplier) : [];
}

async function listRemoteItems(config, filters) {
  let qs = "supplier_items?select=*&order=category.asc,name_zh.asc";
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
        return { items, source: "local_json", fallbackReason: error.message };
      }
    },

    async getBestPriceItems() {
      const { items } = await this.listSupplierItems();
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
