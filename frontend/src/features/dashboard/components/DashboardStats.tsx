import ResponsiveTable from '../../../shared/components/ResponsiveTable';
import type { DashboardMetrics } from '../types';
export default function DashboardStats({ metrics }: { metrics: DashboardMetrics }) { return <ResponsiveTable headers={['Metric','Value']} rows={Object.entries(metrics).map(([key,value])=>[key,value])} />; }
