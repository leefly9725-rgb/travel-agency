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
    throw new Error(`Supabase 请求失败：${response.status} ${text}`);
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


