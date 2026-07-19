"use strict";
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
function buildAdjustmentLogs(before={},after={},userId,reason){
  const logs=[];const add=(fieldName,oldValue,newValue,quoteItemId=null)=>{if(!same(oldValue,newValue))logs.push({fieldName,oldValue:oldValue??null,newValue:newValue??null,quoteItemId,userId,reason:String(reason||'').trim()})};
  add('minimumProcessingFee',before.minimumProcessingFee,after.minimumProcessingFee);add('minimumOrderAmount',before.minimumOrderAmount,after.minimumOrderAmount);add('delivery.saleUnitPrice',before.delivery?.saleUnitPrice,after.delivery?.saleUnitPrice);add('installation.saleUnitPrice',before.additionalFees?.find(x=>x.category==='installation')?.saleUnitPrice,after.additionalFees?.find(x=>x.category==='installation')?.saleUnitPrice);add('discountPercent',before.discountPercent,after.discountPercent);add('fixedDiscount',before.fixedDiscount,after.fixedDiscount);add('adjustment',before.adjustment,after.adjustment);
  const oldItems=new Map((before.items||[]).map(x=>[x.id,x]));for(const item of after.items||[]){const old=oldItems.get(item.id)||{};for(const field of ['materialSaleUnitPrice','manualAdjustment','actualSalePrice'])add(field,old[field],item[field],item.id);const oldProcesses=new Map((old.processes||[]).map(x=>[x.processId,x]));for(const process of item.processes||[]){const previous=oldProcesses.get(process.processId)||{};add(`process.${process.processId}.actualSalePrice`,previous.actualSalePrice,process.actualSalePrice,item.id)}}
  if(logs.length&&!String(reason||'').trim())throw Object.assign(new Error('手工调价必须填写修改原因。'),{statusCode:400,code:'ADJUSTMENT_REASON_REQUIRED'});return logs;
}
module.exports={buildAdjustmentLogs};
