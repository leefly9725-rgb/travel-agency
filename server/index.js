const { createServer } = require("./app");

const preferredPort = Number(process.env.PORT || 3000);
const maxAttempts = 10;

function startServer(port, attempt = 0) {
  const server = createServer();

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attempt < maxAttempts) {
      const nextPort = port + 1;
      console.log(`端口 ${port} 已被占用，正在尝试端口 ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    if (error.code === "EADDRINUSE") {
      console.error(`启动失败：从端口 ${preferredPort} 开始连续尝试了 ${maxAttempts + 1} 个端口，仍然都被占用。`);
      console.error("你可以先关闭占用中的进程，或者手动指定端口，例如：");
      console.error("PowerShell: $env:PORT=3015; npm start");
      process.exit(1);
    }

    console.error("启动失败：", error.message);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`泷鼎晟国际旅行社运营系统 V1.0 已启动：http://localhost:${port}`);
    if (port !== preferredPort) {
      console.log(`注意：默认端口 ${preferredPort} 被占用，本次已自动切换到 ${port}。`);
    }
  });
}

startServer(preferredPort);

