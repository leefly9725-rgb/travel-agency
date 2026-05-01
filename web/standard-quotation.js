(function () {
  "use strict";

  var params   = new URLSearchParams(window.location.search);
  var QUOTE_ID = params.get("id");
  var lang     = params.get("lang")      || "bi";
  var taxMode  = params.get("taxMode")   || "included";
  var showTerms = params.get("showTerms") !== "0";

  // ── Label maps ────────────────────────────────────────────────────────────
  var ZH = {
    company: "泷鼎晟国际旅行社",
    docTitle: "客户报价书",
    quoteNo: "报价编号",
    issueDate: "出单日期",
    client: "客户",
    contact: "联系人",
    project: "项目名称",
    destination: "目的地",
    dates: "行程日期",
    pax: "出行人数",
    currency: "报价币种",
    sectionItems: "报价明细",
    colNo: "序",
    colType: "类型",
    colName: "服务名称",
    colQty: "数量",
    colUnit: "单位",
    colPrice: "单价",
    colSubtotal: "小计",
    colNotes: "备注",
    netAmount: "未税金额",
    vatLabel: "增值税 (20%)",
    totalIncl: "含税总价",
    totalExcl: "报价小计",
    vatInclNote: "以上报价已含增值税（VAT 20%）。",
    vatRefNote: "报价默认不含 VAT，最终税务以合同/发票为准。",
    sectionTerms: "商务条款",
    noItems: "暂无报价项目。",
    notes: "备注",
  };
  var EN = {
    company: "LDS International Travel",
    docTitle: "CLIENT QUOTATION",
    quoteNo: "Quote No.",
    issueDate: "Issue Date",
    client: "Client",
    contact: "Contact",
    project: "Project",
    destination: "Destination",
    dates: "Travel Dates",
    pax: "Pax",
    currency: "Currency",
    sectionItems: "Quotation Details",
    colNo: "No.",
    colType: "Type",
    colName: "Service",
    colQty: "Qty",
    colUnit: "Unit",
    colPrice: "Unit Price",
    colSubtotal: "Subtotal",
    colNotes: "Notes",
    netAmount: "Net Amount",
    vatLabel: "VAT (20%)",
    totalIncl: "Total (incl. VAT)",
    totalExcl: "Subtotal",
    vatInclNote: "VAT (20%) is included in the above price.",
    vatRefNote: "Prices are exclusive of VAT. Final tax per contract or invoice.",
    sectionTerms: "Business Terms",
    noItems: "No items.",
    notes: "Notes",
  };

  var TERMS_ZH = [
    "报价有效期为报价日期起 30 天。",
    "报价以实际确认服务内容为准。",
    "未列明项目不包含在本报价内。",
    "如因客户变更行程、人数、时间导致成本变化，报价需相应调整。",
    "付款方式以双方最终确认合同或订单为准。",
  ];
  var TERMS_EN = [
    "This quotation is valid for 30 days from the date of issue.",
    "The quotation is subject to final confirmation of services.",
    "Items not listed herein are not included in this quotation.",
    "If the client changes the itinerary, group size, or dates, the quotation may be revised accordingly.",
    "Payment terms are subject to the final signed contract or order.",
  ];

  var ITEM_TYPE_ZH = { hotel: "酒店住宿", vehicle: "用车", guide: "导游", interpreter: "翻译", dining: "餐饮", tickets: "门票", meeting: "会议", parking: "停车", misc: "其他" };
  var ITEM_TYPE_EN = { hotel: "Hotel", vehicle: "Vehicle", guide: "Guide", interpreter: "Interpreter", dining: "Dining", tickets: "Tickets", meeting: "Meeting", parking: "Parking", misc: "Misc." };
  var SVC_ROLE_ZH = { guide: "导游", interpreter: "商务翻译" };
  var SVC_ROLE_EN = { guide: "Guide", interpreter: "Interpreter" };
  var SVC_LANG_ZH = { zh: "中文", "zh-sr": "中塞", "zh-en": "中英" };
  var SVC_LANG_EN = { zh: "Chinese", "zh-sr": "CN-SR", "zh-en": "CN-EN" };
  var SVC_DUR_ZH  = { full_day: "全天", hour: "小时" };
  var SVC_DUR_EN  = { full_day: "Full day", hour: "Hour(s)" };
  var VEH_UNIT_ZH = { trip: "趟", full_day: "全天" };
  var VEH_UNIT_EN = { trip: "trip", full_day: "full day" };

  // ── Label helpers ─────────────────────────────────────────────────────────
  function L(key) {
    if (lang === "en") return EN[key] || ZH[key] || key;
    if (lang === "zh") return ZH[key] || key;
    var z = ZH[key] || "", e = EN[key] || "";
    if (z && e && z !== e) return z + " / " + e;
    return z || e || key;
  }

  function typeLabel(type) {
    var z = ITEM_TYPE_ZH[type] || type, e = ITEM_TYPE_EN[type] || type;
    if (lang === "zh") return z;
    if (lang === "en") return e;
    return z + " / " + e;
  }

  function paxSuffix() {
    if (lang === "en") return " pax";
    if (lang === "zh") return " 人";
    return " 人 / pax";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmt(v, c) { return window.AppUtils.formatCurrency(v, c); }

  // ── Detail-row expansion renderers ────────────────────────────────────────
  function hotelExpansion(item, cur) {
    var details = item.hotelDetails || item.hotel_details;
    if (!details || !details.length) return "";
    return details.map(function (d) {
      var rooms = d.roomCount || d.room_count || 0;
      var nights = d.nights || 0;
      var sub = d.priceSubtotal != null ? d.priceSubtotal : (d.priceSubtotalOriginal || 0);
      var nightly = (rooms > 0 && nights > 0) ? sub / rooms / nights : 0;
      var roomLabel = lang === "en" ? "rms" : lang === "zh" ? "间" : "间";
      var nightLabel = lang === "en" ? "nts" : lang === "zh" ? "晚" : "晚";
      return "<tr class=\"sq-sub-row\">"
        + "<td></td><td></td>"
        + "<td style=\"padding:5px 8px 5px 24px;font-size:10.5px;color:#555;font-style:italic\">" + esc(d.roomType || d.room_type || "—") + "</td>"
        + "<td style=\"text-align:center;font-size:10.5px;padding:5px 8px\">" + rooms + " " + roomLabel + "</td>"
        + "<td style=\"text-align:center;font-size:10.5px;padding:5px 8px\">" + nights + " " + nightLabel + "</td>"
        + "<td style=\"text-align:right;font-size:10.5px;color:#555;padding:5px 8px\">" + fmt(nightly, cur) + "</td>"
        + "<td style=\"text-align:right;font-size:10.5px;font-weight:600;padding:5px 8px\">" + fmt(sub, cur) + "</td>"
        + "<td style=\"font-size:9.5px;color:#888;padding:5px 8px\">" + esc(d.notes || "") + "</td>"
        + "</tr>";
    }).join("");
  }

  function vehicleExpansion(item, cur) {
    var details = item.vehicleDetails || item.vehicle_details;
    if (!details || !details.length) return "";
    return details.map(function (d) {
      var sub = d.priceSubtotal != null ? d.priceSubtotal : (d.priceSubtotalOriginal || 0);
      var model = d.vehicleModel || d.vehicle_model || "—";
      var count = d.vehicleCount || d.vehicle_count || 1;
      var bq = d.billingQuantity || 1;
      var pu = lang === "en" ? (VEH_UNIT_EN[d.pricingUnit] || d.pricingUnit || "") : (VEH_UNIT_ZH[d.pricingUnit] || d.pricingUnit || "");
      var vLabel = lang === "en" ? "veh." : lang === "zh" ? "辆" : "辆";
      return "<tr class=\"sq-sub-row\">"
        + "<td></td><td></td>"
        + "<td style=\"padding:5px 8px 5px 24px;font-size:10.5px;color:#555;font-style:italic\">" + esc(model) + "</td>"
        + "<td style=\"text-align:center;font-size:10.5px;padding:5px 8px\">" + count + " " + vLabel + "</td>"
        + "<td style=\"text-align:center;font-size:10.5px;padding:5px 8px\">" + bq + " " + esc(pu) + "</td>"
        + "<td></td>"
        + "<td style=\"text-align:right;font-size:10.5px;font-weight:600;padding:5px 8px\">" + fmt(sub, cur) + "</td>"
        + "<td style=\"font-size:9.5px;color:#888;padding:5px 8px\">" + esc(d.notes || "") + "</td>"
        + "</tr>";
    }).join("");
  }

  function serviceExpansion(item, cur) {
    var details = item.serviceDetails || item.service_details;
    if (!details || !details.length) return "";
    return details.map(function (d) {
      var sub = d.priceSubtotal != null ? d.priceSubtotal : (d.priceSubtotalOriginal || 0);
      var role = lang === "en" ? (SVC_ROLE_EN[d.serviceRole] || d.serviceRole || "") : (SVC_ROLE_ZH[d.serviceRole] || d.serviceRole || "");
      var sl   = lang === "en" ? (SVC_LANG_EN[d.serviceLanguage] || d.serviceLanguage || "") : (SVC_LANG_ZH[d.serviceLanguage] || d.serviceLanguage || "");
      var dur  = lang === "en" ? (SVC_DUR_EN[d.serviceDuration]  || d.serviceDuration  || "") : (SVC_DUR_ZH[d.serviceDuration]  || d.serviceDuration  || "");
      var qty  = d.quantity || 1;
      return "<tr class=\"sq-sub-row\">"
        + "<td></td><td></td>"
        + "<td style=\"padding:5px 8px 5px 24px;font-size:10.5px;color:#555;font-style:italic\">" + esc(role) + " / " + esc(sl) + "</td>"
        + "<td style=\"text-align:center;font-size:10.5px;padding:5px 8px\">" + qty + "</td>"
        + "<td style=\"text-align:center;font-size:10.5px;padding:5px 8px\">" + esc(dur) + "</td>"
        + "<td></td>"
        + "<td style=\"text-align:right;font-size:10.5px;font-weight:600;padding:5px 8px\">" + fmt(sub, cur) + "</td>"
        + "<td style=\"font-size:9.5px;color:#888;padding:5px 8px\">" + esc(d.notes || "") + "</td>"
        + "</tr>";
    }).join("");
  }

  function mealExpansion(item, cur) {
    var md = item.mealDetails || item.meal_details;
    if (!md) return "";
    var total = md.totalAmount != null ? md.totalAmount : (md.total_amount || 0);
    var ppl   = md.mealPeople || md.meal_people;
    var desc  = ppl ? paxSuffix().replace(" ", ppl + " ") : "";
    var diningLabel = lang === "en" ? "Dining total" : lang === "zh" ? "餐饮合计" : "餐饮合计 / Dining total";
    return "<tr class=\"sq-sub-row\">"
      + "<td></td><td></td>"
      + "<td colspan=\"3\" style=\"padding:5px 8px 5px 24px;font-size:10.5px;color:#555;font-style:italic\">" + diningLabel + (desc ? " · " + esc(desc) : "") + "</td>"
      + "<td></td>"
      + "<td style=\"text-align:right;font-size:10.5px;font-weight:600;padding:5px 8px\">" + fmt(total, cur) + "</td>"
      + "<td></td>"
      + "</tr>";
  }

  // ── Items table ───────────────────────────────────────────────────────────
  function renderItemsTable(items, cur) {
    if (!items || !items.length) {
      return "<p style=\"padding:12px 0;color:#888;font-style:italic;font-size:12px\">" + L("noItems") + "</p>";
    }

    var TH  = "padding:7px 8px;text-align:left;background:#1e3352;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:0.04em;white-space:nowrap";
    var THR = TH + ";text-align:right";
    var THC = TH + ";text-align:center";

    var header = "<tr>"
      + "<th style=\"" + TH  + ";width:26px\">" + L("colNo")       + "</th>"
      + "<th style=\"" + TH  + ";width:78px\">" + L("colType")     + "</th>"
      + "<th style=\"" + TH  + "\">"             + L("colName")     + "</th>"
      + "<th style=\"" + THC + ";width:44px\">" + L("colQty")      + "</th>"
      + "<th style=\"" + THC + ";width:48px\">" + L("colUnit")     + "</th>"
      + "<th style=\"" + THR + ";width:86px\">" + L("colPrice")    + "</th>"
      + "<th style=\"" + THR + ";width:86px\">" + L("colSubtotal") + "</th>"
      + "<th style=\"" + TH  + ";width:80px\">" + L("colNotes")    + "</th>"
      + "</tr>";

    var rows = items.map(function (item, idx) {
      var type    = item.type     || item.itemType  || "misc";
      var name    = item.name     || item.itemName  || "";
      var qty     = item.quantity || 1;
      var unit    = item.unit     || "";
      var price   = item.price    || item.salesUnitPrice || 0;
      var sub     = item.totalPrice != null ? item.totalPrice : price * qty;
      var notes   = item.notes    || "";

      var hasHotel   = type === "hotel"                                    && (item.hotelDetails   || item.hotel_details   || []).length > 0;
      var hasVehicle = type === "vehicle"                                  && (item.vehicleDetails || item.vehicle_details || []).length > 0;
      var hasService = (type === "guide" || type === "interpreter")        && (item.serviceDetails || item.service_details || []).length > 0;
      var hasMeal    = type === "dining"                                   && !!(item.mealDetails  || item.meal_details);
      var hasExp     = hasHotel || hasVehicle || hasService || hasMeal;

      var bg  = idx % 2 === 0 ? "#fafbfc" : "#fff";
      var TD  = "padding:7px 8px;border-bottom:1px solid #e8ecf0;vertical-align:top;font-size:11px;background:" + bg;
      var TDR = TD + ";text-align:right";
      var TDC = TD + ";text-align:center";

      var mainRow = "<tr>"
        + "<td style=\"" + TDC + ";color:#999;font-size:10px\">" + (idx + 1) + "</td>"
        + "<td style=\"" + TD  + ";font-size:10px;color:#666\">" + typeLabel(type) + "</td>"
        + "<td style=\"" + TD  + ";font-weight:600\">" + esc(name) + "</td>"
        + "<td style=\"" + TDC + "\">" + (hasExp ? "—" : qty)       + "</td>"
        + "<td style=\"" + TDC + "\">" + (hasExp ? ""  : esc(unit)) + "</td>"
        + "<td style=\"" + TDR + ";color:#666\">" + (hasExp ? "" : fmt(price, cur)) + "</td>"
        + "<td style=\"" + TDR + ";font-weight:700;color:#1e3352\">" + fmt(sub, cur) + "</td>"
        + "<td style=\"" + TD  + ";font-size:10px;color:#888\">" + esc(notes) + "</td>"
        + "</tr>";

      var expansion = "";
      if      (hasHotel)   expansion = hotelExpansion(item, cur);
      else if (hasVehicle) expansion = vehicleExpansion(item, cur);
      else if (hasService) expansion = serviceExpansion(item, cur);
      else if (hasMeal)    expansion = mealExpansion(item, cur);

      return mainRow + expansion;
    }).join("");

    return "<table class=\"sq-table\" style=\"width:100%;border-collapse:collapse;font-size:11px\">"
      + "<thead>" + header + "</thead>"
      + "<tbody>" + rows   + "</tbody>"
      + "</table>";
  }

  // ── Tax / total block ─────────────────────────────────────────────────────
  function renderTotals(total, cur) {
    var ROW  = "display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;font-size:12px;gap:20px";
    var ROWG = "display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;margin-top:4px;border-top:2px solid rgba(255,255,255,0.3);font-size:15px;font-weight:700;gap:20px";
    var WRAP = "margin-top:12px;padding:16px 20px;background:linear-gradient(135deg,#1e3352 0%,#253f61 100%);border-radius:8px;color:#fff";
    var MUTED = "color:rgba(255,255,255,0.72)";
    var NOTE = "margin:8px 0 0;font-size:10px;color:rgba(255,255,255,0.52);line-height:1.5";

    if (taxMode === "included") {
      var net = total / 1.2;
      var vat = total - net;
      return "<div style=\"" + WRAP + "\">"
        + "<div style=\"" + ROW + "\"><span style=\"" + MUTED + "\">" + L("netAmount") + "</span><span>" + fmt(net, cur) + "</span></div>"
        + "<div style=\"" + ROW + "\"><span style=\"" + MUTED + "\">" + L("vatLabel")  + "</span><span>" + fmt(vat, cur) + "</span></div>"
        + "<div style=\"" + ROWG + "\"><span>" + L("totalIncl") + "</span><span>" + fmt(total, cur) + "</span></div>"
        + "<p style=\"" + NOTE + "\">" + L("vatInclNote") + "</p>"
        + "</div>";
    } else {
      var vatEx  = total * 0.2;
      var gross  = total + vatEx;
      return "<div style=\"" + WRAP + "\">"
        + "<div style=\"" + ROW + "\"><span style=\"" + MUTED + "\">" + L("totalExcl") + "</span><span>" + fmt(total, cur) + "</span></div>"
        + "<div style=\"" + ROW + "\"><span style=\"" + MUTED + "\">" + L("vatLabel")  + "</span><span>" + fmt(vatEx, cur) + "</span></div>"
        + "<div style=\"" + ROWG + "\"><span>" + L("totalIncl") + "</span><span>" + fmt(gross, cur) + "</span></div>"
        + "<p style=\"" + NOTE + "\">" + L("vatRefNote") + "</p>"
        + "</div>";
    }
  }

  // ── Terms block ───────────────────────────────────────────────────────────
  function renderTerms() {
    if (!showTerms) return "";
    var items;
    if (lang === "en") {
      items = TERMS_EN.map(function (t) { return "<li>" + esc(t) + "</li>"; });
    } else if (lang === "zh") {
      items = TERMS_ZH.map(function (t) { return "<li>" + esc(t) + "</li>"; });
    } else {
      items = TERMS_ZH.map(function (t, i) {
        return "<li>" + esc(t)
          + (TERMS_EN[i] ? "<br><em style=\"font-size:10px;color:#888;font-style:normal\">" + esc(TERMS_EN[i]) + "</em>" : "")
          + "</li>";
      });
    }
    return "<div style=\"margin-top:20px;padding-top:14px;border-top:1px solid #ddd\">"
      + "<h3 style=\"font-size:11.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#1e3352;margin:0 0 10px\">" + L("sectionTerms") + "</h3>"
      + "<ol style=\"margin:0;padding-left:18px;font-size:11px;color:#444;line-height:1.8\">"
      + items.join("")
      + "</ol>"
      + "</div>";
  }

  // ── Page content renderer ─────────────────────────────────────────────────
  function renderContent(quote) {
    var cur    = quote.currency || "EUR";
    var items  = Array.isArray(quote.items) ? quote.items : [];
    var total  = quote.totalPrice != null ? quote.totalPrice : (quote.totalSales || 0);
    var today  = new Date().toISOString().slice(0, 10);

    var MLBL = "font-size:10px;color:#888;margin:0 0 2px;letter-spacing:0.04em;text-transform:uppercase";
    var MVAL = "font-size:13px;font-weight:600;color:#1e3352;margin:0;line-height:1.3";
    function metaCell(label, val) {
      return "<div><p style=\"" + MLBL + "\">" + esc(label) + "</p><p style=\"" + MVAL + "\">" + esc(String(val || "—")) + "</p></div>";
    }

    var dateRange = (quote.startDate || "—") + " → " + (quote.endDate || "—");
    var paxVal    = String(quote.paxCount || "—") + paxSuffix();
    var contactVal = (quote.contactName || "") + (quote.contactPhone ? " · " + quote.contactPhone : "");

    var notesBlock = "";
    if (quote.notes) {
      var notesTitle = lang === "en" ? "Notes" : lang === "zh" ? "备注" : "备注 / Notes";
      notesBlock = "<div style=\"margin-top:14px;padding:10px 14px;background:#fff9f0;border-radius:6px;border-left:3px solid #c9a040;font-size:11px;color:#555;line-height:1.6\">"
        + "<strong style=\"font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#c9a040\">" + esc(notesTitle) + "</strong>"
        + "<p style=\"margin:4px 0 0\">" + esc(quote.notes) + "</p>"
        + "</div>";
    }

    var html = ""
      // ── Header
      + "<div style=\"display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2.5px solid #1e3352;margin-bottom:16px\">"
      +   "<div>"
      +     "<p style=\"margin:0 0 5px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#999\">" + L("company") + "</p>"
      +     "<h1 style=\"margin:0;font-size:26px;font-weight:800;letter-spacing:0.02em;color:#1e3352;line-height:1.1\">" + L("docTitle") + "</h1>"
      +   "</div>"
      +   "<div style=\"text-align:right;font-size:11px\">"
      +     "<p style=\"margin:0;font-weight:700;font-size:12px;color:#1e3352\">" + L("quoteNo") + ": " + esc(quote.quoteNumber || quote.id) + "</p>"
      +     "<p style=\"margin:4px 0 0;color:#888\">" + L("issueDate") + ": " + today + "</p>"
      +   "</div>"
      + "</div>"
      // ── Meta grid
      + "<div style=\"display:grid;grid-template-columns:repeat(3,1fr);gap:10px 20px;margin-bottom:18px;padding:14px 16px;background:#f5f7fa;border-radius:8px;border-left:3px solid #1e3352\">"
      +   metaCell(L("client"),      quote.clientName)
      +   metaCell(L("contact"),     contactVal)
      +   metaCell(L("project"),     quote.projectName)
      +   metaCell(L("destination"), quote.destination)
      +   metaCell(L("dates"),       dateRange)
      +   metaCell(L("pax"),         paxVal)
      + "</div>"
      // ── Items section
      + "<h2 style=\"font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1e3352;margin:0 0 8px;padding-bottom:5px;border-bottom:1px solid #cdd4dc\">" + L("sectionItems") + "</h2>"
      + renderItemsTable(items, cur)
      // ── Totals
      + "<div style=\"display:flex;justify-content:flex-end;margin-top:16px\">"
      +   "<div style=\"min-width:280px\">" + renderTotals(total, cur) + "</div>"
      + "</div>"
      // ── Notes
      + notesBlock
      // ── Terms
      + renderTerms();

    document.getElementById("sq-page").innerHTML = html;
  }

  // ── Error display ─────────────────────────────────────────────────────────
  function showError(msg) {
    document.getElementById("sq-loading").hidden = true;
    var wrap = document.getElementById("sq-preview-wrap");
    if (wrap) wrap.hidden = true;
    var el = document.getElementById("sq-error");
    el.hidden = false;
    el.innerHTML = "<div class=\"sq-err-box\">"
      + "<p style=\"margin:0 0 12px;font-size:14px;color:#c0392b\">⚠ " + esc(msg) + "</p>"
      + "<a href=\"/standard-quotes.html\" style=\"color:#1565c0;font-size:13px\">← 返回报价列表</a>"
      + "</div>";
  }

  // ── Toolbar binding ───────────────────────────────────────────────────────
  function bindToolbar(quote) {
    var langSel  = document.getElementById("sq-lang");
    var taxSel   = document.getElementById("sq-tax");
    var termsCb  = document.getElementById("sq-terms");

    if (langSel) {
      langSel.value = lang;
      langSel.addEventListener("change", function () { lang = langSel.value; renderContent(quote); });
    }
    if (taxSel) {
      taxSel.value = taxMode;
      taxSel.addEventListener("change", function () { taxMode = taxSel.value; renderContent(quote); });
    }
    if (termsCb) {
      termsCb.checked = showTerms;
      termsCb.addEventListener("change", function () { showTerms = termsCb.checked; renderContent(quote); });
    }
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function bootstrap() {
    var backLink = document.getElementById("sq-back-link");
    if (backLink && QUOTE_ID) {
      backLink.href = "/quote-detail.html?id=" + encodeURIComponent(QUOTE_ID);
    }

    if (!QUOTE_ID) {
      showError("缺少报价编号，请从报价详情页进入。");
      return;
    }

    window.AppUtils.fetchJson(
      "/api/customer-standard-quotations/" + encodeURIComponent(QUOTE_ID),
      null,
      "报价单加载失败，请稍后重试。"
    ).then(function (quote) {
      var pm = quote.pricingMode || quote.pricing_mode || "standard";
      if (pm === "project_based") {
        showError("当前报价不是标准报价，不能使用此页面。");
        return;
      }

      document.getElementById("sq-loading").hidden = true;
      document.getElementById("sq-preview-wrap").hidden = false;
      document.title = "客户报价单 – " + (quote.projectName || quote.quoteNumber || "");

      // Initialise checkbox to match URL param before binding
      var termsCb = document.getElementById("sq-terms");
      if (termsCb) termsCb.checked = showTerms;

      renderContent(quote);
      bindToolbar(quote);
      window.__SQ_READY__ = true;

    }).catch(function (e) {
      showError((e && e.message) || "报价单加载失败，请稍后重试。");
    });
  }

  bootstrap();
})();
