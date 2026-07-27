/**
 * Structured pino logger for the worker application.
 *
 * NOTE: never log private keys or other secrets. The redact list below is a
 * safety net in case a config or job object is ever logged accidentally.
 */
import { pino } from 'pino'
import { config } from './config.js'

export const logger = pino({
  level: config.logLevel,
  base: { service: 'openbadge-worker' },
  redact: {
    paths: ['minterPrivateKey', '*.minterPrivateKey', 'privateKey', '*.privateKey'],
    censor: '[REDACTED]',
  },
})
