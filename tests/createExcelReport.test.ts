import { pushToS3 } from '../states/createExcelReport/createExcelReport';
import * as worksheet from '../states/createExcelReport/libs/worksheet';
import { RoleType } from '../states/types/RdsMetadata';
import { S3FileSaveRequest } from '../states/types/S3FileSaveRequest';
import { Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { Workbook } from 'excel4node';

// Mock AWS SDK S3 and Logger
jest.mock('aws-sdk', () => ({
  S3: jest.fn().mockReturnValue({
    upload: jest.fn().mockReturnValue({ promise: () => Promise.resolve() }),
    getSignedUrlPromise: jest.fn().mockResolvedValue('mock-signed-url'),
  }),
}));

jest.mock('excel4node', () => ({
  Workbook: jest.fn().mockReturnValue({
    addWorksheet: jest.fn().mockReturnValue({
      cell: jest.fn().mockReturnValue({
        style: jest.fn().mockReturnValue(() => jest.fn().mockReturnThis),
        string: jest.fn().mockReturnValue(() => jest.fn().mockReturnThis),
        number: jest.fn().mockReturnValue(() => jest.fn().mockReturnThis),
        boolean: jest.fn().mockReturnValue(() => jest.fn().mockReturnThis),
      }),
      column: jest.fn().mockReturnValue({
        setWidth: jest.fn().mockReturnValue(() => jest.fn().mockReturnThis),
      }),
    }),
    writeToBuffer: jest.fn().mockReturnValue(Buffer.of(1)),
  }),
}));

jest.mock('../states/sharedLibs/utils', () => ({
  logger: {
    info: jest.fn(),
  },
  initialiseLogger: jest.fn(),
}));

describe('createExcelReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add correct header data to a worksheet', async () => {
    const workbook = new Workbook();
    const worksheetMock = workbook.addWorksheet('');
    const cellMock = worksheetMock.cell(-1, -1); // ensure that we check it's been called with correct params (not -1, -1)

    const event: S3FileSaveRequest = [
      {
        account: '1',
        instances: [
          {
            name: 'name',
            account: '1',
            region: 'region',
            arn: 'arn',
            instanceType: 'instanceType',
            role: RoleType.READER,
            savingsPlan: false,
            hasRequiredTags: true,
            engine: 'engine',
            cpu: { p50: 50, p90: 0, p99: 0, avg: 0, p95: 0, max: 0 },
            connections: { p50: 0, p90: 0, p99: 0, avg: 0, p95: 0, max: 0 },
          },
        ],
      },
    ];

    // So what do we expect here. We expect...

    const context: Context = {} as Context;
    await pushToS3(event, context);

    expect(worksheetMock.cell).toHaveBeenCalledWith(1, 1);
    expect(worksheetMock.cell).toHaveBeenCalledWith(1, 22);
    expect(cellMock.string).toHaveBeenCalledWith('CPU Max'); // Header
  });

  it('should add correct data to a worksheet', async () => {
    const workbook = new Workbook();
    const worksheetMock = workbook.addWorksheet('');
    const cellMock = worksheetMock.cell(-1, -1); // ensure that we check it's been called with correct params (not -1, -1)

    const event: S3FileSaveRequest = [
      {
        account: '1',
        instances: [
          {
            name: 'name',
            account: '1',
            region: 'region',
            arn: 'arn',
            instanceType: 'instanceType',
            role: RoleType.READER,
            savingsPlan: false,
            hasRequiredTags: true,
            engine: 'engine',
            cpu: { p50: 50, p90: 0, p99: 0, avg: 0, p95: 0, max: 0 },
            connections: { p50: 0, p90: 0, p99: 0, avg: 0, p95: 0, max: 0 },
          },
        ],
      },
    ];

    // So what do we expect here. We expect...

    const context: Context = {} as Context;
    await pushToS3(event, context);

    expect(cellMock.string).toHaveBeenCalledWith('N'); // HasRequiredTags
    expect(cellMock.string).toHaveBeenCalledWith('name'); // Name
    expect(cellMock.number).toHaveBeenCalledWith(50);
  });

  it('set the width of a cell', async () => {
    const workbook = new Workbook();
    const worksheetMock = workbook.addWorksheet('');
    const columnMock = worksheetMock.column(-1); // ensure that it has been called with correct params (not -1)

    const event: S3FileSaveRequest = [
      {
        account: '1',
        instances: [
          {
            name: 'name',
            account: '1',
            region: 'region',
            arn: 'arn',
            instanceType: 'instanceType',
            role: RoleType.READER,
            savingsPlan: false,
            hasRequiredTags: true,
            engine: 'engine',
            cpu: { p50: 50, p90: 0, p99: 0, avg: 0, p95: 0, max: 0 },
            connections: { p50: 0, p90: 0, p99: 0, avg: 0, p95: 0, max: 0 },
          },
        ],
      },
    ];

    // So what do we expect here. We expect...

    const context: Context = {} as Context;
    await pushToS3(event, context);

    expect(columnMock.setWidth).toHaveBeenCalled();
  });

  it('should create a worksheet per account', async () => {
    const mockedWorksheetFN = jest.fn();
    jest.spyOn(worksheet, 'addWorksheetFromData').mockImplementation(() => mockedWorksheetFN);

    const event = [
      { account: '1', instances: [] },
      { account: '2', instances: [] },
    ];

    const context = {};

    await pushToS3(event, context as Context);

    expect(worksheet.addWorksheetFromData).toHaveBeenCalled();
    expect(mockedWorksheetFN).toHaveBeenCalledTimes(event.length + 1);

    const calledWith = [{ account: 'all', instances: [] }, ...event];

    // Foreach calls this with 3 parameters, arg, idx, fullArr
    expect(mockedWorksheetFN).toHaveBeenCalledWith(calledWith[0], 0, calledWith);
    expect(mockedWorksheetFN).toHaveBeenCalledWith(calledWith[1], 1, calledWith);
    expect(mockedWorksheetFN).toHaveBeenCalledWith(calledWith[2], 2, calledWith);
  });

  it('should push data to S3 and return signed URL', async () => {
    const event: S3FileSaveRequest = [];
    const context: Context = {} as Context;
    const innerMocks = new AWS.S3();

    const signedUrl = await pushToS3(event, context);

    // Assert that the AWS SDK S3 methods were called as expected
    expect(innerMocks.upload).toHaveBeenCalled();

    expect(innerMocks.getSignedUrlPromise).toHaveBeenCalledWith('getObject', {
      Bucket: undefined, //Process.env
      Key: expect.any(String),
    });

    // Assert that the returned signed URL matches the expected value
    expect(signedUrl).toBe('mock-signed-url');
  });
});
