const { Router } = require('express');
const { authenticateJWT } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { sequelize } = require('../config/database');

const router = Router();
router.use(authenticateJWT);
router.get('/', authorize('producto.consultar'), async (_req, res) => {
  const [rows] = await sequelize.query(`SELECT p.*, c.nombre as categoria FROM producto p LEFT JOIN categoria c ON c.id_categoria=p.categoria_id WHERE p.estado='activo' ORDER BY p.nombre`);
  res.json(rows);
});
router.post('/', authorize('producto.gestionar'), async (req, res, next) => {
  try {
    const { categoria_id, nombre, precio, stock, stock_minimo } = req.body;
    const [rows] = await sequelize.query(`INSERT INTO producto (categoria_id, nombre, precio, stock, stock_minimo) VALUES (:cat, :nom, :pre, :stock, :min) RETURNING *`, { replacements: { cat: categoria_id, nom: nombre, pre: precio, stock: stock||0, min: stock_minimo||0 } });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
module.exports = { productsRouter: router };
