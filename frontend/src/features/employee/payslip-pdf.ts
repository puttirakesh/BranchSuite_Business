// The default resolver must also be safe in browsers. Metro selects .native.ts
// on Android/iOS; web and non-platform resolvers use the direct PDF exporter.
export { savePayslipPdf, payslipLines } from './payslip-pdf.web';
export type { PayslipExportResult } from './payslip-pdf-content';
