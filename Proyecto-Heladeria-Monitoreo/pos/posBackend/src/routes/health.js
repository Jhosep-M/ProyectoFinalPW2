const { Router } = require('express');
const router = Router();
router.get('/', (_req, res) => res.json({ ok: true, service: 'pos-backend', ts: new Date().toISOString() }));
module.exports = { healthRouter: router };
