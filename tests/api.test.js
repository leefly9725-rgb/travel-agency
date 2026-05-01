const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createServer } = require("../server/app");

const tempDataFile = path.join(process.cwd(), "tests", "temp-seed.json");
const blockedFetchPorts = new Set([1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);

const baseData = {
  quotes: [
    {
      id: "Q-1",
      projectId: "P-1",
      quoteNumber: "QT-1",
      clientName: "Client",
      projectName: "Project",
      contactName: "Contact",
      contactPhone: "123",
      language: "zh-CN",
      currency: "EUR",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      tripDate: "2026-06-01",
      travelDays: 2,
      destination: "Belgrade",
      paxCount: 8,
      notes: "Need airport pickup",
      items: [
        { type: "hotel", name: "Hotel", unit: "night", supplier: "Supplier", currency: "EUR", cost: 100, price: 150, quantity: 2, notes: "" }
      ],
      dataQuality: {
        reviewStatus: "flagged_review",
        issues: ["Test issue"],
        note: "Need manual review",
      }
    }
  ],
  receptions: [
    {
      id: "R-1",
      projectId: "P-1",
      taskType: "airport_pickup",
      title: "Pickup",
      assignee: "Mila",
      dueTime: "2026-06-01T08:00",
      status: "pending",
      location: "Airport",
      notes: "Call guest"
    }
  ],
  documents: [],
};

async function withServer(run) {
  fs.writeFileSync(tempDataFile, JSON.stringify(baseData, null, 2));
  process.env.DATA_FILE = "./tests/temp-seed.json";
  const _prevBypass = process.env.ALLOW_DEV_BYPASS;
  process.env.ALLOW_DEV_BYPASS = 'true';

  let server;
  let port;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    server = createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
    if (!blockedFetchPorts.has(port)) {
      break;
    }
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server = null;
  }

  if (!server) {
    delete process.env.DATA_FILE;
    if (_prevBypass === undefined) { delete process.env.ALLOW_DEV_BYPASS; } else { process.env.ALLOW_DEV_BYPASS = _prevBypass; }
    if (fs.existsSync(tempDataFile)) {
      fs.unlinkSync(tempDataFile);
    }
    throw new Error("??????? fetch ????????");
  }

  try {
    await run(port);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete process.env.DATA_FILE;
    if (_prevBypass === undefined) { delete process.env.ALLOW_DEV_BYPASS; } else { process.env.ALLOW_DEV_BYPASS = _prevBypass; }
    if (fs.existsSync(tempDataFile)) {
      fs.unlinkSync(tempDataFile);
    }
  }
}

function apiFetch(port, path, options = {}) {
  const { headers, ...rest } = options;
  return fetch(`http://127.0.0.1:${port}${path}`, {
    ...rest,
    headers: { Authorization: 'Bearer dev-bypass-token', ...headers },
  });
}

test("GET /api/templates returns default templates when local data has none", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/templates');
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.length >= 5);
    assert.equal(payload.some((item) => item.id === "TPL-business-reception"), true);
  });
});

test("POST /api/templates creates a custom template", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/templates', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "����ģ��",
        description: "���ڲ���",
        items: [
          { type: "vehicle", name: "�����ӻ�", unit: "��", currency: "EUR", quantity: 1, notes: "���Ա�ע" }
        ],
      }),
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.name, "����ģ��");
    assert.equal(payload.items[0].type, "vehicle");

    const saved = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    assert.equal(Array.isArray(saved.templates), true);
    assert.equal(saved.templates.some((item) => item.name === "����ģ��"), true);
  });
});

test("GET /api/quotes/:id returns enriched quote detail", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quotes/Q-1');
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.projectName, "Project");
    assert.equal(payload.totalPrice, 300);
    assert.equal(payload.grossMargin, 33.33);
    assert.equal(payload.startDate, "2026-06-01");
    assert.equal(payload.endDate, "2026-06-02");
    assert.equal(payload.dataQuality.reviewStatus, "flagged_review");
  });
});

test("PUT /api/quotes/:id updates quote dates and recalculates mixed-currency items", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quotes/Q-1', {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteNumber: "QT-1",
        clientName: "Updated Client",
        projectName: "Updated Project",
        contactName: "Updated Contact",
        contactPhone: "999",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-06-03",
        endDate: "2026-06-05",
        destination: "Novi Sad",
        paxCount: 6,
        notes: "Updated note",
        items: [
          { type: "vehicle", name: "Transfer", unit: "trip", supplier: "Fleet", currency: "RSD", cost: 117, price: 234, quantity: 1, notes: "" },
          { type: "hotel", name: "Hotel", unit: "night", supplier: "Supplier", currency: "EUR", cost: 80, price: 120, quantity: 2, notes: "" }
        ]
      })
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.travelDays, 3);
    assert.equal(payload.startDate, "2026-06-03");
    assert.equal(payload.endDate, "2026-06-05");
    assert.equal(payload.items[0].currency, "RSD");
    assert.equal(payload.items[0].totalPrice, 2);
    assert.equal(payload.totalPrice, 242);
  });
});

test("PUT /api/quotes/:id preserves items array order", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quotes/Q-1', {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteNumber: "QT-1",
        clientName: "Client",
        projectName: "Project",
        contactName: "Contact",
        contactPhone: "123",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-06-01",
        endDate: "2026-06-02",
        destination: "Belgrade",
        paxCount: 8,
        notes: "",
        items: [
          { type: "misc", name: "ItemC", unit: "项", supplier: "", currency: "EUR", cost: 10, price: 20, quantity: 1, notes: "" },
          { type: "misc", name: "ItemA", unit: "项", supplier: "", currency: "EUR", cost: 30, price: 50, quantity: 1, notes: "" },
          { type: "misc", name: "ItemB", unit: "项", supplier: "", currency: "EUR", cost: 50, price: 80, quantity: 1, notes: "" },
        ],
      }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.items.length, 3);
    assert.equal(payload.items[0].name, "ItemC");
    assert.equal(payload.items[1].name, "ItemA");
    assert.equal(payload.items[2].name, "ItemB");
  });
});

test("DELETE /api/quotes/:id removes a quote", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quotes/Q-1', { method: "DELETE" });
    assert.equal(response.status, 200);
    const saved = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    assert.equal(saved.quotes.length, 0);
  });
});

test("POST /api/receptions saves extended reception fields", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/receptions', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskType: "guide_support",
        title: "Guide standby",
        assignee: "Ana",
        dueTime: "2026-06-02T09:30",
        status: "in_progress",
        location: "City Center",
        notes: "Bring printed schedule",
      }),
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.taskType, "guide_support");
    assert.equal(payload.location, "City Center");
  });
});

test("DELETE /api/receptions/:id removes a reception task", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/receptions/R-1', { method: "DELETE" });
    assert.equal(response.status, 200);
    const saved = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    assert.equal(saved.receptions.length, 0);
  });
});

test("GET /api/document-previews returns five preview blocks", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/document-previews?quoteId=Q-1&receptionId=R-1');
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.length, 5);
    assert.equal(payload[0].type, "quote_document");
  });
});

test("GET /api/projects/:id returns project archive detail with linked flagged quote", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/projects/P-1');
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.projectName, "Project");
    assert.equal(payload.linkedQuotes.length, 1);
    assert.equal(payload.linkedQuotes[0].dataQuality.reviewStatus, "flagged_review");
    assert.equal(payload.linkedReceptions.length, 1);
    assert.equal(payload.linkedDocumentPreviews.length, 5);
  });
});

test("POST /api/quotes/:id/submit requires Supabase (returns 503 when not configured)", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quotes/Q-1/submit', { method: "POST" });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("POST /api/quotes/:id/review requires Supabase (returns 503 when not configured)", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quotes/Q-1/review', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("POST /api/quotes/:id/reopen requires Supabase (returns 503 when not configured)", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quotes/Q-1/reopen', { method: "POST" });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("POST /api/quotes/:id/clone clones a standard quote as a new draft", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quotes/Q-1/clone', { method: "POST" });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.notEqual(payload.id, "Q-1");
    assert.equal(payload.status || "draft", "draft");
    assert.equal(payload.pricingMode || "standard", "standard");
    assert.ok(String(payload.projectName || "").includes("副本"), "cloned projectName should include 副本");
    assert.equal(payload.clientName, "Client");
  });
});

test("POST /api/quotes/:id/clone does not modify the original quote", async () => {
  await withServer(async (port) => {
    await apiFetch(port, '/api/quotes/Q-1/clone', { method: "POST" });
    const getResponse = await apiFetch(port, '/api/quotes/Q-1');
    assert.equal(getResponse.status, 200);
    const original = await getResponse.json();
    assert.equal(original.id, "Q-1");
    assert.equal(original.projectName, "Project");
  });
});

test("POST /api/quotes/:id/clone returns 404 for non-existent quote", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quotes/NONEXISTENT/clone', { method: "POST" });
    assert.equal(response.status, 404);
  });
});

test("POST /api/quotes/:id/clone returns 400 for project_based quote", async () => {
  await withServer(async (port) => {
    const createResponse = await apiFetch(port, '/api/quotes', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Test",
        projectName: "Project Quote",
        contactName: "Contact",
        contactPhone: "",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        destination: "Belgrade",
        paxCount: 5,
        notes: "",
        pricingMode: "project_based",
        items: [],
        projectGroups: [],
      }),
    });
    assert.equal(createResponse.status, 201);
    const newQuote = await createResponse.json();
    const cloneResponse = await apiFetch(port, `/api/quotes/${encodeURIComponent(newQuote.id)}/clone`, { method: "POST" });
    assert.equal(cloneResponse.status, 400);
  });
});


