const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await b.newPage({viewport:{width:1600,height:1000}});
 const token='x.'+Buffer.from(JSON.stringify({sub:'synthetic-user','custom:userId':'synthetic-user','custom:homeId':'home-a','custom:role':'PCHO','custom:homeType':'Personal Care Home',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.x';
 await page.context().addCookies([{name:'idToken',value:token,domain:'localhost',path:'/'},{name:'homeId',value:'home-a',domain:'localhost',path:'/'},{name:'userId',value:'synthetic-user',domain:'localhost',path:'/'}]);
 await page.route('http://localhost:3001/**', route=>route.fulfill({contentType:'text/html',body:`<html><body>Synthetic dashboard bridge<script>
 window.addEventListener('message',e=>{if(e.origin==='http://localhost:3000'&&e.source===parent&&e.data.type==='GIA_NAVIGATE'){document.body.dataset.step=e.data.step_id;parent.postMessage({type:'GIA_NAVIGATION_RESULT',request_id:e.data.request_id,status:'ok'},'http://localhost:3000');}});
 setTimeout(()=>parent.postMessage({type:'GIA_READY'},'http://localhost:3000'),200);
 </script></body></html>`}));
 await page.goto('http://localhost:3000/onboarding');
 await page.getByRole('button',{name:'Nurse Leads',exact:true}).waitFor({timeout:90000});


 await page.getByRole('button',{name:'Nurse Leads',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[aria-current=step]')?.textContent==='Nurse Leads');
 const input=page.getByPlaceholder('Type a message...');
 await input.fill('What do I do here?'); await page.getByRole('button',{name:'Send message'}).click();
 await page.getByText(/Select.*Add New/).last().waitFor();
 await input.fill("What's next?");await page.getByRole('button',{name:'Send message'}).click();
 await page.getByRole('button',{name:'Open',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[aria-current=step]')?.textContent==='Seniors');
 await page.reload();await page.waitForFunction(()=>document.querySelector('[aria-current=step]')?.textContent==='Seniors');
 await page.getByPlaceholder('Type a message...').fill('Tell me about Referral Agents');await page.getByRole('button',{name:'Send message'}).click();
 await page.getByText(/Referral Agents:/).waitFor();
 if(await page.locator('[aria-current=step]').textContent()!=='Seniors')throw Error('Reference question changed selection');
 console.log('Synthetic iframe browser acceptance passed: manual nurse selection, help, next Open, clinical selection, refresh resume, reference question stays put');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
