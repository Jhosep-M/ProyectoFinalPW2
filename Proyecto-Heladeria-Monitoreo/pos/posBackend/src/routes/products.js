const { Router } = require('express');
const { authenticateJWT } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { createProductSchema } = require('../validators/product');
const { sequelize } = require('../config/database');

const router = Router();
router.use(authenticateJWT);
router.get('/', authorize('producto.consultar'), async (_req, res) => {
  const [rows] = await sequelize.query(`SELECT p.*, c.nombre as categoria FROM producto p LEFT JOIN categoria c ON c.id_categoria=p.categoria_id WHERE p.estado='activo' ORDER BY p.nombre`);
  res.json(rows);
});
router.post('/', authorize('producto.gestionar'), async (req, res, next) => {
  try {
    const parsed = createProductSchema.parse(req.body);
    const [rows] = await sequelize.query(`INSERT INTO producto (categoria_id, nombre, precio, stock, stock_minimo) VALUES (:cat, :nom, :pre, :stock, :min) RETURNING *`, { replacements: { cat: parsed.categoria_id || null, nom: parsed.nombre, pre: parsed.precio, stock: parsed.stock ?? 0, min: parsed.stock_minimo ?? 0 } });
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: e.errors });
    next(e);
  }
});
module.exports = { productsRouter: router };
