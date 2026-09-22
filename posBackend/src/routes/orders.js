const { Router } = require('express');
const { authenticateJWT } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { createOrderSchema, updateOrderSchema } = require('../validators/orders');
const { sequelize } = require('../config/database');
const { auditLog } = require('../utils/audit');

const router = Router();
router.use(authenticateJWT);

router.get('/', authorize('pedido.consultar'), async (_req, res, next) => {
  try {
    const [rows] = await sequelize.query(`SELECT p.*, m.nombre as mesa_nombre, u.nombre as mesero_nombre FROM pedido p LEFT JOIN mesa m ON m.id_mesa=p.mesa_id LEFT JOIN usuario u ON u.id_usuario=p.mesero_id ORDER BY p.fecha DESC LIMIT 100`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', authorize('pedido.consultar'), async (req, res, next) => {
  try {
    const [rows] = await sequelize.query(`SELECT * FROM pedido WHERE id_pedido=:id`, { replacements: { id: req.params.id } });
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    const [detalles] = await sequelize.query(`SELECT dp.*, pr.nombre as producto_nombre, pr.precio FROM detalle_pedido dp LEFT JOIN producto pr ON pr.id_producto=dp.producto_id WHERE dp.pedido_id=:id`, { replacements: { id: req.params.id } });
    res.json({ ...rows[0], detalles });
  } catch (e) { next(e); }
});

router.post('/', authorize('pedido.crear'), async (req, res, next) => {
  try {
    const parsed = createOrderSchema.parse(req.body);
    const meseroId = parsed.mesero_id || req.user.id;
    const [pedidoRows] = await sequelize.query(
      `INSERT INTO pedido (mesa_id, mesero_id, estado) VALUES (:mesa, :mesero, :estado) RETURNING *`,
      { replacements: { mesa: parsed.mesa_id || null, mesero: meseroId, estado: parsed.estado } }
    );
    const pedido = pedidoRows[0];
    // insertar detalles; precio se toma de producto si no viene del frontend (no confiar frontend)
    for (const item of parsed.items) {
      const [prodRows] = await sequelize.query(`SELECT precio FROM producto WHERE id_producto=:id`, { replacements: { id: item.producto_id } });
      const precio = item.precio_unitario != null ? item.precio_unitario : (prodRows[0]?.precio ?? 0);
      await sequelize.query(
        `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, observacion) VALUES (:pedido, :prod, :cant, :precio, :obs)`,
        { replacements: { pedido: pedido.id_pedido, prod: item.producto_id, cant: item.cantidad, precio, obs: item.observacion || parsed.observacion || null } }
      );
    }
    await auditLog({ usuario_id: req.user.id, accion: 'pedido.crear', entidad: 'pedido', entidad_id: pedido.id_pedido, resultado: 'exito', detalle: parsed, ip: req.ip, userAgent: req.headers['user-agent'] });
    const [detalles] = await sequelize.query(`SELECT * FROM detalle_pedido WHERE pedido_id=:id`, { replacements: { id: pedido.id_pedido } });
    res.status(201).json({ ...pedido, detalles });
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: e.errors });
    next(e);
  }
});

router.patch('/:id', authorize('pedido.gestionar'), async (req, res, next) => {
  try {
    const parsed = updateOrderSchema.parse(req.body);
    const sets = [];
    const repl = { id: req.params.id };
    if (parsed.mesa_id !== undefined) { sets.push('mesa_id=:mesa'); repl.mesa = parsed.mesa_id; }
    if (parsed.estado !== undefined) { sets.push('estado=:estado'); repl.estado = parsed.estado; }
    if (parsed.estado === 'cancelado' || parsed.estado === 'cobrado') { sets.push('fecha_cierre=NOW()'); }
    if (sets.length > 0) {
      const [rows] = await sequelize.query(`UPDATE pedido SET ${sets.join(', ')} WHERE id_pedido=:id RETURNING *`, { replacements: repl });
      if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
      // si vienen items nuevos, reemplazar detalles (solo si estado abierto)
      if (parsed.items) {
        await sequelize.query(`DELETE FROM detalle_pedido WHERE pedido_id=:id`, { replacements: { id: req.params.id } });
        for (const item of parsed.items) {
          const [prodRows] = await sequelize.query(`SELECT precio FROM producto WHERE id_producto=:id`, { replacements: { id: item.producto_id } });
          const precio = item.precio_unitario != null ? item.precio_unitario : (prodRows[0]?.precio ?? 0);
          await sequelize.query(`INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, observacion) VALUES (:pedido, :prod, :cant, :precio, :obs)`, { replacements: { pedido: req.params.id, prod: item.producto_id, cant: item.cantidad, precio, obs: item.observacion || null } });
        }
      }
      await auditLog({ usuario_id: req.user.id, accion: 'pedido.actualizar', entidad: 'pedido', entidad_id: req.params.id, resultado: 'exito', detalle: parsed, ip: req.ip, userAgent: req.headers['user-agent'] });
      const [updated] = await sequelize.query(`SELECT * FROM pedido WHERE id_pedido=:id`, { replacements: { id: req.params.id } });
      const [detalles] = await sequelize.query(`SELECT * FROM detalle_pedido WHERE pedido_id=:id`, { replacements: { id: req.params.id } });
      return res.json({ ...updated[0], detalles });
    }
    res.json({ message: 'sin cambios' });
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: e.errors });
    next(e);
  }
});

module.exports = { ordersRouter: router };
