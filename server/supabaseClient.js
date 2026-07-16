function getRemoteKey(config) {
  return config.serviceRoleKey || config.anonKey || config.publishableKey || "";
}

function buildHeaders(config, extraHeaders) {
  const key = getRemoteKey(config);
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

async function supabaseRequest(config, pathname, options = {}) {
  const key = getRemoteKey(config);
  if (!config.url || !key) {
    throw new Error("Supabase 未配置。");
  }

  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    method: options.method || "GET",
    headers: buildHeaders(config, options.headers),
    body: options.body,
  });

  if (!response.ok) {
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_error) {
      payload = null;
    }
    const remoteMessage = payload && typeof payload.message === "string"
      ? payload.message
      : `HTTP ${response.status}`;
    const error = new Error(`Supabase 请求失败：${remoteMessage}`);
    error.name = "SupabaseRequestError";
    error.status = response.status;
    error.code = payload && typeof payload.code === "string" ? payload.code : null;
    error.details = payload ? payload.details ?? null : null;
    error.hint = payload ? payload.hint ?? null : null;
    error.isSupabaseError = true;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text || text.trim() === "") {
    return null;
  }

  return JSON.parse(text);
}

module.exports = { getRemoteKey, buildHeaders, supabaseRequest };

