import { getAccountInformation } from '../states/getAccountsFromOrganization/getAccountsFromOrganization';
import { Context } from 'aws-lambda';
import { assumeRoleForAccount } from '../states/sharedLibs/sts';

// Mock AWS SDK and Logger
jest.mock('aws-sdk', () => ({
  Organizations: jest.fn().mockReturnValue({
    listAccountsForParent: jest
      .fn()
      .mockReturnValue({ promise: () => Promise.resolve({ Accounts: [{ Id: '123'}, {Id: '456'}, {Id: '789'}, {Id: '101112'}] }) }),
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

describe('getAccountsFromOrganization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { PARENT_ORG_ID: 'orgId', PARENT_AWS_ID: '123' };
  });

  it('should assume a new role from different account', async () => {
    await getAccountInformation({}, null as Context);
    expect(assumeRoleForAccount).toHaveBeenCalled();
  });

  it('should remove organisation id account', async () => {
    const accounts = await getAccountInformation({ exclude: [] }, null as Context);
    expect(accounts.accounts.findIndex(it => it.account == '123')).toBe(-1);
  });

  it('should remove accounts from exclude', async () => {
    const accounts = await getAccountInformation({ exclude: ['101112', '456'] }, null as Context);
    
    console.log(accounts.accounts)
    
    expect(accounts.accounts.findIndex(it => it.account == '101112')).toBe(-1);
    expect(accounts.accounts.findIndex(it => it.account == '456')).toBe(-1);
    expect(accounts.accounts.findIndex(it => it.account == '789')).not.toBe(-1);

    
  });
});
