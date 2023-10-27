import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as Infra from "../lib/resource-explorer-rds-stack";

test("S3 Bucket Created", () => {
  const app = new cdk.App({
    context: {
      parent_aws_account_id: "123456789012",
      parent_org_id: "tst-id-org",
      aggregator_index_region: "eu-west-1",
    },
  });
  // WHEN
  const stack = new Infra.ResourceExplorerRDSWorkload(app, "MyTestStack");

  // THEN
  const template = Template.fromStack(stack);
  template.hasResource("AWS::S3::Bucket", {});
});

test("Should create Lambda and permissions.", () => {
  const app = new cdk.App({
    context: {
      parent_aws_account_id: "123456789012",
      parent_org_id: "tst-id-org",
      aggregator_index_region: "eu-west-1",
    },
  });
  const stack = new Infra.ResourceExplorerRDSWorkload(app, "TestStack");

  // Check the permissions for each Lambda function
  const lambdaFunctions = [
    stack.stateGetAcct,
    stack.stateExtractRds,
    stack.stateExtractPerformanceDataRds,
    stack.statePushToS3,
  ];

  for (const lambdaFunction of lambdaFunctions) {
    expect(
      lambdaFunction!.permissionsNode.tryFindChild("Resource")
    ).toBeDefined();
  }
});

test("Should create StateMachine", () => {
  const app = new cdk.App({
    context: {
      parent_aws_account_id: "123456789012",
      parent_org_id: "tst-id-org",
      aggregator_index_region: "eu-west-1",
    },
  });
  // WHEN
  const stack = new Infra.ResourceExplorerRDSWorkload(app, "MyTestStack");

  // THEN
  const template = Template.fromStack(stack);
  template.hasResource("AWS::StepFunctions::StateMachine", {});
});
