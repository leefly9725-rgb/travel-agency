const state = {
  dashboard: null,
  quotes: [],
  receptions: [],
  documents: [],
};

function text(value) {
  return value;
}

function statusLabel(status) {
  const labels = {
    pending: "\u5f85\u5904\u7406",
    in_progress: "\u8fdb\u884c\u4e2d",
    done: "\u5df2\u5b8c\u6210",
  };
  return labels[status] || status;
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

async function loadAll() {
  const [dashboard, quotes, receptions, documents] = await Promise.all([
    fetchJson("/api/dashboard"),
    fetchJson("/api/quotes"),
    fetchJson("/api/receptions"),
    fetchJson("/api/documents"),
  ]);

  state.dashboard = dashboard;
  state.quotes = quotes;
  state.receptions = receptions;
  state.documents = documents;

  render();
}

function render() {
  renderMetrics();
  renderQuotes();
  renderReceptions();
  renderDocuments();
}

function renderMetrics() {
  const dashboard = state.dashboard;
  const metricsEl = document.getElementById("metrics");
  metricsEl.innerHTML = `
    <div class="metrics-grid">
      <div class="metric fade-in"><span>\u62a5\u4ef7\u5355</span><strong>${dashboard.metrics.quoteCount}</strong></div>
      <div class="metric fade-in" style="animation-delay: 0.05s"><span>\u63a5\u5f85\u4efb\u52a1</span><strong>${dashboard.metrics.receptionTaskCount}</strong></div>
      <div class="metric fade-in" style="animation-delay: 0.1s"><span>\u6587\u6863\u6570</span><strong>${dashboard.metrics.documentCount}</strong></div>
      <div class="metric fade-in" style="animation-delay: 0.15s"><span>\u7d2f\u8ba1\u6bdb\u5229</span><strong>${formatCurrency(dashboard.metrics.totalGrossProfit, dashboard.defaultCurrency)}</strong></div>
    </div>
  `;
}

function renderQuotes() {
  const quotesEl = document.getElementById("quotes");
  quotesEl.innerHTML = state.quotes.map((quote, index) => `
    <article class="card fade-in" style="animation-delay: ${index * 0.05}s">
      <div class="list-row">
        <h3>${quote.clientName}</h3>
        <button class="mini-button" data-edit-quote="${quote.id}">\u7f16\u8f91</button>
      </div>
      <p class="meta">${quote.id} ? ${quote.tripDate} ? ${quote.language} ? ${quote.currency}</p>
      <div class="quote-metrics">
        <div class="metric"><span>\u6210\u672c</span><strong>${formatCurrency(quote.totalCost, quote.currency)}</strong></div>
        <div class="metric"><span>\u552e\u4ef7</span><strong>${formatCurrency(quote.totalPrice, quote.currency)}</strong></div>
        <div class="metric"><span>\u6bdb\u5229</span><strong>${formatCurrency(quote.grossProfit, quote.currency)}</strong></div>
        <div class="metric"><span>\u6bdb\u5229\u7387</span><strong>${quote.grossMargin}%</strong></div>
      </div>
    </article>
  `).join("") || '<p class="empty">\u6682\u65e0\u62a5\u4ef7\u6570\u636e</p>';
}

function renderReceptions() {
  const receptionsEl = document.getElementById("receptions");
  receptionsEl.innerHTML = state.receptions.map((item, index) => `
    <article class="card fade-in" style="animation-delay: ${index * 0.05}s">
      <div class="list-row">
        <h3>${item.title}</h3>
        <button class="mini-button" data-edit-reception="${item.id}">\u7f16\u8f91</button>
      </div>
      <p class="meta">\u8d1f\u8d23\u4eba ${item.assignee}</p>
      <div class="list-row compact">
        <span class="status ${item.status}">${statusLabel(item.status)}</span>
        <span class="meta">${item.date} ? ${item.type}</span>
      </div>
    </article>
  `).join("") || '<p class="empty">\u6682\u65e0\u63a5\u5f85\u4efb\u52a1</p>';
}

function renderDocuments() {
  const documentsEl = document.getElementById("documents");
  documentsEl.innerHTML = state.documents.map((doc, index) => `
    <article class="card fade-in" style="animation-delay: ${index * 0.05}s">
      <div class="list-row">
        <h3>${doc.title}</h3>
        <button class="mini-button" data-edit-document="${doc.id}">\u7f16\u8f91</button>
      </div>
      <p class="meta">${doc.id} ? ${doc.category}</p>
      <p class="meta">${doc.language} ? ${doc.updatedAt}</p>
    </article>
  `).join("") || '<p class="empty">\u6682\u65e0\u6587\u6863</p>';
}

function parseQuoteItems(textValue) {
  return textValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, cost, price, quantity] = line.split("|").map((part) => part.trim());
      return {
        name,
        cost: Number(cost || 0),
        price: Number(price || 0),
        quantity: Number(quantity || 0),
      };
    });
}

function quoteItemsToText(items) {
  return items.map((item) => [item.name, item.cost, item.price, item.quantity].join("|")).join("\n");
}

function resetQuoteForm() {
  const form = document.getElementById("quote-form");
  form.reset();
  form.id.value = "";
  form.language.value = "zh-CN";
  form.currency.value = "EUR";
  document.getElementById("quote-form-mode").textContent = "\u65b0\u5efa";
}

function resetReceptionForm() {
  const form = document.getElementById("reception-form");
  form.reset();
  form.id.value = "";
  form.status.value = "pending";
  form.type.value = "business";
  document.getElementById("reception-form-mode").textContent = "\u65b0\u5efa";
}

function resetDocumentForm() {
  const form = document.getElementById("document-form");
  form.reset();
  form.id.value = "";
  form.language.value = "zh-CN";
  document.getElementById("document-form-mode").textContent = "\u65b0\u5efa";
}

function editQuote(id) {
  const quote = state.quotes.find((item) => item.id === id);
  if (!quote) return;
  const form = document.getElementById("quote-form");
  form.id.value = quote.id;
  form.clientName.value = quote.clientName;
  form.language.value = quote.language;
  form.currency.value = quote.currency;
  form.tripDate.value = quote.tripDate;
  form.itemsText.value = quoteItemsToText(quote.items);
  document.getElementById("quote-form-mode").textContent = `${quote.id} \u7f16\u8f91\u4e2d`;
}

function editReception(id) {
  const reception = state.receptions.find((item) => item.id === id);
  if (!reception) return;
  const form = document.getElementById("reception-form");
  form.id.value = reception.id;
  form.title.value = reception.title;
  form.assignee.value = reception.assignee;
  form.status.value = reception.status;
  form.date.value = reception.date;
  form.type.value = reception.type;
  document.getElementById("reception-form-mode").textContent = `${reception.id} \u7f16\u8f91\u4e2d`;
}

function editDocument(id) {
  const documentItem = state.documents.find((item) => item.id === id);
  if (!documentItem) return;
  const form = document.getElementById("document-form");
  form.id.value = documentItem.id;
  form.title.value = documentItem.title;
  form.category.value = documentItem.category;
  form.language.value = documentItem.language;
  form.updatedAt.value = documentItem.updatedAt;
  document.getElementById("document-form-mode").textContent = `${documentItem.id} \u7f16\u8f91\u4e2d`;
}

async function submitQuote(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    clientName: form.clientName.value.trim(),
    language: form.language.value,
    currency: form.currency.value,
    tripDate: form.tripDate.value,
    items: parseQuoteItems(form.itemsText.value),
  };
  const id = form.id.value.trim();
  const method = id ? "PUT" : "POST";
  const url = id ? `/api/quotes/${encodeURIComponent(id)}` : "/api/quotes";
  await fetchJson(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  resetQuoteForm();
  await loadAll();
}

async function submitReception(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    title: form.title.value.trim(),
    assignee: form.assignee.value.trim(),
    status: form.status.value,
    date: form.date.value,
    type: form.type.value.trim(),
  };
  const id = form.id.value.trim();
  const method = id ? "PUT" : "POST";
  const url = id ? `/api/receptions/${encodeURIComponent(id)}` : "/api/receptions";
  await fetchJson(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  resetReceptionForm();
  await loadAll();
}

async function submitDocument(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    title: form.title.value.trim(),
    category: form.category.value.trim(),
    language: form.language.value,
    updatedAt: form.updatedAt.value,
  };
  const id = form.id.value.trim();
  const method = id ? "PUT" : "POST";
  const url = id ? `/api/documents/${encodeURIComponent(id)}` : "/api/documents";
  await fetchJson(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  resetDocumentForm();
  await loadAll();
}

function bindEvents() {
  document.getElementById("quote-form").addEventListener("submit", submitQuote);
  document.getElementById("reception-form").addEventListener("submit", submitReception);
  document.getElementById("document-form").addEventListener("submit", submitDocument);

  document.querySelectorAll("[data-reset-form]").forEach((button) => {
    button.addEventListener("click", () => {
      const formName = button.getAttribute("data-reset-form");
      if (formName === "quote") resetQuoteForm();
      if (formName === "reception") resetReceptionForm();
      if (formName === "document") resetDocumentForm();
    });
  });

  document.body.addEventListener("click", (event) => {
    const quoteId = event.target.getAttribute("data-edit-quote");
    if (quoteId) {
      editQuote(quoteId);
    }

    const receptionId = event.target.getAttribute("data-edit-reception");
    if (receptionId) {
      editReception(receptionId);
    }

    const documentId = event.target.getAttribute("data-edit-document");
    if (documentId) {
      editDocument(documentId);
    }
  });
}

async function bootstrap() {
  bindEvents();
  resetQuoteForm();
  resetReceptionForm();
  resetDocumentForm();
  await loadAll();
}

bootstrap().catch((error) => {
  document.body.innerHTML = `<pre style="padding: 24px; color: #a33;">${error.message}</pre>`;
});
