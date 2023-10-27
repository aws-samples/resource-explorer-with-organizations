import { extractMetricInformation } from '../states/extractPerformanceMetricsFromRds/extractPerformanceMetricsFromRds';
import { RdsInstanceData } from '../states/types/RdsInstanceData';
import { Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { RoleType } from '../states/types/RdsMetadata';
import { GetMetricDataInput } from 'aws-sdk/clients/cloudwatch';
import { assumeRoleForAccount } from '../states/sharedLibs/sts';

// Mock AWS SDK and Logger
jest.mock('aws-sdk', () => ({
  CloudWatch: jest.fn().mockReturnValue({
    getMetricData: jest.fn().mockReturnValue({ promise: () => Promise.resolve({ MetricDataResults: [{ Id: 'p95', Values: [15.4] }] }) }),
  }),
}));

jest.mock('../states/sharedLibs/sts', () => ({ 
    assumeRoleForAccount: jest.fn().mockResolvedValue({})
}));

jest.mock('../states/sharedLibs/utils', () => ({
  logger: {
    info: jest.fn(),
  },
  initialiseLogger: jest.fn(),
}));

describe('extractPerformanceMetricsFromRds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should assume a new role from different account', async () => {
    const metricData: RdsInstanceData = {
        account: '1',
        instances: [],
      };
  
      await extractMetricInformation(metricData, null as Context);
      expect(assumeRoleForAccount).toHaveBeenCalled();
  });

  it('should adjust the region of the client based on the instances', async () => {
    const metricData: RdsInstanceData = {
        account: '1',
        instances: [
          {
            name: 'name',
            account: '1',
            region: 'region-test',
            arn: 'arn',
            instanceType: 'instanceType',
            role: RoleType.CLUSTER,
            savingsPlan: false,
            hasRequiredTags: true,
            engine: 'engine',
          },
        ],
      };
  
      await extractMetricInformation(metricData, null as Context);
      expect(AWS.CloudWatch).toHaveBeenCalledWith({ region: 'region-test' });
  });

  it('should request metrics for DBCluster if Cluster is present', async () => {
    const metricData: RdsInstanceData = {
      account: '1',
      instances: [
        {
          name: 'name',
          account: '1',
          region: 'region',
          arn: 'arn',
          instanceType: 'instanceType',
          role: RoleType.CLUSTER,
          savingsPlan: false,
          hasRequiredTags: true,
          engine: 'engine',
        },
      ],
    };

    const mockedCloudwatch = new AWS.CloudWatch();

    await extractMetricInformation(metricData, null as Context);
    const mockedCall = mockedCloudwatch.getMetricData as any;
    const data: GetMetricDataInput = mockedCall.mock.calls[0][0];

    expect(data.MetricDataQueries[0].MetricStat.Metric.Dimensions[0].Name).toEqual("DBClusterIdentifier")
  });

  it('should request metrics for DBInstance if Instance is present', async () => {
    const metricData: RdsInstanceData = {
        account: '1',
        instances: [
          {
            name: 'name',
            account: '1',
            region: 'region',
            arn: 'arn',
            instanceType: 'instanceType',
            role: RoleType.READER,
            savingsPlan: false,
            hasRequiredTags: true,
            engine: 'engine',
          },
        ],
      };
  
      const mockedCloudwatch = new AWS.CloudWatch();
  
      await extractMetricInformation(metricData, null as Context);
      const mockedCall = mockedCloudwatch.getMetricData as any;
      const data: GetMetricDataInput = mockedCall.mock.calls[0][0];
  
      expect(data.MetricDataQueries[0].MetricStat.Metric.Dimensions[0].Name).toEqual("DBInstanceIdentifier")
  });

  it('should request metrics for CPU in percent', async () => {
    const metricData: RdsInstanceData = {
        account: '1',
        instances: [
          {
            name: 'name',
            account: '1',
            region: 'region',
            arn: 'arn',
            instanceType: 'instanceType',
            role: RoleType.READER,
            savingsPlan: false,
            hasRequiredTags: true,
            engine: 'engine',
          },
        ],
      };
  
      const mockedCloudwatch = new AWS.CloudWatch();
  
      await extractMetricInformation(metricData, null as Context);
      const mockedCall = mockedCloudwatch.getMetricData as any;
      const data: GetMetricDataInput = mockedCall.mock.calls[0][0];
  
      expect(data.MetricDataQueries.some(it => { 
        return it.MetricStat.Metric.MetricName == 'CPUUtilization' && it.MetricStat.Unit == 'Percent'
      })).toBe(true);

      expect(data.MetricDataQueries.some(it => { 
        return it.MetricStat.Metric.MetricName == 'CPUUtilization' && it.MetricStat.Unit != 'Percent'
      })).toBe(false);
  });

  it('should request metrics for Connections in Count', async () => {
    const metricData: RdsInstanceData = {
        account: '1',
        instances: [
          {
            name: 'name',
            account: '1',
            region: 'region',
            arn: 'arn',
            instanceType: 'instanceType',
            role: RoleType.READER,
            savingsPlan: false,
            hasRequiredTags: true,
            engine: 'engine',
          },
        ],
      };
  
      const mockedCloudwatch = new AWS.CloudWatch();
  
      await extractMetricInformation(metricData, null as Context);
      const mockedCall = mockedCloudwatch.getMetricData as any;
      const data: GetMetricDataInput = mockedCall.mock.calls[1][0];
  
      expect(data.MetricDataQueries.some(it => { 
        return it.MetricStat.Metric.MetricName == 'DatabaseConnections' && it.MetricStat.Unit == 'Count'
      })).toBe(true);

      expect(data.MetricDataQueries.some(it => { 
        return it.MetricStat.Metric.MetricName == 'DatabaseConnections' && it.MetricStat.Unit != 'Count'
      })).toBe(false);
  });

  it('should return 0 if the CPU or Connections returns 0 for performance', async () => {
    const metricData: RdsInstanceData = {
        account: '1',
        instances: [
          {
            name: 'name',
            account: '1',
            region: 'region',
            arn: 'arn',
            instanceType: 'instanceType',
            role: RoleType.READER,
            savingsPlan: false,
            hasRequiredTags: true,
            engine: 'engine',
          },
        ],
      };
  
      const mockedCloudwatch = new AWS.CloudWatch();
      (mockedCloudwatch.getMetricData as any).mockReturnValue({ promise: () => Promise.resolve({ MetricDataResults: [{ Id: 'p95', Values: [15.4]},{ Id: 'p90', Values: [] }]}) });

      const rdsData = await extractMetricInformation(metricData, null as Context);
      expect(rdsData.instances[0].cpu['p90']).toBe(0);
      expect(rdsData.instances[0].cpu['p95']).toBe(15.4);
  });
});
