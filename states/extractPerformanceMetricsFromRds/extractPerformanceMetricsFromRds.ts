 import { Context } from 'aws-lambda';
import { RdsInstanceData } from '../types/RdsInstanceData';
import { RdsMetadata, RoleType } from '../types/RdsMetadata';
import { CloudWatch } from 'aws-sdk';
import { RdsPerformanceMetadata, PerformanceMetrics } from '../types/RdsPerformanceData';
import { MetricDataResult } from 'aws-sdk/clients/cloudwatch';
import { map, reduce } from 'lodash';
import { assumeRoleForAccount } from '../sharedLibs/sts';
import { logger, initialiseLogger } from '../sharedLibs/utils';

initialiseLogger(`extractPerformanceMetricsFromRds`);
// Tuple of values.
const DEFAULT_METRICS: PerformanceMetrics = {
  p99: 0,
  p90: 0,
  p95: 0,
  p50: 0,
  avg: 0,
  max: 0,
};
const RELEVANT_METRICS = [
  ['p99', 'p99'],
  ['p90', 'p90'],
  ['p50', 'p50'],
  ['p95', 'p95'],
  ['Average', 'avg'],
  ['Maximum', 'max'],
];
const TIME_FRAME = 7 * 24 * 60 * 60 * 1000; // 7days;

export async function extractMetricInformation(
  { instances, account }: RdsInstanceData,
  _context: Context,
): Promise<RdsInstanceData> {
  console.log(assumeRoleForAccount)
  await assumeRoleForAccount(account);

  logger.info('Adding CPU and Connection Metrics to RDS Data');
  const performanceEnrichedInstances = await Promise.all(map(instances, enrichWithMetricData));

  logger.info(`Enriched Data: ${JSON.stringify(performanceEnrichedInstances)}`);
  return { account, instances: performanceEnrichedInstances };
}

async function enrichWithMetricData(metadata: Partial<RdsPerformanceMetadata>): Promise<RdsPerformanceMetadata> {
  const partialMeta = metadata as RdsMetadata;
  const cpuPerformance = await getPerformanceMetrics(partialMeta, 'CPUUtilization', 'Percent');
  const dbConnections = await getPerformanceMetrics(partialMeta, 'DatabaseConnections', 'Count');

  return {
    ...metadata,
    cpu: cpuPerformance,
    connections: dbConnections,
  } as RdsPerformanceMetadata;
}

async function getPerformanceMetrics(
  rdsMetadata: RdsMetadata,
  metricType: string,
  metricUnit: string,
): Promise<PerformanceMetrics> {
  // Ok so we need to call cloudwatch api
  const cloudwatchRegionalClient = new CloudWatch({
    region: rdsMetadata.region,
  });

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - TIME_FRAME); // 7 days ago

  const { role, name } = rdsMetadata;
  const metricDimension = role == RoleType.CLUSTER ? 'DBClusterIdentifier' : 'DBInstanceIdentifier';
  const metricDataQueries = RELEVANT_METRICS.map(([metric, id]) => ({
    Id: id,
    MetricStat: {
      Metric: {
        Namespace: 'AWS/RDS',
        MetricName: metricType,
        Dimensions: [
          {
            Name: metricDimension,
            Value: name,
          },
        ],
      },
      Period: TIME_FRAME,
      Stat: metric,
      Unit: metricUnit,
    },
  }));

  const time = await cloudwatchRegionalClient
    .getMetricData({
      StartTime: startTime,
      EndTime: endTime,
      MetricDataQueries: metricDataQueries,
      ScanBy: 'TimestampDescending',
    })
    .promise();

  logger.info(JSON.stringify(time));

  return reduce(
    time.MetricDataResults,
    (acc: PerformanceMetrics, data: MetricDataResult) => ({
      ...acc,
      [data.Id]: data.Values[0] || 0,
    }),
    DEFAULT_METRICS as PerformanceMetrics,
  );
}
