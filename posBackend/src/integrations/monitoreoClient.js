async function enviarConsumoAMonitoreo(payload, apiKey, url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('monitoreo url requerido');
  }
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('monitoreo apiKey requerido');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('monitoreo url invalida');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('monitoreo url debe ser http(s)');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('timeout 5s al contactar monitoreo');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { enviarConsumoAMonitoreo };
