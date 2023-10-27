import { Logger } from '@aws-lambda-powertools/logger';

export let logger: Logger | null = null;
export function initialiseLogger(serviceName: string): void {
  logger = new Logger({ serviceName });
}
