import { extractInformation } from '../states/extractRdsAndMetadataPerAccount/extractRdsAndMetadataPerAccount';
import { AccountDefinition } from '../states/types/AccountDefinition';
import { Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { RoleType } from '../states/types/RdsMetadata';
import { GetMetricDataInput } from 'aws-sdk/clients/cloudwatch';
import { assumeRoleForAccount } from '../states/sharedLibs/sts';

// Mock AWS SDK and Logger
jest.mock('aws-sdk', () => ({
  ResourceExplorer2: jest.fn().mockReturnValue({
    search: jest.fn().mockReturnValue({ promise: () => Promise.resolve({ Resources: [] }) }),
  }),
  RDS: jest.fn().mockReturnValue({
    describeDBInstances: jest.fn().mockReturnValue({ promise: () => Promise.resolve({ DBInstances: [] }) }),
    describeReservedDBInstances: jest.fn().mockReturnValue({ promise: () => Promise.reject() }),
    describeDBClusters: jest.fn().mockReturnValue({ promise: () => Promise.resolve({ DBClusters: [] }) }),
  }),
}));

jest.mock('../states/sharedLibs/sts', () => ({
  assumeRoleForAccount: jest.fn().mockResolvedValue({}),
}));

jest.mock('../states/sharedLibs/utils', () => ({
  logger: {
    info: jest.fn(),
  },
  initialiseLogger: jest.fn(),
}));

describe('extractRdsAndMetadataPerAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should assume a new role from different account', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    await extractInformation(metricData, null as Context);
    expect(assumeRoleForAccount).toHaveBeenCalled();
  });

  it('should search for clusters', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    await extractInformation(metricData, null as Context);
    expect(assumeRoleForAccount).toHaveBeenCalled();

    expect(resourceExplorerMock.search).toHaveBeenCalledWith({
      QueryString: `resourcetype:rds:cluster`,
      MaxResults: 1000,
    });
  });

  it('should search for instances', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    await extractInformation(metricData, null as Context);
    expect(assumeRoleForAccount).toHaveBeenCalled();

    expect(resourceExplorerMock.search).toHaveBeenCalledWith({ QueryString: `resourcetype:rds:db`, MaxResults: 1000 });
  });

  it('should change RDS Client based on Region of found resource', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    (resourceExplorerMock.search as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          Resources: [
            {
              Arn: 'arn:aws:rds:test-region:123456789012:db:my-mysql-instance-1',
              Region: 'test-region',
              ResourceType: 'rds:db',
            },
            {
              Arn: 'arn:aws:rds:test-region-2:123456789012:db:my-mysql-instance-1',
              Region: 'test-region-2',
              ResourceType: 'rds:db',
            },
          ],
        }),
    });

    await extractInformation(metricData, null as Context);

    expect(AWS.RDS).toHaveBeenCalledWith({ region: 'test-region' });
    expect(AWS.RDS).toHaveBeenCalledWith({ region: 'test-region-2' });
  });

  it('should call describe Instance with the name of the instance', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    const rdsMock = new AWS.RDS();

    (resourceExplorerMock.search as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          Resources: [
            {
              Arn: 'arn:aws:rds:test-region:123456789012:db:my-mysql-instance-1',
              Region: 'test-region',
              ResourceType: 'rds:db',
            },
          ],
        }),
    });

    await extractInformation(metricData, null as Context);
    expect(rdsMock.describeDBInstances).toHaveBeenCalledWith({ DBInstanceIdentifier: 'my-mysql-instance-1' });
  });

  it('should call describe Cluster with the name of the cluster', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    const rdsMock = new AWS.RDS();

    (resourceExplorerMock.search as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          Resources: [
            {
              Arn: 'arn:aws:rds:test-region:123456789012:db:my-mysql-instance-1',
              Region: 'test-region',
              ResourceType: 'rds:cluster',
            },
          ],
        }),
    });

    await extractInformation(metricData, null as Context);
    expect(rdsMock.describeDBClusters).toHaveBeenCalledWith({ DBClusterIdentifier: 'my-mysql-instance-1' });
  });

  it('should get children of clusters', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    const rdsMock = new AWS.RDS();

    (resourceExplorerMock.search as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          Resources: [
            {
              Arn: 'arn:aws:rds:test-region:123456789012:clusters:my-mysql-cluster-1',
              Region: 'test-region',
              ResourceType: 'rds:cluster',
            },
          ],
        }),
    });
    (rdsMock.describeDBClusters as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          DBClusters: [
            {
              Engine: 'mysql',
              DBClusterMembers: [
                { DBInstanceIdentifier: 'my-mysql-instance-1', IsClusterWriter: true },
                { DBInstanceIdentifier: 'my-mysql-instance-2' },
              ],
              DBClusterInstanceClass: 'rds-big-xl',
              DBClusterArn: '123',
            },
            
          ],
        }),
    });

    await extractInformation(metricData, null as Context);
    expect(rdsMock.describeDBInstances).toHaveBeenCalledWith({ DBInstanceIdentifier: 'my-mysql-instance-1' });
    expect(rdsMock.describeDBInstances).toHaveBeenCalledWith({ DBInstanceIdentifier: 'my-mysql-instance-2' });
  });

  it('should get extract missing cluster info from child', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    const rdsMock = new AWS.RDS();

    (resourceExplorerMock.search as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          Resources: [
            {
              Arn: 'arn:aws:rds:test-region:123456789012:clusters:my-mysql-cluster-1',
              Region: 'test-region',
              ResourceType: 'rds:cluster',
            },
          ],
        }),
    });
    (rdsMock.describeDBClusters as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          DBClusters: [
            {
              Engine: 'mysql',
              DBClusterMembers: [
                { DBInstanceIdentifier: 'my-mysql-instance-1', IsClusterWriter: true },
                { DBInstanceIdentifier: 'my-mysql-instance-2' },
              ],
              DBClusterArn: '123',
            },
            
          ],
        }),
    });

    const data = await extractInformation(metricData, null as Context);
    expect(data.instances[0].instanceType).not.toBeNull();
  });

  it('should return hasTags if tags are present.', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    (resourceExplorerMock.search as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          Resources: [
            {
              Name: 'my-mysql-instance-1',
              Arn: 'arn:aws:rds:test-region:123456789012:db:my-mysql-instance-1',
              Region: 'test-region',
              ResourceType: 'rds:db',
              Properties: [{ Data: [{ Key: 'Team' }] }],
            },
            {
              Arn: 'arn:aws:rds:test-region:123456789012:db:my-mysql-instance-2',
              Region: 'test-region',
              ResourceType: 'rds:db',
              Properties: [{ Data: [{ Key: 'Team' }] }],
            },
          ],
        }),
    });

    const rdsMock = new AWS.RDS();
    (rdsMock.describeDBInstances as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          DBInstances: [
            {
              Engine: 'mysql',
              DBInstanceClass: 'rds-big-xl',
            },
          ],
        }),
    });

    const data = await extractInformation(metricData, null as Context);
    expect(data.instances[0].hasRequiredTags).toBe(true);
  });

  it('should return savingsPlan if savingsPlan are present.', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    (resourceExplorerMock.search as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          Resources: [
            {
              Name: 'my-mysql-instance-1',
              Arn: 'arn:aws:rds:test-region:123456789012:db:my-mysql-instance-1',
              Region: 'test-region',
              ResourceType: 'rds:db',
              Properties: [{ Data: [{ Key: 'Team' }] }],
            },
          ],
        }),
    });

    const rdsMock = new AWS.RDS();
    (rdsMock.describeDBInstances as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          DBInstances: [
            {
              Engine: 'mysql',
              DBInstanceClass: 'rds-big-xl',
            },
          ],
        }),
    });

    const noSavingsPlan = await extractInformation(metricData, null as Context);
    expect(noSavingsPlan.instances[0].savingsPlan).toBe(false);

    (rdsMock.describeReservedDBInstances as any).mockReturnValue({
      promise: () => Promise.resolve({ ReservedDBInstances: [{ Name: 'my-mysql-instance-1' }] }),
    });

    const data = await extractInformation(metricData, null as Context);
    expect(data.instances[0].savingsPlan).toBe(true);
  });

  it('throws if resource does not match schema', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    (resourceExplorerMock.search as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          Resources: [
            {
              Name: 'my-mysql-instance-1',
              Arn: 'arn:aws:rds:test-region:123456789012:db:my-mysql-instance-1',
              Region: 'test-region',
              ResourceType: 'rds:blahblah',
              Properties: [{ Data: [{ Key: 'Team' }] }],
            },
          ],
        }),
    });

    try {
      await extractInformation(metricData, null as Context);
    } catch (e) {
      expect(true).toBe(true);
      return;
    }

    expect(false).toBe(true);
  });

  it('should return empty if no instances found or throws (Can happen if index is out of date.).', async () => {
    const metricData: AccountDefinition = {
      account: '1',
      organization: 'test',
    };

    const resourceExplorerMock = new AWS.ResourceExplorer2();
    (resourceExplorerMock.search as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          Resources: [
            {
              Name: 'my-mysql-instance-1',
              Arn: 'arn:aws:rds:test-region:123456789012:db:my-mysql-instance-1',
              Region: 'test-region',
              ResourceType: 'rds:db',
              Properties: [{ Data: [{ Key: 'Team' }] }],
            },
            {
              Arn: 'arn:aws:rds:test-region:123456789012:db:my-mysql-instance-2',
              Region: 'test-region',
              ResourceType: 'rds:db',
              Properties: [{ Data: [{ Key: 'Team' }] }],
            },
          ],
        }),
    });

    const rdsMock = new AWS.RDS();
    (rdsMock.describeDBInstances as any).mockReturnValue({
      promise: () =>
        Promise.resolve({
          DBInstances: null
        }),
    });

    const data = await extractInformation(metricData, null as Context);
    expect(data.instances.length).toBe(0);

    (rdsMock.describeDBInstances as any).mockReturnValue({
      promise: () =>
        Promise.reject(),
    });

    const thrownData = await extractInformation(metricData, null as Context);
    expect(thrownData.instances.length).toBe(0);
  });

  
});
