import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

export class ResourceExplorerRDSWorkload extends cdk.Stack {
  reportStorage: s3.Bucket | null = null;
  stateGetAcct: NodejsFunction | null;
  stateExtractRds: NodejsFunction | null;
  stateExtractPerformanceDataRds: NodejsFunction | null;
  statePushToS3: NodejsFunction | null;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.reportStorage = new s3.Bucket(this, "report-bucket", {
      bucketName: `${cdk.Stack.of(this).account}-rds-reports`,
    });

    const stsAssumePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["sts:AssumeRole"],
      resources: [
        "arn:aws:iam::*:role/ResourceExplorerOrganizationAccountAssumableRole", //This can assume any account in the organization with the correct name.
      ],
    });

    this.stateGetAcct = new NodejsFunction(this, "stateGetAccts", {
      entry: path.join(__dirname, "../../../states/getAccountsFromOrganization/getAccountsFromOrganization.ts"),
      depsLockFilePath: `${process.cwd()}/../../package-lock.json`,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "getAccountInformation",
      timeout: cdk.Duration.minutes(15),
      bundling: {
        minify: true,
      },
      environment: {
        PARENT_AWS_ID: this.node.getContext("parent_aws_account_id"),
        PARENT_ORG_ID: this.node.getContext("parent_org_id"),
        ROLE_TEMPLATE:
          "arn:aws:iam::{ACCOUNT}:role/ResourceExplorerOrganizationAccountAssumableRole",
        AGGREGATOR_INDEX_REGION: this.node.getContext(
          "aggregator_index_region"
        ),
      },
    });
    this.stateGetAcct.addToRolePolicy(stsAssumePolicy);

    this.stateExtractRds = new NodejsFunction(this, "stateExtractMetadataRds", {
      entry: path.join(
        __dirname,
        "../../../states/extractRdsAndMetadataPerAccount/extractRdsAndMetadataPerAccount.ts"
      ),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "extractInformation",
      depsLockFilePath: `${process.cwd()}/../../package-lock.json`,
      bundling: {
        minify: true,
      },
      timeout: cdk.Duration.minutes(15),
      environment: {
        ROLE_TEMPLATE:
          "arn:aws:iam::{ACCOUNT}:role/ResourceExplorerOrganizationAccountAssumableRole",
        AGGREGATOR_INDEX_REGION: this.node.getContext(
          "aggregator_index_region"
        ),
      },
    });
    this.stateExtractRds.addToRolePolicy(stsAssumePolicy);

    this.stateExtractPerformanceDataRds = new NodejsFunction(
      this,
      "stateExtractPerformanceDataRds",
      {
        entry: path.join(
          __dirname,
          "../../../states/extractPerformanceMetricsFromRds/extractPerformanceMetricsFromRds.ts"
        ),
        runtime: lambda.Runtime.NODEJS_16_X,
        depsLockFilePath: `${process.cwd()}/../../package-lock.json`,
        handler: "extractMetricInformation",
        bundling: {
          minify: true,
        },
        timeout: cdk.Duration.minutes(15),
        environment: {
          ROLE_TEMPLATE:
            "arn:aws:iam::{ACCOUNT}:role/ResourceExplorerOrganizationAccountAssumableRole",
        },
      }
    );
    this.stateExtractPerformanceDataRds.addToRolePolicy(stsAssumePolicy);

    this.statePushToS3 = new NodejsFunction(this, "statePushToS3", {
      entry: `${process.cwd()}/../../states/createExcelReport/createExcelReport.ts`,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "pushToS3",
      depsLockFilePath: `${process.cwd()}/../../package-lock.json`,
      bundling: {
        minify: true,
      },
      timeout: cdk.Duration.minutes(15),
      environment: {
        REPORT_BUCKET_ARN: this.reportStorage.bucketName,
      },
    });
    this.reportStorage.grantReadWrite(this.statePushToS3);
    this.statePushToS3.addToRolePolicy(stsAssumePolicy);

    const extractDataAccountMap = new sfn.Map(this, "mapState", {
      comment:
        "Extract the RDS information from an account and return it as an object",
      inputPath: "$.Payload",
      itemsPath: "$.accounts",
      maxConcurrency: 3,
    });

    const getAccountTask = new tasks.LambdaInvoke(this, "taskGetAccounts", {
      lambdaFunction: this.stateGetAcct,
      taskTimeout: sfn.Timeout.duration(cdk.Duration.minutes(15)),
    });

    const pushToS3Task = new tasks.LambdaInvoke(this, "createExcel", {
      lambdaFunction: this.statePushToS3,
      taskTimeout: sfn.Timeout.duration(cdk.Duration.minutes(15)),
      inputPath: "$[*].Payload",
    });

    const getMetadataTask = new tasks.LambdaInvoke(this, "rdsMetadata", {
      lambdaFunction: this.stateExtractRds,
      taskTimeout: sfn.Timeout.duration(cdk.Duration.minutes(15)),
    });

    const getPerformanceTask = new tasks.LambdaInvoke(this, "rdsPerformance", {
      lambdaFunction: this.stateExtractPerformanceDataRds,
      taskTimeout: sfn.Timeout.duration(cdk.Duration.minutes(15)),
      inputPath: "$.Payload",
    });

    extractDataAccountMap.iterator(getMetadataTask.next(getPerformanceTask));

    const stepFunctionExtraction = new sfn.StateMachine(
      this,
      "RdsExtractionStateMachine",
      {
        definition: getAccountTask
          .next(extractDataAccountMap)
          .next(pushToS3Task),
      }
    );
  }
}
