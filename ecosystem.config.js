module.exports = {
    apps: [
      {
        name: 'visual-audio-book-workers',
        script: 'pnpm',
        args: 'run worker:start',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'production'
        }
      }
    ]
  };