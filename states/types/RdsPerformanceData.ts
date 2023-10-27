import { RdsMetadata } from './RdsMetadata';

export type PerformanceMetrics = {
  avg: number;
  p99: number;
  p95: number;
  p90: number;
  p50: number;
  max: number;
};

export type RdsPerformanceMetadata = RdsMetadata & {
  cpu: PerformanceMetrics;
  connections: PerformanceMetrics;
};
