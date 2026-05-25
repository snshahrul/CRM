module.exports = {
  apps: [{
    name: 'crm',
    script: 'backend/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_PATH: '/var/lib/crm/crm.db',
      JWT_SECRET: 'change-this-to-a-random-string'
    },
    error_file: '/var/log/crm/err.log',
    out_file: '/var/log/crm/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_restarts: 10,
    restart_delay: 5000,
    watch: false
  }]
};
