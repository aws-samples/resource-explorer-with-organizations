import { Context } from 'aws-lambda';
import { S3FileSaveRequest } from '../types/S3FileSaveRequest';
import { flatMap } from 'lodash';
import { get } from 'lodash/fp';
import { Workbook } from 'excel4node';
import { addWorksheetFromData } from './libs/worksheet';
import { S3 } from 'aws-sdk';
import { logger, initialiseLogger } from '../sharedLibs/utils';

type SignedUrl = string;

initialiseLogger('createExcelReport');
const s3 = new S3();

export async function pushToS3(event: S3FileSaveRequest, _context: Context): Promise<SignedUrl> {
  const mergedAccounts = flatMap(event, get('instances'));
  const worksheetData = [{ account: 'all', instances: mergedAccounts }, ...event];

  const workbook = new Workbook();
  worksheetData.forEach(addWorksheetFromData(workbook));

  const dateTime = new Date().toISOString().split(/[./:]/g).join('_');
  const buffer = await workbook.writeToBuffer();

  logger.info(`Written all the reports writing to ${process.env.REPORT_BUCKET_ARN}`);

  await s3
    .upload({
      Bucket: process.env.REPORT_BUCKET_ARN,
      Key: `report_${dateTime}.xlsx`,
      Body: buffer,
    })
    .promise();

  return s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.REPORT_BUCKET_ARN,
    Key: `report_${dateTime}.xlsx`,
  });
}
