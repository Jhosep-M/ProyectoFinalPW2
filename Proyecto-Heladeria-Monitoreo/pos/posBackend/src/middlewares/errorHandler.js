function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal error', ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}) });
}

function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}

module.exports = { errorHandler, notFound };
