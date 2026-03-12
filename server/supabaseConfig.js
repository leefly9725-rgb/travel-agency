function readValue(key) {
  return String(process.env[key] || "").trim();
}

function getSupabaseConfig() {
  const url = readValue("SUPABASE_URL");
  const publishableKey = readValue("SUPABASE_PUBLISHABLE_KEY");
  const anonKey = readValue("SUPABASE_ANON_KEY");
  const serviceRoleKey = readValue("SUPABASE_SERVICE_ROLE_KEY");

  return {
    url,
    publishableKey,
    anonKey,
    serviceRoleKey,
    enabled: Boolean(url && (publishableKey || anonKey)),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  };
}

module.exports = {
  getSupabaseConfig,
};
