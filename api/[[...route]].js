module.exports = async function vercelHandler(request, response) {
  const { loadEnvFile } = require("../server/env");
  const { handleRequest } = require("../server/app");

  loadEnvFile();
  return handleRequest(request, response);
};
