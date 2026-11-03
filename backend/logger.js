/**
 * @module logger
 */
const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('node:crypto');

const SERVICE = 'backend';
/**
 * Crée un logger Pino JSON : champs `service` et `env`, niveau `LOG_LEVEL`, données sensibles masquées.
 * @param {object} [options]
 * @param {string} [options.level] - fatal, error, warn, info, debug, trace ou silent.
 * @param {stream.Writable} [options.destination] - Sortie (stdout par défaut).
 * @returns {pino.Logger}
 */
function createLogger({ level = process.env.LOG_LEVEL, destination } = {}) {
  const allowed = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
  return pino({
    level: allowed.includes(level) ? level : 'info',
    base: { service: SERVICE, env: process.env.APP_ENV || process.env.NODE_ENV || 'development' },
    redact: { paths: ['password', 'token', 'secret', 'authorization', 'cookie', 'email', 'apiKey',
      'body', 'headers', '*.headers', 'shippingAddress', 'req.body', 'req.headers', 'headers.authorization', 'headers.cookie',
      '*.password', '*.token', '*.secret', '*.email', '*.apiKey'], censor: '[REDACTED]' },
    serializers: { err: () => ({ type: 'Error' }) },
  }, destination);
}
const logger = createLogger();
/**
 * Middleware de journal HTTP : méthode, code de réponse, route et en-tête `X-Request-Id`.
 * N'écrit jamais d'en-têtes, de corps ni d'URL.
 * @param {pino.Logger} [instance]
 * @returns {express.RequestHandler}
 */
function requestLogging(instance = logger) {
  return pinoHttp({
    logger: instance,
    wrapSerializers: false,
    quietReqLogger: true,
    genReqId(req, res) {
      const id = randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    // Allowlist fields: never serialize raw URLs, query strings, headers or bodies.
    serializers: {
      req: req => ({ id: req.id, method: req.method }),
      res: res => ({ statusCode: res.statusCode }),
      err: () => ({ type: 'Error' }),
    },
    customSuccessObject: (req, res, value) => ({ ...value, route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched' }),
    customErrorObject: (req, res, error, value) => ({ ...value, route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched' }),
    customLogLevel(req, res, error) {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return error ? 'error' : 'info';
    },
  });
}
/**
 * Gestionnaire d'erreurs final : répond en JSON sans détail technique.
 * @param {Error} error
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {function} next
 * @returns {void}
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) { res.destroy(); return; }
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  res.status(status).json({ message: status === 500 ? 'Erreur serveur.' : 'Requête invalide.' });
}
module.exports = { logger, createLogger, requestLogging, errorHandler };
