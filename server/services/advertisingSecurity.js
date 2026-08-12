"use strict";
function isSensitiveAdvertisingKey(key){const normalized=String(key).replace(/[^a-z0-9]/gi,'').toLowerCase();return normalized==='bomlines'||normalized.includes('priceversion')||normalized.includes('cost')||normalized.includes('grossprofit')||normalized.includes('grossmargin')||normalized.includes('supplier')||normalized.includes('minimumsale')||normalized.includes('markup')||normalized.startsWith('internal');}
function sanitizeAdvertisingPayload(value,canViewCosts=false){if(canViewCosts||value===null||typeof value!=='object')return value;if(Array.isArray(value))return value.map(entry=>sanitizeAdvertisingPayload(entry,false));return Object.fromEntries(Object.entries(value).filter(([key])=>!isSensitiveAdvertisingKey(key)).map(([key,nested])=>[key,sanitizeAdvertisingPayload(nested,false)]));}
function sanitizeAdvertisingCatalogPayload(value,{canViewCosts=false,canManageCatalog=false}={}){
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(entry=>sanitizeAdvertisingCatalogPayload(entry,{canViewCosts,canManageCatalog}));
  const output={};
  for(const[key,nested]of Object.entries(value)){
    const normalized=String(key).replace(/[^a-z0-9]/gi,'').toLowerCase();
    if(normalized==='priceversions')continue;
    if(normalized.includes('priceversion')){
      if(canManageCatalog)output[key]=sanitizeAdvertisingPayload(nested,canViewCosts);
      continue;
    }
    if(!canViewCosts&&isSensitiveAdvertisingKey(key))continue;
    output[key]=sanitizeAdvertisingCatalogPayload(nested,{canViewCosts,canManageCatalog});
  }
  return output;
}
module.exports={isSensitiveAdvertisingKey,sanitizeAdvertisingPayload,sanitizeAdvertisingCatalogPayload};
