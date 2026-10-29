import { readDatabase } from '../../../core/api/client';
import { DEMO_DATE } from '../../../core/config/constants';
import type { Database } from '../../../shared/types/common.types';
import type { Customer } from '../../customers/types';
import type { DashboardMetrics } from '../types';
export function effectiveStatus(t: Customer) { const s=t.subscription; if(s.status==='Trial'&&s.trialEndsOn<DEMO_DATE)return 'Expired'; if(['Active','Past due'].includes(s.status)&&s.renewOn<DEMO_DATE){if(s.cancelAtRenewal)return 'Cancelled';return s.graceEndsOn>=DEMO_DATE?'Past due':'Expired';}return s.status; }
export function calculateMetrics(db: Database): DashboardMetrics { return { customers: db.tenants.length, active: db.tenants.filter(t=>effectiveStatus(t)==='Active').length, trials: db.tenants.filter(t=>effectiveStatus(t)==='Trial').length, attention: db.tenants.filter(t=>['Past due','Expired','Suspended'].includes(effectiveStatus(t))).length, mrr: db.tenants.filter(t=>['Active','Past due'].includes(effectiveStatus(t))).reduce((n,t)=>{ const p=db.plans.find(p=>p.id===t.subscription.planId); return n+(p?(t.subscription.cycle==='Annual'?p.annual/12:p.monthly):0); },0), unpaid: db.subscriptionInvoices.filter(i=>i.status==='Unpaid').reduce((n,i)=>n+i.amount,0), support: db.saasTickets.filter(t=>t.status!=='Resolved').length, prospects: db.saasLeads.filter(l=>!['Converted','Closed'].includes(l.status)).length }; }
export async function getDashboard() { const db=await readDatabase();return db?calculateMetrics(db):null; }
