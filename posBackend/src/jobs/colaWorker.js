const { sequelize } = require('../config/database');
const { enviarConsumoAMonitoreo } = require('../integrations/monitoreoClient');

async function processColaOnce() {
  const [rows] = await sequelize.query(`
    SELECT ci.id_cola, ci.consumo_id, ci.idempotency_key, ci.intentos, cr.tipo_recurso, cr.cantidad, cr.unidad_medida, cr.fecha_consumo
    FROM cola_integracion ci JOIN consumo_reportado cr ON cr.id_consumo=ci.consumo_id
    WHERE ci.estado='pendiente' AND (ci.proximo_intento IS NULL OR ci.proximo_intento <= NOW())
    ORDER BY ci.creado_en LIMIT 5 FOR UPDATE SKIP LOCKED
  `);
  for (const r of rows) {
    await sequelize.query(
      `UPDATE cola_integracion SET estado='procesando', ultimo_intento=NOW(), intentos=intentos+1 WHERE id_cola=:id`,
      { replacements: { id: r.id_cola } }
    );
    try {
      const url = process.env.MONITOREO_URL || 'https://monitoreo.example.com/api/v1/integrations/consumption';
      const apiKey = process.env.MONITOREO_API_KEY || 'dummy';
      const result = await enviarConsumoAMonitoreo(
        {
          consumoExternoId: r.consumo_id,
          idempotencyKey: r.idempotency_key,
          tipoRecurso: r.tipo_recurso,
          cantidad: Number(r.cantidad),
          unidadMedida: r.unidad_medida,
          fechaConsumo: r.fecha_consumo,
          origen: 'POS',
        },
        apiKey,
        url
      );
      if (result.ok) {
        await sequelize.query(
          `UPDATE cola_integracion SET estado='enviado', respuesta=:body WHERE id_cola=:id`,
          { replacements: { id: r.id_cola, body: result.body } }
        );
        await sequelize.query(
          `UPDATE consumo_reportado SET estado='enviado' WHERE id_consumo=:cid`,
          { replacements: { cid: r.consumo_id } }
        );
      } else {
        await sequelize.query(
          `UPDATE cola_integracion SET estado='error', error=:body, proximo_intento=NOW() + (interval '5 minutes' * intentos) WHERE id_cola=:id`,
          { replacements: { id: r.id_cola, body: result.body } }
        );
        await sequelize.query(
          `UPDATE consumo_reportado SET estado='error' WHERE id_consumo=:cid`,
          { replacements: { cid: r.consumo_id } }
        );
      }
    } catch (e) {
      await sequelize.query(
        `UPDATE cola_integracion SET estado='error', error=:err, proximo_intento=NOW() + (interval '5 minutes' * intentos) WHERE id_cola=:id`,
        { replacements: { id: r.id_cola, err: e.message } }
      );
      await sequelize.query(
        `UPDATE consumo_reportado SET estado='error' WHERE id_consumo=:cid`,
        { replacements: { cid: r.consumo_id } }
      );
    }
  }
  return rows.length;
}

function startWorker(intervalMs = 30000) {
  const timer = setInterval(() => processColaOnce().catch(console.error), intervalMs);
  // allow process to exit if only worker remains
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { processColaOnce, startWorker };
