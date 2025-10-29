export default () => ({
  // Server
  port: parseInt(process.env.REDIS_PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  // CORS
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    credentials: true,
  },

  // Security
  security: {
    bcryptRounds: 12,
    rateLimit: {
      ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10),
      limit: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
    },
  },
});
