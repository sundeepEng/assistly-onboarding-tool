import {useOnboarding} from './onboarding-provider';
export default function StepsPanel(){
 const {state,error,pendingStepId,navigateToStep}=useOnboarding();
 return <aside className="h-full overflow-y-auto bg-white p-4 border-r">
  <h2 className="text-lg font-bold">Product walkthrough</h2>
  <p className="text-sm text-gray-500 my-2">Selected checklist screen. Explore without creating records.</p>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {!state&&!error&&<p>Loading your checklist…</p>}
  {state?.notice&&<p>{state.notice}</p>}
  {['crm','clinical'].map(module=><section key={module}><h3 className="font-bold uppercase mt-5">{module}</h3>
   {state?.screens.filter(s=>s.module_id===module).map(s=><div key={s.screen_id} className="my-3">
    <button disabled={!!pendingStepId} onClick={()=>void navigateToStep(s.screen_id)} aria-current={state.selected?.screen_id===s.screen_id?'step':undefined} className={`w-full text-left rounded p-2 ${state.selected?.screen_id===s.screen_id?'bg-blue-100':'bg-gray-50'}`}>{s.screen_title}</button>
    <p className="text-xs text-gray-500">{state.acknowledged.includes(s.screen_id)?'Acknowledged':state.viewed.includes(s.screen_id)?'Viewed':'Not viewed'}</p>
    <details className="ml-2 text-sm"><summary>Task help</summary>{s.tasks.map(t=><div key={t.step_id} className="my-2"><b>{t.title}</b><p>{t.guidance.replace(/\*\*/g,'')}</p>{t.kind==='reference'&&<small>Product help</small>}</div>)}</details>
   </div>)}
  </section>)}
  {state?.selected&&<button disabled={!!pendingStepId} className="rounded bg-blue-600 text-white p-2" onClick={()=>{const i=state.screens.findIndex(s=>s.screen_id===state.selected?.screen_id);const next=state.screens[i+1];if(next)void navigateToStep(next.screen_id,true);}}>Continue walkthrough</button>}
 </aside>;
}
