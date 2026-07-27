/**
 * Structured pino logger for the indexer application.
 * Never log private keys or other secrets.
 */
import { pino } from 'pino'
import { config } from './config.js'

export const logger = pino({
  level: config.logLevel,
  base: { service: 'openbadge-indexer' },
})
