export enum RoleType {
  WRITER = 'writer',
  READER = 'reader',
  STANDALONE = 'standalone',
  CLUSTER = 'cluster',
}

export type RdsMetadata = {
  name: string;
  parentArn?: string | undefined;
  account: string;
  region: string;
  arn: string;
  instanceType: string;
  role: RoleType;
  savingsPlan: boolean;
  hasRequiredTags: boolean;
  engine: string;
};
