import { Context } from 'aws-lambda';
import { AccountDefinition } from '../types/AccountDefinition';
import { RdsInstanceData } from '../types/RdsInstanceData';
import { populateRdsDataFromResources } from './libs/rds';
import { searchForRdsData } from './libs/resourceExplorer';
import { keyBy, flatten, map, concat, filter } from 'lodash';
import { assumeRoleForAccount } from '../sharedLibs/sts';
import { logger, initialiseLogger } from '../sharedLibs/utils';

initialiseLogger('extractRdsAndMetadataPerAccount');
export async function extractInformation(event: AccountDefinition, _context: Context): Promise<RdsInstanceData> {
  await assumeRoleForAccount(event.account);

  logger.info(`Getting all clusters and instances from ${event.account}`);
  const [clusters, instances] = await Promise.all([searchForRdsData(event.account)]);
  console.log("log 1" + clusters);
  

  logger.info(`Populating Cluster information`);
  const populatedRdsClusters = flatten(await Promise.all(map(clusters, populateRdsDataFromResources)));
  logger.info(`Populatied Cluster information ${JSON.stringify(populatedRdsClusters)}`);
  console.log("log2 "+ populatedRdsClusters);



  return {
    account: event.account,
    instances: concat(populatedRdsClusters),
  };
}

