'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const routes = require('./routes');
const { mountSwagger } = require('./common/swagger');
const { generalLimiter } = require('./middleware/rateLimit.middleware');
const { requestLogger } = require('./middleware/requestLogger.middleware');
const { globalErrorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // API — CSP not required
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = config.cors.origin;
    if (allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestLogger);
app.use('/api/', generalLimiter);

// static uploads
app.use('/uploads', express.static(path.resolve(process.cwd(), config.upload.dir)));

// Swagger
if (config.swagger.enabled) mountSwagger(app);

// Root ping
app.get('/', (_req, res) =>
  res.json({
    name: 'Background Verification Portal API',
    version: '1.0.0',
    docs: '/api/docs',
    health: '/api/v1/health',
  })
);

// API routes
app.use('/api/v1', routes);

// 404 + error
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
