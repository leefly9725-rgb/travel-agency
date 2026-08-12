"use strict";
const { buildProjectQuotationDocx, DOCX_CONTENT_TYPE }=require('./projectQuotationDocxService');
function safeName(value){return String(value||'').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-').replace(/\s+/g,'_').slice(0,60)}
function buildLegacyAdvertisingCustomerView(quote,{internal=false}={}){
  const calc=quote.calculationSnapshot||{};
  const visible=(quote.items||[]).filter(item=>item.customerVisible!==false);
  const declaredGroups=Array.isArray(quote.groups)?quote.groups:[];
  const knownGroupIds=new Set(declaredGroups.map(group=>String(group.id)));
  const hasUngrouped=visible.some(item=>!item.groupId||!knownGroupIds.has(String(item.groupId)));
  const sourceGroups=declaredGroups.length?[...declaredGroups]:[];
  if(hasUngrouped||!sourceGroups.length)sourceGroups.push({id:'__ungrouped',nameZh:declaredGroups.length?'未分组产品':'广告制作',nameEn:declaredGroups.length?'Ungrouped Items':'Advertising Production'});
  const groups=sourceGroups.map(group=>({
    projectTitle:group.nameZh||'广告制作',
    projectType:'mixed',
    items:visible.filter(item=>group.id==='__ungrouped'?(!item.groupId||!knownGroupIds.has(String(item.groupId))):String(item.groupId)===String(group.id)).map(item=>{
      const calculated=(calc.items||[]).find(entry=>entry.id===item.id)||item;
      return{itemName:{zh:item.name||'广告产品',en:item.nameEn||''},specification:String(item.width||'')+'×'+String(item.height||'')+' '+String(item.sizeUnit||'mm')+' · '+String(calculated.materialNameSnapshot||'')+(internal?' · Cost '+Number(calculated.costAmount||0).toFixed(2):''),quantity:item.quantity||1,unit:item.unit||'件',salesUnitPrice:Number(calculated.saleAmount||0)/Number(item.quantity||1),salesSubtotal:Number(calculated.saleAmount||0),notes:item.notes||''};
    })
  })).filter(group=>group.items.length);
  const fees=(calc.additionalFees||[]).filter(fee=>fee.customerVisible!==false&&fee.category!=='delivery');
  if(fees.length)groups.push({projectTitle:'附加服务',projectType:'mixed',items:fees.map(fee=>({itemName:{zh:fee.nameZh||fee.name||fee.category||'附加服务',en:fee.nameEn||''},quantity:fee.quantity||1,unit:fee.unit||'项',salesUnitPrice:Number(fee.saleUnitPrice||0),salesSubtotal:Number(fee.saleAmount||0),notes:fee.customerNotes||''}))});
  const calculatedDeliverySale=calc.deliverySale??(calc.additionalFees||[]).filter(fee=>fee.category==='delivery').reduce((sum,fee)=>sum+Number(fee.saleAmount||0),0);
  const adjustments=[
    ['最低订单补差','Minimum order surcharge',Number(calc.minimumOrderSurcharge||0)],
    ['配送费','delivery',Number(calculatedDeliverySale||0)],
    ['加急费','Urgent service',Number(calc.urgentSale||0)],
    ['折扣','Discount',-Number(calc.discountAmount||0)],
    ['整单调整','Adjustment',Number(calc.adjustment||0)],
    ['VAT','VAT',Number(calc.vatAmount||0)]
  ].filter(([, ,amount])=>Math.abs(amount)>0.0001).map(([zh,en,amount])=>({itemName:{zh,en},quantity:1,unit:'项',salesUnitPrice:amount,salesSubtotal:amount,notes:''}));
  if(adjustments.length)groups.push({projectTitle:'金额调整与税费',projectType:'mixed',items:adjustments});
  const totalSales=Number(calc.totalIncludingVat??calc.subtotalExcludingVat??0);
  const detailTotal=groups.flatMap(group=>group.items).reduce((sum,item)=>sum+Number(item.salesSubtotal||0),0);
  const reconciliation=Number((totalSales-detailTotal).toFixed(2));
  if(Math.abs(reconciliation)>0.0001)groups.push({projectTitle:'金额汇总',projectType:'mixed',items:[{itemName:{zh:'其他已计入金额',en:'Other included amount'},quantity:1,unit:'项',salesUnitPrice:reconciliation,salesSubtotal:reconciliation,notes:''}]});
  const entity=quote.entitySnapshot||{};
  const entityCode=String(entity.code||quote.entityId||'LDS').toUpperCase();
  const logoConfigured=entityCode==='LDS'&&entity.logoConfigured!==false;
  const companyEnglish=String(entity.nameEn||entity.nameZh||entityCode).toUpperCase();
  const displayEnglish=(logoConfigured?companyEnglish:companyEnglish+' · LOGO NOT CONFIGURED')+(internal?' · INTERNAL USE ONLY':'');
  return{id:quote.id,quoteNumber:quote.quoteNumber,clientName:quote.clientName,clientContact:quote.contactName||'',projectName:quote.projectName,projectLocation:quote.serviceLocation||'',quoteDate:quote.quoteDate,validUntil:quote.validUntil,currency:quote.currency||'EUR',language:quote.language||'zh-en',company:{cn:entity.nameZh||entity.nameEn||entityCode,en:displayEnglish,legal:entity.legalName||entity.nameEn||'',address:entity.address||'',contact:[entity.phone,entity.email,entity.website].filter(Boolean).join(' | '),logoConfigured},projectGroups:groups,totalSales,notes:quote.customerNotes||'',internal};
}
function buildAdvertisingCustomerView(quote,options={}){
  if(quote.pricingEngine!=='bom_v2')return buildLegacyAdvertisingCustomerView(quote,options);
  const internal=options.internal===true;
  const visible=(quote.items||[]).filter(item=>item.customerVisible!==false);
  const lines=Array.isArray(quote.bomLines)?quote.bomLines:[];
  const itemRows=visible.map(item=>{
    const saleAmount=lines.filter(line=>line.customerVisible!==false&&String(line.quoteItemId||'')===String(item.id)).reduce((sum,line)=>sum+Number(line.saleAmount||0),0);
    const quantity=Number(item.quantity||1)||1;
    return{itemName:{zh:item.name||'广告产品',en:item.nameEn||''},specification:String(item.width||'')+'×'+String(item.height||'')+' '+String(item.sizeUnit||'mm'),quantity,unit:item.unit||'件',salesUnitPrice:saleAmount/quantity,salesSubtotal:saleAmount,notes:item.notes||''};
  });
  const groups=itemRows.length?[{projectTitle:'广告制作',projectType:'mixed',items:itemRows}]:[];
  const adjustments=lines.filter(line=>line.customerVisible!==false&&!line.quoteItemId&&Math.abs(Number(line.saleAmount||0))>0.0001).map(line=>({itemName:{zh:line.descriptionSnapshot||line.nameSnapshot||'金额调整',en:''},quantity:1,unit:'项',salesUnitPrice:Number(line.saleAmount||0),salesSubtotal:Number(line.saleAmount||0),notes:''}));
  if(adjustments.length)groups.push({projectTitle:'金额调整与税费',projectType:'mixed',items:adjustments});
  const calc=quote.calculationSnapshot||{};
  const totalSales=Number(calc.totalIncludingVat??calc.subtotalExcludingVat??lines.reduce((sum,line)=>sum+Number(line.saleAmount||0),0));
  const detailTotal=groups.flatMap(group=>group.items).reduce((sum,item)=>sum+Number(item.salesSubtotal||0),0);
  const reconciliation=Number((totalSales-detailTotal).toFixed(2));
  if(Math.abs(reconciliation)>0.0001)groups.push({projectTitle:'金额汇总',projectType:'mixed',items:[{itemName:{zh:'其他已计入金额',en:'Other included amount'},quantity:1,unit:'项',salesUnitPrice:reconciliation,salesSubtotal:reconciliation,notes:''}]});
  const entity=quote.entitySnapshot||{};
  const entityCode=String(entity.code||quote.entityId||'LDS').toUpperCase();
  const logoConfigured=entityCode==='LDS'&&entity.logoConfigured!==false;
  const companyEnglish=String(entity.nameEn||entity.nameZh||entityCode).toUpperCase();
  const view={id:quote.id,quoteNumber:quote.quoteNumber,clientName:quote.clientName,clientContact:quote.contactName||'',projectName:quote.projectName,projectLocation:quote.serviceLocation||'',quoteDate:quote.quoteDate,validUntil:quote.validUntil,currency:quote.currency||'EUR',language:quote.language||'zh-en',company:{cn:entity.nameZh||entity.nameEn||entityCode,en:(logoConfigured?companyEnglish:companyEnglish+' · LOGO NOT CONFIGURED')+(internal?' · INTERNAL USE ONLY':''),legal:entity.legalName||entity.nameEn||'',address:entity.address||'',contact:[entity.phone,entity.email,entity.website].filter(Boolean).join(' | '),logoConfigured},projectGroups:groups,totalSales,notes:quote.customerNotes||'',internal};
  if(internal)view.internalBomLines=lines.map(line=>({lineType:line.lineType,descriptionSnapshot:line.descriptionSnapshot,quantity:line.quantity,sourceCurrency:line.sourceCurrency,costUnitPriceSource:line.costUnitPriceSource,saleUnitPriceSource:line.saleUnitPriceSource,costAmount:line.costAmount,saleAmount:line.saleAmount,supplierSnapshot:line.supplierSnapshot,priceVersionId:line.priceVersionId,internalNotes:line.internalNotes}));
  return view;
}
function buildAdvertisingQuotationDocx(quote,options={}){return buildProjectQuotationDocx(buildAdvertisingCustomerView(quote,options),options)}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function buildAdvertisingQuotationHtml(quote,options={}){const vm=buildAdvertisingCustomerView(quote,options);const internalBom=vm.internal&&Array.isArray(vm.internalBomLines)&&vm.internalBomLines.length?`<h2>Internal BOM Detail / 内部 BOM 明细</h2><table><thead><tr><th>Type</th><th>BOM detail</th><th>Qty</th><th>Source</th><th>Cost</th><th>Sale</th><th>Supplier / version</th><th>Internal notes</th></tr></thead><tbody>${vm.internalBomLines.map(line=>`<tr><td>${esc(line.lineType)}</td><td>${esc(line.descriptionSnapshot)}</td><td>${esc(line.quantity)}</td><td>${esc(line.sourceCurrency)}</td><td>${esc(line.costAmount)}</td><td>${esc(line.saleAmount)}</td><td>${esc(line.supplierSnapshot?.name||line.supplierSnapshot?.nameZh||line.supplierSnapshot?.id||'')} / ${esc(line.priceVersionId)}</td><td>${esc(line.internalNotes)}</td></tr>`).join('')}</tbody></table>`:'';return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:"Noto Sans CJK SC","PingFang SC",Arial,sans-serif;color:#172033}.page{width:210mm;min-height:297mm;padding:18mm 18mm 16mm;page-break-after:always}.cover{display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(145deg,#10233f,#234b73);color:white}.brand{font-size:13px;letter-spacing:.12em}.cover h1{font-size:32px;margin:0 0 10px}.cover .total{font-size:27px;font-weight:700}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}.content{page-break-after:auto}h2{color:#163b62;border-bottom:2px solid #163b62;padding-bottom:7px;break-after:avoid}h3{break-after:avoid;margin-top:20px}table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:15px}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #ccd5df;padding:7px;text-align:left}th{background:#edf3f8}.num{text-align:right}.terms,.signature{break-inside:avoid}.signature{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:30px}.line{border-top:1px solid #667;margin-top:45px;padding-top:6px}</style></head><body><section class="page cover"><div><div class="brand">${esc(vm.company.en)}</div><p>${esc(vm.company.address)}</p></div><div><h1>广告制作报价<br><small>Advertising Production Quotation</small></h1><p>${esc(vm.projectName)}</p></div><div><div class="total">${esc(vm.currency)} ${Number(vm.totalSales).toFixed(2)}</div><div class="meta"><span>报价编号 / No.<br>${esc(vm.quoteNumber)}</span><span>客户 / Client<br>${esc(vm.clientName)}</span><span>日期 / Date<br>${esc(vm.quoteDate)}</span><span>有效期 / Valid until<br>${esc(vm.validUntil)}</span></div></div></section><section class="page content"><h2>报价明细 / Quotation Details</h2>${vm.projectGroups.map(group=>`<h3>${esc(group.projectTitle)}</h3><table><thead><tr><th>产品 / Item</th><th>规格 / Specification</th><th>数量</th><th>单位</th><th class="num">单价</th><th class="num">金额</th></tr></thead><tbody>${group.items.map(item=>`<tr><td>${esc(item.itemName.zh||item.itemName)}<br>${esc(item.itemName.en||'')}</td><td>${esc(item.specification)}</td><td>${esc(item.quantity)}</td><td>${esc(item.unit)}</td><td class="num">${Number(item.salesUnitPrice||0).toFixed(2)}</td><td class="num">${Number(item.salesSubtotal||0).toFixed(2)}</td></tr>`).join('')}</tbody></table>`).join('')}<h2>总计 / Total: ${esc(vm.currency)} ${Number(vm.totalSales).toFixed(2)}</h2>${internalBom}<div class="terms"><h2>商务条款 / Commercial Terms</h2><p>本报价以最终确认的制作范围为准。报价有效期内确认后安排生产。</p><p>The quotation is subject to the finally confirmed production scope.</p></div><div class="signature"><div class="line">报价方签字 / Supplier</div><div class="line">客户确认 / Client</div></div></section></body></html>`}
function advertisingQuotationFileName(quote,ext='docx'){const entity=quote.entitySnapshot?.code||quote.entitySnapshot?.quotePrefix?.split('-')[0]||'LDS';return `${safeName(quote.quoteNumber||entity+'-AD')}_${safeName(quote.clientName||'Client')}_Quotation_CN-EN.${ext}`}
module.exports={DOCX_CONTENT_TYPE,buildAdvertisingCustomerView,buildAdvertisingQuotationDocx,buildAdvertisingQuotationHtml,advertisingQuotationFileName};
