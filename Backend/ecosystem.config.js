module.exports = {
  apps: [
    {
      name: 'quiz-tn-backend',
      script: 'dist/main.js',
      instances: 'max',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: '51.38.234.49',
      ref: 'origin/main',
      repo: 'https://github.com/AhmedKazdar/QUIZ-TN.git',
      path: '/var/www/quiz-tn-backend',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};
