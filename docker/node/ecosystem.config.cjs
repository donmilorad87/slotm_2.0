module.exports = {
  apps: [
    {
      name: "slotm",
      script: "/home/node/app/dist/server.js",
      cwd: "/home/node/app",
      instances: 1,
      exec_mode: "fork",
      watch: process.env.NODE_ENV !== "production"
        ? ["/home/node/app/dist"]
        : false,
      watch_delay: 1000,
      ignore_watch: ["node_modules", "data", ".git"],
      max_memory_restart: "256M",
      env: {
        NODE_ENV: process.env.NODE_ENV || "development",
      },
      restart_delay: 2000,
      max_restarts: 10,
      autorestart: true,
    },
  ],
};
