const { Router } = require('express');
const { authenticateJWT } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { sequelize } = require('../config/database');

const router = Router();
router.use(authenticateJWT);

router.get('/', authorize('integracion.consultar'), async (req, res, next) => {
  try {
    const estado = req.query.estado;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const repl = { limit, offset };
    let where = '';
    if (estado) { where = 'WHERE estado=:estado'; repl.estado = estado; }
    const [rows] = await sequelize.query(`SELECT * FROM cola_integracion ${where} ORDER BY creado_en DESC LIMIT :limit OFFSET :offset`, { replacements: repl });
    const [countRows] = await sequelize.query(`SELECT COUNT(*)::int as total FROM cola_integracion ${where}`, { replacements: repl });
    res.json({ data: rows, total: countRows[0].total, limit, offset });
  } catch (e) { next(e); }
});

router.get('/cola', authorize('integracion.consultar'), async (req, res, next) => {
  try {
    const estado = req.query.estado || 'pendiente';
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const [rows] = await sequelize.query(`SELECT * FROM cola_integracion WHERE estado=:estado ORDER BY creado_en ASC LIMIT :limit`, { replacements: { estado, limit } });
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', authorize('integracion.consultar'), async (req, res, next) => {
  try {
    const [rows] = await sequelize.query(`SELECT * FROM cola_integracion WHERE id_cola=:id`, { replacements: { id: req.params.id } });
    if (!rows[0]) return res.status(404).json({ error: 'Cola no encontrada' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/:id/reintentar', authorize('integracion.gestionar'), async (req, res, next) => {
  try {
    const [rows] = await sequelize.query(`UPDATE cola_integracion SET estado='pendiente', proximo_intento=NOW(), intentos=0 WHERE id_cola=:id RETURNING *`, { replacements: { id: req.params.id } });
    if (!rows[0]) return res.status(404).json({ error: 'Cola no encontrada' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = { integrationsRouter: router };
