const { sequelize } = require('../config/database');
const { enviarConsumoAMonitoreo } = require('../integrations/monitoreoClient');

async function processColaOnce() {
  if (!process.env.MONITOREO_URL || !process.env.MONITOREO_API_KEY) {
    throw new Error('MONITOREO_URL/API_KEY required');
  }
  const url = process.env.MONITOREO_URL;
  const apiKey = process.env.MONITOREO_API_KEY;

  // Claim rows atomically inside a transaction using FOR UPDATE SKIP LOCKED
  const claimed = await sequelize.transaction(async (t) => {
    const [rows] = await sequelize.query(
      `
    SELECT ci.id_cola, ci.consumo_id, ci.idempotency_key, ci.intentos, cr.tipo_recurso, cr.cantidad, cr.unidad_medida, cr.fecha_consumo
    FROM cola_integracion ci JOIN consumo_reportado cr ON cr.id_consumo=ci.consumo_id
    WHERE ci.estado='pendiente' AND (ci.proximo_intento IS NULL OR ci.proximo_intento <= NOW())
    ORDER BY ci.creado_en LIMIT 5 FOR UPDATE SKIP LOCKED
  `,
      { transaction: t }
    );
    for (const r of rows) {
      await sequelize.query(
        `UPDATE cola_integracion SET estado='procesando', ultimo_intento=NOW(), intentos=intentos+1 WHERE id_cola=:id`,
        { replacements: { id: r.id_cola }, transaction: t }
      );
      // keep intentos incremented value for backoff calculation
      r.intentos = (r.intentos ?? 0) + 1;
    }
    return rows;
  });

  for (const r of claimed) {
    try {
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
        await sequelize.transaction(async (t) => {
          await sequelize.query(
            `UPDATE cola_integracion SET estado='enviado', respuesta=:body WHERE id_cola=:id`,
            { replacements: { id: r.id_cola, body: result.body }, transaction: t }
          );
          await sequelize.query(
            `UPDATE consumo_reportado SET estado='enviado' WHERE id_consumo=:cid`,
            { replacements: { cid: r.consumo_id }, transaction: t }
          );
        });
      } else {
        await sequelize.transaction(async (t) => {
          await sequelize.query(
            `UPDATE cola_integracion SET estado='error', error=:body, proximo_intento=NOW() + (interval '5 minutes' * :intentos) WHERE id_cola=:id`,
            { replacements: { id: r.id_cola, body: result.body, intentos: r.intentos }, transaction: t }
          );
          await sequelize.query(
            `UPDATE consumo_reportado SET estado='error' WHERE id_consumo=:cid`,
            { replacements: { cid: r.consumo_id }, transaction: t }
          );
        });
      }
    } catch (e) {
      await sequelize.transaction(async (t) => {
        await sequelize.query(
          `UPDATE cola_integracion SET estado='error', error=:err, proximo_intento=NOW() + (interval '5 minutes' * :intentos) WHERE id_cola=:id`,
          { replacements: { id: r.id_cola, err: e.message, intentos: r.intentos }, transaction: t }
        );
        await sequelize.query(
          `UPDATE consumo_reportado SET estado='error' WHERE id_consumo=:cid`,
          { replacements: { cid: r.consumo_id }, transaction: t }
        );
      });
    }
  }
  return claimed.length;
}

function startWorker(intervalMs = 30000) {
  const timer = setInterval(() => processColaOnce().catch(console.error), intervalMs);
  // allow process to exit if only worker remains
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { processColaOnce, startWorker };
