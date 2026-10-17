import React,{useCallback,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {getAdminScope} from '../../../src/core/admin/scope';
import {dealsApi,type DealDto} from '../../../src/core/admin/deals.api';
import {quotesApi,type Quote,type QuoteLine,type QuoteStatus} from '../../../src/core/admin/quotes.api';

const stages:QuoteStatus[]=['SENT','ACCEPTED','REJECTED','CANCELLED'];
const priceOk=/^(0|[1-9]\d{0,13})(\.\d{1,2})?$/;
export default function QuotesLive(){
 const router=useRouter();const [deals,setDeals]=useState<DealDto[]>([]);const [dealId,setDealId]=useState('');
 const [quotes,setQuotes]=useState<Quote[]>([]);const [title,setTitle]=useState('');const [notes,setNotes]=useState('');
 const [lines,setLines]=useState<QuoteLine[]>([{description:'',quantity:1,unitPrice:'0'}]);const [editing,setEditing]=useState<Quote|null>(null);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [reload,setReload]=useState(0);
 useFocusEffect(useCallback(()=>{let active=true;setLoading(true);getAdminScope().then(async scope=>{
   const d=await dealsApi.list(scope.companyId);if(!active)return;setDeals(d);
   const next=d.some(x=>x.id===dealId)?dealId:(d[0]?.id??'');setDealId(next);
   setQuotes(next?await quotesApi.list(next):[]);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load quotes');}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};},[reload]));
 const choose=async(id:string)=>{setDealId(id);setEditing(null);setError('');setLoading(true);try{setQuotes(await quotesApi.list(id));}catch(e){setError(e instanceof Error?e.message:'Cannot load quotes');}finally{setLoading(false)}};
 const reset=()=>{setEditing(null);setTitle('');setNotes('');setLines([{description:'',quantity:1,unitPrice:'0'}]);};
 const edit=(q:Quote)=>{setEditing(q);setTitle(q.title);setNotes('');setLines(q.items.map(i=>({description:i.description,quantity:i.quantity,unitPrice:String(i.unitPrice)})))};
 const save=async()=>{if(busy)return;if(!dealId||!title.trim()||!lines.length||lines.some(l=>!l.description.trim()||!Number.isInteger(l.quantity)||l.quantity<1||!priceOk.test(l.unitPrice))){setError('Enter a title and valid quote items.');return;}
  setBusy(true);setError('');try{const items=lines.map(l=>({...l,description:l.description.trim()}));if(editing)await quotesApi.update(editing.id,{expectedVersion:editing.version,title:title.trim(),notes,items});else await quotesApi.create({dealId,title:title.trim(),notes,items});reset();setReload(n=>n+1);}catch(e){setError(e instanceof Error?e.message:'Unable to save quote');}finally{setBusy(false)}};
 const move=async(q:Quote,status:QuoteStatus)=>{if(busy)return;setBusy(true);setError('');try{await quotesApi.status(q.id,status,q.version);setReload(n=>n+1)}catch(e){setError(e instanceof Error?e.message:'Unable to update status')}finally{setBusy(false)}};
 const updateLine=(index:number,field:keyof QuoteLine,value:string)=>setLines(old=>old.map((l,i)=>i===index?{...l,[field]:field==='quantity'?Number(value):value}:l));
 return <ScrollView style={styles.page} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
 <Pressable onPress={()=>router.push('/admin/crm')}><Text style={styles.link}>‹ Back to CRM</Text></Pressable><Text style={styles.heading}>Quotes · PostgreSQL</Text>
 <Text style={styles.note}>Choose a deal. Draft quotes are editable; sent and decided quotes are retained as history.</Text>
 {error?<Text style={styles.error}>{error}</Text>:null}
 {loading?<ActivityIndicator/>:null}
 <Text style={styles.label}>Deals</Text><View style={styles.wrap}>{deals.map(d=><Pressable key={d.id} onPress={()=>choose(d.id)} style={[styles.chip,dealId===d.id&&styles.selected]}><Text style={styles.chipText}>{d.title}</Text></Pressable>)}</View>
 {dealId?<>
 <Text style={styles.section}>{editing?'Edit draft quote':'New quotation'}</Text>
 <TextInput style={styles.input} value={title} placeholder="Quote title" onChangeText={setTitle}/>
 <TextInput style={styles.input} value={notes} placeholder="Optional notes" onChangeText={setNotes}/>
 {lines.map((line,i)=><View key={i} style={styles.line}>
 <TextInput style={styles.input} placeholder="Item description" value={line.description} onChangeText={v=>updateLine(i,'description',v)}/>
 <View style={styles.wrap}><TextInput style={[styles.input,styles.number]} keyboardType="number-pad" placeholder="Quantity" value={String(line.quantity)} onChangeText={v=>updateLine(i,'quantity',v)}/><TextInput style={[styles.input,styles.number]} keyboardType="decimal-pad" placeholder="Unit price" value={line.unitPrice} onChangeText={v=>updateLine(i,'unitPrice',v)}/>
 <Pressable onPress={()=>setLines(old=>old.filter((_,j)=>j!==i))}><Text style={styles.link}>Remove item</Text></Pressable></View></View>)}
 <View style={styles.wrap}><Pressable onPress={()=>setLines(old=>[...old,{description:'',quantity:1,unitPrice:'0'}])} style={styles.button}><Text style={styles.buttonText}>+ Item</Text></Pressable><Pressable disabled={busy} onPress={save} style={styles.button}><Text style={styles.buttonText}>{editing?'Save changes':'Create draft'}</Text></Pressable>{editing?<Pressable onPress={reset} style={styles.button}><Text style={styles.buttonText}>Cancel edit</Text></Pressable>:null}</View>
 <Text style={styles.section}>Saved quotes</Text>{quotes.length===0?<Text>No quotes for this deal yet.</Text>:null}
 {quotes.map(q=><View key={q.id} style={styles.card}><Text style={styles.quoteTitle}>{q.title} · {q.status}</Text><Text>{q.currency} {String(q.total)} · {q.items.length} item(s) · revision {q.version}</Text>
 <View style={styles.wrap}>{q.status==='DRAFT'?<Pressable onPress={()=>edit(q)} style={styles.chip}><Text>Edit draft</Text></Pressable>:null}{stages.filter(st=>q.status==='DRAFT'?['SENT','CANCELLED'].includes(st):q.status==='SENT'?['ACCEPTED','REJECTED','CANCELLED'].includes(st):false).map(st=><Pressable disabled={busy} key={st} onPress={()=>move(q,st)} style={styles.chip}><Text>{st}</Text></Pressable>)}</View></View>)}
 </>:<Text>No accessible deals found. Create a deal first.</Text>}
 </ScrollView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f6f8fc'},body:{padding:20,gap:12,paddingBottom:60},heading:{fontSize:24,fontWeight:'700',color:'#182944'},note:{color:'#52617c'},link:{color:'#345cf2',fontWeight:'600'},error:{color:'#b3261e'},label:{fontWeight:'700'},section:{fontSize:19,fontWeight:'700',marginTop:12,color:'#182944'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},chip:{borderWidth:1,borderColor:'#ccd6ed',paddingVertical:10,paddingHorizontal:12,borderRadius:8},selected:{backgroundColor:'#dbe6ff'},chipText:{color:'#182944'},input:{borderWidth:1,borderColor:'#cfd7e6',backgroundColor:'white',borderRadius:8,paddingHorizontal:12,paddingVertical:10,minWidth:180,flexGrow:1},number:{minWidth:90,flexGrow:0,width:120},button:{backgroundColor:'#345cf2',padding:12,borderRadius:8},buttonText:{color:'white',fontWeight:'700'},line:{gap:8,borderWidth:1,borderColor:'#e1e5ee',padding:10,borderRadius:10},card:{borderWidth:1,borderColor:'#d7deec',backgroundColor:'white',padding:14,borderRadius:12,gap:8},quoteTitle:{fontWeight:'700',color:'#182944',fontSize:16}});
