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
