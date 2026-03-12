function isFlaggedReview(record) {
  return record?.dataQuality?.reviewStatus === "flagged_review";
}

function renderVehicleDetailBlock(item, quoteCurrency) {
  if (!item.vehicleDetails || item.vehicleDetails.length === 0) {
    return "";
  }

  return `
    <div class="vehicle-detail-preview section-spacing-sm">
      ${item.vehicleDetails.map((detail) => `
        <div class="table-row table-row-wide table-row-split">
          <div>
            <strong>${window.AppUi.getLabel("vehicleDetailTypeLabels", detail.detailType)} / ${detail.vehicleModel}</strong>
            <p class="meta preview-subline">${detail.vehicleCount} ? / ?? ${detail.billingQuantity} ${window.AppUi.getLabel("vehiclePricingUnitLabels", detail.pricingUnit)} / ?? ${window.AppUi.getLabel("currencyLabels", detail.currency)}</p>
            <p class="meta preview-subline">?? ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}??? ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}?/ ?? ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}??? ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}?</p>
            <p class="meta preview-subline">${detail.notes || "???"}</p>
          </div>
          <div class="table-row-values">
            <span>?? ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}</span>
            <strong>?? ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}</strong>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderServiceDetailBlock(item, quoteCurrency) {
  if (!item.serviceDetails || item.serviceDetails.length === 0) {
    return "";
  }

  return `
    <div class="service-detail-preview section-spacing-sm">
      ${item.serviceDetails.map((detail) => `
        <div class="table-row table-row-wide table-row-split">
          <div>
            <strong>${window.AppUi.getLabel("serviceRoleLabels", detail.serviceRole)} / ${window.AppUi.getLabel("serviceLanguageLabels", detail.serviceLanguage)}</strong>
            <p class="meta preview-subline">${window.AppUi.getLabel("serviceDurationLabels", detail.serviceDuration)} / ?? ${detail.quantity} / ?? ${window.AppUi.getLabel("currencyLabels", detail.currency)}</p>
            <p class="meta preview-subline">?? ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}??? ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}?/ ?? ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}??? ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}?</p>
            <p class="meta preview-subline">${detail.notes || "???"}</p>
          </div>
          <div class="table-row-values">
            <span>?? ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}</span>
            <strong>?? ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}</strong>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderHotelDetailBlock(item, quoteCurrency) {
  if (!item.hotelDetails || item.hotelDetails.length === 0) {
    return "";
  }

  return `
    <div class="hotel-detail-preview section-spacing-sm">
      ${item.hotelDetails.map((detail) => `
        <div class="table-row table-row-wide table-row-split">
          <div>
            <strong>${detail.roomType}</strong>
            <p class="meta preview-subline">${detail.roomCount} 间 / ${detail.nights} 晚 / 币种 ${window.AppUi.getLabel("currencyLabels", detail.currency)}</p>
            <p class="meta preview-subline">成本 ${window.AppUtils.formatCurrency(detail.costSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}）/ 销售 ${window.AppUtils.formatCurrency(detail.priceSubtotalOriginal, detail.currency)}（折算 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}）</p>
            <p class="meta preview-subline">${detail.notes || "无备注"}</p>
          </div>
          <div class="table-row-values">
            <span>成本 ${window.AppUtils.formatCurrency(detail.costSubtotal, quoteCurrency)}</span>
            <strong>销售 ${window.AppUtils.formatCurrency(detail.priceSubtotal, quoteCurrency)}</strong>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function bootstrap() {
  window.AppUtils.applyFlash("quote-message");
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    document.getElementById("quote-detail").innerHTML = window.AppUtils.renderEmptyState("未找到报价编号", "请从报价列表重新进入详情页。");
    return;
  }

  try {
    const quote = await window.AppUtils.fetchJson(`/api/quotes/${encodeURIComponent(id)}`, null, "报价详情加载失败，请稍后重试。");
    const projectArchiveId = quote.projectId || quote.id;
    const container = document.getElementById("quote-detail");
    container.innerHTML = `
      <div class="panel-head panel-head-wrap">
        <div>
          <div class="title-row">
            <h1>${quote.projectName}</h1>
            ${isFlaggedReview(quote) ? '<span class="review-badge">待复核</span>' : ''}
          </div>
          <p class="meta">${quote.quoteNumber} / ${quote.clientName}</p>
        </div>
        <div class="action-row">
          <a class="button-link small-link" href="/quote-new.html?id=${encodeURIComponent(quote.id)}">编辑报价</a>
          <a class="button-link small-link" href="/documents.html?quoteId=${encodeURIComponent(quote.id)}">查看文档数据</a>
          <a class="button-link small-link" href="/project-detail.html?id=${encodeURIComponent(projectArchiveId)}">项目主档</a>
        </div>
      </div>
      ${isFlaggedReview(quote) ? `
        <div class="review-note section-spacing">
          <strong>待复核提示</strong>
          <p>${quote.dataQuality.note || "该报价记录已标记为待复核，正式业务使用前请先完成人工检查。"}</p>
        </div>
      ` : ""}
      <div class="detail-grid section-spacing">
        <div class="metric"><span>客户</span><strong>${quote.clientName}</strong></div>
        <div class="metric"><span>联系人</span><strong>${quote.contactName}</strong></div>
        <div class="metric"><span>联系电话</span><strong>${quote.contactPhone || "暂无"}</strong></div>
        <div class="metric"><span>行程日期</span><strong>${quote.startDate} ~ ${quote.endDate}</strong></div>
        <div class="metric"><span>行程天数</span><strong>${quote.travelDays} 天</strong></div>
        <div class="metric"><span>出行人数（PAX）</span><strong>${quote.paxCount || "未填写"}</strong></div>
        <div class="metric"><span>主要目的地</span><strong>${quote.destination}</strong></div>
        <div class="metric"><span>文档输出语言</span><strong>${window.AppUi.getLabel("languageLabels", quote.language)}</strong></div>
        <div class="metric"><span>报价币种</span><strong>${window.AppUi.getLabel("currencyLabels", quote.currency)}</strong></div>
        <div class="metric"><span>成本合计</span><strong>${window.AppUtils.formatCurrency(quote.totalCost, quote.currency)}</strong></div>
        <div class="metric"><span>售价合计</span><strong>${window.AppUtils.formatCurrency(quote.totalPrice, quote.currency)}</strong></div>
        <div class="metric"><span>毛利</span><strong>${window.AppUtils.formatCurrency(quote.grossProfit, quote.currency)}</strong></div>
        <div class="metric"><span>毛利率</span><strong>${quote.grossMargin}%</strong></div>
      </div>
      <div class="panel subpanel section-spacing">
        <div class="panel-head"><h2>报价项明细</h2><span>${quote.items.length} 项</span></div>
        <div class="table-like">
          ${quote.items.length > 0 ? quote.items.map((item) => `
            <div class="table-row table-row-wide table-row-split">
              <div>
                <strong>${window.AppUi.getLabel("quoteItemTypeLabels", item.type)} / ${item.name}</strong>
                <p class="meta preview-subline">${item.type === "hotel" ? `酒店成本合计 ${window.AppUtils.formatCurrency(item.totalCost, quote.currency)} / 酒店售价合计 ${window.AppUtils.formatCurrency(item.totalPrice, quote.currency)}` : `${item.quantity} ${item.unit}，原币种 ${window.AppUtils.formatCurrency(item.totalPriceOriginal, item.currency)}，折算后 ${window.AppUtils.formatCurrency(item.totalPrice, quote.currency)}`}</p>
                ${item.type === "hotel" ? renderHotelDetailBlock(item, quote.currency) : ""}${item.type === "vehicle" ? renderVehicleDetailBlock(item, quote.currency) : ""}${["guide", "interpreter"].includes(item.type) ? renderServiceDetailBlock(item, quote.currency) : ""}
              </div>
              <div class="table-row-values">
                <span>成本 ${window.AppUtils.formatCurrency(item.totalCost, quote.currency)}</span>
                <strong>销售 ${window.AppUtils.formatCurrency(item.totalPrice, quote.currency)}</strong>
              </div>
            </div>
          `).join("") : '<p class="empty">这份报价还没有报价项。</p>'}
        </div>
      </div>
      <div class="panel subpanel section-spacing">
        <div class="panel-head"><h2>特殊需求 / 备注</h2></div>
        <p>${quote.notes || "暂无"}</p>
      </div>
    `;
  } catch (error) {
    document.getElementById("quote-detail").innerHTML = window.AppUtils.renderEmptyState("报价详情不可用", error.message);
    window.AppUtils.showMessage("quote-message", error.message, "error");
  }
}

bootstrap();
