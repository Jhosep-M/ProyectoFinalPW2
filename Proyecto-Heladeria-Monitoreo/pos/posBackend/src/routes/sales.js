const { Router } = require('express');
const { authenticateJWT } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { registrarVentaSchema } = require('../validators/sales');
const { sequelize } = require('../config/database');

const router = Router();
router.use(authenticateJWT);

router.get('/', authorize('venta.consultar'), async (_req, res) => {
  const [rows] = await sequelize.query(`SELECT * FROM venta ORDER BY fecha DESC LIMIT 50`);
  res.json(rows);
});

router.post('/', authorize('venta.crear'), async (req, res, next) => {
  try {
    const parsed = registrarVentaSchema.parse(req.body);
    const userId = req.user.id;
    const [result] = await sequelize.query(`SELECT public.registrar_venta(:uid, :turno, :cliente, :items::jsonb, :desc, :pagos::jsonb) as venta_id`, {
      replacements: { uid: userId, turno: parsed.turno_id, cliente: parsed.cliente_id || null, items: JSON.stringify(parsed.items), desc: parsed.descuento, pagos: JSON.stringify(parsed.pagos) },
    });
    res.status(201).json({ venta_id: result[0].venta_id });
  } catch (e) { next(e); }
});

router.post('/:id/anular', authorize('venta.anular'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { motivo } = req.body;
    if (!motivo || motivo.trim().length < 5) return res.status(400).json({ error: 'motivo requerido >=5 chars' });
    await sequelize.query(`SELECT public.anular_venta(:venta, :uid, :motivo)`, { replacements: { venta: req.params.id, uid: userId, motivo } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = { salesRouter: router };
