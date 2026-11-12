import {test} from 'node:test';
import assert from 'node:assert/strict';
import {walkthrough} from './registry';
import {productReply} from './product-walkthrough';
const pch={role:'PCHO',homeType:'Personal Care Home'};
test('home applicability fails closed; roles use app grants',()=>{
 assert.equal(walkthrough(pch).length,7);
 assert.equal(walkthrough({...pch,homeType:'Adult Day Center'}).length,0);
 assert.ok(walkthrough({...pch,role:'SalesRepresentative'}).length<7);
 assert.equal(walkthrough({...pch,role:'unknown'}).length,0);
});
test('Nurse guidance, next screen, reference questions, and hostile model targets',()=>{
 const screens=walkthrough(pch);const selected=screens.find(s=>s.screen_id==='nurse_leads')!;
 const state={screens,selected,task:selected.tasks[0],viewed:[],acknowledged:[],fallback:null,notice:null};
 assert.match(productReply('What do I do here?',state).message!,/Add New/);
 assert.equal(productReply("What's next?",state).navigation?.screen_id,'seniors');
 assert.equal(productReply("What’s next for this nurse lead?",state).navigation,null);
 assert.equal(productReply('Tell me about Referral Agents',state).navigation,null);
 assert.match(productReply('Tell me about Referral Agents',state).message!,/referral/i);
 assert.equal(productReply('help',state,{intent:'open_step',step_id:'https://evil.test'}).navigation,null);
 assert.equal(productReply('done',state).intent,'continue');
 assert.equal(state.selected.screen_id,'nurse_leads');
});
