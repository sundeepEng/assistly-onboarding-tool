const assert=require('node:assert/strict');
const token=(u='test-a',h='home-a',role='PCHO',type='Personal Care Home')=>'x.'+Buffer.from(JSON.stringify({sub:u,'custom:homeId':h,'custom:role':role,'custom:homeType':type})).toString('base64url')+'.x';
async function api(path,body,t=token()){const r=await fetch('http://localhost:3100'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return [r.status,await r.json()];}
(async()=>{
 assert.equal((await api('/walkthrough',null,token('a','h','PCHO','Adult Day Center')))[1].screens.length,0);
 assert.ok((await api('/walkthrough',null,token('a','h','SalesRepresentative')))[1].screens.length<7);
 assert.equal((await api('/walkthrough/select',{screen_id:'nurse_leads'}))[1].selected.screen_id,'nurse_leads');
 assert.match((await api('/walkthrough/chat',{message:'What do I do here?'}))[1].message,/Add New/);
 const reply=(await api('/walkthrough/chat',{message:"What's next?"}))[1];assert.equal(reply.navigation.screen_id,'seniors');
 assert.equal((await api('/walkthrough'))[1].selected.screen_id,'nurse_leads');
 await api('/walkthrough/select',{screen_id:'seniors',acknowledge:true});
 const s=(await api('/walkthrough'))[1];assert.equal(s.selected.screen_id,'seniors');assert.ok(s.acknowledged.includes('nurse_leads'));
 assert.equal((await api('/walkthrough/chat',{message:'Tell me about Referral Agents'}))[1].navigation,null);
 assert.equal((await api('/walkthrough'))[1].selected.screen_id,'seniors');
 assert.equal((await api('/walkthrough',null,token('other-user')))[1].selected.screen_id,'senior_leads');
 assert.equal((await api('/walkthrough',null,token('test-a','other-home')))[1].selected.screen_id,'senior_leads');
 assert.equal((await api('/walkthrough/select',{screen_id:'evil'}))[0],403);
 assert.equal((await api('/onboarding/evaluate',{session_id:'bad'}))[0],404);
 console.log('API acceptance passed: filtering, selection, chat offers, acknowledgement, refresh, user/home isolation, invalid destination rejection, legacy verification disabled');
})().catch(e=>{console.error(e);process.exit(1)});
