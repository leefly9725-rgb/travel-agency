const supportedDocumentPreviewTypes = [
  "quote_document",
  "itinerary",
  "airport_pickup_confirmation",
  "vehicle_service_confirmation",
  "guide_task_sheet",
];

function formatLine(label, value) {
  return { label, value: value == null || value === "" ? "-" : String(value) };
}

function buildDocumentPreviews({ quote, reception }) {
  if (!quote) {
    throw new Error("报价不存在。");
  }

  const receptionItem = reception || null;
  const itemNames = quote.items.map((item) => `${item.name} x ${item.quantity}`).join("，");
  const dateRange = `${quote.startDate} ~ ${quote.endDate}`;

  return supportedDocumentPreviewTypes.map((type) => {
    if (type === "quote_document") {
      return {
        type,
        title: "报价单源数据预览",
        sections: [
          {
            title: "基础信息",
            rows: [
              formatLine("报价单号", quote.quoteNumber),
              formatLine("客户名称", quote.clientName),
              formatLine("项目名称", quote.projectName),
              formatLine("行程日期", dateRange),
              formatLine("主要目的地", quote.destination),
            ],
          },
          {
            title: "财务摘要",
            rows: [
              formatLine("报价币种", quote.currency),
              formatLine("成本合计", `${quote.currency} ${quote.totalCost}`),
              formatLine("售价合计", `${quote.currency} ${quote.totalPrice}`),
              formatLine("毛利", `${quote.currency} ${quote.grossProfit}`),
            ],
          },
        ],
      };
    }

    if (type === "itinerary") {
      return {
        type,
        title: "行程单源数据预览",
        sections: [
          {
            title: "行程信息",
            rows: [
              formatLine("项目名称", quote.projectName),
              formatLine("行程日期", dateRange),
              formatLine("行程天数", `${quote.travelDays} 天`),
              formatLine("主要服务", itemNames),
              formatLine("备注", quote.notes),
            ],
          },
        ],
      };
    }

    if (type === "airport_pickup_confirmation") {
      return {
        type,
        title: "接机确认单源数据预览",
        sections: [
          {
            title: "接机任务",
            rows: [
              formatLine("接待任务", receptionItem ? receptionItem.title : "-"),
              formatLine("负责人", receptionItem ? receptionItem.assignee : "-"),
              formatLine("到场时间", receptionItem ? receptionItem.dueTime : "-"),
              formatLine("地点", receptionItem ? receptionItem.location : "-"),
            ],
          },
        ],
      };
    }

    if (type === "vehicle_service_confirmation") {
      return {
        type,
        title: "用车确认单源数据预览",
        sections: [
          {
            title: "车辆服务",
            rows: [
              formatLine("客户", quote.clientName),
              formatLine("服务项目", quote.items.filter((item) => item.type === "vehicle").map((item) => item.name).join("，") || "-"),
              formatLine("服务日期", dateRange),
              formatLine("地点", receptionItem ? receptionItem.location : quote.destination),
            ],
          },
        ],
      };
    }

    return {
      type,
      title: "导游任务单源数据预览",
      sections: [
        {
          title: "导游任务",
          rows: [
            formatLine("客户", quote.clientName),
            formatLine("项目", quote.projectName),
            formatLine("服务日期", dateRange),
            formatLine("导游服务", quote.items.filter((item) => item.type === "guide").map((item) => item.name).join("，") || "-"),
            formatLine("接待备注", receptionItem ? receptionItem.notes : quote.notes),
          ],
        },
      ],
    };
  });
}

module.exports = {
  buildDocumentPreviews,
  supportedDocumentPreviewTypes,
};
