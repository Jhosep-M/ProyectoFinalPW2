const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const { env } = require('./config/env');
const { apiLimiter } = require('./middlewares/rateLimit');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { healthRouter } = require('./routes/health');
const { salesRouter } = require('./routes/sales');
const { shiftsRouter } = require('./routes/shifts');
const { productsRouter } = require('./routes/products');
const { usersRouter } = require('./routes/users');
const { inventoryRouter } = require('./routes/inventory');
const { customersRouter } = require('./routes/customers');
const { ordersRouter } = require('./routes/orders');
const { paymentsRouter } = require('./routes/payments');
const { returnsRouter } = require('./routes/returns');
const { promotionsRouter } = require('./routes/promotions');
const { auditRouter } = require('./routes/audit');
const { integrationsRouter } = require('./routes/integrations');
const { configRouter } = require('./routes/config');

function createApp() {
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], objectSrc: ["'none'"] } },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp());
  app.use('/api', apiLimiter);

  app.use('/health', healthRouter);
  app.use('/api/v1/sales', salesRouter);
  app.use('/api/v1/shifts', shiftsRouter);
  app.use('/api/v1/products', productsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/inventory', inventoryRouter);
  app.use('/api/v1/customers', customersRouter);
  app.use('/api/v1/orders', ordersRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/returns', returnsRouter);
  app.use('/api/v1/promotions', promotionsRouter);
  app.use('/api/v1/audit', auditRouter);
  app.use('/api/v1/integrations', integrationsRouter);
  app.use('/api/v1/config', configRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
