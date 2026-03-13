const { getSupabaseConfig } = require("../supabaseConfig");
const { supabaseRequest } = require("../supabaseClient");

function mapRemoteDocument(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    language: row.language || "zh-CN",
    updatedAt: row.updated_at || "",
  };
}

async function listRemoteDocuments(config) {
  const rows = await supabaseRequest(config, "documents?select=*&order=updated_at.desc");
  return Array.isArray(rows) ? rows.map(mapRemoteDocument) : [];
}

async function saveRemoteDocument(config, document) {
  await supabaseRequest(config, "documents", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: document.id,
      title: document.title,
      category: document.category,
      language: document.language || "zh-CN",
      updated_at: document.updatedAt || new Date().toISOString().slice(0, 10),
    }),
  });
  return document;
}

async function deleteRemoteDocument(config, id) {
  await supabaseRequest(config, `documents?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  return true;
}

function createDocumentStore({ data, saveData }) {
  const config = getSupabaseConfig();

  function listLocalDocuments() {
    return Array.isArray(data.documents) ? data.documents : [];
  }

  function saveLocalDocument(document) {
    if (!Array.isArray(data.documents)) data.documents = [];
    const index = data.documents.findIndex((item) => item.id === document.id);
    if (index === -1) {
      data.documents.unshift(document);
    } else {
      data.documents[index] = document;
    }
    saveData(data);
    return document;
  }

  function deleteLocalDocument(id) {
    if (!Array.isArray(data.documents)) return false;
    const index = data.documents.findIndex((item) => item.id === id);
    if (index === -1) return false;
    data.documents.splice(index, 1);
    saveData(data);
    return true;
  }

  return {
    async listDocuments() {
      if (!config.enabled) {
        return { documents: listLocalDocuments(), source: "local_json" };
      }
      try {
        const documents = await listRemoteDocuments(config);
        return { documents, source: "supabase" };
      } catch (error) {
        console.warn("文档读取出错，回退到本地 JSON。", error.message);
        return { documents: listLocalDocuments(), source: "local_json", fallbackReason: error.message };
      }
    },

    async getDocumentById(id) {
      const result = await this.listDocuments();
      const document = result.documents.find((item) => item.id === id);
      if (!document) throw new Error("文档不存在。");
      return { document, source: result.source };
    },

    async saveDocument(document) {
      if (!config.enabled) {
        return { document: saveLocalDocument(document), source: "local_json" };
      }
      try {
        await saveRemoteDocument(config, document);
        return { document, source: "supabase" };
      } catch (error) {
        console.warn("文档保存出错，回退到本地 JSON。", error.message);
        return { document: saveLocalDocument(document), source: "local_json", fallbackReason: error.message };
      }
    },

    async deleteDocument(id) {
      if (!config.enabled) {
        return { deleted: deleteLocalDocument(id), source: "local_json" };
      }
      try {
        await deleteRemoteDocument(config, id);
        return { deleted: true, source: "supabase" };
      } catch (error) {
        console.warn("文档删除出错，回退到本地 JSON。", error.message);
        return { deleted: deleteLocalDocument(id), source: "local_json", fallbackReason: error.message };
      }
    },
  };
}

module.exports = { createDocumentStore };
