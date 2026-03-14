/**
 * import-supplier-catalog.js
 * Idempotent script to seed supplier and catalog item data into data/seed.json.
 * Run: node scripts/import-supplier-catalog.js
 */

const fs = require("node:fs");
const path = require("node:path");

const SEED_PATH = path.join(__dirname, "../data/seed.json");

const SUPPLIERS = [
  {
    id: "SUP-1001",
    name: "Congress Rental l.t.d.",
    contact: "Miloš Jovanović",
    phone: "+381 11 3456789",
    email: "info@congressrental.rs",
    notes: "贝尔格莱德本地专业活动设备租赁商，主营音视频、舞台及家具。",
    isActive: true,
  },
  {
    id: "SUP-1002",
    name: "Watchout",
    contact: "Ana Petrović",
    phone: "+381 11 2987654",
    email: "production@watchout.rs",
    notes: "专业舞台结构与多媒体展示解决方案供应商。",
    isActive: true,
  },
  {
    id: "SUP-1003",
    name: "Agency C1 Intelligence",
    contact: "Stefan Nikolić",
    phone: "+381 63 8123456",
    email: "events@c1intelligence.rs",
    notes: "活动策划与人员服务机构，提供礼仪、翻译、物流等综合服务。",
    isActive: true,
  },
];

const SUPPLIER_ITEMS = [
  // Congress Rental – av_equipment
  { id: "SI-1001", supplierId: "SUP-1001", category: "av_equipment",   nameZh: "LED屏 8×3m",          nameEn: "LED Wall 8x3m",                  spec: "P3.9室内，含框架",         unit: "套",   costPrice: 2400, notes: "", isActive: true },
  { id: "SI-1002", supplierId: "SUP-1001", category: "av_equipment",   nameZh: "LED屏 4×3m",          nameEn: "LED Wall 4x3m",                  spec: "P3.9室内，含框架",         unit: "套",   costPrice: 1400, notes: "", isActive: true },
  { id: "SI-1003", supplierId: "SUP-1001", category: "av_equipment",   nameZh: "专业投影仪 15000流明", nameEn: "Projector 15000lm",              spec: "含镜头及安装支架",         unit: "台",   costPrice:  950, notes: "", isActive: true },
  { id: "SI-1004", supplierId: "SUP-1001", category: "av_equipment",   nameZh: "线阵音响系统",        nameEn: "Line Array PA System",           spec: "左右各4只，含调音台",      unit: "套",   costPrice: 1800, notes: "", isActive: true },
  { id: "SI-1005", supplierId: "SUP-1001", category: "av_equipment",   nameZh: "无线麦克风",          nameEn: "Wireless Microphone",            spec: "手持，含接收机",           unit: "支",   costPrice:  120, notes: "", isActive: true },
  { id: "SI-1006", supplierId: "SUP-1001", category: "av_equipment",   nameZh: "同声传译系统",        nameEn: "Simultaneous Interpretation System", spec: "含4频道，50副耳机",    unit: "套",   costPrice: 1200, notes: "", isActive: true },
  { id: "SI-1015", supplierId: "SUP-1001", category: "av_equipment",   nameZh: "舞台灯光套装",        nameEn: "Stage Lighting Package",         spec: "含摇头灯×8、帕灯×16",    unit: "套",   costPrice: 2800, notes: "", isActive: true },
  { id: "SI-1016", supplierId: "SUP-1001", category: "av_equipment",   nameZh: "视频导播系统",        nameEn: "Video Switcher System",          spec: "4路输入，含监视器",        unit: "套",   costPrice:  650, notes: "", isActive: true },
  // Congress Rental – stage_structure
  { id: "SI-1007", supplierId: "SUP-1001", category: "stage_structure",nameZh: "主舞台 12×8m",        nameEn: "Main Stage 12x8m",               spec: "铝合金桁架，高80cm",       unit: "套",   costPrice: 3500, notes: "", isActive: true },
  { id: "SI-1008", supplierId: "SUP-1001", category: "stage_structure",nameZh: "主舞台 8×6m",         nameEn: "Main Stage 8x6m",                spec: "铝合金桁架，高60cm",       unit: "套",   costPrice: 2200, notes: "", isActive: true },
  { id: "SI-1009", supplierId: "SUP-1001", category: "stage_structure",nameZh: "演讲台",              nameEn: "Podium",                         spec: "含LOGO贴膜位",             unit: "个",   costPrice:  180, notes: "", isActive: true },
  { id: "SI-1010", supplierId: "SUP-1001", category: "stage_structure",nameZh: "灯光架 truss 6m",     nameEn: "Lighting Truss 6m",              spec: "铝合金，承重300kg",        unit: "套",   costPrice:  420, notes: "", isActive: true },
  // Congress Rental – furniture
  { id: "SI-1011", supplierId: "SUP-1001", category: "furniture",      nameZh: "圆桌 φ180cm",         nameEn: "Round Table 180cm",              spec: "折叠式，含桌布",           unit: "张",   costPrice:   45, notes: "", isActive: true },
  { id: "SI-1012", supplierId: "SUP-1001", category: "furniture",      nameZh: "宴会椅",              nameEn: "Banquet Chair",                  spec: "白色椅套",                 unit: "把",   costPrice:    8, notes: "", isActive: true },
  { id: "SI-1013", supplierId: "SUP-1001", category: "furniture",      nameZh: "高脚鸡尾酒桌",       nameEn: "Cocktail Table",                 spec: "含桌布",                   unit: "张",   costPrice:   35, notes: "", isActive: true },
  { id: "SI-1014", supplierId: "SUP-1001", category: "furniture",      nameZh: "VIP休息区沙发组合",   nameEn: "VIP Lounge Sofa Set",            spec: "3人沙发+茶几",             unit: "套",   costPrice:  280, notes: "", isActive: true },
  // Congress Rental – logistics
  { id: "SI-1017", supplierId: "SUP-1001", category: "logistics",      nameZh: "设备运输（市内）",    nameEn: "Local Equipment Transport",      spec: "含装卸，5吨厢货",          unit: "次",   costPrice:  350, notes: "", isActive: true },
  { id: "SI-1018", supplierId: "SUP-1001", category: "logistics",      nameZh: "设备安装调试",        nameEn: "Equipment Setup & Testing",      spec: "全套安装，含工程师",       unit: "天",   costPrice:  600, notes: "", isActive: true },
  // Watchout – stage_structure
  { id: "SI-2001", supplierId: "SUP-1002", category: "stage_structure",nameZh: "背景板 6×3m",         nameEn: "Backdrop 6x3m",                  spec: "铝合金框架+喷绘",          unit: "套",   costPrice:  580, notes: "", isActive: true },
  { id: "SI-2002", supplierId: "SUP-1002", category: "stage_structure",nameZh: "背景板 4×2.5m",       nameEn: "Backdrop 4x2.5m",                spec: "铝合金框架+喷绘",          unit: "套",   costPrice:  380, notes: "", isActive: true },
  // Watchout – print_display
  { id: "SI-2003", supplierId: "SUP-1002", category: "print_display",  nameZh: "X展架",               nameEn: "X Banner Stand",                 spec: "含画面印刷",               unit: "个",   costPrice:   25, notes: "", isActive: true },
  { id: "SI-2004", supplierId: "SUP-1002", category: "print_display",  nameZh: "易拉宝 80×200cm",     nameEn: "Roll-up Banner 80x200cm",        spec: "含画面印刷",               unit: "个",   costPrice:   45, notes: "", isActive: true },
  { id: "SI-2005", supplierId: "SUP-1002", category: "print_display",  nameZh: "桌卡（双面印刷）",    nameEn: "Table Card Double-sided",        spec: "A4折叠，铜版纸",           unit: "张",   costPrice:  1.5, notes: "最低起订100张", isActive: true },
  { id: "SI-2006", supplierId: "SUP-1002", category: "print_display",  nameZh: "会议指引牌",          nameEn: "Directional Sign",               spec: "A3铝框，双面",             unit: "个",   costPrice:   55, notes: "", isActive: true },
  { id: "SI-2007", supplierId: "SUP-1002", category: "print_display",  nameZh: "活动手册（A5彩色）",  nameEn: "Event Booklet A5",               spec: "16页，哑膜覆膜",           unit: "本",   costPrice:  3.5, notes: "最低起订50本", isActive: true },
  // Watchout – av_equipment
  { id: "SI-2008", supplierId: "SUP-1002", category: "av_equipment",   nameZh: "多媒体控制台",        nameEn: "Multimedia Control Station",     spec: "含笔记本+遥控切换",       unit: "套",   costPrice:  380, notes: "", isActive: true },
  // Watchout – decoration
  { id: "SI-2009", supplierId: "SUP-1002", category: "decoration",     nameZh: "开幕式气球拱门",      nameEn: "Balloon Arch",                   spec: "3m高，双色定制",           unit: "套",   costPrice:  220, notes: "", isActive: true },
  { id: "SI-2010", supplierId: "SUP-1002", category: "decoration",     nameZh: "鲜花台花",            nameEn: "Floral Centerpiece",             spec: "φ40cm，当季鲜花",         unit: "个",   costPrice:   65, notes: "", isActive: true },
  // Agency C1 – personnel
  { id: "SI-3001", supplierId: "SUP-1003", category: "personnel",      nameZh: "礼仪接待（全天）",    nameEn: "Hostess Full Day",               spec: "含培训，8小时",            unit: "人天", costPrice:  120, notes: "", isActive: true },
  { id: "SI-3002", supplierId: "SUP-1003", category: "personnel",      nameZh: "礼仪接待（半天）",    nameEn: "Hostess Half Day",               spec: "含培训，4小时",            unit: "人次", costPrice:   70, notes: "", isActive: true },
  { id: "SI-3003", supplierId: "SUP-1003", category: "personnel",      nameZh: "现场协调员",          nameEn: "On-site Coordinator",           spec: "全天，含对讲机",           unit: "人天", costPrice:  180, notes: "", isActive: true },
  { id: "SI-3004", supplierId: "SUP-1003", category: "personnel",      nameZh: "中塞同声传译员",      nameEn: "ZH-SR Interpreter",             spec: "同传或交传，全天",         unit: "人天", costPrice:  350, notes: "", isActive: true },
  { id: "SI-3005", supplierId: "SUP-1003", category: "personnel",      nameZh: "中英同声传译员",      nameEn: "ZH-EN Interpreter",             spec: "同传或交传，全天",         unit: "人天", costPrice:  380, notes: "", isActive: true },
  { id: "SI-3006", supplierId: "SUP-1003", category: "personnel",      nameZh: "摄影师",              nameEn: "Photographer",                  spec: "专业单反，含后期",         unit: "人天", costPrice:  250, notes: "", isActive: true },
  { id: "SI-3007", supplierId: "SUP-1003", category: "personnel",      nameZh: "摄像师",              nameEn: "Videographer",                  spec: "4K拍摄，含剪辑",           unit: "人天", costPrice:  320, notes: "", isActive: true },
  { id: "SI-3008", supplierId: "SUP-1003", category: "personnel",      nameZh: "安保人员",            nameEn: "Security Personnel",            spec: "持证，8小时",              unit: "人天", costPrice:   90, notes: "", isActive: true },
  // Agency C1 – management
  { id: "SI-3009", supplierId: "SUP-1003", category: "management",     nameZh: "活动项目管理费",      nameEn: "Event Management Fee",          spec: "全程统筹协调",             unit: "项",   costPrice: 1500, notes: "", isActive: true },
  { id: "SI-3010", supplierId: "SUP-1003", category: "management",     nameZh: "场地踩点与预勘",      nameEn: "Venue Inspection",              spec: "含报告",                   unit: "次",   costPrice:  300, notes: "", isActive: true },
  { id: "SI-3018", supplierId: "SUP-1003", category: "management",     nameZh: "紧急备勤费（半天）",  nameEn: "Emergency Standby Half Day",    spec: "协调员+司机",              unit: "次",   costPrice:  250, notes: "", isActive: true },
  // Agency C1 – logistics
  { id: "SI-3011", supplierId: "SUP-1003", category: "logistics",      nameZh: "嘉宾接送（轿车）",    nameEn: "VIP Transfer Sedan",            spec: "市内，含司机，4小时",      unit: "次",   costPrice:   85, notes: "", isActive: true },
  { id: "SI-3012", supplierId: "SUP-1003", category: "logistics",      nameZh: "团体大巴（49座）",    nameEn: "Coach Bus 49-seat",             spec: "全天包车，含司机",         unit: "天",   costPrice:  420, notes: "", isActive: true },
  { id: "SI-3013", supplierId: "SUP-1003", category: "logistics",      nameZh: "物料打包运输",        nameEn: "Material Packing & Transport",  spec: "含打包材料",               unit: "次",   costPrice:  200, notes: "", isActive: true },
  // Agency C1 – decoration / print
  { id: "SI-3014", supplierId: "SUP-1003", category: "decoration",     nameZh: "签到背景墙（含设计）",nameEn: "Check-in Backdrop with Design", spec: "4×2.5m，喷绘+框架",       unit: "套",   costPrice:  650, notes: "", isActive: true },
  { id: "SI-3015", supplierId: "SUP-1003", category: "decoration",     nameZh: "指引牌系统",          nameEn: "Wayfinding Sign System",        spec: "10块，含支架",             unit: "套",   costPrice:  480, notes: "", isActive: true },
  { id: "SI-3016", supplierId: "SUP-1003", category: "print_display",  nameZh: "嘉宾胸牌（有绳）",    nameEn: "Name Badge with Lanyard",       spec: "双面印刷，防水",           unit: "个",   costPrice:    4, notes: "", isActive: true },
  { id: "SI-3017", supplierId: "SUP-1003", category: "print_display",  nameZh: "会议资料袋",          nameEn: "Conference Tote Bag",           spec: "无纺布，含LOGO印刷",       unit: "个",   costPrice:    6, notes: "", isActive: true },
];

function run() {
  const raw = fs.readFileSync(SEED_PATH, "utf-8");
  const data = JSON.parse(raw);

  let suppliersAdded = 0;
  let itemsAdded = 0;

  if (!Array.isArray(data.suppliers)) data.suppliers = [];
  if (!Array.isArray(data.supplierItems)) data.supplierItems = [];

  for (const sup of SUPPLIERS) {
    if (!data.suppliers.find((s) => s.id === sup.id)) {
      data.suppliers.push(sup);
      suppliersAdded++;
    }
  }

  for (const item of SUPPLIER_ITEMS) {
    if (!data.supplierItems.find((i) => i.id === item.id)) {
      data.supplierItems.push(item);
      itemsAdded++;
    }
  }

  fs.writeFileSync(SEED_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log(`Done. Suppliers added: ${suppliersAdded}, Items added: ${itemsAdded}`);
}

run();
