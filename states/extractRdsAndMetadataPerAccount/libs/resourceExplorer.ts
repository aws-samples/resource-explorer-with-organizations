import { ResourceExplorer2 } from 'aws-sdk';
import { ResourceList } from 'aws-sdk/clients/resourceexplorer2';
import { logger } from '../../sharedLibs/utils';

export async function searchForRdsData(serviceType: string): Promise<ResourceList> {
  const resourceExplorerClient = new ResourceExplorer2({
    region: process.env.AGGREGATOR_INDEX_REGION,
  });
  let nextToken: string | undefined;
  const resourceList: ResourceList = [];

  do {
    const { NextToken, Resources } = await resourceExplorerClient
      .search({ QueryString: `accountid:${serviceType}`, MaxResults: 1000 })
      .promise();
    nextToken = NextToken;

    if (Resources) {
      logger.info(`Retrieved ${JSON.stringify(Resources)}`);
      resourceList.push(...Resources);
    }
  } while (nextToken != undefined);
  
  return resourceList;
}
