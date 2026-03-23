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
  supplierItemCategoryLabels: {
    av_equipment: "音视频设备",
    stage_structure: "舞台结构",
    print_display: "印刷展示",
    decoration: "装饰物料",
    furniture: "家具桌椅",
    personnel: "人员服务",
    logistics: "物流设备",
    management: "管理服务",
  },
  quoteStatusLabels: {
    draft:    '草稿',
    pending:  '待审批',
    approved: '已批准',
    rejected: '已拒绝',
  },
  executionStatusLabels: {
    preparing: '筹备中',
    executing: '执行中',
    completed: '已完成',
  },
  pricingModeLabels: {
    standard:      "标准差旅报价",
    project_based: "项目型报价",
  },
  // @deprecated 已迁移至数据库 quote_item_types 表，前端应调用 GET /api/quote-item-types 动态获取
  projectItemTypeLabels: {
    hotel:             "酒店",
    transport:         "用车",
    guide_translation: "导游/翻译",
    event_material:    "活动物料",
    print_display:     "印刷展示",
    av_equipment:      "音视频设备",
    decoration:        "装饰物料",
    misc:              "杂项",
  },
  // @deprecated 已迁移至数据库 project_group_types 表，前端应调用 GET /api/project-group-types 动态获取
  projectGroupTypeLabels: {
    travel: "旅游接待",
    event:  "活动服务",
    mixed:  "综合项目",
  },
  projectQuoteStatusLabels: {
    draft: "草稿",
    sent: "已发送",
    confirmed: "已确认",
    cancelled: "已取消",
  },
  projectQuoteStatusColors: {
    draft: "status-draft",
    sent: "status-sent",
    confirmed: "status-confirmed",
    cancelled: "status-cancelled",
  },
  supplierItemCategoryIcons: {
    av_equipment: "🔊",
    stage_structure: "🏗️",
    print_display: "🖼️",
    decoration: "🌿",
    furniture: "🪑",
    personnel: "👥",
    logistics: "🚛",
    management: "📋",
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


