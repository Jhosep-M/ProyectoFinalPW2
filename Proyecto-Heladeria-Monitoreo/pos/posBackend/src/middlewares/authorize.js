const { sequelize } = require('../config/database');

function authorize(permiso) {
  return async (req, res, next) => {
    const user = req.user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [rows] = await sequelize.query(
        `SELECT EXISTS (
           SELECT 1 FROM usuario u
           JOIN rol r ON r.id_rol = u.rol_id
           JOIN rol_permiso rp ON rp.rol_id = r.id_rol
           JOIN permiso p ON p.id_permiso = rp.permiso_id
           WHERE u.id_usuario = :uid AND u.estado='activo' AND r.estado='activo' AND p.nombre = :perm
         ) as has_perm`,
        { replacements: { uid: user.id, perm: permiso } }
      );
      const has = rows[0]?.has_perm;
      if (!has) return res.status(403).json({ error: 'Forbidden', permiso });
      next();
    } catch (e) {
      return res.status(500).json({ error: 'RBAC check failed', detail: e.message });
    }
  };
}

module.exports = { authorize };
