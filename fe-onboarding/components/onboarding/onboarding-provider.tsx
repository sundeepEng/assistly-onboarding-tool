import {createContext,useContext,useEffect,useRef,useState} from 'react';
import Cookies from 'js-cookie';
import {ID_TOKEN} from '../../utils/constants';
import {buildNavigate,GIA_READY,isNavigationResult} from '../../utils/onboarding/protocol';
import {RegistryStep} from '../../utils/onboarding/registry';
const ORIGIN=process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN || 'http://localhost:3001';
const API=process.env.NEXT_PUBLIC_ONBOARDING_API || 'http://localhost:3100';
type Screen=RegistryStep & {tasks:RegistryStep[]};
type State={screens:Screen[];selected:Screen|null;task:RegistryStep|null;viewed:string[];acknowledged:string[];fallback:string|null;notice:string|null};
export type ChatMessage={id:number;role:'user'|'agent';text:string;screenId?:string;acknowledge?:boolean};
type Context={state:State|null;error:string;pendingStepId:string|null;messages:ChatMessage[];chatBusy:boolean;sendChat:(text:string)=>Promise<void>;navigateToStep:(id:string,ack?:boolean)=>Promise<boolean>;registerIframe:(win:Window|null)=>void};
const C=createContext<Context|null>(null);
export const useOnboarding=()=>{const c=useContext(C);if(!c)throw Error('Missing onboarding provider');return c;};
async function request(path:string,body?:unknown){
 const r=await fetch(API+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${Cookies.get(ID_TOKEN)}`},body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw Error(r.status===401?'Please sign in again.':'Progress was not saved. Please retry.');return r.json();
}
export function OnboardingProvider({children}:{children:React.ReactNode}){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[pendingStepId,setPending]=useState<string|null>(null),[chatBusy,setBusy]=useState(false);
 const [messages,setMessages]=useState<ChatMessage[]>([{id:0,role:'agent',text:'Hi, I’m Gia. Select a checklist screen to explore Assistly.'}]);
 const win=useRef<Window|null>(null),latest=useRef<State|null>(null),pending=useRef<{id:string;screen:Screen;ack:boolean;resume?:boolean}|null>(null),loaded=useRef(false),ready=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 latest.current=state;
 const add=(text:string,screenId?:string,acknowledge?:boolean)=>setMessages(p=>[...p,{id:Date.now()+Math.random(),role:'agent',text,screenId,acknowledge}]);
 function open(screen:Screen,ack=false,resume=false){
  if(!win.current || !ready.current || pending.current){setError('The dashboard is not ready. Please retry.');return false;}
  const id=crypto.randomUUID();pending.current={id,screen,ack,resume};setPending(screen.step_id);setError('');
  win.current.postMessage(buildNavigate(id,screen.step_id),ORIGIN);
  timer.current=setTimeout(()=>{if(pending.current?.id===id){pending.current=null;setPending(null);setError('The dashboard did not confirm navigation. Progress was not saved.');}},10000);return true;
 }
 async function navigateToStep(id:string,ack=false){const s=latest.current?.screens.find(s=>s.screen_id===id || s.tasks.some(t=>t.step_id===id));return s?open(s,ack):false;}
 function resume(){if(loaded.current&&ready.current&&!pending.current&&latest.current?.selected){loaded.current=false;open(latest.current.selected,false,true);}}
 useEffect(()=>{
  let cancelled=false;
  request('/walkthrough').then((s:State)=>{if(cancelled)return;latest.current=s;setState(s);loaded.current=true;if(s.fallback)add(s.fallback);resume();}).catch(e=>setError(e.message));
  const listener=async(e:MessageEvent)=>{
   if(e.origin!==ORIGIN||e.source!==win.current)return;
   if(e.data?.type===GIA_READY){ready.current=true;resume();return;}
   if(!isNavigationResult(e.data)||e.data.request_id!==pending.current?.id)return;
   const nav=pending.current!;if(timer.current)clearTimeout(timer.current);
   if(e.data.status!=='ok'){pending.current=null;setPending(null);setError('Navigation was not confirmed. Your saved selection is unchanged.');return;}
   if(nav.resume){pending.current=null;setPending(null);return;}
   try{const s=await request('/walkthrough/select',{screen_id:nav.screen.screen_id,acknowledge:nav.ack});latest.current=s;setState(s);}
   catch(e){setError((e as Error).message);}
   finally{pending.current=null;setPending(null);}
  };
  window.addEventListener('message',listener);return()=>{cancelled=true;window.removeEventListener('message',listener);if(timer.current)clearTimeout(timer.current);};
 },[]);
 async function sendChat(text:string){setMessages(p=>[...p,{id:Date.now(),role:'user',text}]);setBusy(true);try{const r=await request('/walkthrough/chat',{message:text});add(r.message,r.navigation?.screen_id,r.intent==='continue');}catch(e){add((e as Error).message);}finally{setBusy(false);}}
 return <C.Provider value={{state,error,pendingStepId,messages,chatBusy,sendChat,navigateToStep,registerIframe:w=>{win.current=w;}}}>{children}</C.Provider>;
}
