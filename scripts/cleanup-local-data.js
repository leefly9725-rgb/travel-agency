const fs = require("node:fs");
const path = require("node:path");

const dataFile = path.resolve(process.cwd(), process.argv[2] || "data/seed.json");
const reportFile = path.resolve(process.cwd(), process.argv[3] || "backups/latest-cleanup-report.json");
const supportedStatuses = new Set(["pending", "in_progress", "done"]);
const supportedQuoteItemTypes = new Set(["hotel", "vehicle", "guide", "interpreter", "dining", "tickets", "meeting", "parking", "misc"]);

function addCleaned(report, id, changes) {
  if (changes.length > 0) {
    report.cleanedRecords.push({ id, changes });
  }
}

function addMarked(report, id, issues) {
  if (issues.length > 0) {
    report.markedRecords.push({ id, issues });
  }
}

function containsSuspiciousTravelMismatch(text) {
  return /luster|fotelje|retro|kristalni|kozna|ko\u017ena|potpuno/i.test(String(text || ""));
}

function cleanupQuote(quote, report) {
  const cleaned = [];
  const issues = [];

  if (quote.projectId == null) {
    quote.projectId = "";
    cleaned.push("\u8865\u9f50\u7f3a\u5931\u7684 projectId \u5b57\u6bb5\u4e3a\u7a7a\u5b57\u7b26\u4e32");
  } else if (typeof quote.projectId !== "string") {
    quote.projectId = String(quote.projectId);
    cleaned.push("\u5c06 projectId \u8f6c\u4e3a\u5b57\u7b26\u4e32");
  }

  if (!Number.isFinite(Number(quote.paxCount))) {
    quote.paxCount = 0;
    cleaned.push("\u5c06\u65e0\u6548\u7684 paxCount \u89c4\u8303\u4e3a 0");
  } else if (quote.paxCount == null) {
    quote.paxCount = 0;
    cleaned.push("\u8865\u9f50\u7f3a\u5931\u7684 paxCount \u4e3a 0");
  } else {
    quote.paxCount = Number(quote.paxCount);
  }

  ["clientName", "projectName", "contactName", "contactPhone", "destination", "notes", "quoteNumber", "projectId"].forEach((field) => {
    if (typeof quote[field] === "string") {
      const trimmed = quote[field].trim();
      if (trimmed !== quote[field]) {
        quote[field] = trimmed;
        cleaned.push(`\u6e05\u7406 ${field} \u9996\u5c3e\u7a7a\u683c`);
      }
    }
  });

  if (!Array.isArray(quote.items)) {
    quote.items = [];
    issues.push("\u62a5\u4ef7\u9879\u5217\u8868\u7f3a\u5931\uff0c\u5df2\u4fdd\u7559\u7a7a\u6570\u7ec4\u5f85\u4eba\u5de5\u590d\u6838");
  }

  quote.items.forEach((item, index) => {
    if (typeof item.type === "string") {
      const normalizedType = item.type.trim().toLowerCase();
      if (normalizedType !== item.type) {
        item.type = normalizedType;
        cleaned.push(`\u62a5\u4ef7\u9879 ${index + 1} \u7c7b\u578b\u7edf\u4e00\u4e3a\u5c0f\u5199`);
      }
    }

    if (!supportedQuoteItemTypes.has(item.type)) {
      issues.push(`\u62a5\u4ef7\u9879 ${index + 1} \u7c7b\u578b ${item.type || "\u7a7a\u503c"} \u4e0d\u5728\u652f\u6301\u8303\u56f4\u5185`);
    }

    ["name", "unit", "supplier", "notes"].forEach((field) => {
      if (typeof item[field] === "string") {
        const trimmed = item[field].trim();
        if (trimmed !== item[field]) {
          item[field] = trimmed;
          cleaned.push(`\u62a5\u4ef7\u9879 ${index + 1} \u7684 ${field} \u53bb\u9664\u9996\u5c3e\u7a7a\u683c`);
        }
      }
    });
  });

  const suspiciousItemNames = (quote.items || []).filter((item) => containsSuspiciousTravelMismatch(item.name)).map((item) => item.name);
  const suspiciousUnits = (quote.items || []).filter((item) => /^\d+$/.test(String(item.unit || "")) || String(item.unit || "").toLowerCase() === "unit").map((item) => item.unit);

  if (suspiciousItemNames.length > 0) {
    issues.push("\u5305\u542b\u660e\u663e\u975e\u65c5\u6e38\u670d\u52a1\u540d\u79f0\u7684\u62a5\u4ef7\u9879\uff1a" + suspiciousItemNames.join("\uff1b"));
  }

  if (suspiciousUnits.length > 0) {
    issues.push("\u5b58\u5728\u4e0d\u9002\u5408\u65c5\u6e38\u62a5\u4ef7\u7684\u5355\u4f4d\u503c\uff1a" + suspiciousUnits.join("\u3001"));
  }

  if (issues.length > 0) {
    quote.dataQuality = {
      reviewStatus: "flagged_review",
      issues,
      note: "\u6b64\u8bb0\u5f55\u5df2\u6807\u8bb0\uff0c\u672a\u81ea\u52a8\u731c\u6d4b\u4fee\u590d\uff0c\u8bf7\u4eba\u5de5\u590d\u6838\u540e\u518d\u7528\u4e8e\u6b63\u5f0f\u4e1a\u52a1\u3002",
    };
  } else if (quote.dataQuality) {
    delete quote.dataQuality;
    cleaned.push("\u79fb\u9664\u8fc7\u671f\u7684\u6570\u636e\u8d28\u91cf\u6807\u8bb0");
  }

  addCleaned(report, quote.id, cleaned);
  addMarked(report, quote.id, issues);
}

function cleanupReception(reception, report) {
  const cleaned = [];
  const issues = [];

  if (reception.projectId == null) {
    reception.projectId = "";
    cleaned.push("\u8865\u9f50\u7f3a\u5931\u7684 projectId \u5b57\u6bb5\u4e3a\u7a7a\u5b57\u7b26\u4e32");
  } else if (typeof reception.projectId !== "string") {
    reception.projectId = String(reception.projectId);
    cleaned.push("\u5c06 projectId \u8f6c\u4e3a\u5b57\u7b26\u4e32");
  }

  ["title", "assignee", "location", "notes", "projectId"].forEach((field) => {
    if (typeof reception[field] === "string") {
      const trimmed = reception[field].trim();
      if (trimmed !== reception[field]) {
        reception[field] = trimmed;
        cleaned.push(`\u6e05\u7406 ${field} \u9996\u5c3e\u7a7a\u683c`);
      }
    }
  });

  if (!supportedStatuses.has(reception.status)) {
    issues.push(`\u72b6\u6001\u503c ${reception.status || "\u7a7a\u503c"} \u4e0d\u5728\u652f\u6301\u8303\u56f4\u5185`);
  }

  if (Object.prototype.hasOwnProperty.call(reception, "type")) {
    delete reception.type;
    cleaned.push("\u79fb\u9664\u65e7\u7248\u672a\u4f7f\u7528\u7684 type \u5b57\u6bb5");
  }

  if (issues.length > 0) {
    reception.dataQuality = {
      reviewStatus: "flagged_review",
      issues,
      note: "\u6b64\u8bb0\u5f55\u9700\u8981\u4eba\u5de5\u590d\u6838\u3002",
    };
  } else if (reception.dataQuality) {
    delete reception.dataQuality;
    cleaned.push("\u79fb\u9664\u8fc7\u671f\u7684\u6570\u636e\u8d28\u91cf\u6807\u8bb0");
  }

  addCleaned(report, reception.id, cleaned);
  addMarked(report, reception.id, issues);
}

function cleanupDocument(document, report) {
  const cleaned = [];
  ["title", "category", "language", "updatedAt"].forEach((field) => {
    if (typeof document[field] === "string") {
      const trimmed = document[field].trim();
      if (trimmed !== document[field]) {
        document[field] = trimmed;
        cleaned.push(`\u6e05\u7406 ${field} \u9996\u5c3e\u7a7a\u683c`);
      }
    }
  });
  addCleaned(report, document.id, cleaned);
}

function main() {
  const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const report = {
    dataFile,
    generatedAt: new Date().toISOString(),
    cleanedRecords: [],
    markedRecords: [],
  };

  if (!Array.isArray(data.quotes)) {
    data.quotes = [];
  }
  if (!Array.isArray(data.receptions)) {
    data.receptions = [];
  }
  if (!Array.isArray(data.documents)) {
    data.documents = [];
  }

  data.quotes.forEach((quote) => cleanupQuote(quote, report));
  data.receptions.forEach((reception) => cleanupReception(reception, report));
  data.documents.forEach((document) => cleanupDocument(document, report));

  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main();
