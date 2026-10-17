import { api } from '../api/client';
import { call } from './http';
export type QuoteStatus = 'DRAFT'|'SENT'|'ACCEPTED'|'REJECTED'|'CANCELLED';
export type QuoteLine = {description:string; quantity:number;unitPrice:string};
export type Quote = {id:string;dealId:string;companyId:string;branchId:string|null;title:string;notes:string|null;status:QuoteStatus;version:number;currency:string;total:string|number;createdAt:string;items:(QuoteLine&{id:string;lineTotal:string|number})[]};
export const quotesApi = {
  listCompany:(companyId:string,branchId?:string)=>call(api.get<Quote[]>('/quotes',{params:{companyId,...(branchId?{branchId}:{})}})),
  get:(id:string)=>call(api.get<Quote>(`/quotes/${id}`)),
  list:(dealId:string)=>call(api.get<Quote[]>('/quotes',{params:{dealId}})),
  create:(data:{dealId:string;title:string;notes?:string;items:QuoteLine[]})=>call(api.post<Quote>('/quotes',data)),
  update:(id:string,data:{expectedVersion:number;title:string;notes?:string;items:QuoteLine[]})=>call(api.patch<Quote>(`/quotes/${id}`,data)),
  status:(id:string,status:QuoteStatus,expectedVersion:number)=>call(api.post<Quote>(`/quotes/${id}/status`,{status,expectedVersion})),
};
