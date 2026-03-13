/**
 * Seed suppliers and supplier items via the local API server.
 * Usage: node scripts/seed-suppliers.js
 * Requires the server to be running (npm start).
 */

const http = require("node:http");

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

async function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(raw);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || parsed.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Bad JSON: ${raw.slice(0, 80)}`));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── Seed data ──────────────────────────────────────────────────────────────

const SUPPLIERS = [
  {
    name: "Congress Rental l.t.d.",
    contact: "rental@congressrental.eu",
    notes: "",
    items: [
      { category: "av_equipment", nameZh: "音响系统", nameEn: "Sound System", unit: "套", costPrice: 2000, spec: "中型活动参考价" },
      { category: "av_equipment", nameZh: "LED墙8x3m", nameEn: "LED Wall 8x3m", unit: "套", costPrice: 0, spec: "含运输安装" },
      { category: "av_equipment", nameZh: "LED墙8x4m", nameEn: "LED Wall 8x4m", unit: "套", costPrice: 0, spec: "" },
      { category: "av_equipment", nameZh: "无线话筒", nameEn: "Wireless Mic", unit: "支", costPrice: 0, spec: "" },
      { category: "av_equipment", nameZh: "同传隔音舱", nameEn: "SI Booth", unit: "个", costPrice: 0, spec: "" },
      { category: "av_equipment", nameZh: "同传接收器", nameEn: "SI Receiver", unit: "套", costPrice: 0, spec: "按人数" },
      { category: "av_equipment", nameZh: "混合直播设备", nameEn: "Hybrid Streaming", unit: "套", costPrice: 0, spec: "" },
      { category: "furniture", nameZh: "单人沙发", nameEn: "Single Sofa", unit: "张", costPrice: 0, spec: "" },
      { category: "print_display", nameZh: "照片墙512x288cm", nameEn: "Photo Wall 512x288cm", unit: "套", costPrice: 670, spec: "" },
    ],
  },
  {
    name: "Watchout",
    contact: "",
    notes: "",
    items: [
      { category: "decoration", nameZh: "天然苔藓绿墙丛林组合", nameEn: "Natural Moss Wall Jungle", unit: "m²", costPrice: 590, spec: "" },
      { category: "decoration", nameZh: "苔藓地面", nameEn: "Moss Floor", unit: "m²", costPrice: 540, spec: "" },
      { category: "decoration", nameZh: "苔藓+植物组合", nameEn: "Moss+Plants Wall", unit: "m²", costPrice: 724, spec: "" },
      { category: "decoration", nameZh: "人工绿墙方案1", nameEn: "Artificial Green Wall Opt1", unit: "m²", costPrice: 227, spec: "" },
      { category: "decoration", nameZh: "人工绿墙方案2", nameEn: "Artificial Green Wall Opt2", unit: "m²", costPrice: 275, spec: "" },
      { category: "decoration", nameZh: "吊灯苔藓装饰", nameEn: "Chandelier Moss Decoration", unit: "个", costPrice: 256, spec: "" },
      { category: "decoration", nameZh: "运输费", nameEn: "Transport", unit: "次", costPrice: 100, spec: "" },
      { category: "av_equipment", nameZh: "LED大屏15x5m", nameEn: "LED Screen 15x5m", unit: "套", costPrice: 10000, spec: "3天" },
      { category: "stage_structure", nameZh: "舞台16x6m", nameEn: "Stage 16x6m", unit: "套", costPrice: 3000, spec: "" },
      { category: "stage_structure", nameZh: "讲台", nameEn: "Podium", unit: "个", costPrice: 200, spec: "" },
      { category: "av_equipment", nameZh: "同传耳机(三语)", nameEn: "SI Headset 3-lang", unit: "套", costPrice: 1500, spec: "300人" },
      { category: "furniture", nameZh: "会场桌椅", nameEn: "Venue Tables+Chairs", unit: "桌", costPrice: 10, spec: "每桌" },
      { category: "furniture", nameZh: "会场沙发", nameEn: "Venue Sofa", unit: "个", costPrice: 20, spec: "" },
      { category: "stage_structure", nameZh: "拱门6x4m", nameEn: "Arched Door", unit: "套", costPrice: 3000, spec: "" },
      { category: "decoration", nameZh: "礼炮彩纸", nameEn: "Confetti Sprayer", unit: "套", costPrice: 800, spec: "" },
      { category: "stage_structure", nameZh: "入口拱门+印刷", nameEn: "Entrance Portal+Print", unit: "套", costPrice: 1600, spec: "" },
      { category: "stage_structure", nameZh: "主舞台16x6x1m", nameEn: "Main Stage", unit: "套", costPrice: 9800, spec: "" },
      { category: "stage_structure", nameZh: "乐队舞台", nameEn: "Band Stage", unit: "套", costPrice: 2000, spec: "" },
      { category: "print_display", nameZh: "背景墙+印刷16x4m", nameEn: "Back Wall+Print", unit: "套", costPrice: 2560, spec: "" },
      { category: "furniture", nameZh: "VIP帐篷+家具", nameEn: "VIP Tent+Furniture", unit: "套", costPrice: 6400, spec: "" },
      { category: "decoration", nameZh: "走道红毯", nameEn: "Walkway Red Carpet", unit: "套", costPrice: 520, spec: "" },
      { category: "print_display", nameZh: "新闻墙6x3m", nameEn: "Press Wall", unit: "套", costPrice: 1500, spec: "" },
      { category: "stage_structure", nameZh: "音响系统", nameEn: "Sound System", unit: "套", costPrice: 3000, spec: "" },
      { category: "print_display", nameZh: "展示架8个", nameEn: "Display Stands x8", unit: "套", costPrice: 1500, spec: "" },
      { category: "decoration", nameZh: "红色彩带38条", nameEn: "Red Ribbons x38", unit: "套", costPrice: 6590, spec: "" },
      { category: "decoration", nameZh: "气球50个", nameEn: "Balloons x50", unit: "套", costPrice: 2830, spec: "" },
      { category: "decoration", nameZh: "礼炮彩纸2台", nameEn: "Confetti Blower x2", unit: "套", costPrice: 1300, spec: "" },
      { category: "print_display", nameZh: "Heras围栏印刷", nameEn: "Fence Prints", unit: "块", costPrice: 120, spec: "每块" },
      { category: "furniture", nameZh: "VIP绳栏", nameEn: "VIP Rope Poles", unit: "套", costPrice: 200, spec: "" },
      { category: "personnel", nameZh: "安保(至午夜)", nameEn: "Security", unit: "次", costPrice: 400, spec: "" },
      { category: "logistics", nameZh: "围栏213m", nameEn: "Frame Fence", unit: "套", costPrice: 7500, spec: "" },
      { category: "print_display", nameZh: "围栏印刷660m", nameEn: "Fence Printing", unit: "套", costPrice: 6000, spec: "" },
      { category: "logistics", nameZh: "红地毯1800m²", nameEn: "Red Carpet", unit: "套", costPrice: 1800, spec: "" },
      { category: "logistics", nameZh: "发电机", nameEn: "Generator", unit: "套", costPrice: 1500, spec: "" },
      { category: "logistics", nameZh: "卫生间VIP+普通", nameEn: "Toilets", unit: "套", costPrice: 350, spec: "" },
      { category: "personnel", nameZh: "礼仪+摄影", nameEn: "Hosts+Photographers", unit: "套", costPrice: 1500, spec: "" },
      { category: "personnel", nameZh: "主持人", nameEn: "Event Host", unit: "人", costPrice: 1500, spec: "" },
      { category: "management", nameZh: "代理费10%", nameEn: "Agency Fee 10%", unit: "式", costPrice: 0, spec: "按总价10%" },
      { category: "management", nameZh: "预制作费", nameEn: "Pre-production", unit: "项", costPrice: 600, spec: "" },
      { category: "management", nameZh: "设计+印前", nameEn: "Design+Prepress", unit: "套", costPrice: 1000, spec: "" },
      { category: "management", nameZh: "工作证制作", nameEn: "ID Cards", unit: "张", costPrice: 3, spec: "每张" },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`连接服务器 ${BASE}…`);

  let totalSuppliers = 0;
  let totalItems = 0;
  let errors = 0;

  for (const supplierData of SUPPLIERS) {
    const { items, ...supplierPayload } = supplierData;

    // Create supplier
    let supplier;
    try {
      supplier = await post("/api/suppliers", supplierPayload);
      console.log(`✓ 供应商：${supplier.name} (${supplier.id})`);
      totalSuppliers++;
    } catch (error) {
      console.error(`✗ 供应商「${supplierPayload.name}」创建失败：${error.message}`);
      errors++;
      continue;
    }

    // Create items
    for (const item of items) {
      try {
        await post("/api/supplier-items", { ...item, supplierId: supplier.id });
        process.stdout.write(".");
        totalItems++;
      } catch (error) {
        console.error(`\n  ✗ 物料「${item.nameZh}」失败：${error.message}`);
        errors++;
      }
    }
    console.log(` (${items.length} 条物料)`);
  }

  console.log(`\n完成：${totalSuppliers} 个供应商，${totalItems} 条物料，${errors} 个错误。`);
  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("脚本执行失败：", error.message);
  console.error("请确认服务器已启动（npm start）后重试。");
  process.exit(1);
});
