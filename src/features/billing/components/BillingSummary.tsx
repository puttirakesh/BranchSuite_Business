import ResponsiveTable from '../../../shared/components/ResponsiveTable';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import type { Invoice } from '../types';
export default function BillingSummary({ invoices }: { invoices: Invoice[] }) { return <ResponsiveTable headers={['Status','Total']} rows={['Paid','Unpaid'].map(status=>[status,formatCurrency(invoices.filter(i=>i.status===status).reduce((n,i)=>n+i.amount,0))])} />; }
