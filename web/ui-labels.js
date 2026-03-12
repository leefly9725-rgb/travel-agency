window.AppUi = {
  quoteItemTypeLabels: {
    hotel: "酒店",
    vehicle: "用车",
    guide: "导游",
    interpreter: "翻译",
    dining: "用餐",
    tickets: "门票",
    meeting: "会议",
    parking: "停车",
    misc: "其他",
  },
  vehicleDetailTypeLabels: {
    pickup: "接机",
    dropoff: "送机",
    full_day: "全天",
  },
  vehiclePricingUnitLabels: {
    trip: "趟",
    full_day: "全天",
  },
  serviceRoleLabels: {
    guide: "导游",
    interpreter: "商务翻译",
  },
  serviceLanguageLabels: {
    zh: "中文",
    "zh-sr": "中塞",
    "zh-en": "中英",
  },
  serviceDurationLabels: {
    full_day: "全天",
    hour: "小时",
  },
  receptionStatusLabels: {
    pending: "待处理",
    in_progress: "进行中",
    done: "已完成",
  },
  receptionTaskTypeLabels: {
    airport_pickup: "接机",
    hotel_checkin: "酒店入住",
    vehicle_service: "用车服务",
    guide_support: "导游协同",
    business_meeting: "商务会议",
    document_delivery: "文件交付",
    misc: "其他",
  },
  projectStatusLabels: {
    planning: "筹备中",
    confirmed: "已确认",
    running: "执行中",
    completed: "已完成",
  },
  documentPreviewTypeLabels: {
    quote_document: "报价单",
    itinerary: "行程单",
    airport_pickup_confirmation: "接机确认单",
    vehicle_service_confirmation: "用车确认单",
    guide_task_sheet: "导游任务单",
  },
  languageLabels: {
    "zh-CN": "中文",
    en: "英文",
    sr: "塞尔维亚语",
  },
  currencyLabels: {
    EUR: "欧元",
    RSD: "第纳尔",
    KM: "马克",
    ALL: "列克",
    RMB: "人民币",
  },
  getLabel(groupName, value) {
    const group = this[groupName] || {};
    return group[value] || value;
  },
  createOptions(groupName, values, selectedValue) {
    return values.map((value) => {
      const label = this.getLabel(groupName, value);
      const selected = value === selectedValue ? "selected" : "";
      return `<option value="${value}" ${selected}>${label}</option>`;
    }).join("");
  },
};


