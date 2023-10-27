import { assumeRoleForAccount } from '../states/sharedLibs/sts';
import { Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';

// Mock AWS SDK and Logger
jest.mock('aws-sdk', () => ({
  STS: jest.fn().mockReturnValue({
    assumeRole: jest.fn().mockReturnValue({
      promise: () =>
        Promise.resolve({ Credentials: { AccessKeyId: 'abc', SecretAccessKey: 'def', SessionToken: 'ghi' } }),
    }),
  }),
  Credentials: jest.requireActual('aws-sdk').Credentials,
  config: {
    update: jest.fn(),
  },
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
    process.env = { ROLE_TEMPLATE: 'arn:aws:iam::{ACCOUNT}:role/ResourceExplorerOrganizationAccountAssumableRole' };
  });

  it('should reset config at the start', async () => {
    await assumeRoleForAccount('123');

    expect(AWS.config.update).toHaveBeenCalledWith({ credentials: undefined });
    // expect(AWS.config.update).toHaveBeenCalledWith(
    //   new AWS.Credentials({
    //     accessKeyId: 'abc',
    //     secretAccessKey: 'def',
    //     sessionToken: 'ghi',
    //   }),
    // );
  });

  it('should reset call sts with the role', async () => {
    const stsmock = new AWS.STS();
    await assumeRoleForAccount('123');

    expect(stsmock.assumeRole).toHaveBeenCalledWith({
      RoleArn: 'arn:aws:iam::123:role/ResourceExplorerOrganizationAccountAssumableRole',
      RoleSessionName: 'AssumingForStepFns',
    });
  });

  it('should update the config to returned STS Value', async () => {
    await assumeRoleForAccount('123');

    const { credentials } = (AWS.config.update as any).mock.calls[1][0];

    expect(credentials.accessKeyId).toEqual("abc");
    expect(credentials.secretAccessKey).toEqual("def");
    expect(credentials.sessionToken).toEqual("ghi");
  });

  it('should throw if sts returns empty value for credentials', async () => {
    const stsmock = new AWS.STS();
    (stsmock.assumeRole as any).mockReturnValue({ promise: () => Promise.resolve({ credentials: null })});

    try { 
        await assumeRoleForAccount('123');
    } catch(e) { 
        expect(e.message).toEqual("Error assuming the role: Failed to assume the role.");
        return 
    }

    expect(false).toBe(true);
  });

  it('should throw if sts throws an error', async () => {
    const stsmock = new AWS.STS();
    (stsmock.assumeRole as any).mockReturnValue({ promise: () => Promise.reject({ message: 'testerr' })});

    try { 
        await assumeRoleForAccount('123');
    } catch(e) { 
        expect(e.message).toEqual("Error assuming the role: testerr");
        return
    }

    expect(false).toBe(true)
  });

  
});
