const { env } = require('../config/env');

function getForwardHeaders(req) {
  const cookieHeader = req.headers.cookie || (req.cookies?.sid ? `sid=${req.cookies.sid}` : null);

  return {
    'Content-Type': 'application/json',
    'X-Organization-ID': req.organizationId,
    'X-User-ID': req.user.id,
    'X-User-Role': req.user.role,
    ...(req.user.contact_id ? { 'X-Contact-ID': req.user.contact_id } : {}),
    ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };
}

const aiController = {
  async predictComment(req, res) {
    try {
      const response = await fetch(`${env.aiBackendUrl}/api/legacy/predict-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: req.body?.comment }),
        signal: AbortSignal.timeout(env.aiRequestTimeoutMs),
      });

      const body = await response.json().catch(() => ({
        detail: 'AI moderation service returned an invalid response',
      }));

      if (!response.ok && body.detail && !body.message) {
        body.message = body.detail;
      }

      return res.status(response.status).json(body);
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return res.status(504).json({
          success: false,
          message: 'Message safety check timed out',
          detail: 'Message safety check timed out',
        });
      }
      return res.status(503).json({
        success: false,
        message: 'Message safety check is unavailable',
        detail: 'Start the AI backend or set AI_BACKEND_URL to its running URL.',
      });
    }
  },

  async chat(req, res, next) {
    try {
      const response = await fetch(`${env.aiBackendUrl}/api/v1/chat`, {
        method: 'POST',
        headers: getForwardHeaders(req),
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(env.aiRequestTimeoutMs),
      });

      const body = await response.json().catch(() => ({
        detail: 'AI service returned an invalid response',
      }));

      if (!response.ok && body.detail && !body.message) {
        body.message = body.detail;
      }

      return res.status(response.status).json(body);
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return res.status(504).json({
          success: false,
          message: 'AI service timed out while preparing the answer',
          detail: 'AI service timed out while preparing the answer',
        });
      }
      return res.status(503).json({
        success: false,
        message: `AI service is unavailable at ${env.aiBackendUrl}`,
        detail: 'Start the AI backend or set AI_BACKEND_URL to its running URL.',
      });
    }
  },
};

module.exports = aiController;
