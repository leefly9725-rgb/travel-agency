const defaultQuoteTemplates = [
  {
    id: "TPL-business-reception",
    name: "商务接待基础模板",
    description: "适合商务拜访、客户接待、短期差旅行程。",
    isBuiltIn: true,
    items: [
      { type: "hotel", name: "商务酒店标准间", unit: "间夜", currency: "EUR", quantity: 2, notes: "含早餐，可按实际入住晚数调整" },
      { type: "vehicle", name: "市内商务用车", unit: "天", currency: "EUR", quantity: 1, notes: "含司机与基础油费" },
      { type: "guide", name: "中文接待协助", unit: "天", currency: "EUR", quantity: 1, notes: "协助现场沟通与陪同" },
      { type: "dining", name: "商务工作餐", unit: "人", currency: "RSD", quantity: 2, notes: "可根据人数调整标准" },
      { type: "meeting", name: "会议接待安排", unit: "场", currency: "EUR", quantity: 1, notes: "含会议现场协调" },
    ],
  },
  {
    id: "TPL-premium-custom",
    name: "高端定制游基础模板",
    description: "适合高端自由行、VIP 接待和定制路线。",
    isBuiltIn: true,
    items: [
      { type: "hotel", name: "高端酒店豪华房", unit: "间夜", currency: "EUR", quantity: 3, notes: "可按星级和房型调整" },
      { type: "vehicle", name: "专属包车服务", unit: "天", currency: "EUR", quantity: 3, notes: "含司机与中文客服协调" },
      { type: "guide", name: "中文导游服务", unit: "天", currency: "EUR", quantity: 2, notes: "可升级为私人定制导览" },
      { type: "tickets", name: "核心景点门票", unit: "人", currency: "RSD", quantity: 2, notes: "按实际景点组合调整" },
      { type: "dining", name: "特色餐饮安排", unit: "餐", currency: "RSD", quantity: 2, notes: "可加入欢迎晚宴或特色餐厅" },
      { type: "misc", name: "定制服务费", unit: "项", currency: "EUR", quantity: 1, notes: "用于礼宾、行程设计等综合服务" },
    ],
  },
  {
    id: "TPL-exhibition-reception",
    name: "会展接待基础模板",
    description: "适合展会、论坛、商务活动接待场景。",
    isBuiltIn: true,
    items: [
      { type: "hotel", name: "会展期间酒店住宿", unit: "间夜", currency: "EUR", quantity: 3, notes: "建议靠近展馆或会场" },
      { type: "vehicle", name: "展会接送用车", unit: "趟", currency: "EUR", quantity: 4, notes: "含酒店与展馆往返" },
      { type: "interpreter", name: "商务翻译支持", unit: "天", currency: "EUR", quantity: 2, notes: "可根据语种增加人数" },
      { type: "meeting", name: "展会会议协助", unit: "场", currency: "EUR", quantity: 1, notes: "含现场签到与联络协助" },
      { type: "dining", name: "参展工作餐", unit: "人", currency: "RSD", quantity: 4, notes: "可拆分午餐与晚餐" },
      { type: "parking", name: "展馆停车安排", unit: "天", currency: "RSD", quantity: 2, notes: "按实际车辆数量调整" },
    ],
  },
  {
    id: "TPL-airport-transfer",
    name: "接送机基础模板",
    description: "适合单次或往返机场接送安排。",
    isBuiltIn: true,
    items: [
      { type: "vehicle", name: "机场接机", unit: "趟", currency: "EUR", quantity: 1, notes: "含航班落地等待" },
      { type: "vehicle", name: "机场送机", unit: "趟", currency: "EUR", quantity: 1, notes: "可按返程时间调整" },
      { type: "guide", name: "接机举牌协助", unit: "趟", currency: "EUR", quantity: 1, notes: "适合团队或 VIP 客户" },
      { type: "parking", name: "机场停车费", unit: "次", currency: "RSD", quantity: 1, notes: "按实际停车时长结算" },
    ],
  },
  {
    id: "TPL-blank",
    name: "空白模板",
    description: "不预填任何报价项目，适合完全手动录入。",
    isBuiltIn: true,
    items: [],
  },
];

module.exports = {
  defaultQuoteTemplates,
};
