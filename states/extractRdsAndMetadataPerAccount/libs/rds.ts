import { RDS } from 'aws-sdk';
import { Resource, ResourceProperty } from 'aws-sdk/clients/resourceexplorer2';
import { RdsPerformanceMetadata } from '../../types/RdsPerformanceData';
import { map, some, flatten, find } from 'lodash';
import { RdsMetadata, RoleType } from '../../types/RdsMetadata';
import { ResourceData } from '../../types/ResourceData';
import { logger } from '../../sharedLibs/utils';

type InstanceResource = Partial<Resource> & { Name?: string };

/**
 * @returns The RDS Metadata, including the ARN, the resource name, the RDS Type, Instance Type, saving plans(??), and the account id. How? How!
 */
export async function populateRdsDataFromResources(rds: Resource): Promise<ResourceData[]> {
  // Retrieve metadata
  const { Region, Arn, ResourceType, Properties, LastReportedAt } = rds;
  const name = Arn.split(':')[6]; // The Name of the Db Instance or Db Cluster.
  const account = Arn.split(':')[4]; // The Account Id
  const hasTags = !!find(Properties, (it: ResourceProperty) =>
    some(it.Data, (it: Record<string, string>) => it['Key'] == 'Team'),
  );

  const resourceData: ResourceData = {
    account: account,
    name: name,
    region: Region,
    arn: Arn,
    resourceType: ResourceType,
    lastReportedAt: LastReportedAt.toLocaleString(),
    // hasTags: hasTags,
  };

  // Wrap it in an array and return it inside a Promise
  return [resourceData];
}




// async function extractMetadataFromInstance( 
//   resource: InstanceResource, //Parameter taking in InstanceResource
//   parentIdentifier: undefined | string = undefined, 
// ): Promise<Partial<RdsPerformanceMetadata>[]> { //returns a Promise of type RdsPerformanceMetadata
//   const name = resource.Name || resource.Arn.split(':')[6]; // The Name of the Db Instance or Db Cluster.
//   const region = resource.Region;
//   const arn = resource.Arn;


  // const rdsClient = new RDS({ region }); //starts a new rds client with aws-sdk

  // let rdsInstanceData;
  // try {
  //   [rdsInstanceData] =
  //     (await rdsClient.describeDBInstances({ DBInstanceIdentifier: name }).promise()).DBInstances ?? [];
  // } catch (e) {
  //   // Resource Explorer can return no longer existing instances, if this is the case we should just return.
  //   return [];
  // }

  // let isReserved = false;
  // try {
  //   isReserved =
  //     (
  //       (await rdsClient.describeReservedDBInstances({ ReservedDBInstanceId: name }).promise()).ReservedDBInstances ??
  //       []
  //     ).length > 0;
  // } catch (e) {
  //   // Continue
  // }

  // if (!rdsInstanceData) return [];

  // const { Engine, DBInstanceClass } = rdsInstanceData;
  // //instanceType

//   return [
//     {
//       name,
//       region,
//       arn,
//     },
//   ];
// }

// const extractChildDataFromCluster = (region: string, parent: string) => async (instance: RDS.DBClusterMember) => {
//   const [instanceData] = await extractMetadataFromInstance(
//     { Name: instance.DBInstanceIdentifier, Region: region },
//     parent,
//   );

//   return {
//     ...instanceData,
//     role: instance.IsClusterWriter ? RoleType.WRITER : RoleType.READER,
//   };
// };

// // Returns the parents and the children.
// async function extractMetadataFromCluster(resource: Resource): Promise<Partial<RdsPerformanceMetadata>[]> {
//   const name = resource.Arn.split(':')[6]; // The Name of the Db Instance or Db Cluster.
//   const region = resource.Region;

//   const rdsClient = new RDS({ region });

//   const [rdsClusterInfo] =
//     (await rdsClient.describeDBClusters({ DBClusterIdentifier: name }).promise()).DBClusters ?? [];


//   if (!rdsClusterInfo) return [];

//   const { Engine, DBClusterMembers, DBClusterInstanceClass, DBClusterArn: parentArn } = rdsClusterInfo;
//   const children: Partial<RdsPerformanceMetadata>[] = flatten(
//     await Promise.all(map(DBClusterMembers, extractChildDataFromCluster(region, parentArn))),
//   );

//   return [
//     {
//       name,
//       savingsPlan: some(children, ({ savingsPlan }) => savingsPlan),
//       engine: Engine,
//       role: RoleType.CLUSTER,
//       instanceType: DBClusterInstanceClass || children.find(({ instanceType }) => instanceType)?.instanceType,
//     },
//     ...children,
//   ];
// }
