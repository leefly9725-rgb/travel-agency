const { getSupabaseConfig } = require("../supabaseConfig");
const { supabaseRequest } = require("../supabaseClient");

function sortByPosition(arr) {
  return [...arr].sort((a, b) => (a.position || 0) - (b.position || 0));
}

function mapRemoteHotelDetail(row) {
  return {
    roomType: row.room_type,
    roomCount: Number(row.room_count || 1),
    nights: Number(row.nights || 1),
    costNightlyRate: Number(row.cost_nightly_rate || 0),
    priceNightlyRate: Number(row.price_nightly_rate || 0),
    currency: row.currency || "EUR",
    notes: row.notes || "",
  };
}

function mapRemoteVehicleDetail(row) {
  return {
    detailType: row.detail_type,
    vehicleModel: row.vehicle_model || "",
    vehicleCount: Number(row.vehicle_count || 1),
    pricingUnit: row.pricing_unit || "trip",
    billingQuantity: Number(row.billing_quantity || 1),
    costUnitPrice: Number(row.cost_unit_price || 0),
    priceUnitPrice: Number(row.price_unit_price || 0),
    currency: row.currency || "EUR",
    notes: row.notes || "",
  };
}

function mapRemoteServiceDetail(row) {
  return {
    serviceRole: row.service_role,
    serviceLanguage: row.service_language,
    serviceDuration: row.service_duration,
    quantity: Number(row.quantity || 1),
    costUnitPrice: Number(row.cost_unit_price || 0),
    priceUnitPrice: Number(row.price_unit_price || 0),
    currency: row.currency || "EUR",
    notes: row.notes || "",
  };
}

function mapRemoteItem(row) {
  const hotelDetails = sortByPosition(row.hotel_details || []).map(mapRemoteHotelDetail);
  const vehicleDetails = sortByPosition(row.vehicle_details || []).map(mapRemoteVehicleDetail);
  const serviceDetails = sortByPosition(row.service_details || []).map(mapRemoteServiceDetail);

  return {
    type: row.type,
    name: row.name,
    unit: row.unit || "项",
    supplier: row.supplier || "",
    currency: row.currency || "EUR",
    quantity: Number(row.quantity || 1),
    cost: Number(row.cost || 0),
    price: Number(row.price || 0),
    notes: row.notes || "",
    hotelDetails,
    vehicleDetails,
    serviceDetails,
    mealDetails: null,
  };
}

function mapRemoteQuote(row) {
  const items = sortByPosition(row.quote_items || []).map(mapRemoteItem);
  return {
    id: row.id,
    quoteNumber: row.quote_number || "",
    projectId: row.project_id || "",
    clientName: row.client_name,
    projectName: row.project_name,
    contactName: row.contact_name,
    contactPhone: row.contact_phone || "",
    language: row.language || "zh-CN",
    currency: row.currency || "EUR",
    startDate: String(row.start_date || "").slice(0, 10),
    endDate: String(row.end_date || "").slice(0, 10),
    tripDate: String(row.trip_date || "").slice(0, 10),
    travelDays: Number(row.travel_days || 1),
    destination: row.destination || "",
    paxCount: Number(row.pax_count || 0),
    notes: row.notes || "",
    dataQuality: row.data_quality || {},
    items,
  };
}

const QUOTE_SELECT = "quotes?select=*,quote_items(*,hotel_details(*),vehicle_details(*),service_details(*))";

async function listRemoteQuotes(config) {
  const rows = await supabaseRequest(config, `${QUOTE_SELECT}&order=updated_at.desc`);
  return Array.isArray(rows) ? rows.map(mapRemoteQuote) : [];
}

async function getRemoteQuoteById(config, id) {
  const rows = await supabaseRequest(
    config,
    `${QUOTE_SELECT}&id=eq.${encodeURIComponent(id)}`
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("报价不存在。");
  }
  return mapRemoteQuote(rows[0]);
}

async function saveRemoteQuote(config, quote) {
  const now = new Date().toISOString();

  // Phase 1: Upsert the quote row
  await supabaseRequest(config, "quotes", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: quote.id,
      quote_number: quote.quoteNumber || "",
      project_id: quote.projectId || "",
      client_name: quote.clientName,
      project_name: quote.projectName,
      contact_name: quote.contactName,
      contact_phone: quote.contactPhone || "",
      language: quote.language || "zh-CN",
      currency: quote.currency || "EUR",
      start_date: quote.startDate,
      end_date: quote.endDate,
      trip_date: quote.tripDate || quote.startDate,
      travel_days: quote.travelDays || 1,
      destination: quote.destination || "",
      pax_count: quote.paxCount || 0,
      notes: quote.notes || "",
      data_quality: quote.dataQuality || {},
      updated_at: now,
    }),
  });

  // Phase 2: Delete existing quote_items (ON DELETE CASCADE removes detail rows)
  await supabaseRequest(config, `quote_items?quote_id=eq.${encodeURIComponent(quote.id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  // Phase 3: Re-insert items and their details
  for (const [index, item] of (quote.items || []).entries()) {
    // For dining items with mealDetails, store computed totalAmount as cost/price
    const hasMealDetails = item.mealDetails && typeof item.mealDetails === "object";
    const effectiveCost = hasMealDetails ? (item.mealDetails.totalAmount || 0) : (item.cost || 0);
    const effectivePrice = hasMealDetails ? (item.mealDetails.totalAmount || 0) : (item.price || 0);

    const itemRows = await supabaseRequest(config, "quote_items", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        quote_id: quote.id,
        type: item.type,
        name: item.name,
        unit: item.unit || "项",
        supplier: item.supplier || "",
        currency: item.currency || quote.currency || "EUR",
        quantity: item.quantity || 1,
        cost: effectiveCost,
        price: effectivePrice,
        notes: item.notes || "",
        position: index,
      }),
    });

    const itemRow = Array.isArray(itemRows) ? itemRows[0] : itemRows;
    if (!itemRow) continue;
    const itemId = itemRow.id;

    if (Array.isArray(item.hotelDetails) && item.hotelDetails.length > 0) {
      await supabaseRequest(config, "hotel_details", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(item.hotelDetails.map((detail, di) => ({
          quote_item_id: itemId,
          room_type: detail.roomType,
          room_count: detail.roomCount || 1,
          nights: detail.nights || 1,
          cost_nightly_rate: detail.costNightlyRate ?? detail.nightlyRate ?? 0,
          price_nightly_rate: detail.priceNightlyRate ?? detail.nightlyRate ?? 0,
          currency: detail.currency || item.currency || "EUR",
          notes: detail.notes || "",
          position: di,
        }))),
      });
    }

    if (Array.isArray(item.vehicleDetails) && item.vehicleDetails.length > 0) {
      await supabaseRequest(config, "vehicle_details", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(item.vehicleDetails.map((detail, di) => ({
          quote_item_id: itemId,
          detail_type: detail.detailType || "pickup",
          vehicle_model: detail.vehicleModel || "",
          vehicle_count: detail.vehicleCount || 1,
          pricing_unit: detail.pricingUnit || "trip",
          cost_unit_price: detail.costUnitPrice || 0,
          price_unit_price: detail.priceUnitPrice || 0,
          currency: detail.currency || item.currency || "EUR",
          notes: detail.notes || "",
          position: di,
        }))),
      });
    }

    if (Array.isArray(item.serviceDetails) && item.serviceDetails.length > 0) {
      await supabaseRequest(config, "service_details", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(item.serviceDetails.map((detail, di) => ({
          quote_item_id: itemId,
          service_role: detail.serviceRole || "guide",
          service_language: detail.serviceLanguage || "zh",
          service_duration: detail.serviceDuration || "full_day",
          quantity: detail.quantity || 1,
          cost_unit_price: detail.costUnitPrice || 0,
          price_unit_price: detail.priceUnitPrice || 0,
          currency: detail.currency || item.currency || "EUR",
          notes: detail.notes || "",
          position: di,
        }))),
      });
    }
  }

  return quote;
}

async function deleteRemoteQuote(config, id) {
  await supabaseRequest(config, `quotes?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  return true;
}

function createQuoteStore({ data, saveData }) {
  const config = getSupabaseConfig();

  function listLocalQuotes() {
    return Array.isArray(data.quotes) ? data.quotes : [];
  }

  function saveLocalQuote(quote) {
    if (!Array.isArray(data.quotes)) data.quotes = [];
    const index = data.quotes.findIndex((item) => item.id === quote.id);
    if (index === -1) {
      data.quotes.unshift(quote);
    } else {
      data.quotes[index] = quote;
    }
    saveData(data);
    return quote;
  }

  function deleteLocalQuote(id) {
    if (!Array.isArray(data.quotes)) return false;
    const index = data.quotes.findIndex((item) => item.id === id);
    if (index === -1) return false;
    data.quotes.splice(index, 1);
    saveData(data);
    return true;
  }

  return {
    async listQuotes() {
      if (!config.enabled) {
        return { quotes: listLocalQuotes(), source: "local_json" };
      }
      try {
        const quotes = await listRemoteQuotes(config);
        return { quotes, source: "supabase" };
      } catch (error) {
        console.warn("报价读取出错，回退到本地 JSON。", error.message);
        return { quotes: listLocalQuotes(), source: "local_json", fallbackReason: error.message };
      }
    },

    async getQuoteById(id) {
      if (!config.enabled) {
        const quote = listLocalQuotes().find((item) => item.id === id);
        if (!quote) throw new Error("报价不存在。");
        return { quote, source: "local_json" };
      }
      try {
        const quote = await getRemoteQuoteById(config, id);
        return { quote, source: "supabase" };
      } catch (error) {
        console.warn("报价查询出错，回退到本地 JSON。", error.message);
        const quote = listLocalQuotes().find((item) => item.id === id);
        if (!quote) throw new Error("报价不存在。");
        return { quote, source: "local_json", fallbackReason: error.message };
      }
    },

    async saveQuote(quote) {
      if (!config.enabled) {
        return { quote: saveLocalQuote(quote), source: "local_json" };
      }
      try {
        await saveRemoteQuote(config, quote);
        return { quote, source: "supabase" };
      } catch (error) {
        console.warn("报价保存出错，回退到本地 JSON。", error.message);
        return { quote: saveLocalQuote(quote), source: "local_json", fallbackReason: error.message };
      }
    },

    async deleteQuote(id) {
      if (!config.enabled) {
        return { deleted: deleteLocalQuote(id), source: "local_json" };
      }
      try {
        await deleteRemoteQuote(config, id);
        return { deleted: true, source: "supabase" };
      } catch (error) {
        console.warn("报价删除出错，回退到本地 JSON。", error.message);
        return { deleted: deleteLocalQuote(id), source: "local_json", fallbackReason: error.message };
      }
    },
  };
}

module.exports = { createQuoteStore };
