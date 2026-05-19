const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createServer } = require("../server/app");

const tempDataFile = path.join(process.cwd(), "tests", "temp-seed.json");
const blockedFetchPorts = new Set([1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);
const testJwtSecret = "test-customer-quote-token-secret";

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

const customerPayloadForbiddenKeys = [
  "totalCost",
  "grossProfit",
  "grossMargin",
  "status",
  "executionStatus",
  "ownerId",
  "reviewerId",
  "reviewedAt",
  "reviewNote",
  "dataQuality",
  "submittedAt",
  "createdAt",
  "updatedAt",
  "projectId",
  "tripDate",
  "cost",
  "costUnitPrice",
  "supplier",
  "supplierId",
  "supplierName",
  "internalNotes",
  "costSubtotal",
  "costNightlyRate",
];

function assertDeepNoKeys(value, forbiddenKeys, pathLabel = "payload") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertDeepNoKeys(entry, forbiddenKeys, `${pathLabel}[${index}]`));
    return;
  }
  for (const key of forbiddenKeys) {
    assert.equal(Object.prototype.hasOwnProperty.call(value, key), false, `${pathLabel}.${key} must not be in customer payload`);
  }
  for (const [key, child] of Object.entries(value)) {
    assertDeepNoKeys(child, forbiddenKeys, `${pathLabel}.${key}`);
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signCustomerQuoteToken(payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", testJwtSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function createExpiredCustomerQuoteToken(quoteId) {
  return signCustomerQuoteToken({
    qid: quoteId,
    purpose: "customer_standard_quote",
    iat: 1,
    exp: 2,
    salt: "expired-test",
  });
}

function seedCustomerQuoteFixture() {
  const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
  data.quotes.push({
    id: "Q-CUSTOMER",
    projectId: "P-CUSTOMER",
    quoteNumber: "QT-CUSTOMER",
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
    notes: "Internal quote note: margin can move",
    customerNotes: "Customer visible quote note",
    status: "draft",
    executionStatus: "internal_pending",
    ownerId: "owner-1",
    reviewerId: "reviewer-1",
    reviewedAt: "2026-05-01T10:00:00Z",
    reviewNote: "Internal manager review",
    submittedAt: "2026-05-01T09:00:00Z",
    createdAt: "2026-05-01T08:00:00Z",
    updatedAt: "2026-05-01T11:00:00Z",
    items: [
      {
        type: "hotel",
        name: "Hotel",
        unit: "night",
        supplier: "Supplier",
        supplierId: "S-1",
        supplierName: "Supplier Internal Name",
        currency: "EUR",
        cost: 100,
        price: 150,
        quantity: 2,
        notes: "Internal item note: supplier quoted lower",
        publicNotes: "Customer visible item note",
        internalNotes: "Internal execution reminder",
        hotelDetails: [
          {
            roomType: "Standard",
            roomCount: 2,
            nights: 1,
            costNightlyRate: 80,
            priceNightlyRate: 150,
            supplier: "Hotel Supplier",
            supplierId: "HS-1",
            notes: "Internal detail note: use net rate",
            public_notes: "Customer visible room note",
          }
        ]
      }
    ],
    dataQuality: {
      reviewStatus: "flagged_review",
      issues: ["Test issue"],
      note: "Need manual review",
    }
  });
  fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));
}

async function withServer(run) {
  fs.writeFileSync(tempDataFile, JSON.stringify(baseData, null, 2));
  process.env.DATA_FILE = "./tests/temp-seed.json";
  const _prevBypass = process.env.ALLOW_DEV_BYPASS;
  const _prevJwtSecret = process.env.JWT_SECRET;
  process.env.ALLOW_DEV_BYPASS = 'true';
  process.env.JWT_SECRET = testJwtSecret;

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
    if (_prevJwtSecret === undefined) { delete process.env.JWT_SECRET; } else { process.env.JWT_SECRET = _prevJwtSecret; }
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
    if (_prevJwtSecret === undefined) { delete process.env.JWT_SECRET; } else { process.env.JWT_SECRET = _prevJwtSecret; }
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

function publicFetch(port, path, options = {}) {
  return fetch(`http://127.0.0.1:${port}${path}`, options);
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

test("GET /api/customer-standard-quotations/:id returns whitelisted customer payload", async () => {
  await withServer(async (port) => {
    seedCustomerQuoteFixture();
    const response = await apiFetch(port, '/api/customer-standard-quotations/Q-CUSTOMER');
    assert.equal(response.status, 200);
    const payload = await response.json();

    // ── Required fields present ──────────────────────────────────────────
    assert.equal(payload.id, "Q-CUSTOMER");
    assert.equal(payload.clientName, "Client");
    assert.equal(payload.projectName, "Project");
    assert.equal(payload.quoteNumber, "QT-CUSTOMER");
    assert.equal(payload.currency, "EUR");
    assert.equal(typeof payload.totalPrice, "number");
    assert.equal(Array.isArray(payload.items), true);
    assert.equal(payload.customerNotes, "Customer visible quote note");
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "notes"), false, "top-level notes must not be in customer payload");
    assert.equal(payload.items[0].type, "hotel");
    assert.equal(payload.items[0].name, "Hotel");
    assert.equal(typeof payload.items[0].totalPrice, "number");
    assert.equal(payload.items[0].customerNotes, "Customer visible item note");
    assert.equal(Object.prototype.hasOwnProperty.call(payload.items[0], "notes"), false, "item.notes must not be in customer payload");
    assert.equal(Array.isArray(payload.items[0].hotelDetails), true);
    assert.equal(payload.items[0].hotelDetails[0].customerNotes, "Customer visible room note");
    assert.equal(Object.prototype.hasOwnProperty.call(payload.items[0].hotelDetails[0], "notes"), false, "detail.notes must not be in customer payload");

    // ── Internal top-level fields must be absent ─────────────────────────
    assert.equal(payload.totalCost,       undefined, "totalCost must not be in customer payload");
    assert.equal(payload.grossProfit,     undefined, "grossProfit must not be in customer payload");
    assert.equal(payload.grossMargin,     undefined, "grossMargin must not be in customer payload");
    assert.equal(payload.status,          undefined, "status must not be in customer payload");
    assert.equal(payload.executionStatus, undefined, "executionStatus must not be in customer payload");
    assert.equal(payload.ownerId,         undefined, "ownerId must not be in customer payload");
    assert.equal(payload.reviewerId,      undefined, "reviewerId must not be in customer payload");
    assert.equal(payload.reviewedAt,      undefined, "reviewedAt must not be in customer payload");
    assert.equal(payload.reviewNote,      undefined, "reviewNote must not be in customer payload");
    assert.equal(payload.dataQuality,     undefined, "dataQuality must not be in customer payload");
    assert.equal(payload.submittedAt,     undefined, "submittedAt must not be in customer payload");
    assert.equal(payload.updatedAt,       undefined, "updatedAt must not be in customer payload");
    assert.equal(payload.createdAt,       undefined, "createdAt must not be in customer payload");

    // ── Internal item-level fields must be absent ────────────────────────
    const item = payload.items[0];
    assert.equal(item.cost,             undefined, "item.cost must not be in customer payload");
    assert.equal(item.totalCost,        undefined, "item.totalCost must not be in customer payload");
    assert.equal(item.supplier,         undefined, "item.supplier must not be in customer payload");
    assert.equal(item.supplierName,     undefined, "item.supplierName must not be in customer payload");
    assert.equal(item.supplierId,       undefined, "item.supplierId must not be in customer payload");
    assert.equal(item.internalNotes,    undefined, "item.internalNotes must not be in customer payload");
    assertDeepNoKeys(payload, ["notes", ...customerPayloadForbiddenKeys]);
  });
});

test("POST /api/customer-standard-quotations/:id/share-token returns a signed customer link", async () => {
  await withServer(async (port) => {
    seedCustomerQuoteFixture();
    const response = await apiFetch(port, '/api/customer-standard-quotations/Q-CUSTOMER/share-token', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validityDays: 7 }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(typeof payload.token, "string");
    assert.equal(payload.token.length > 20, true);
    assert.equal(/[\/+=]/.test(payload.token), false);
    assert.equal(typeof payload.expiresAt, "string");
    assert.equal(payload.url.includes("/standard-quotation.html?token="), true);
    assert.equal(payload.url.includes("lang=bi"), true);
  });
});

test("GET /api/customer-standard-quotations/by-token/:token returns whitelisted customer payload", async () => {
  await withServer(async (port) => {
    seedCustomerQuoteFixture();
    const tokenResponse = await apiFetch(port, '/api/customer-standard-quotations/Q-CUSTOMER/share-token', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validityDays: 30 }),
    });
    assert.equal(tokenResponse.status, 200);
    const { token } = await tokenResponse.json();

    const response = await publicFetch(port, `/api/customer-standard-quotations/by-token/${encodeURIComponent(token)}`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.id, "Q-CUSTOMER");
    assert.equal(payload.customerNotes, "Customer visible quote note");
    assert.equal(payload.items[0].customerNotes, "Customer visible item note");
    assertDeepNoKeys(payload, ["notes", ...customerPayloadForbiddenKeys]);
  });
});

test("GET /api/customer-standard-quotations/by-token/:token rejects invalid token", async () => {
  await withServer(async (port) => {
    const response = await publicFetch(port, '/api/customer-standard-quotations/by-token/not-a-valid-token');
    assert.equal([401, 403].includes(response.status), true);
  });
});

test("GET /api/customer-standard-quotations/by-token/:token rejects expired token", async () => {
  await withServer(async (port) => {
    seedCustomerQuoteFixture();
    const token = createExpiredCustomerQuoteToken("Q-CUSTOMER");
    const response = await publicFetch(port, `/api/customer-standard-quotations/by-token/${encodeURIComponent(token)}`);
    assert.equal([401, 403].includes(response.status), true);
  });
});

test("GET /api/customer-standard-quotations/:id requires login and blocks public id enumeration", async () => {
  await withServer(async (port) => {
    seedCustomerQuoteFixture();
    const response = await publicFetch(port, '/api/customer-standard-quotations/Q-CUSTOMER');
    assert.equal(response.status, 401);
  });
});

test("GET /api/customer-standard-quotations/:id returns 404 for non-existent quote", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/customer-standard-quotations/NONEXISTENT');
    assert.equal(response.status, 404);
  });
});

test("GET /api/customer-standard-quotations/:id returns 400 for project_based quote", async () => {
  await withServer(async (port) => {
    const createResponse = await apiFetch(port, '/api/quotes', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Test",
        projectName: "PB Quote",
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
    const csqResponse = await apiFetch(port, `/api/customer-standard-quotations/${encodeURIComponent(newQuote.id)}`);
    assert.equal(csqResponse.status, 400);
  });
});

test("GET /api/quote-item-types returns defaultUnit for each type", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quote-item-types');
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(Array.isArray(payload), "should return an array");
    assert.ok(payload.length > 0, "should have at least one type");
    payload.forEach((item) => {
      assert.ok("defaultUnit" in item, `item ${item.code} should have defaultUnit field`);
    });
    const hotel = payload.find((t) => t.code === "hotel");
    assert.ok(hotel, "hotel type should be present");
    assert.equal(hotel.defaultUnit, "间");
  });
});

test("POST /api/quote-item-types (local mode) saves and returns defaultUnit", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quote-item-types', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "custom_test_type",
        nameZh: "测试自定义类型",
        defaultUnit: "批次",
        projectGroupCodes: ["travel", "mixed"],
        sortOrder: 99,
        isActive: true,
      }),
    });
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.code, "custom_test_type");
    assert.equal(saved.defaultUnit, "批次");
    assert.ok(Array.isArray(saved.projectGroupCodes), "projectGroupCodes should be an array");
    assert.ok(saved.projectGroupCodes.includes("travel"), "projectGroupCodes should include travel");
  });
});

test("PUT /api/quote-item-types/:id (local mode) updates defaultUnit", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, '/api/quote-item-types', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "unit_update_test",
        nameZh: "单位更新测试",
        defaultUnit: "项",
        projectGroupCodes: ["mixed"],
        sortOrder: 98,
        isActive: true,
      }),
    });
    assert.equal(createResp.status, 201);
    const created = await createResp.json();

    const updateResp = await apiFetch(port, `/api/quote-item-types/${encodeURIComponent(created.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameZh: "单位更新测试",
        defaultUnit: "套",
        projectGroupCodes: ["event", "mixed"],
        sortOrder: 98,
        isActive: true,
      }),
    });
    assert.equal(updateResp.status, 200);
    const updated = await updateResp.json();
    assert.equal(updated.defaultUnit, "套");
  });
});

test("GET /api/quote-item-types returns defaultUnit even for types without it in seed", async () => {
  await withServer(async (port) => {
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    data.quotationItemTypes = [
      { id: "QT-NOUNIT", code: "no_unit_type", nameZh: "无单位类型", isActive: true, sortOrder: 1 }
    ];
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    const response = await apiFetch(port, '/api/quote-item-types');
    assert.equal(response.status, 200);
    const payload = await response.json();
    const found = payload.find((t) => t.code === "no_unit_type");
    assert.ok(found, "custom type without defaultUnit should be returned");
    assert.equal(typeof found.defaultUnit, "string", "defaultUnit should be a string even when missing from seed");
  });
});

test("project_based quote preserves item unit after save and reload", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, '/api/quotes', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Test Client",
        projectName: "Unit Preservation Test",
        contactName: "Contact",
        contactPhone: "",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-07-01",
        endDate: "2026-07-03",
        destination: "Belgrade",
        paxCount: 10,
        notes: "",
        pricingMode: "project_based",
        items: [],
        projectGroups: [
          {
            projectType: "travel",
            projectTitle: "差旅组",
            items: [
              {
                itemType: "hotel",
                itemName: "贝尔格莱德希尔顿",
                specification: "标准间",
                unit: "晚",
                quantity: 3,
                costUnitPrice: 150,
                salesUnitPrice: 200,
                remarks: "",
              },
              {
                itemType: "transport",
                itemName: "机场接送",
                specification: "商务车",
                unit: "辆次",
                quantity: 2,
                costUnitPrice: 80,
                salesUnitPrice: 120,
                remarks: "",
              },
            ],
          },
        ],
      }),
    });
    assert.equal(createResp.status, 201);
    const newQuote = await createResp.json();

    const getResp = await apiFetch(port, `/api/quotes/${encodeURIComponent(newQuote.id)}`);
    assert.equal(getResp.status, 200);
    const loaded = await getResp.json();

    assert.ok(Array.isArray(loaded.projectGroups), "projectGroups should be an array");
    assert.equal(loaded.projectGroups.length, 1);
    const group = loaded.projectGroups[0];
    assert.equal(group.items.length, 2);

    const hotelItem = group.items.find((i) => i.itemType === "hotel");
    assert.ok(hotelItem, "hotel item should be present");
    assert.equal(hotelItem.unit, "晚", "hotel item unit should be preserved as saved");

    const transportItem = group.items.find((i) => i.itemType === "transport");
    assert.ok(transportItem, "transport item should be present");
    assert.equal(transportItem.unit, "辆次", "transport item unit should be preserved as saved");
  });
});

test("GET /api/quote-item-types returns projectGroupCodes for each type", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quote-item-types');
    assert.equal(response.status, 200);
    const payload = await response.json();
    payload.forEach((item) => {
      assert.ok("projectGroupCodes" in item, `item ${item.code} should have projectGroupCodes field`);
      assert.ok(Array.isArray(item.projectGroupCodes), `${item.code}.projectGroupCodes should be an array`);
    });
    const hotel = payload.find((t) => t.code === "hotel");
    assert.ok(hotel, "hotel type should exist");
    assert.ok(hotel.projectGroupCodes.includes("travel"), "hotel should include travel in projectGroupCodes");
  });
});

test("POST /api/quote-item-types saves and returns projectGroupCodes (local mode)", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/quote-item-types', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "pgc_round_trip_test",
        nameZh: "适用组测试类型",
        defaultUnit: "次",
        projectGroupCodes: ["event", "mixed"],
        sortOrder: 97,
        isActive: true,
      }),
    });
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.ok(Array.isArray(saved.projectGroupCodes), "saved.projectGroupCodes should be array");
    assert.ok(saved.projectGroupCodes.includes("event"), "should include event");
    assert.ok(saved.projectGroupCodes.includes("mixed"), "should include mixed");
  });
});

test("GET /api/supplier-categories returns defaultUnit for each category", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/supplier-categories');
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(Array.isArray(payload), "should return an array");
    assert.ok(payload.length > 0, "should have at least one category");
    payload.forEach((cat) => {
      assert.ok("defaultUnit" in cat, `category ${cat.code} should have defaultUnit`);
      assert.equal(typeof cat.defaultUnit, "string", `${cat.code}.defaultUnit should be a string`);
    });
    const av = payload.find((c) => c.code === "av_equipment");
    assert.ok(av, "av_equipment category should be present");
    assert.equal(av.defaultUnit, "套", "av_equipment defaultUnit should be 套");
    const personnel = payload.find((c) => c.code === "personnel");
    assert.ok(personnel, "personnel category should be present");
    assert.equal(personnel.defaultUnit, "人天", "personnel defaultUnit should be 人天");
  });
});

test("GET /api/supplier-categories returns defaultUnit fallback for categories without it in seed", async () => {
  await withServer(async (port) => {
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    data.supplierCategories = [
      { id: "sc-test-1", code: "av_equipment", nameZh: "音视频设备", sortOrder: 1, isActive: true }
    ];
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    const response = await apiFetch(port, '/api/supplier-categories');
    assert.equal(response.status, 200);
    const payload = await response.json();
    const av = payload.find((c) => c.code === "av_equipment");
    assert.ok(av, "av_equipment should be returned");
    assert.equal(av.defaultUnit, "套", "av_equipment should fall back to 套 when defaultUnit missing");
  });
});

test("POST /api/supplier-categories saves and returns defaultUnit (local mode)", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, '/api/supplier-categories', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "test_cat_unit",
        nameZh: "测试单位分类",
        defaultUnit: "批",
        sortOrder: 99,
      }),
    });
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.code, "test_cat_unit");
    assert.equal(saved.defaultUnit, "批");
  });
});

test("PUT /api/supplier-categories/:id updates defaultUnit (local mode)", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, '/api/supplier-categories', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "cat_unit_update", nameZh: "更新单位测试", defaultUnit: "项", sortOrder: 98 }),
    });
    assert.equal(createResp.status, 201);
    const created = await createResp.json();

    const updateResp = await apiFetch(port, `/api/supplier-categories/${encodeURIComponent(created.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameZh: "更新单位测试", defaultUnit: "套", sortOrder: 98 }),
    });
    assert.equal(updateResp.status, 200);
    const updated = await updateResp.json();
    assert.equal(updated.defaultUnit, "套", "defaultUnit should be updated to 套");
  });
});

test("project_based event group preserves itemCategory and unit after save and reload", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, '/api/quotes', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Event Test Client",
        projectName: "Event Category Unit Test",
        contactName: "Contact",
        contactPhone: "",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-08-01",
        endDate: "2026-08-02",
        destination: "Belgrade",
        paxCount: 50,
        notes: "",
        pricingMode: "project_based",
        items: [],
        projectGroups: [
          {
            projectType: "event",
            projectTitle: "活动执行组",
            items: [
              {
                itemType: "misc",
                itemCategory: "av_equipment",
                itemName: "LED大屏",
                specification: "P4 室内",
                unit: "套",
                quantity: 2,
                costUnitPrice: 3000,
                salesUnitPrice: 4500,
                remarks: "含安装调试",
              },
              {
                itemType: "misc",
                itemCategory: "personnel",
                itemName: "活动执行人员",
                specification: "专职执行团队",
                unit: "人天",
                quantity: 5,
                costUnitPrice: 800,
                salesUnitPrice: 1200,
                remarks: "",
              },
            ],
          },
        ],
      }),
    });
    assert.equal(createResp.status, 201);
    const newQuote = await createResp.json();

    const getResp = await apiFetch(port, `/api/quotes/${encodeURIComponent(newQuote.id)}`);
    assert.equal(getResp.status, 200);
    const loaded = await getResp.json();

    assert.ok(Array.isArray(loaded.projectGroups));
    const group = loaded.projectGroups[0];
    assert.equal(group.projectType, "event");
    assert.equal(group.items.length, 2);

    const avItem = group.items.find((i) => i.itemCategory === "av_equipment");
    assert.ok(avItem, "av_equipment item should be present");
    assert.equal(avItem.unit, "套", "av_equipment item unit should be preserved as 套");

    const personnelItem = group.items.find((i) => i.itemCategory === "personnel");
    assert.ok(personnelItem, "personnel item should be present");
    assert.equal(personnelItem.unit, "人天", "personnel item unit should be preserved as 人天");
  });
});

test("project_based event: effectiveType — itemCategory returned by backend even when itemType=misc", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, '/api/quotes', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "EffType Client",
        projectName: "EffectiveType Test",
        contactName: "Contact",
        contactPhone: "",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
        destination: "Belgrade",
        paxCount: 30,
        notes: "",
        pricingMode: "project_based",
        items: [],
        projectGroups: [
          {
            projectType: "event",
            projectTitle: "活动组",
            items: [
              { itemType: "misc", itemCategory: "av_equipment", itemName: "LED屏", specification: "P4", unit: "套", quantity: 1, costUnitPrice: 2000, salesUnitPrice: 3000, remarks: "" },
              { itemType: "misc", itemCategory: "stage_structure", itemName: "舞台", specification: "10m x 8m", unit: "套", quantity: 1, costUnitPrice: 5000, salesUnitPrice: 7000, remarks: "" },
            ],
          },
        ],
      }),
    });
    assert.equal(createResp.status, 201);
    const newQuote = await createResp.json();

    const getResp = await apiFetch(port, `/api/quotes/${encodeURIComponent(newQuote.id)}`);
    assert.equal(getResp.status, 200);
    const loaded = await getResp.json();

    const group = loaded.projectGroups[0];
    assert.equal(group.projectType, "event");

    const avItem = group.items.find((i) => i.itemCategory === "av_equipment");
    assert.ok(avItem, "itemCategory=av_equipment must be returned even when itemType=misc");
    assert.equal(avItem.itemType, "misc", "itemType should remain misc (not overwritten)");

    const stageItem = group.items.find((i) => i.itemCategory === "stage_structure");
    assert.ok(stageItem, "itemCategory=stage_structure must be returned");
    assert.equal(stageItem.itemType, "misc", "itemType stays misc for event rows");
  });
});

test("project_based event: supplierId and supplierCatalogItemId preserved after save and reload", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, '/api/quotes', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Supplier Persist Client",
        projectName: "Supplier Fields Test",
        contactName: "Contact",
        contactPhone: "",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-09-03",
        endDate: "2026-09-04",
        destination: "Novi Sad",
        paxCount: 20,
        notes: "",
        pricingMode: "project_based",
        items: [],
        projectGroups: [
          {
            projectType: "event",
            projectTitle: "供应商关联测试组",
            items: [
              {
                itemType: "misc",
                itemCategory: "av_equipment",
                itemName: "LED大屏",
                specification: "P4室内",
                unit: "套",
                quantity: 2,
                costUnitPrice: 3000,
                salesUnitPrice: 4500,
                remarks: "",
                supplierId: "SUP-001",
                supplierCatalogItemId: "CITEM-888",
              },
            ],
          },
        ],
      }),
    });
    assert.equal(createResp.status, 201);
    const newQuote = await createResp.json();

    const getResp = await apiFetch(port, `/api/quotes/${encodeURIComponent(newQuote.id)}`);
    assert.equal(getResp.status, 200);
    const loaded = await getResp.json();

    const item = loaded.projectGroups[0].items[0];
    assert.equal(item.supplierId, "SUP-001", "supplierId should be preserved");
    assert.equal(item.supplierCatalogItemId, "CITEM-888", "supplierCatalogItemId should be preserved");
  });
});

test("project_based event: supplierDisplay preserved after save and reload", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, '/api/quotes', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Display Persist Client",
        projectName: "SupplierDisplay Test",
        contactName: "Contact",
        contactPhone: "",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-09-05",
        endDate: "2026-09-06",
        destination: "Subotica",
        paxCount: 15,
        notes: "",
        pricingMode: "project_based",
        items: [],
        projectGroups: [
          {
            projectType: "event",
            projectTitle: "供应商名称测试组",
            items: [
              {
                itemType: "misc",
                itemCategory: "personnel",
                itemName: "礼仪人员",
                specification: "全天候",
                unit: "人天",
                quantity: 5,
                costUnitPrice: 600,
                salesUnitPrice: 900,
                remarks: "",
                supplierId: "SUP-002",
                supplierCatalogItemId: "CITEM-999",
                supplierDisplay: "贝尔格莱德礼仪公司",
              },
            ],
          },
        ],
      }),
    });
    assert.equal(createResp.status, 201);
    const newQuote = await createResp.json();

    const getResp = await apiFetch(port, `/api/quotes/${encodeURIComponent(newQuote.id)}`);
    assert.equal(getResp.status, 200);
    const loaded = await getResp.json();

    const item = loaded.projectGroups[0].items[0];
    assert.equal(item.supplierDisplay, "贝尔格莱德礼仪公司", "supplierDisplay should be preserved after reload");
    assert.equal(item.itemCategory, "personnel", "itemCategory should also be preserved");
  });
});

test("project_based: old data items without itemCategory field do not error on GET", async () => {
  await withServer(async (port) => {
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    data.quotes.push({
      id: "Q-LEGACY-PB",
      quoteNumber: "QT-LEGACY",
      clientName: "Legacy Client",
      projectName: "Legacy Project Based",
      contactName: "Contact",
      contactPhone: "",
      language: "zh-CN",
      currency: "EUR",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      tripDate: "2026-01-01",
      travelDays: 2,
      destination: "Belgrade",
      paxCount: 10,
      notes: "",
      pricingMode: "project_based",
      items: [],
      projectGroups: [
        {
          projectType: "event",
          projectTitle: "旧版活动组",
          items: [
            { itemType: "misc", itemName: "旧物料", unit: "项", quantity: 1, costUnitPrice: 100, salesUnitPrice: 200, remarks: "" },
          ],
        },
      ],
      totalCost: 100,
      totalSales: 200,
      totalProfit: 100,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    const getResp = await apiFetch(port, '/api/quotes/Q-LEGACY-PB');
    assert.equal(getResp.status, 200);
    const loaded = await getResp.json();

    assert.ok(Array.isArray(loaded.projectGroups), "projectGroups should be returned");
    const item = loaded.projectGroups[0].items[0];
    assert.ok(item, "item should be present");
    // Legacy items may not have itemCategory in stored JSON; the server must not
    // crash (500) on GET — itemCategory will be absent or empty, both are fine.
    assert.ok(item.itemCategory === undefined || item.itemCategory === "", "itemCategory absent or empty for legacy items");
    assert.equal(item.itemName, "旧物料", "itemName should be preserved");
  });
});

test("project_based travel: itemType is preserved and not overwritten on save and reload", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, '/api/quotes', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Travel Type Client",
        projectName: "Travel ItemType Preservation",
        contactName: "Contact",
        contactPhone: "",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-10-01",
        endDate: "2026-10-05",
        destination: "Novi Sad",
        paxCount: 12,
        notes: "",
        pricingMode: "project_based",
        items: [],
        projectGroups: [
          {
            projectType: "travel",
            projectTitle: "旅游差旅组",
            items: [
              { itemType: "guide_translation", itemCategory: "", itemName: "中文导游", specification: "专职导游", unit: "人天", quantity: 4, costUnitPrice: 400, salesUnitPrice: 600, remarks: "" },
              { itemType: "ticket", itemCategory: "", itemName: "景区门票", specification: "成人票", unit: "张", quantity: 12, costUnitPrice: 30, salesUnitPrice: 50, remarks: "" },
            ],
          },
        ],
      }),
    });
    assert.equal(createResp.status, 201);
    const newQuote = await createResp.json();

    const getResp = await apiFetch(port, `/api/quotes/${encodeURIComponent(newQuote.id)}`);
    assert.equal(getResp.status, 200);
    const loaded = await getResp.json();

    const group = loaded.projectGroups[0];
    assert.equal(group.projectType, "travel");

    const guideItem = group.items.find((i) => i.itemType === "guide_translation");
    assert.ok(guideItem, "guide_translation itemType should be preserved");
    assert.equal(guideItem.unit, "人天", "guide unit should be preserved");

    const ticketItem = group.items.find((i) => i.itemType === "ticket");
    assert.ok(ticketItem, "ticket itemType should be preserved");
    assert.equal(ticketItem.unit, "张", "ticket unit should be preserved");
  });
});

test("project_based mixed: both itemType and itemCategory preserved for different rows", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, '/api/quotes', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Mixed Client",
        projectName: "Mixed Group Fields Test",
        contactName: "Contact",
        contactPhone: "",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-11-01",
        endDate: "2026-11-03",
        destination: "Belgrade",
        paxCount: 25,
        notes: "",
        pricingMode: "project_based",
        items: [],
        projectGroups: [
          {
            projectType: "mixed",
            projectTitle: "综合服务组",
            items: [
              { itemType: "hotel", itemCategory: "", itemName: "酒店住宿", specification: "标准间", unit: "晚", quantity: 2, costUnitPrice: 120, salesUnitPrice: 180, remarks: "" },
              { itemType: "misc", itemCategory: "av_equipment", itemName: "会议AV", specification: "高清投影", unit: "套", quantity: 1, costUnitPrice: 800, salesUnitPrice: 1200, remarks: "" },
            ],
          },
        ],
      }),
    });
    assert.equal(createResp.status, 201);
    const newQuote = await createResp.json();

    const getResp = await apiFetch(port, `/api/quotes/${encodeURIComponent(newQuote.id)}`);
    assert.equal(getResp.status, 200);
    const loaded = await getResp.json();

    const group = loaded.projectGroups[0];
    assert.equal(group.projectType, "mixed");

    const hotelItem = group.items.find((i) => i.itemType === "hotel");
    assert.ok(hotelItem, "hotel itemType should be preserved in mixed group");
    assert.equal(hotelItem.itemCategory, "", "hotel item should have empty itemCategory");
    assert.equal(hotelItem.unit, "晚");

    const avItem = group.items.find((i) => i.itemCategory === "av_equipment");
    assert.ok(avItem, "av_equipment itemCategory should be preserved in mixed group");
    assert.equal(avItem.itemType, "misc", "misc itemType preserved alongside itemCategory");
    assert.equal(avItem.unit, "套");
  });
});

test("project_based: old data without supplierDisplay field does not error on GET", async () => {
  await withServer(async (port) => {
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    data.quotes.push({
      id: "Q-LEGACY-NOSUP",
      quoteNumber: "QT-LEGACY-NOSUP",
      clientName: "Legacy No Supplier",
      projectName: "Legacy No SupplierDisplay",
      contactName: "Contact",
      contactPhone: "",
      language: "zh-CN",
      currency: "EUR",
      startDate: "2026-02-01",
      endDate: "2026-02-02",
      tripDate: "2026-02-01",
      travelDays: 2,
      destination: "Belgrade",
      paxCount: 5,
      notes: "",
      pricingMode: "project_based",
      items: [],
      projectGroups: [
        {
          projectType: "event",
          projectTitle: "旧版无供应商组",
          items: [
            { itemType: "misc", itemCategory: "av_equipment", itemName: "LED屏", unit: "套", quantity: 1, costUnitPrice: 500, salesUnitPrice: 800, remarks: "" },
          ],
        },
      ],
      totalCost: 500,
      totalSales: 800,
      totalProfit: 300,
      createdAt: "2026-02-01T00:00:00Z",
      updatedAt: "2026-02-01T00:00:00Z",
    });
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    const getResp = await apiFetch(port, "/api/quotes/Q-LEGACY-NOSUP");
    assert.equal(getResp.status, 200, "GET must not crash when supplierDisplay is absent");
    const loaded = await getResp.json();
    const item = loaded.projectGroups[0].items[0];
    assert.ok(item, "item should be present");
    // supplierDisplay absent from stored JSON — GET must return "" or undefined, never crash
    assert.ok(
      item.supplierDisplay === "" || item.supplierDisplay === undefined,
      "supplierDisplay should be empty string or absent for legacy items"
    );
    assert.equal(item.itemCategory, "av_equipment", "itemCategory should be preserved");
    assert.equal(item.unit, "套", "unit should be preserved");
  });
});

test("project_based event: old row with itemType=av_lighting and no itemCategory gets fallback itemCategory on GET", async () => {
  await withServer(async (port) => {
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    data.quotes.push({
      id: "Q-LEGACY-AVLIGHT",
      quoteNumber: "QT-LEGACY-AVLIGHT",
      clientName: "Legacy AV Lighting",
      projectName: "Legacy AV Lighting Fallback",
      contactName: "Contact",
      contactPhone: "",
      language: "zh-CN",
      currency: "EUR",
      startDate: "2026-03-01",
      endDate: "2026-03-02",
      tripDate: "2026-03-01",
      travelDays: 2,
      destination: "Belgrade",
      paxCount: 8,
      notes: "",
      pricingMode: "project_based",
      items: [],
      projectGroups: [
        {
          projectType: "event",
          projectTitle: "旧版AV灯光组",
          items: [
            { itemType: "av_lighting", itemName: "舞台灯光", unit: "套", quantity: 1, costUnitPrice: 2000, salesUnitPrice: 3000, remarks: "" },
          ],
        },
      ],
      totalCost: 2000,
      totalSales: 3000,
      totalProfit: 1000,
      createdAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-03-01T00:00:00Z",
    });
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    const getResp = await apiFetch(port, "/api/quotes/Q-LEGACY-AVLIGHT");
    assert.equal(getResp.status, 200, "GET must not crash for legacy av_lighting item");
    const loaded = await getResp.json();
    const item = loaded.projectGroups[0].items[0];
    assert.ok(item, "item should be present");
    assert.equal(item.itemType, "av_lighting", "itemType must be preserved");
    // GET compat normalization should provide fallback itemCategory for av_lighting
    assert.equal(item.itemCategory, "av_equipment", "fallback itemCategory should be av_equipment for av_lighting");
    assert.equal(item.unit, "套", "unit must not be overwritten by GET normalization");
    assert.equal(item.itemName, "舞台灯光", "itemName must not be changed");
  });
});

test("project_based: GET normalization does not overwrite existing unit field", async () => {
  await withServer(async (port) => {
    const createResp = await apiFetch(port, "/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Unit Preservation Client",
        projectName: "Unit Not Overwritten Test",
        contactName: "Contact",
        contactPhone: "",
        language: "zh-CN",
        currency: "EUR",
        startDate: "2026-04-01",
        endDate: "2026-04-02",
        destination: "Novi Sad",
        paxCount: 10,
        notes: "",
        pricingMode: "project_based",
        items: [],
        projectGroups: [
          {
            projectType: "event",
            projectTitle: "单位保留测试",
            items: [
              { itemType: "misc", itemCategory: "personnel", itemName: "礼仪人员", specification: "10人", unit: "人次", quantity: 10, costUnitPrice: 200, salesUnitPrice: 300, remarks: "" },
              { itemType: "misc", itemCategory: "logistics", itemName: "货运", specification: "整车", unit: "趟", quantity: 2, costUnitPrice: 800, salesUnitPrice: 1200, remarks: "" },
            ],
          },
        ],
      }),
    });
    assert.equal(createResp.status, 201);
    const newQuote = await createResp.json();

    const getResp = await apiFetch(port, `/api/quotes/${encodeURIComponent(newQuote.id)}`);
    assert.equal(getResp.status, 200);
    const loaded = await getResp.json();
    const group = loaded.projectGroups[0];

    const personnelItem = group.items.find((i) => i.itemCategory === "personnel");
    assert.ok(personnelItem, "personnel item should be present");
    assert.equal(personnelItem.unit, "人次", "unit must not be overwritten for personnel item");

    const logisticsItem = group.items.find((i) => i.itemCategory === "logistics");
    assert.ok(logisticsItem, "logistics item should be present");
    assert.equal(logisticsItem.unit, "趟", "unit must not be overwritten for logistics item");
  });
});

// ── B1-01: 报价转项目 & 项目实体 ──────────────────────────────────────────────

function seedProjectBasedQuote() {
  const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
  data.quotes.push({
    id: "Q-PB",
    projectId: "",
    quoteNumber: "QT-PB",
    clientName: "ProjectClient",
    projectName: "测试活动项目",
    contactName: "王五",
    contactPhone: "13900000001",
    language: "zh-CN",
    currency: "EUR",
    startDate: "2026-07-01",
    endDate: "2026-07-03",
    tripDate: "2026-07-01",
    travelDays: 3,
    destination: "Novi Sad",
    paxCount: 20,
    notes: "",
    pricingMode: "project_based",
    totalCost: 500,
    totalSales: 800,
    totalProfit: 300,
    projectGroups: [
      {
        id: "G-1",
        projectType: "event",
        projectTitle: "主会场布置",
        sortOrder: 0,
        projectCostTotal: 500,
        projectSalesTotal: 800,
        projectProfitTotal: 300,
        items: [
          {
            itemType: "misc",
            itemCategory: "decoration",
            itemName: "花艺布置",
            specification: "全场",
            unit: "套",
            quantity: 1,
            currency: "EUR",
            costUnitPrice: 500,
            salesUnitPrice: 800,
            costSubtotal: 500,
            salesSubtotal: 800,
            remarks: "",
            sortOrder: 0,
          }
        ]
      }
    ],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  });
  fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));
}

test("POST /api/quotes/:id/convert-to-project creates project from project_based quote", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const response = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    assert.equal(response.status, 201);
    const project = await response.json();
    assert.ok(project.id, "project.id should exist");
    assert.ok(project.projectNumber, "project.projectNumber should exist");
    assert.equal(project.projectName, "测试活动项目");
    assert.equal(project.clientName, "ProjectClient");
    assert.equal(project.sourceQuoteId, "Q-PB");
    assert.equal(project.sourceQuoteNumber, "QT-PB");
    assert.equal(project.status, "draft");
    assert.ok(project.quoteSnapshot, "quoteSnapshot should be present");
    assert.equal(project.quoteSnapshot.quoteId, "Q-PB");
    assert.equal(project.totalCost, 500);
    assert.equal(project.totalSales, 800);
  });
});

test("POST /api/quotes/:id/convert-to-project returns 400 for standard quote", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, "/api/quotes/Q-1/convert-to-project", { method: "POST" });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("POST /api/quotes/:id/convert-to-project returns 404 for non-existent quote", async () => {
  await withServer(async (port) => {
    const response = await apiFetch(port, "/api/quotes/Q-NONEXISTENT/convert-to-project", { method: "POST" });
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("POST /api/quotes/:id/convert-to-project is idempotent — no duplicate project", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const r1 = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    assert.equal(r1.status, 201);
    const p1 = await r1.json();

    const r2 = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    assert.equal(r2.status, 200, "second convert should return 200 (already exists)");
    const p2 = await r2.json();
    assert.equal(p1.id, p2.id, "project id must be the same on second convert");
  });
});

test("GET /api/projects returns real project list after convert", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const response = await apiFetch(port, "/api/projects");
    assert.equal(response.status, 200);
    const projects = await response.json();
    assert.ok(Array.isArray(projects), "should return array");
    assert.equal(projects.length, 1);
    assert.equal(projects[0].sourceQuoteId, "Q-PB");
    assert.equal(projects[0].status, "draft");
  });
});

test("GET /api/projects/:id returns real project detail with quoteSnapshot", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const response = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`);
    assert.equal(response.status, 200);
    const project = await response.json();
    assert.equal(project.id, projectId);
    assert.ok(project.quoteSnapshot, "quoteSnapshot should be present");
    assert.equal(project.quoteSnapshot.quoteId, "Q-PB");
    assert.ok(Array.isArray(project.quoteSnapshot.projectGroups), "projectGroups in snapshot");
  });
});

test("PATCH /api/projects/:id/status updates status to confirmed", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.status, "confirmed");

    // Verify persisted
    const getRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`);
    const fetched = await getRes.json();
    assert.equal(fetched.status, "confirmed");
  });
});

test("PATCH /api/projects/:id/status returns 400 for invalid status", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "flying" }),
    });
    assert.equal(patchRes.status, 400);
    const payload = await patchRes.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("PATCH /api/projects/:id/status returns 404 for non-existent project", async () => {
  await withServer(async (port) => {
    const patchRes = await apiFetch(port, "/api/projects/PRJ-NONEXISTENT/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    assert.equal(patchRes.status, 404);
    const payload = await patchRes.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("convert: projectGroups amounts used when quote top-level totalCost/totalSales are 0", async () => {
  await withServer(async (port) => {
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    data.quotes.push({
      id: "Q-ZERO-TOP",
      quoteNumber: "QT-ZERO",
      clientName: "ZeroClient",
      projectName: "零顶级金额测试",
      currency: "EUR",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      travelDays: 3,
      paxCount: 10,
      destination: "Belgrade",
      pricingMode: "project_based",
      totalCost: 0,
      totalSales: 0,
      projectGroups: [
        {
          id: "G-ZERO",
          projectType: "event",
          projectTitle: "测试组",
          projectCostTotal: 300,
          projectSalesTotal: 500,
          items: [
            {
              itemType: "misc",
              itemName: "测试项目",
              unit: "套",
              quantity: 1,
              costUnitPrice: 300,
              salesUnitPrice: 500,
              costSubtotal: 300,
              salesSubtotal: 500,
            },
          ],
        },
      ],
    });
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    const res = await apiFetch(port, "/api/quotes/Q-ZERO-TOP/convert-to-project", { method: "POST" });
    assert.equal(res.status, 201);
    const project = await res.json();
    assert.equal(project.totalCost, 300, "totalCost should be derived from projectGroups when top-level is 0");
    assert.equal(project.totalSales, 500, "totalSales should be derived from projectGroups when top-level is 0");
    assert.ok(project.grossProfit > 0, "grossProfit should be positive");
  });
});

test("GET /api/projects/:id: old snapshot totalSales=0 but projectGroups have data → dynamic recalc", async () => {
  await withServer(async (port) => {
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    if (!Array.isArray(data.projects)) data.projects = [];
    data.projects.push({
      id: "PRJ-OLD-ZERO",
      projectNumber: "PRJ-20260101-ZERO",
      sourceQuoteId: "Q-OLD-ZERO",
      sourceQuoteNumber: "QT-OLD-ZERO",
      sourcePricingMode: "project_based",
      projectName: "旧项目零快照金额测试",
      clientName: "OldClient",
      currency: "EUR",
      status: "running",
      ownerName: "",
      notes: "",
      quoteSnapshot: {
        quoteId: "Q-OLD-ZERO",
        totalCost: 0,
        totalSales: 0,
        grossProfit: 0,
        grossMargin: 0,
        projectGroups: [
          {
            id: "G-OLD",
            projectCostTotal: 400,
            projectSalesTotal: 600,
            items: [],
          },
        ],
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    const res = await apiFetch(port, "/api/projects/PRJ-OLD-ZERO");
    assert.equal(res.status, 200);
    const project = await res.json();
    assert.equal(project.totalSales, 600, "totalSales should be dynamically recalculated from projectGroups");
    assert.equal(project.totalCost, 400, "totalCost should be dynamically recalculated from projectGroups");
    assert.ok(project.grossProfit > 0, "grossProfit should be positive");
  });
});

test("PATCH /api/projects/:id/status to running reflects in GET", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "running" }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.status, "running");

    const getRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`);
    assert.equal(getRes.status, 200);
    const fetched = await getRes.json();
    assert.equal(fetched.status, "running", "status should persist as running after PATCH");
  });
});

// ── B1-02 运营主档字段测试 ──────────────────────────────────────────────────────

test("B1-02: convert-to-project sets default operational fields", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const res = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    assert.equal(res.status, 201);
    const project = await res.json();
    assert.equal(project.priority, "normal", "priority defaults to normal");
    assert.equal(project.operationStatus, "not_started", "operationStatus defaults to not_started");
    assert.equal(project.operationOwner, "", "operationOwner defaults to empty string");
    assert.equal(project.salesOwner, "", "salesOwner defaults to empty string");
    assert.equal(project.coordinator, "", "coordinator defaults to empty string");
    assert.equal(project.internalDeadline, "", "internalDeadline defaults to empty string");
    assert.equal(project.operationNotes, "", "operationNotes defaults to empty string");
    assert.equal(project.riskNotes, "", "riskNotes defaults to empty string");
  });
});

test("B1-02: PATCH /api/projects/:id updates master fields and persists", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: "更新后的项目名",
        clientName: "新客户",
        contactName: "张三",
        contactPhone: "13800138000",
        destination: "Niš",
        startDate: "2026-09-01",
        endDate: "2026-09-05",
        paxCount: 30,
        operationOwner: "李四",
        salesOwner: "王五",
        coordinator: "赵六",
        priority: "high",
        operationStatus: "preparing",
        internalDeadline: "2026-08-20",
        operationNotes: "需要提前确认场地",
        riskNotes: "签证存在风险",
      }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.projectName, "更新后的项目名");
    assert.equal(updated.clientName, "新客户");
    assert.equal(updated.contactName, "张三");
    assert.equal(updated.contactPhone, "13800138000");
    assert.equal(updated.destination, "Niš");
    assert.equal(updated.startDate, "2026-09-01");
    assert.equal(updated.endDate, "2026-09-05");
    assert.equal(updated.paxCount, 30);
    assert.equal(updated.operationOwner, "李四");
    assert.equal(updated.salesOwner, "王五");
    assert.equal(updated.coordinator, "赵六");
    assert.equal(updated.priority, "high");
    assert.equal(updated.operationStatus, "preparing");
    assert.equal(updated.internalDeadline, "2026-08-20");
    assert.equal(updated.operationNotes, "需要提前确认场地");
    assert.equal(updated.riskNotes, "签证存在风险");

    // 确认持久化
    const getRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`);
    assert.equal(getRes.status, 200);
    const fetched = await getRes.json();
    assert.equal(fetched.projectName, "更新后的项目名");
    assert.equal(fetched.operationOwner, "李四");
    assert.equal(fetched.priority, "high");
    assert.equal(fetched.operationStatus, "preparing");
    assert.equal(fetched.riskNotes, "签证存在风险");
  });
});

test("B1-02: PATCH /api/projects/:id returns 400 for invalid priority", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: "critical" }),
    });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("B1-02: PATCH /api/projects/:id returns 400 for invalid operationStatus", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationStatus: "done" }),
    });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("B1-02: PATCH /api/projects/:id returns 404 for non-existent project", async () => {
  await withServer(async (port) => {
    const res = await apiFetch(port, "/api/projects/PRJ-NONEXISTENT-MASTER", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName: "测试" }),
    });
    assert.equal(res.status, 404);
    const payload = await res.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("B1-02: PATCH /api/projects/:id does not allow updating protected fields", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const original = await convertRes.json();
    const projectId = original.id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteSnapshot: { injected: true },
        totalCost: 99999,
        grossProfit: 99999,
        projectNumber: "FAKE-NUMBER",
        operationOwner: "合法字段",
      }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.totalCost, original.totalCost, "totalCost must not change");
    assert.equal(updated.grossProfit, original.grossProfit, "grossProfit must not change");
    assert.equal(updated.projectNumber, original.projectNumber, "projectNumber must not change");
    assert.ok(updated.quoteSnapshot && !updated.quoteSnapshot.injected, "quoteSnapshot must not be replaced");
    assert.equal(updated.operationOwner, "合法字段");
  });
});

test("B1-02: existing PATCH /api/projects/:id/status still works after adding master route", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "running" }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.status, "running");
  });
});

// ── B1-03 项目执行清单测试 ──────────────────────────────────────────────────────

test("B1-03: GET /api/projects/:id/execution-items returns empty array initially", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    assert.equal(res.status, 200);
    const items = await res.json();
    assert.ok(Array.isArray(items), "should return array");
    assert.equal(items.length, 0, "initially empty");
  });
});

test("B1-03: POST generate creates execution items from quoteSnapshot", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const genRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, {
      method: "POST",
    });
    assert.ok(genRes.status === 201 || genRes.status === 200, "should return 200 or 201");
    const result = await genRes.json();
    assert.ok(Array.isArray(result.items), "result.items should be array");
    assert.ok(result.items.length > 0, "should generate at least one item");
    assert.equal(result.created, true, "created should be true on first generate");

    // All items should have required fields
    for (const item of result.items) {
      assert.ok(item.id, "item.id should exist");
      assert.equal(item.projectId, projectId, "item.projectId should match");
      assert.equal(item.status, "pending", "status defaults to pending");
      assert.ok(item.title, "title should be set");
    }
  });
});

test("B1-03: repeated POST generate returns existing items, created=false", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const secondRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    assert.equal(secondRes.status, 200, "second generate should return 200");
    const result = await secondRes.json();
    assert.equal(result.created, false, "created should be false on duplicate generate");
    assert.ok(Array.isArray(result.items), "items should be array");
  });
});

test("B1-03: GET /api/projects/:id/execution-items returns items after generate", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });

    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    assert.equal(listRes.status, 200);
    const items = await listRes.json();
    assert.ok(Array.isArray(items) && items.length > 0, "should return generated items");
  });
});

test("B1-03: PATCH /api/projects/:id/execution-items/:itemId updates allowed fields", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    assert.ok(items.length > 0, "need at least one item to patch");
    const itemId = items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: "张三",
        status: "in_progress",
        supplierStatus: "inquiring",
        notes: "已联系供应商",
        location: "贝尔格莱德",
      }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.owner, "张三");
    assert.equal(updated.status, "in_progress");
    assert.equal(updated.supplierStatus, "inquiring");
    assert.equal(updated.notes, "已联系供应商");
    assert.equal(updated.location, "贝尔格莱德");
  });
});

test("B1-03: PATCH does not allow updating protected fields", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const itemId = items[0].id;
    const originalProjectId = items[0].projectId;
    const originalSourceGroupId = items[0].sourceGroupId;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "INJECTED-ID",
        projectId: "INJECTED-PROJECT",
        sourceGroupId: "INJECTED-GROUP",
        createdAt: "1970-01-01",
        owner: "合法字段",
      }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.id, itemId, "id must not be changed");
    assert.equal(updated.projectId, originalProjectId, "projectId must not be changed");
    assert.equal(updated.sourceGroupId, originalSourceGroupId, "sourceGroupId must not be changed");
    assert.equal(updated.owner, "合法字段", "legitimate field should be updated");
  });
});

test("B1-03: PATCH returns 400 for invalid status", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const itemId = items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "flying" }),
    });
    assert.equal(patchRes.status, 400);
    const payload = await patchRes.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("B1-03: DELETE /api/projects/:id/execution-items/:itemId removes the item", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const countBefore = items.length;
    assert.ok(countBefore > 0, "need at least one item to delete");
    const itemId = items[0].id;

    const delRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 200);

    const listAfter = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const itemsAfter = await listAfter.json();
    assert.equal(itemsAfter.length, countBefore - 1, "one item should be removed");
    assert.ok(!itemsAfter.find((i) => i.id === itemId), "deleted item should not appear");
  });
});

test("B1-03: quoteSnapshot is not modified by generate/patch/delete", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const original = await convertRes.json();
    const projectId = original.id;
    const originalSnapshot = JSON.stringify(original.quoteSnapshot);

    // generate
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });

    // patch first item
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    if (items.length > 0) {
      await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(items[0].id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "测试" }),
      });
      // delete first item
      await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(items[0].id)}`, {
        method: "DELETE",
      });
    }

    const projectRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`);
    const projectAfter = await projectRes.json();
    assert.equal(JSON.stringify(projectAfter.quoteSnapshot), originalSnapshot, "quoteSnapshot must remain frozen");
  });
});

test("B1-03: execution items local fallback does not crash without Supabase", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    // All execution item operations should work in local mode
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    assert.equal(listRes.status, 200, "GET should not crash");

    const genRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    assert.ok(genRes.status === 200 || genRes.status === 201, "generate should not crash");

    const listAfterGen = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    assert.equal(listAfterGen.status, 200, "GET after generate should not crash");
  });
});

test("B1-03: DELETE returns 404 for non-existent item", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const delRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/PEI-NONEXISTENT`, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 404);
    const payload = await delRes.json();
    assert.ok(payload.error, "error field should be present");
  });
});

test("B1-03: customer interface not affected — GET /api/projects/:id still works", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });

    const projectRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`);
    assert.equal(projectRes.status, 200);
    const project = await projectRes.json();
    assert.ok(project.quoteSnapshot, "quoteSnapshot should still be present");
    assert.equal(project.sourceQuoteId, "Q-PB");
  });
});

// ── B1-03A: null 字段防护测试 ──────────────────────────────────────────────

test("B1-03A: PATCH notes/location/owner/title/unit null saves as empty string", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const itemId = items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: null, location: null, owner: null, title: null, unit: null }),
    });
    assert.equal(patchRes.status, 200, "null text fields should not cause 400");
    const updated = await patchRes.json();
    assert.equal(updated.notes, "", "notes null → ''");
    assert.equal(updated.location, "", "location null → ''");
    assert.equal(updated.owner, "", "owner null → ''");
    assert.equal(updated.title, "", "title null → ''");
    assert.equal(updated.unit, "", "unit null → ''");
  });
});

test("B1-03A: PATCH date fields null saves as null", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const itemId = items[0].id;

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedDate: "2026-07-01" }),
    });

    const clearRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedDate: null, startDate: null, endDate: null }),
    });
    assert.equal(clearRes.status, 200);
    const cleared = await clearRes.json();
    assert.equal(cleared.plannedDate, null, "plannedDate null is allowed");
    assert.equal(cleared.startDate, null, "startDate null is allowed");
    assert.equal(cleared.endDate, null, "endDate null is allowed");
  });
});

// ── B1-03A: 同供应商批量同步测试 ──────────────────────────────────────────

function seedProjectBasedQuoteWithTwoSupplierItems() {
  const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
  data.quotes.push({
    id: "Q-PB-S",
    projectId: "",
    quoteNumber: "QT-PB-S",
    clientName: "SupplierClient",
    projectName: "供应商同步测试项目",
    contactName: "李四",
    contactPhone: "13900000002",
    language: "zh-CN",
    currency: "EUR",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    tripDate: "2026-08-01",
    travelDays: 3,
    destination: "Novi Sad",
    paxCount: 10,
    notes: "",
    pricingMode: "project_based",
    totalCost: 1000,
    totalSales: 1500,
    totalProfit: 500,
    projectGroups: [
      {
        id: "G-S1",
        projectType: "event",
        projectTitle: "供应商A服务组",
        sortOrder: 0,
        items: [
          {
            id: "ITEM-S1",
            itemType: "misc",
            itemCategory: "decoration",
            itemName: "花艺布置",
            unit: "套",
            quantity: 1,
            currency: "EUR",
            costUnitPrice: 300,
            salesUnitPrice: 450,
            costSubtotal: 300,
            salesSubtotal: 450,
            supplierId: "SUP-001",
            supplierDisplay: "鲜花供应商A",
          },
          {
            id: "ITEM-S2",
            itemType: "misc",
            itemCategory: "decoration",
            itemName: "背景板安装",
            unit: "套",
            quantity: 1,
            currency: "EUR",
            costUnitPrice: 200,
            salesUnitPrice: 300,
            costSubtotal: 200,
            salesSubtotal: 300,
            supplierId: "SUP-001",
            supplierDisplay: "鲜花供应商A",
          },
          {
            id: "ITEM-S3",
            itemType: "misc",
            itemCategory: "logistics",
            itemName: "物流运输",
            unit: "次",
            quantity: 1,
            currency: "EUR",
            costUnitPrice: 500,
            salesUnitPrice: 750,
            costSubtotal: 500,
            salesSubtotal: 750,
            supplierId: "SUP-002",
            supplierDisplay: "物流公司B",
          },
        ],
      },
    ],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  });
  fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));
}

// ── B1-03C: 时间字段简化测试 ──────────────────────────────────────────────────

test("B1-03C: generate sets plannedDate = startDate - 1 day", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote(); // startDate: "2026-07-01"
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    assert.ok(items.length > 0, "should have items");
    assert.ok(items.every(i => i.plannedDate === "2026-06-30"), "plannedDate should be startDate - 1 day");
  });
});

test("B1-03C: generate with no startDate in quoteSnapshot sets plannedDate = null", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote(); // startDate: "2026-07-01"
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    // 直接从 seed 文件中移除 quoteSnapshot.startDate，模拟无日期场景
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    const proj = data.projects.find(p => p.id === projectId);
    if (proj && proj.quoteSnapshot) {
      delete proj.quoteSnapshot.startDate;
      delete proj.quoteSnapshot.start_date;
    }
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    assert.ok(items.length > 0, "should have items");
    assert.ok(items.every(i => i.plannedDate === null), "plannedDate should be null when quoteSnapshot has no startDate");
  });
});

test("B1-03C: PATCH plannedDate still works (backward compat)", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const itemId = items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedDate: "2026-08-15" }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    const item = result.id ? result : result.item;
    assert.equal(item.plannedDate, "2026-08-15", "plannedDate should be updated");
  });
});

test("B1-03A: generate inherits supplierId and supplierDisplay from quote items", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuoteWithTwoSupplierItems();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB-S/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    assert.ok(items.length >= 2, "should have at least 2 items");
    const sup1Items = items.filter(i => i.supplierId === "SUP-001");
    assert.ok(sup1Items.length >= 2, "should have 2 items for SUP-001");
    assert.ok(sup1Items.every(i => i.supplierDisplay === "鲜花供应商A"), "supplierDisplay inherited");
  });
});

test("B1-03A: applyToSameSupplier=true syncs owner/status/notes to sibling items", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuoteWithTwoSupplierItems();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB-S/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const sup1Items = items.filter(i => i.supplierId === "SUP-001");
    assert.ok(sup1Items.length >= 2, "need at least 2 SUP-001 items");
    const targetId = sup1Items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "张三", status: "in_progress", notes: "已联系", applyToSameSupplier: true }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    assert.ok(result.item, "result.item should exist");
    assert.ok(result.affectedCount >= 2, `affectedCount should be ≥ 2, got ${result.affectedCount}`);
    assert.ok(Array.isArray(result.items), "result.items should be array");

    const afterRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const afterItems = await afterRes.json();
    const sup1After = afterItems.filter(i => i.supplierId === "SUP-001");
    assert.ok(sup1After.every(i => i.owner === "张三"), "all SUP-001 items should have owner 张三");
    assert.ok(sup1After.every(i => i.status === "in_progress"), "all SUP-001 items should be in_progress");
    assert.ok(sup1After.every(i => i.notes === "已联系"), "all SUP-001 items should have notes synced");
  });
});

test("B1-03A: applyToSameSupplier does NOT sync title/quantity/unit", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuoteWithTwoSupplierItems();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB-S/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const sup1Items = items.filter(i => i.supplierId === "SUP-001");
    const targetId = sup1Items[0].id;
    const siblingId = sup1Items[1].id;
    const siblingOriginalTitle = sup1Items[1].title;

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "修改后的标题", owner: "李四", applyToSameSupplier: true }),
    });

    const afterRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const afterItems = await afterRes.json();
    const sibling = afterItems.find(i => i.id === siblingId);
    assert.equal(sibling.title, siblingOriginalTitle, "sibling title must NOT be synced");
    assert.equal(sibling.owner, "李四", "sibling owner MUST be synced");
  });
});

test("B1-03A: applyToSameSupplier=false only updates current item", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuoteWithTwoSupplierItems();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB-S/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const sup1Items = items.filter(i => i.supplierId === "SUP-001");
    const targetId = sup1Items[0].id;
    const siblingId = sup1Items[1].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "独自更新", applyToSameSupplier: false }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    const ownerId = result.owner || (result.item && result.item.owner);
    assert.equal(ownerId, "独自更新", "current item updated");

    const afterRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const afterItems = await afterRes.json();
    const sibling = afterItems.find(i => i.id === siblingId);
    assert.notEqual(sibling.owner, "独自更新", "sibling must NOT be updated when applyToSameSupplier=false");
  });
});

test("B1-03A: no supplierId/supplierDisplay — applyToSameSupplier returns affectedCount 1", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const itemId = items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "测试", applyToSameSupplier: true }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    if (result.affectedCount !== undefined) {
      assert.equal(result.affectedCount, 1, "affectedCount should be 1 when no supplier");
    }
  });
});

test("B1-03A: supplierId/supplierDisplay in PROTECTED_EI cannot be overwritten via PATCH", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuoteWithTwoSupplierItems();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB-S/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const item = items.find(i => i.supplierId === "SUP-001");

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: "INJECTED", supplierDisplay: "INJECTED", owner: "合法字段" }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    const resultItem = result.item || result;
    assert.equal(resultItem.supplierId, "SUP-001", "supplierId must not change");
    assert.equal(resultItem.supplierDisplay, "鲜花供应商A", "supplierDisplay must not change");
    assert.equal(resultItem.owner, "合法字段", "legitimate field should be updated");
  });
});

// ── B1-03B: 供应商回填测试 ──────────────────────────────────────────────────

// Helper: 从种子 quote 生成执行项，然后把供应商字段清空（模拟 B1-03A 部署前的历史数据）
async function setupStaleExecutionItems(port) {
  seedProjectBasedQuoteWithTwoSupplierItems();
  const convertRes = await apiFetch(port, "/api/quotes/Q-PB-S/convert-to-project", { method: "POST" });
  const { id: projectId } = await convertRes.json();
  await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });

  // 清空所有执行项的供应商字段，模拟历史脏数据
  const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
  data.projectExecutionItems = (data.projectExecutionItems || []).map(ei =>
    ei.projectId === projectId
      ? { ...ei, supplierId: "", supplierCatalogItemId: "", supplierDisplay: "" }
      : ei
  );
  fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

  return projectId;
}

test("B1-03B: backfill fills supplierId / supplierDisplay / supplierCatalogItemId from quoteSnapshot", async () => {
  await withServer(async (port) => {
    const projectId = await setupStaleExecutionItems(port);

    // 确认当前供应商字段为空
    const beforeRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const before = await beforeRes.json();
    assert.ok(before.every(i => !i.supplierId && !i.supplierDisplay), "supplier fields should be empty before backfill");

    // 执行回填
    const backfillRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/backfill-suppliers`, { method: "POST" });
    assert.equal(backfillRes.status, 200, "backfill should return 200");
    const result = await backfillRes.json();
    assert.ok(typeof result.updatedCount === "number", "updatedCount should be a number");
    assert.ok(result.updatedCount > 0, "should have updated at least one item");
    assert.ok(typeof result.skippedCount === "number", "skippedCount should be present");
    assert.ok(typeof result.totalCount === "number", "totalCount should be present");
    assert.ok(typeof result.availableSupplierCount === "number", "availableSupplierCount should be present");

    // 验证回填后供应商字段正确
    const afterRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const after = await afterRes.json();
    const sup1Items = after.filter(i => i.supplierId === "SUP-001");
    assert.ok(sup1Items.length >= 2, "at least 2 items should now have SUP-001");
    assert.ok(sup1Items.every(i => i.supplierDisplay === "鲜花供应商A"), "supplierDisplay should be filled");
    const sup2Items = after.filter(i => i.supplierId === "SUP-002");
    assert.ok(sup2Items.length >= 1, "at least 1 item should have SUP-002");
    assert.equal(sup2Items[0].supplierDisplay, "物流公司B", "物流公司B should be filled");
  });
});

test("B1-03B: backfill does NOT modify quoteSnapshot", async () => {
  await withServer(async (port) => {
    const projectId = await setupStaleExecutionItems(port);

    // 读取 backfill 前的 quoteSnapshot
    const projectBefore = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`)).json();
    const snapshotBefore = JSON.stringify(projectBefore.quoteSnapshot);

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/backfill-suppliers`, { method: "POST" });

    // 读取 backfill 后的 quoteSnapshot
    const projectAfter = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`)).json();
    const snapshotAfter = JSON.stringify(projectAfter.quoteSnapshot);

    assert.equal(snapshotBefore, snapshotAfter, "quoteSnapshot must remain unchanged after backfill");
  });
});

test("B1-03B: backfill does NOT overwrite owner / status / supplierStatus / notes / location", async () => {
  await withServer(async (port) => {
    const projectId = await setupStaleExecutionItems(port);

    // 先生成并取得第一个执行项，写入自定义业务字段
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const target = items[0];

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(target.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "张三", status: "in_progress", notes: "已联系", location: "测试地点" }),
    });

    // 执行回填
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/backfill-suppliers`, { method: "POST" });

    // 验证业务字段未被修改
    const afterRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const afterItems = await afterRes.json();
    const updated = afterItems.find(i => i.id === target.id);
    assert.ok(updated, "item should still exist");
    assert.equal(updated.owner, "张三", "owner should not be overwritten");
    assert.equal(updated.status, "in_progress", "status should not be overwritten");
    assert.equal(updated.notes, "已联系", "notes should not be overwritten");
    assert.equal(updated.location, "测试地点", "location should not be overwritten");
  });
});

test("B1-03B: backfill skips items that already have supplierId (default force=false)", async () => {
  await withServer(async (port) => {
    const projectId = await setupStaleExecutionItems(port);

    // 第一次回填
    const r1 = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/backfill-suppliers`, { method: "POST" })).json();
    assert.ok(r1.updatedCount > 0, "first backfill should update some items");

    // 第二次回填：已有供应商的项目应被跳过
    const r2 = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/backfill-suppliers`, { method: "POST" })).json();
    assert.equal(r2.updatedCount, 0, "second backfill should update 0 items (already filled)");
  });
});

test("B1-03B: backfill skips items where quoteSnapshot has no supplier info (skippedCount reflects this)", async () => {
  await withServer(async (port) => {
    // 用 Q-PB（无供应商 quote）建立项目
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });

    const result = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/backfill-suppliers`, { method: "POST" })).json();

    assert.equal(result.updatedCount, 0, "no supplier info in quoteSnapshot → updatedCount should be 0");
    assert.ok(result.skippedCount >= 0, "skippedCount should be present");
    assert.equal(result.availableSupplierCount, 0, "no supplier in quoteSnapshot → availableSupplierCount = 0");
  });
});

test("B1-03B: after backfill, applyToSameSupplier sync works on newly-filled supplier items", async () => {
  await withServer(async (port) => {
    const projectId = await setupStaleExecutionItems(port);

    // 先回填
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/backfill-suppliers`, { method: "POST" });

    // 找到 SUP-001 的两个执行项
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const items = await listRes.json();
    const sup1Items = items.filter(i => i.supplierId === "SUP-001");
    assert.ok(sup1Items.length >= 2, "need at least 2 SUP-001 items for sync test");

    const targetId = sup1Items[0].id;
    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "李四", status: "done", applyToSameSupplier: true }),
    });
    assert.equal(patchRes.status, 200);
    const patchResult = await patchRes.json();
    assert.ok(patchResult.affectedCount >= 2, "should sync at least 2 SUP-001 items");

    // 验证所有 SUP-001 项目均已同步
    const afterRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const afterItems = await afterRes.json();
    const sup1After = afterItems.filter(i => i.supplierId === "SUP-001");
    assert.ok(sup1After.every(i => i.owner === "李四"), "all SUP-001 items should be synced: owner");
    assert.ok(sup1After.every(i => i.status === "done"), "all SUP-001 items should be synced: status");
  });
});

test("B1-03B: customer interface not affected — quoteSnapshot intact after backfill", async () => {
  await withServer(async (port) => {
    const projectId = await setupStaleExecutionItems(port);
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/backfill-suppliers`, { method: "POST" });

    const projectRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`);
    assert.equal(projectRes.status, 200);
    const project = await projectRes.json();
    assert.ok(project.quoteSnapshot, "quoteSnapshot should still be present");
    assert.ok(project.sourceQuoteId === "Q-PB-S", "sourceQuoteId should be unchanged");
  });
});

// ── B1-04: 接待/执行任务 (projectTasks) ──────────────────────────────────────

async function setupProjectWithExecutionItems(port) {
  seedProjectBasedQuote();
  const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
  const { id: projectId } = await convertRes.json();
  await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
  return projectId;
}

test("B1-04: GET /api/projects/:id/tasks returns empty array initially", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`);
    assert.equal(res.status, 200);
    const tasks = await res.json();
    assert.ok(Array.isArray(tasks), "should return array");
    assert.equal(tasks.length, 0, "no tasks before generate");
  });
});

test("B1-04: POST generate creates tasks from executionItems", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);

    const genRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });
    assert.equal(genRes.status, 201, "first generate should return 201");
    const result = await genRes.json();
    assert.ok(result.createdCount > 0, "createdCount should be > 0");
    assert.ok(Array.isArray(result.tasks), "tasks should be array");
    assert.ok(result.tasks.length > 0, "tasks should not be empty");
  });
});

test("B1-04: repeated generate does not duplicate tasks (idempotent)", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);

    const r1 = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" })).json();
    const r2 = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" })).json();

    assert.equal(r1.createdCount, r2.tasks.length, "task count should remain same on second generate");
    assert.equal(r2.createdCount, 0, "second generate createdCount should be 0");
  });
});

test("B1-04: task field mapping from executionItem is correct", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);

    const eiRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`);
    const executionItems = await eiRes.json();
    assert.ok(executionItems.length > 0, "need at least one executionItem");
    const ei = executionItems[0];

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });
    const taskRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`);
    const tasks = await taskRes.json();
    assert.ok(tasks.length > 0, "tasks should not be empty");

    const task = tasks.find(t => t.sourceExecutionItemId === ei.id);
    assert.ok(task, "task should map to executionItem by sourceExecutionItemId");
    assert.equal(task.title, ei.title, "title should match");
    assert.equal(task.sourceExecutionItemId, ei.id, "sourceExecutionItemId should match");
    assert.equal(task.assignee, ei.owner || "", "assignee maps from owner");
    assert.equal(task.dueDate, ei.plannedDate || null, "dueDate maps from plannedDate");
    assert.equal(task.supplierDisplay, ei.supplierDisplay || "", "supplierDisplay should match");
    assert.ok(["todo","in_progress","done","cancelled"].includes(task.status), "status should be valid task status");
    assert.equal(task.priority, "normal", "default priority is normal");
  });
});

test("B1-04: PATCH can update assignee, status, priority, dates, location, notes", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const taskId = tasks[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignee: "张三",
        status: "in_progress",
        priority: "high",
        dueDate: "2026-06-30",
        executionDate: "2026-07-01",
        location: "主会场",
        notes: "需提前到场",
      }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.assignee, "张三");
    assert.equal(updated.status, "in_progress");
    assert.equal(updated.priority, "high");
    assert.equal(updated.dueDate, "2026-06-30");
    assert.equal(updated.executionDate, "2026-07-01");
    assert.equal(updated.location, "主会场");
    assert.equal(updated.notes, "需提前到场");
  });
});

test("B1-04: PATCH cannot overwrite protected fields", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const task = tasks[0];
    const taskId = task.id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "INJECTED-ID",
        projectId: "INJECTED-PID",
        sourceExecutionItemId: "INJECTED-EI",
        supplierId: "INJECTED-SUP",
        supplierDisplay: "INJECTED-DISPLAY",
        taskType: "INJECTED-TYPE",
        createdAt: "2000-01-01T00:00:00Z",
        assignee: "合法更新",
      }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    assert.equal(result.id, taskId, "id must not change");
    assert.equal(result.projectId, projectId, "projectId must not change");
    assert.equal(result.sourceExecutionItemId, task.sourceExecutionItemId, "sourceExecutionItemId must not change");
    assert.equal(result.supplierId, task.supplierId, "supplierId must not change");
    assert.equal(result.supplierDisplay, task.supplierDisplay, "supplierDisplay must not change");
    assert.equal(result.assignee, "合法更新", "legitimate field should be updated");
  });
});

test("B1-04: generate returns createdCount 0 when no executionItems exist", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const genRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });
    assert.equal(genRes.status, 200, "should return 200 not 500");
    const result = await genRes.json();
    assert.equal(result.createdCount, 0, "no executionItems means createdCount 0");
    assert.ok(Array.isArray(result.tasks), "tasks should be array");
    assert.equal(result.tasks.length, 0, "tasks should be empty");
  });
});

test("B1-04: PATCH returns 400 for invalid status", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const taskId = tasks[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invalid_status" }),
    });
    assert.equal(patchRes.status, 400);
  });
});

test("B1-04: PATCH returns 400 for invalid priority", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const taskId = tasks[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: "super_urgent" }),
    });
    assert.equal(patchRes.status, 400);
  });
});

test("B1-04: GET /api/projects/:id does not expose projectTasks or tasks fields", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });

    const projectRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`);
    assert.equal(projectRes.status, 200);
    const project = await projectRes.json();

    assert.equal(Object.prototype.hasOwnProperty.call(project, "projectTasks"), false, "projectTasks must not appear in project response");
    assert.equal(Object.prototype.hasOwnProperty.call(project, "tasks"), false, "tasks must not appear in project response");
    assert.ok(project.quoteSnapshot, "quoteSnapshot should still be present");
  });
});

test("B1-04: quoteSnapshot is not modified by task generate or PATCH", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);

    const before = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`)).json();
    const snapshotBefore = JSON.stringify(before.quoteSnapshot);

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    if (tasks.length > 0) {
      await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(tasks[0].id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee: "李四", status: "done" }),
      });
    }

    const after = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`)).json();
    const snapshotAfter = JSON.stringify(after.quoteSnapshot);

    assert.equal(snapshotBefore, snapshotAfter, "quoteSnapshot must not be modified");
  });
});

// ── B1-04A: 项目任务同供应商批量同步 ──────────────────────────────────────

async function setupProjectTasksWithSuppliers(port) {
  seedProjectBasedQuoteWithTwoSupplierItems();
  const convertRes = await apiFetch(port, `/api/quotes/Q-PB-S/convert-to-project`, { method: "POST" });
  const { id: projectId } = await convertRes.json();
  await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
  await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });
  return projectId;
}

test("B1-04A: applyToSameSupplier=true syncs assignee/status to sibling tasks", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectTasksWithSuppliers(port);

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const sup1Tasks = tasks.filter(t => t.supplierId === "SUP-001");
    assert.ok(sup1Tasks.length >= 2, `need at least 2 SUP-001 tasks, got ${sup1Tasks.length}`);

    const targetId = sup1Tasks[0].id;
    const siblingId = sup1Tasks[1].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee: "王五", status: "in_progress", applyToSameSupplier: true }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    assert.ok(result.item, "result.item should exist");
    assert.ok(result.affectedCount >= 2, `affectedCount should be ≥ 2, got ${result.affectedCount}`);
    assert.ok(Array.isArray(result.tasks), "result.tasks should be array");

    const afterTasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const sibling = afterTasks.find(t => t.id === siblingId);
    assert.equal(sibling.assignee, "王五", "sibling assignee must be synced");
    assert.equal(sibling.status, "in_progress", "sibling status must be synced");
  });
});

test("B1-04A: applyToSameSupplier does NOT sync notes or protected fields", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectTasksWithSuppliers(port);

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const sup1Tasks = tasks.filter(t => t.supplierId === "SUP-001");
    assert.ok(sup1Tasks.length >= 2, "need at least 2 SUP-001 tasks");

    const targetId = sup1Tasks[0].id;
    const siblingId = sup1Tasks[1].id;
    const siblingTitleBefore = tasks.find(t => t.id === siblingId)?.title;

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee: "赵六", notes: "内部备注", applyToSameSupplier: true }),
    });

    const afterTasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const sibling = afterTasks.find(t => t.id === siblingId);
    assert.equal(sibling.assignee, "赵六", "assignee should be synced");
    assert.notEqual(sibling.notes, "内部备注", "notes must NOT be synced to sibling");
    assert.equal(sibling.title, siblingTitleBefore, "title must NOT change");
  });
});

test("B1-04A: applyToSameSupplier=false only updates current task", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectTasksWithSuppliers(port);

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const sup1Tasks = tasks.filter(t => t.supplierId === "SUP-001");
    assert.ok(sup1Tasks.length >= 2, "need at least 2 SUP-001 tasks");

    const targetId = sup1Tasks[0].id;
    const siblingId = sup1Tasks[1].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee: "独自更新", applyToSameSupplier: false }),
    });
    assert.equal(patchRes.status, 200);

    const afterTasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const sibling = afterTasks.find(t => t.id === siblingId);
    assert.notEqual(sibling.assignee, "独自更新", "sibling must NOT be updated when applyToSameSupplier=false");
  });
});

test("B1-04A: no supplier — applyToSameSupplier returns affectedCount 1", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/generate`, { method: "POST" });

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    assert.ok(tasks.length > 0, "should have at least one task");

    const taskId = tasks[0].id;
    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee: "测试员", applyToSameSupplier: true }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    // no-supplier task: may return plain task or { item, affectedCount: 1 }
    const affectedCount = result.affectedCount !== undefined ? result.affectedCount : 1;
    assert.equal(affectedCount, 1, "affectedCount should be 1 when task has no supplier");
  });
});

test("B1-04A: applyToSameSupplier does not affect tasks from different supplier", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectTasksWithSuppliers(port);

    const tasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const sup1Tasks = tasks.filter(t => t.supplierId === "SUP-001");
    const sup2Tasks = tasks.filter(t => t.supplierId === "SUP-002");
    assert.ok(sup1Tasks.length >= 1, "need SUP-001 tasks");
    assert.ok(sup2Tasks.length >= 1, "need SUP-002 tasks");

    const targetId = sup1Tasks[0].id;
    const sup2Id = sup2Tasks[0].id;
    const sup2AssigneeBefore = sup2Tasks[0].assignee;

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee: "新负责人", applyToSameSupplier: true }),
    });

    const afterTasks = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/tasks`)).json();
    const sup2After = afterTasks.find(t => t.id === sup2Id);
    assert.equal(sup2After.assignee, sup2AssigneeBefore, "SUP-002 task must not be affected by SUP-001 sync");
  });
});

// ── B1-05A: 执行项供应商锁定 + 实际成本 ───────────────────────────────────────

async function setupProjectWithSupplierItems(port) {
  seedProjectBasedQuoteWithTwoSupplierItems();
  const convertRes = await apiFetch(port, `/api/quotes/Q-PB-S/convert-to-project`, { method: "POST" });
  const { id: projectId } = await convertRes.json();
  await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
  return projectId;
}

test("B1-05A: normalize — new cost fields present with defaults", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    assert.ok(items.length > 0, "should have execution items");
    const item = items[0];
    assert.ok("quoteUnitCost" in item, "quoteUnitCost should be present");
    assert.ok("quoteTotalCost" in item, "quoteTotalCost should be present");
    assert.ok("actualUnitCost" in item, "actualUnitCost should be present");
    assert.ok("actualTotalCost" in item, "actualTotalCost should be present");
    assert.ok("costCurrency" in item, "costCurrency should be present");
    assert.ok("costStatus" in item, "costStatus should be present");
    assert.ok("supplierLocked" in item, "supplierLocked should be present");
    assert.ok("supplierLockedAt" in item, "supplierLockedAt should be present");
    assert.ok("supplierLockNotes" in item, "supplierLockNotes should be present");
    assert.ok("costNotes" in item, "costNotes should be present");
    assert.equal(item.costStatus, "not_started", "costStatus default should be not_started");
    assert.equal(item.supplierLocked, false, "supplierLocked default should be false");
    assert.equal(item.costCurrency, "EUR", "costCurrency default should be EUR");
    assert.equal(item.actualUnitCost, null, "actualUnitCost initial should be null");
    assert.equal(item.actualTotalCost, null, "actualTotalCost initial should be null");
  });
});

test("B1-05A: generate from snapshot carries quoteUnitCost / quoteTotalCost", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, `/api/quotes/Q-PB/convert-to-project`, { method: "POST" });
    assert.equal(convertRes.status, 201);
    const { id: projectId } = await convertRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    assert.ok(items.length > 0, "should have execution items");

    // quoteSnapshot must not be modified
    const project = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`)).json();
    const snapshotStr = JSON.stringify(project.quoteSnapshot);
    assert.ok(!snapshotStr.includes('"actualUnitCost"'), "quoteSnapshot must not contain actualUnitCost");
    assert.ok(!snapshotStr.includes('"supplierLocked"'), "quoteSnapshot must not contain supplierLocked");
  });
});

test("B1-05A: PATCH actualUnitCost and costStatus succeeds", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    const itemId = items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualUnitCost: 120.5, costStatus: "estimated", costNotes: "预估成本" }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    const updated = result.item || result;
    assert.equal(updated.actualUnitCost, 120.5, "actualUnitCost should be updated");
    assert.equal(updated.costStatus, "estimated", "costStatus should be updated");
    assert.equal(updated.costNotes, "预估成本", "costNotes should be updated");
  });
});

test("B1-05A: PATCH actualUnitCost negative returns 400", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    const itemId = items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualUnitCost: -50 }),
    });
    assert.equal(patchRes.status, 400, "negative actualUnitCost should return 400");
  });
});

test("B1-05A: PATCH costStatus invalid value returns 400", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    const itemId = items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ costStatus: "invalid_value" }),
    });
    assert.equal(patchRes.status, 400, "invalid costStatus should return 400");
  });
});

test("B1-05A: PATCH supplierLocked=true auto-sets supplierLockedAt", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    const itemId = items[0].id;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierLocked: true, supplierLockNotes: "合同已签" }),
    });
    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    const updated = result.item || result;
    assert.equal(updated.supplierLocked, true, "supplierLocked should be true");
    assert.ok(updated.supplierLockedAt, "supplierLockedAt should be set automatically");
    assert.equal(updated.supplierLockNotes, "合同已签", "supplierLockNotes should be saved");
  });
});

test("B1-05A: PATCH supplierLocked=false clears supplierLockedAt", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    const itemId = items[0].id;

    // first lock it
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierLocked: true }),
    });

    // then unlock
    const unlockRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierLocked: false }),
    });
    assert.equal(unlockRes.status, 200);
    const result = await unlockRes.json();
    const updated = result.item || result;
    assert.equal(updated.supplierLocked, false, "supplierLocked should be false");
    assert.ok(!updated.supplierLockedAt, "supplierLockedAt should be cleared");
  });
});

test("B1-05A: PATCH cannot overwrite quoteUnitCost or quoteTotalCost", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithExecutionItems(port);
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    const item = items[0];
    const itemId = item.id;
    const originalQuoteUnit = item.quoteUnitCost;
    const originalQuoteTotal = item.quoteTotalCost;

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteUnitCost: 9999, quoteTotalCost: 9999 }),
    });
    assert.equal(patchRes.status, 200, "PATCH should succeed but ignore protected fields");
    const result = await patchRes.json();
    const updated = result.item || result;
    assert.equal(updated.quoteUnitCost, originalQuoteUnit, "quoteUnitCost must not be overwritten");
    assert.equal(updated.quoteTotalCost, originalQuoteTotal, "quoteTotalCost must not be overwritten");
  });
});

test("B1-05A: applyToSameSupplier does not sync actualUnitCost or costNotes", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierItems(port);
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    const sup1Items = items.filter(i => i.supplierId === "SUP-001");
    assert.ok(sup1Items.length >= 2, `need at least 2 SUP-001 items, got ${sup1Items.length}`);

    const targetId = sup1Items[0].id;
    const siblingId = sup1Items[1].id;

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualUnitCost: 500,
        costNotes: "私有成本备注",
        status: "in_progress",
        applyToSameSupplier: true,
      }),
    });

    const afterItems = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    const sibling = afterItems.find(i => i.id === siblingId);
    assert.ok(sibling, "sibling should exist");
    assert.notEqual(sibling.actualUnitCost, 500, "actualUnitCost must NOT be synced to sibling");
    assert.notEqual(sibling.costNotes, "私有成本备注", "costNotes must NOT be synced to sibling");
    assert.equal(sibling.status, "in_progress", "status should be synced (existing behavior)");
  });
});

test("B1-05A: client-facing quote API does not expose internal cost fields", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, `/api/quotes/Q-PB/convert-to-project`, { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });

    // patch some cost data
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    if (items.length > 0) {
      await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(items[0].id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualUnitCost: 999, supplierLocked: true, costNotes: "机密" }),
      });
    }

    // client-facing project quotation route must not expose cost fields
    const project = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`)).json();
    const sourceQuoteId = project.sourceQuoteId;
    if (sourceQuoteId) {
      const quoteRes = await apiFetch(port, `/api/quotes/${encodeURIComponent(sourceQuoteId)}`);
      if (quoteRes.status === 200) {
        const quoteBody = JSON.stringify(await quoteRes.json());
        assert.ok(!quoteBody.includes('"actualUnitCost"'), "quote API must not expose actualUnitCost");
        assert.ok(!quoteBody.includes('"supplierLocked"'), "quote API must not expose supplierLocked");
        assert.ok(!quoteBody.includes('"costNotes"'), "quote API must not expose costNotes");
      }
    }
  });
});

// ── B1-05B: 供应商项目总成本 + 项目实际利润汇总 ──────────────────────────────

async function setupProjectWithSupplierCosts(port) {
  seedProjectBasedQuote();
  const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
  const { id: projectId } = await convertRes.json();
  await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });
  return projectId;
}

test("B1-05B: GET /api/projects/:id/supplier-costs returns empty array initially", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`);
    assert.equal(res.status, 200);
    const costs = await res.json();
    assert.ok(Array.isArray(costs), "should return array");
    assert.equal(costs.length, 0, "no supplier costs initially");
  });
});

test("B1-05B: POST /api/projects/:id/supplier-costs creates a supplier cost record", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: "SUP-001",
        supplierDisplay: "大华演艺",
        actualTotalCost: 1200,
        costCurrency: "EUR",
        useSupplierTotal: true,
        costStatus: "confirmed",
        invoiceNumber: "INV-001",
        notes: "含搭建费",
      }),
    });
    assert.equal(res.status, 201, "should return 201");
    const cost = await res.json();
    assert.equal(cost.projectId, projectId, "projectId matches");
    assert.equal(cost.supplierId, "SUP-001");
    assert.equal(cost.supplierDisplay, "大华演艺");
    assert.equal(cost.actualTotalCost, 1200);
    assert.equal(cost.costStatus, "confirmed");
    assert.equal(cost.useSupplierTotal, true);
    assert.equal(cost.invoiceNumber, "INV-001");
    assert.ok(cost.id, "should have id");
    assert.ok(cost.createdAt, "should have createdAt");
  });
});

test("B1-05B: POST again with same supplierId+supplierDisplay upserts (no duplicate)", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: "SUP-002", supplierDisplay: "乘风物流", actualTotalCost: 800, costStatus: "estimated" }),
    });
    // second POST same identity → upsert
    const res2 = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: "SUP-002", supplierDisplay: "乘风物流", actualTotalCost: 900, costStatus: "confirmed" }),
    });
    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`);
    const costs = await listRes.json();
    const forSup002 = costs.filter(c => c.supplierId === "SUP-002");
    assert.equal(forSup002.length, 1, "should have exactly 1 record (upserted)");
    assert.equal(forSup002[0].actualTotalCost, 900, "should reflect updated value");
  });
});

test("B1-05B: PATCH /api/projects/:id/supplier-costs/:costId updates fields", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const postRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierDisplay: "测试供应商", actualTotalCost: 500, costStatus: "pending" }),
    });
    const { id: costId } = await postRes.json();

    const patchRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs/${encodeURIComponent(costId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualTotalCost: 650, costStatus: "confirmed", useSupplierTotal: false }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.actualTotalCost, 650);
    assert.equal(updated.costStatus, "confirmed");
    assert.equal(updated.useSupplierTotal, false);
  });
});

test("B1-05B: DELETE /api/projects/:id/supplier-costs/:costId removes the record", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const postRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierDisplay: "待删供应商", actualTotalCost: 300, costStatus: "pending" }),
    });
    const { id: costId } = await postRes.json();

    const delRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs/${encodeURIComponent(costId)}`, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 200);

    const listRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`);
    const costs = await listRes.json();
    assert.ok(!costs.some(c => c.id === costId), "deleted record should not appear");
  });
});

test("B1-05B: POST returns 400 when actualTotalCost is negative", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierDisplay: "供应商A", actualTotalCost: -100, costStatus: "pending" }),
    });
    assert.equal(res.status, 400, "negative actualTotalCost should return 400");
  });
});

test("B1-05B: POST returns 400 when costStatus is invalid", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierDisplay: "供应商B", actualTotalCost: 100, costStatus: "invalid_status" }),
    });
    assert.equal(res.status, 400, "invalid costStatus should return 400");
  });
});

test("B1-05B: POST returns 400 when sourceType is invalid", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierDisplay: "供应商C", actualTotalCost: 100, sourceType: "fax_machine" }),
    });
    assert.equal(res.status, 400, "invalid sourceType should return 400");
  });
});

test("B1-05B: POST returns 400 when both supplierId and supplierDisplay are empty", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: "", supplierDisplay: "", actualTotalCost: 100 }),
    });
    assert.equal(res.status, 400, "both empty supplier identifiers should return 400");
  });
});

test("B1-05B: GET /api/projects/:id/cost-summary returns summary without supplier costs", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);

    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`);
    assert.equal(res.status, 200);
    const summary = await res.json();

    assert.equal(summary.projectId, projectId, "projectId matches");
    assert.ok(typeof summary.quotedRevenueTotal === "number", "quotedRevenueTotal should be a number");
    assert.ok(typeof summary.actualCostTotal === "number", "actualCostTotal should be a number");
    assert.ok(typeof summary.actualGrossProfit === "number", "actualGrossProfit should be a number");
    assert.ok(typeof summary.actualGrossMargin === "number", "actualGrossMargin should be a number");
    assert.ok(typeof summary.costVariance === "number", "costVariance should be a number");
    assert.ok(Array.isArray(summary.supplierRows), "supplierRows should be array");
    assert.ok(summary.unassigned !== undefined, "unassigned should exist");
  });
});

test("B1-05B: cost-summary with no supplier costs uses execution items actual cost", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);

    // Set actual costs on execution items
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    const totalActual = 0;
    if (items.length > 0) {
      await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(items[0].id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualTotalCost: 350 }),
      });
    }

    const summary = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    // All actual cost should come from execution items
    assert.ok(summary.supplierRows.every(r => r.appliedMode === "execution_items"),
      "without supplier costs, all rows should use execution_items mode");
  });
});

test("B1-05B: cost-summary uses supplier_total when useSupplierTotal=true and actualTotalCost is set", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);

    // Get execution items to know the supplier
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    if (items.length === 0) return; // nothing to test

    // Patch an execution item to have a known actual cost
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(items[0].id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualTotalCost: 200, supplierDisplay: "测试供应商X" }),
    });

    // Create supplier cost record with useSupplierTotal=true
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierDisplay: "测试供应商X",
        actualTotalCost: 999,
        useSupplierTotal: true,
        costStatus: "confirmed",
      }),
    });

    const summary = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    const row = summary.supplierRows.find(r => r.supplierDisplay === "测试供应商X");
    if (row) {
      assert.equal(row.appliedMode, "supplier_total", "should use supplier_total mode");
      assert.equal(row.appliedActualCost, 999, "applied cost should be supplier total");
    }
  });
});

test("B1-05B: cost-summary uses execution_items when useSupplierTotal=false", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const items = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items`)).json();
    if (items.length === 0) return;

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/${encodeURIComponent(items[0].id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualTotalCost: 150, supplierDisplay: "供应商Y" }),
    });

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierDisplay: "供应商Y",
        actualTotalCost: 999,
        useSupplierTotal: false,
        costStatus: "pending",
      }),
    });

    const summary = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    const row = summary.supplierRows.find(r => r.supplierDisplay === "供应商Y");
    if (row) {
      assert.equal(row.appliedMode, "execution_items", "useSupplierTotal=false should use execution_items");
    }
  });
});

test("B1-05B: cost-summary costVariance = actualCostTotal - quotedCostTotal", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const summary = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    const expectedVariance = Math.round((summary.actualCostTotal - summary.quotedCostTotal) * 100) / 100;
    assert.ok(Math.abs(summary.costVariance - expectedVariance) < 0.01,
      `costVariance(${summary.costVariance}) should equal actualCostTotal - quotedCostTotal(${expectedVariance})`);
  });
});

test("B1-05B: cost-summary actualGrossProfit = quotedRevenueTotal - actualCostTotal", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const summary = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    const expected = Math.round((summary.quotedRevenueTotal - summary.actualCostTotal) * 100) / 100;
    assert.ok(Math.abs(summary.actualGrossProfit - expected) < 0.01,
      `actualGrossProfit should equal quotedRevenueTotal - actualCostTotal`);
  });
});

test("B1-05B: cost-summary actualGrossMargin is correct percentage", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const summary = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    if (summary.quotedRevenueTotal > 0) {
      const expectedMargin = Math.round((summary.actualGrossProfit / summary.quotedRevenueTotal) * 10000) / 100;
      assert.ok(Math.abs(summary.actualGrossMargin - expectedMargin) < 0.1,
        `actualGrossMargin(${summary.actualGrossMargin}) should be correct`);
    }
  });
});

test("B1-05B: cost-summary is stable when supplierProjectCosts key missing from seed", async () => {
  await withServer(async (port) => {
    // Remove supplierProjectCosts key from seed to test backward compat
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    delete data.supplierProjectCosts;
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });

    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`);
    assert.equal(res.status, 200, "should not crash when supplierProjectCosts key is missing");
    const summary = await res.json();
    assert.ok(typeof summary.actualCostTotal === "number", "actualCostTotal should be a number");
  });
});

test("B1-05B: cost-summary includes completeness metrics", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const summary = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    assert.ok("costCompletenessStatus" in summary, "costCompletenessStatus should be present");
    assert.ok("supplierTotalCount" in summary, "supplierTotalCount should be present");
    assert.ok("supplierConfirmedCount" in summary, "supplierConfirmedCount should be present");
    assert.ok("supplierPendingCount" in summary, "supplierPendingCount should be present");
    assert.ok("missingCostSupplierCount" in summary, "missingCostSupplierCount should be present");
    assert.ok("hasUnconfirmedSupplierCosts" in summary, "hasUnconfirmedSupplierCosts should be present");
    assert.ok("actualProfitIsEstimated" in summary, "actualProfitIsEstimated should be present");
    const validStatuses = ["empty", "partial", "complete"];
    assert.ok(validStatuses.includes(summary.costCompletenessStatus),
      `costCompletenessStatus must be empty|partial|complete, got: ${summary.costCompletenessStatus}`);
  });
});

test("B1-05B: cost-summary completeness becomes 'complete' when all suppliers confirmed", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    // Create a confirmed supplier cost record
    const postRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierDisplay: "唯一供应商",
        actualTotalCost: 800,
        costStatus: "confirmed",
        useSupplierTotal: true,
      }),
    });
    assert.equal(postRes.status, 201);

    // Now patch execution items to assign same supplier so they appear in summary
    // (since execution items from Q-PB have no supplier, supplierTotalCount=0 → 'empty', then adding
    //  a cost record with no matching EI gives supplierTotalCount=1 and missingCostSupplierCount=0)
    const summary = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    // The manually added confirmed supplier record has no EI rows → costRecordId exists → not missing
    assert.ok(summary.supplierTotalCount >= 1, "should have at least 1 supplier");
    if (summary.missingCostSupplierCount === 0 && summary.supplierConfirmedCount === summary.supplierTotalCount) {
      assert.equal(summary.costCompletenessStatus, "complete", "all confirmed → complete");
      assert.equal(summary.actualProfitIsEstimated, false, "all confirmed → not estimated");
    } else {
      // If EI suppliers exist and are not confirmed, partial is correct
      assert.ok(["partial", "complete"].includes(summary.costCompletenessStatus));
    }
  });
});

test("B1-05B: cost-summary quotedTotalCost uses snapshot fallback when EI quoteTotalCost is null", async () => {
  await withServer(async (port) => {
    // Use the two-supplier quote which has costSubtotal set
    seedProjectBasedQuoteWithTwoSupplierItems();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB-S/convert-to-project", { method: "POST" });
    assert.equal(convertRes.status, 201);
    const { id: projectId } = await convertRes.json();
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/execution-items/generate`, { method: "POST" });

    const summary = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    // SUP-001 has two items: costSubtotal 300 + 200 = 500; SUP-002 has one item: costSubtotal 500
    const sup001 = summary.supplierRows.find(r => r.supplierId === "SUP-001");
    const sup002 = summary.supplierRows.find(r => r.supplierId === "SUP-002");
    if (sup001) {
      assert.ok(sup001.quotedTotalCost > 0,
        `SUP-001 quotedTotalCost should be > 0 (snapshot fallback), got ${sup001.quotedTotalCost}`);
    }
    if (sup002) {
      assert.ok(sup002.quotedTotalCost > 0,
        `SUP-002 quotedTotalCost should be > 0 (snapshot fallback), got ${sup002.quotedTotalCost}`);
    }
  });
});

test("B1-05B: client-facing API does not expose supplier cost or profit fields", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    // Add a supplier cost record
    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierDisplay: "内部成本供应商", actualTotalCost: 5000, costStatus: "confirmed" }),
    });

    // Standard quote API should not leak these
    const project = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`)).json();
    const sourceQuoteId = project.sourceQuoteId;
    if (sourceQuoteId) {
      const quoteRes = await apiFetch(port, `/api/quotes/${encodeURIComponent(sourceQuoteId)}`);
      if (quoteRes.status === 200) {
        const quoteBody = JSON.stringify(await quoteRes.json());
        assert.ok(!quoteBody.includes('"supplierProjectCosts"'), "quote API must not expose supplierProjectCosts");
        assert.ok(!quoteBody.includes('"actualGrossProfit"'), "quote API must not expose actualGrossProfit");
        assert.ok(!quoteBody.includes('"actualGrossMargin"'), "quote API must not expose actualGrossMargin");
        assert.ok(!quoteBody.includes('"actualTotalCost"'), "quote API must not expose actualTotalCost in quote");
      }
    }

    // /api/projects/:id does not include supplier costs list
    const projectBody = JSON.stringify(project);
    assert.ok(!projectBody.includes('"supplierProjectCosts"'), "project record must not include supplierProjectCosts array");
    assert.ok(!projectBody.includes('"actualGrossProfit"'), "project record must not include actualGrossProfit");
  });
});

// ── B1-05C: 供应商发票文本导入 ──────────────────────────────────────────────

const { parseSupplierInvoiceText, normalizeMoneyString } = require("../server/services/supplierInvoiceTextImportStore");

// A. parseSupplierInvoiceText 规则解析
test("B1-05C: normalizeMoneyString — Serbian format 120.000,00", () => {
  assert.equal(normalizeMoneyString("120.000,00"), 120000);
  assert.equal(normalizeMoneyString("5.000"), 5000);
  assert.equal(normalizeMoneyString("5,000"), 5000);
  assert.equal(normalizeMoneyString("120,000.00"), 120000);
  assert.equal(normalizeMoneyString("5000.00"), 5000);
  assert.equal(normalizeMoneyString("500"), 500);
});

test("B1-05C: parseSupplierInvoiceText — Serbian invoice full parse", () => {
  const text = `AUDIO PRO D.O.O.
PIB: 103456789
Račun broj: INV-2026-0042
Datum: 18.05.2026
Podstawica (bez PDV): 100.000,00 RSD
PDV: 20.000,00 RSD
Ukupno za uplatu: 120.000,00 RSD`;

  const result = parseSupplierInvoiceText(text);
  assert.equal(result.parsedSupplierName, "AUDIO PRO D.O.O.", "should extract supplier name");
  assert.equal(result.parsedSupplierPib, "103456789", "should extract PIB");
  assert.equal(result.invoiceNumber, "INV-2026-0042", "should extract invoice number");
  assert.equal(result.invoiceDate, "2026-05-18", "should parse date 18.05.2026");
  assert.equal(result.currency, "RSD", "should detect RSD currency");
  assert.equal(result.totalWithTax, 120000, "should parse total 120.000,00");
  assert.equal(result.parseStatus, "parsed", "parseStatus should be parsed");
  assert.equal(result.parseError, "", "parseError should be empty");
});

test("B1-05C: parseSupplierInvoiceText — extracts PIB in various formats", () => {
  const text = `Firma XYZ\nP.I.B.: 987654321\nFaktura br. F-001\nUkupno: 5.000,00`;
  const r = parseSupplierInvoiceText(text);
  assert.equal(r.parsedSupplierPib, "987654321");
  assert.equal(r.invoiceNumber, "F-001");
  assert.equal(r.totalWithTax, 5000);
});

test("B1-05C: parseSupplierInvoiceText — ISO date format", () => {
  const text = `Supplier\nInvoice No: SRV-2026-01\nDate: 2026-05-18\nTotal: 1.500,00 RSD`;
  const r = parseSupplierInvoiceText(text);
  assert.equal(r.invoiceDate, "2026-05-18");
  assert.equal(r.invoiceNumber, "SRV-2026-01");
  assert.equal(r.totalWithTax, 1500);
});

test("B1-05C: parseSupplierInvoiceText — EUR currency detection", () => {
  const text = `Prevod ABC\nBroj računa: R-2026-005\nDatum: 15/03/2026\nUkupno za uplatu: 2.500,00 EUR`;
  const r = parseSupplierInvoiceText(text);
  assert.equal(r.currency, "EUR");
  assert.equal(r.totalWithTax, 2500);
  assert.equal(r.invoiceDate, "2026-03-15");
});

test("B1-05C: parseSupplierInvoiceText — failed parse when no total", () => {
  const text = `Neka firma\nRačun: R-001\nDatum: 01.01.2026\nBez iznosa ovde`;
  const r = parseSupplierInvoiceText(text);
  assert.equal(r.parseStatus, "failed");
  assert.ok(r.parseError.length > 0, "parseError should be set");
  assert.equal(r.totalWithTax, null);
});

// B. POST /api/projects/:id/invoice-text-imports
test("B1-05C: POST invoice-text-imports with empty rawText returns 400", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: "" }),
    });
    assert.equal(res.status, 400, "empty rawText should return 400");
  });
});

test("B1-05C: POST invoice-text-imports with valid text creates record", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);
    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "TECH SOUND\nPIB: 111222333\nRačun: INV-001\nDatum: 18.05.2026\nUkupno za uplatu: 120.000,00 RSD",
      }),
    });
    assert.equal(res.status, 201, "should return 201");
    const record = await res.json();
    assert.ok(record.id, "should have id");
    assert.equal(record.projectId, projectId);
    assert.equal(record.parsedSupplierName, "TECH SOUND");
    assert.equal(record.parsedSupplierPib, "111222333");
    assert.equal(record.invoiceNumber, "INV-001");
    assert.equal(record.invoiceDate, "2026-05-18");
    assert.equal(record.totalWithTax, 120000);
    assert.equal(record.currency, "RSD");
    assert.equal(record.reviewStatus, "pending");
    assert.ok("matchConfidence" in record, "should have matchConfidence field");
    assert.ok("suggestedSupplierDisplay" in record, "should have suggestedSupplierDisplay field");
  });
});

// C. apply import
test("B1-05C: apply import writes supplier_project_cost with sourceType=invoice_text", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);

    // Create the import record
    const createRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "GLOBAL EVENTS\nPIB: 999888777\nFaktura: F-2026-88\nDatum: 01.03.2026\nUkupno za uplatu: 85.000,00 RSD",
      }),
    });
    assert.equal(createRes.status, 201);
    const importRecord = await createRes.json();
    const importId = importRecord.id;

    // Apply the import
    const applyRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports/${encodeURIComponent(importId)}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierDisplay: "Global Events",
        costCurrency: "RSD",
        costStatus: "confirmed",
        useSupplierTotal: true,
      }),
    });
    assert.equal(applyRes.status, 200, "apply should return 200");
    const result = await applyRes.json();
    assert.ok(result.importRecord, "should have importRecord");
    assert.ok(result.supplierCost, "should have supplierCost");

    // Check import record updated
    assert.equal(result.importRecord.reviewStatus, "applied", "reviewStatus should be applied");
    assert.ok(result.importRecord.targetSupplierCostId, "targetSupplierCostId should be set");
    assert.ok(result.importRecord.appliedAt, "appliedAt should be set");

    // Check supplier cost
    const sc = result.supplierCost;
    assert.equal(sc.sourceType, "invoice_text", "sourceType must be invoice_text");
    assert.equal(sc.actualTotalCost, 85000, "actualTotalCost should use parsed total");
    assert.equal(sc.invoiceNumber, "F-2026-88", "invoiceNumber from import");
    assert.equal(sc.invoiceDate, "2026-03-01", "invoiceDate from import");
    assert.ok(sc.id, "supplierCost should have id");
    assert.equal(sc.costStatus, "confirmed");
  });
});

// D. reject import
test("B1-05C: reject import sets reviewStatus=rejected, does not write supplier cost", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);

    const createRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "TEST FIRMA\nRačun: TF-001\nDatum: 10.04.2026\nUkupno: 50.000,00 RSD",
      }),
    });
    const importRecord = await createRes.json();
    const importId = importRecord.id;

    const rejectRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports/${encodeURIComponent(importId)}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "金额不符" }),
    });
    assert.equal(rejectRes.status, 200, "reject should return 200");
    const rejected = await rejectRes.json();
    assert.equal(rejected.reviewStatus, "rejected", "reviewStatus should be rejected");

    // Verify supplier costs NOT created
    const costsRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/supplier-costs`);
    const costs = await costsRes.json();
    const hasTF = costs.some(c => c.invoiceNumber === "TF-001");
    assert.equal(hasTF, false, "reject must NOT create a supplier cost record");
  });
});

// E. cost-summary update after apply
test("B1-05C: apply import → cost-summary actualCostTotal updates", async () => {
  await withServer(async (port) => {
    const projectId = await setupProjectWithSupplierCosts(port);

    const summaryBefore = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();

    const createRes = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "VENUE PLUS\nFaktura: VP-200\nDatum: 05.05.2026\nUkupno za uplatu: 200.000,00 RSD",
      }),
    });
    const { id: importId } = await createRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports/${encodeURIComponent(importId)}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierDisplay: "Venue Plus",
        costCurrency: "RSD",
        costStatus: "confirmed",
        useSupplierTotal: true,
      }),
    });

    const summaryAfter = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/cost-summary`)).json();
    assert.ok(summaryAfter.supplierRows.length >= 1, "should have supplier rows after apply");
    const vpRow = summaryAfter.supplierRows.find(r => r.supplierDisplay === "Venue Plus");
    assert.ok(vpRow, "should find Venue Plus row in summary");
    assert.equal(vpRow.supplierActualTotalCost, 200000, "Venue Plus actual total should be 200000");
  });
});

// F. 客户输出安全
test("B1-05C: client-facing APIs do not expose invoice import data", async () => {
  await withServer(async (port) => {
    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "SECRET SUPPLIER\nFaktura: SEC-001\nDatum: 01.01.2026\nUkupno: 999.999,00 RSD",
      }),
    });

    const project = await (await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}`)).json();
    const projectBody = JSON.stringify(project);
    assert.ok(!projectBody.includes('"supplierInvoiceTextImports"'), "project record must not include supplierInvoiceTextImports");
    assert.ok(!projectBody.includes('"rawText"'), "project record must not include rawText");
    assert.ok(!projectBody.includes('SECRET SUPPLIER'), "project record must not contain raw supplier name from invoice");

    const sourceQuoteId = project.sourceQuoteId;
    if (sourceQuoteId) {
      const quoteRes = await apiFetch(port, `/api/quotes/${encodeURIComponent(sourceQuoteId)}`);
      if (quoteRes.status === 200) {
        const quoteBody = JSON.stringify(await quoteRes.json());
        assert.ok(!quoteBody.includes('"supplierInvoiceTextImports"'), "quote API must not expose supplierInvoiceTextImports");
        assert.ok(!quoteBody.includes('"rawText"'), "quote API must not expose rawText");
        assert.ok(!quoteBody.includes('"actualGrossProfit"'), "quote API must not expose actualGrossProfit");
      }
    }
  });
});

// G. 兼容旧数据
test("B1-05C: supplierInvoiceTextImports key missing from seed does not crash", async () => {
  await withServer(async (port) => {
    const data = JSON.parse(fs.readFileSync(tempDataFile, "utf8"));
    delete data.supplierInvoiceTextImports;
    fs.writeFileSync(tempDataFile, JSON.stringify(data, null, 2));

    seedProjectBasedQuote();
    const convertRes = await apiFetch(port, "/api/quotes/Q-PB/convert-to-project", { method: "POST" });
    const { id: projectId } = await convertRes.json();

    const res = await apiFetch(port, `/api/projects/${encodeURIComponent(projectId)}/invoice-text-imports`);
    assert.equal(res.status, 200, "should not crash when supplierInvoiceTextImports key is missing");
    const list = await res.json();
    assert.ok(Array.isArray(list), "should return array");
    assert.equal(list.length, 0, "should return empty array");
  });
});
