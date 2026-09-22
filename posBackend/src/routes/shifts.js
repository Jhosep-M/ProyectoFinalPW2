const { Router } = require('express');
const { authenticateJWT } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { cerrarTurnoSchema } = require('../validators/sales');
const { sequelize } = require('../config/database');

const router = Router();
router.use(authenticateJWT);

router.get('/', authorize('turno.consultar'), async (req, res) => {
  const userId = req.user.id;
  const [rows] = await sequelize.query(`SELECT * FROM turno_caja WHERE usuario_id = :uid OR EXISTS (SELECT 1 FROM usuario u JOIN rol r ON r.id_rol=u.rol_id JOIN rol_permiso rp ON rp.rol_id=r.id_rol JOIN permiso p ON p.id_permiso=rp.permiso_id WHERE u.id_usuario=:uid AND p.nombre='turno.consultar.todos') ORDER BY fecha_apertura DESC`, { replacements: { uid: userId } });
  res.json(rows);
});

router.post('/', authorize('turno.abrir'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { monto_inicial } = req.body;
    if (monto_inicial == null || monto_inicial < 0) return res.status(400).json({ error: 'monto_inicial >=0 requerido' });
    const [rows] = await sequelize.query(`INSERT INTO turno_caja (usuario_id, monto_inicial, estado) VALUES (:uid, :monto, 'abierto') RETURNING *`, { replacements: { uid: userId, monto: monto_inicial } });
    res.status(201).json(rows[0]);
  } catch (e) { if (e.original?.code === '23505') return res.status(409).json({ error: 'Ya tiene un turno abierto' }); next(e); }
});

router.post('/:id/cerrar', authorize('turno.cerrar'), async (req, res, next) => {
  try {
    const parsed = cerrarTurnoSchema.parse(req.body);
    const [rows] = await sequelize.query(`SELECT public.cerrar_turno(:id::uuid, :monto) as result`, { replacements: { id: req.params.id, monto: parsed.monto_final_real } });
    res.json(rows[0].result);
  } catch (e) { next(e); }
});

module.exports = { shiftsRouter: router };
