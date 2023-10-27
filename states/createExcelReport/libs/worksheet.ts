import { Style, Workbook, Worksheet } from 'excel4node';
import { RdsInstanceData } from '../../types/RdsInstanceData';
import { RdsPerformanceMetadata } from '../../types/RdsPerformanceData';
import { get, keys, values } from 'lodash/fp';
import { logger } from '../../sharedLibs/utils';

type ColumnConfiguraiton = Record<
  string,
  {
    getValue: (string) => string | boolean | number;
    width: number;
  }
>;

const COL_NAMES: ColumnConfiguraiton = {
  Account: { getValue: get('account'), width: 25 },
  Name: { getValue: get('name'), width: 30 },
  Region: { getValue: get('region'), width: 20 },
  ResourceType: { getValue: get('resourceType'), width: 20 },
  ARN: { getValue: get('arn'), width: 80 },
  LastReportedAt: { getValue: get('lastReportedAt'), width: 80 },
  // hasTags: { getValue: get('hasTags'), width: 80 }
};

function generateHeaders(worksheet: Worksheet): void {
  const headerStyle: Style = {
    alignment: {
      vertical: 'center',
      horizontal: 'center',
    },
    font: {
      bold: true,
      name: 'arial',
      size: 16,
    },
    border: {
      top: {
        style: 'thin',
        color: 'black',
      },
      left: {
        style: 'thin',
        color: 'black',
      },
      right: {
        style: 'thin',
        color: 'black',
      },
      bottom: {
        style: 'thin',
        color: 'black',
      },
      outline: true,
    },
    fill: {
      type: 'pattern',
      patternType: 'solid',
      fgColor: '#8EA9DB',
    },
  };

  const colKeys = keys(COL_NAMES);
  for (let index = 0; index < colKeys.length; index++) {
    const column = colKeys[index];
    const colIdx = index + 1;

    const cell = worksheet.cell(1, colIdx);
    cell.style(headerStyle);
    cell.string(column);
    worksheet.column(colIdx).setWidth(COL_NAMES[column].width);
  }
}

const setDataForRowIn = (worksheet: Worksheet) => {
  const style: Style = {
    font: {
      name: 'arial',
      size: 14,
    },
    alignment: {
      vertical: 'center',
      horizontal: 'center',
    },
    numberFormat: '0.00',
    border: {
      top: {
        style: 'thin',
        color: 'black',
      },
      left: {
        style: 'thin',
        color: 'black',
      },
      right: {
        style: 'thin',
        color: 'black',
      },
      bottom: {
        style: 'thin',
        color: 'black',
      },
      outline: true,
    },
  };

  return (perfData: RdsPerformanceMetadata, idx: number) => {
    for (let index = 0; index < keys(COL_NAMES).length; index++) {
      const valFn = values(COL_NAMES)[index].getValue;
      const value = valFn(perfData);

      const cell = worksheet.cell(idx + 2, index + 1);
      cell.style(style);

      switch (typeof value) {
        case 'string': {
          cell.string(value);
          break;
        }
        case 'boolean': {
          const usedValue = value ? 'Y' : 'N';
          const color = value ? '#8CD787' : '#D75349';
          cell.style({
            ...style,
            fill: { type: 'pattern', patternType: 'solid', fgColor: color },
          });
          cell.string(usedValue);
          break;
        }
        case 'number': {
          cell.number(value as number);
          break;
        }
        default:
          break;
      }
    }
  };
};

export const addWorksheetFromData = (work: Workbook) => (data: RdsInstanceData) => {
  logger?.info(`Creating worksheet from ${data.account}`);
  const worksheet = work.addWorksheet(data.account);
  generateHeaders(worksheet);
  data.instances.forEach(setDataForRowIn(worksheet));
};
