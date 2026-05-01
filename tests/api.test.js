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
