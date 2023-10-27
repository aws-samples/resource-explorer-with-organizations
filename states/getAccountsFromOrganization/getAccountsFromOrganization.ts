import { Context } from 'aws-lambda';
import { GetAccountsRequest } from '../types/GetAccountsRequest';
import { AccountsResponse } from '../types/AccountsResponse';
import { Organizations } from 'aws-sdk';
import { assumeRoleForAccount } from '../sharedLibs/sts';
import { logger, initialiseLogger } from '../sharedLibs/utils';

initialiseLogger('getAccountsFromOrganization');
export async function getAccountInformation(event: GetAccountsRequest, _context: Context): Promise<AccountsResponse> {
  await assumeRoleForAccount(process.env.PARENT_AWS_ID);

  const excludeAccountSet = new Set(event.exclude ?? []);
  const orgClient = new Organizations({ region: 'us-east-1' });
  logger.info(`Getting Accounts from Parent ${process.env.PARENT_ORG_ID}`);

  const orgs = (await orgClient.listAccountsForParent({ ParentId: process.env.PARENT_ORG_ID }).promise()).Accounts;
  logger.info(`Retrieved Accounts ${orgs} from Parent ${process.env.PARENT_ORG_ID}`);
  const accounts = orgs
    .map((it) => ({ account: it.Id, organization: process.env.PARENT_ORG_ID }))
    .filter((it) => it.account != process.env.PARENT_AWS_ID && !excludeAccountSet.has(it.account));

  return {
    accounts,
  };
}
