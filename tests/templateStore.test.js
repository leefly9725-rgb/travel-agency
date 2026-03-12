const test = require("node:test");
const assert = require("node:assert/strict");
const { createTemplateStore } = require("../server/services/templateStore");

test("templateStore falls back to local JSON when Supabase is unreachable", async () => {
  const data = { quotes: [], receptions: [], documents: [] };
  let saveCount = 0;
  const store = createTemplateStore({
    data,
    saveData() {
      saveCount += 1;
    },
    supabaseConfig: {
      enabled: true,
      url: "http://127.0.0.1:65530",
      anonKey: "test-key",
      publishableKey: "",
      serviceRoleKey: "",
      hasServiceRoleKey: false,
    },
  });

  const result = await store.listTemplates();
  assert.equal(result.source, "local_json");
  assert.equal(result.templates.some((item) => item.id === "TPL-business-reception"), true);

  const saved = await store.saveTemplate({
    id: "TPL-test-fallback",
    name: "回退模板",
    description: "测试本地回退",
    isBuiltIn: false,
    items: [],
  });

  assert.equal(saved.source, "local_json");
  assert.equal(saveCount, 1);
});

