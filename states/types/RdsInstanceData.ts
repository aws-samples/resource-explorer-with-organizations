import { RdsPerformanceMetadata } from './RdsPerformanceData';

export type RdsInstanceData = {
  account: string; // The account it is associated with.
  instances: Partial<RdsPerformanceMetadata>[];
};
