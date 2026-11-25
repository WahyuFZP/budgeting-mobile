import { strFromU8, unzipSync } from 'fflate';
import { buildXlsx } from './xlsx';

test('xlsx has the workbook parts and typed cells', () => {
  const files = unzipSync(buildXlsx('Transaksi Nov', [['Tanggal', 'Nominal'], ['2026-11-25', 15000], ['Kopi & <roti>', null]], [12, 14]));
  expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  expect(sheet).toContain('<c r="B2"><v>15000</v></c>'); // numbers stay numbers, so Excel can SUM them
  expect(sheet).toContain('<t xml:space="preserve">Kopi &amp; &lt;roti&gt;</t>'); // escaped, no broken XML
  expect(sheet).not.toContain('r="B3"'); // empty cell omitted
  expect(sheet).toContain('<col min="2" max="2" width="14" customWidth="1"/>');
  expect(strFromU8(files['xl/workbook.xml'])).toContain('name="Transaksi Nov"');
});
