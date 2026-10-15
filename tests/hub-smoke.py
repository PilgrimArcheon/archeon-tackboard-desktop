"""Optional Chromium UI smoke test. Requires `playwright` and Chromium installed."""
from playwright.sync_api import sync_playwright
from pathlib import Path
src = Path(__file__).parents[1] / 'src'
state={'settings':{'boardId':'b1','theme':'dark','noteSize':'small','onTop':True,'launchAtLogin':False,'visible':True},'effectiveTheme':'dark','data':{'version':1,'boards':[{'id':'b1','name':'Planning','createdAt':1}],'notes':[{'id':'n1','boardId':'b1','title':'Test note','tasks':[],'updatedAt':1,'archivedAt':None}],'activeBoardId':'b1'},'revision':4,'accountId':'my-test-account-id','lastSyncedAt':None,'paired':False,'pending':10,'status':'local','error':'','limit':30,'noteSizes':{}}
mock='''window.__calls=[];window.__operations=[];window.confirm=()=>true;window.tack={state:async()=>window.__mock, onState:()=>{},onEdit:()=>{},operate:async(op)=>{window.__operations.push(op);return {ok:true}},chooseBoard:async()=>true,hubView:async()=>true,theme:async()=>true,noteSize:async()=>true,visibility:async()=>true,onTop:async()=>true,loginItem:async()=>true,openWeb:async()=>true,hideHub:async()=>true,connect:async(p)=>{window.__calls.push(p);return {ok:true,accountId:'test',revision:5,backupSaved:true}},review:async()=>({ok:true,empty:true}),disconnect:async()=>true,backup:async()=>({ok:true}),backupRecovery:async()=>{window.__calls.push({exported:true});return {ok:true}}}'''
html=(src/'hub.html').read_text().replace('<link rel="stylesheet" href="hub.css">','').replace('<script src="hub.js"></script>','')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':460,'height':850})
 errs=[]
 page.on('pageerror',lambda e: errs.append(str(e)))
 page.set_content(html)
 page.add_style_tag(content=(src/'hub.css').read_text())
 page.evaluate('(s)=>window.__mock=s',state)
 page.evaluate(mock)
 page.add_script_tag(content=(src/'hub.js').read_text())
 assert page.locator('#boards').is_visible()
 page.locator('#boards').select_option('__create__')
 page.locator('#boardName').fill('New desktop board')
 page.locator('#boardForm button[type=submit]').click()
 page.wait_for_function('window.__operations.length === 1')
 assert page.evaluate('window.__operations[0].type')=='new-board'
 page.get_by_role('button',name='Open settings').click()
 assert page.get_by_role('button',name='Connect account').is_visible()
 assert not page.get_by_role('button',name='Disconnect').is_visible()
 assert 'REPLACE' in page.locator('#pairingControls').inner_text() or 'replaces' in page.locator('#pairingControls').inner_text().lower()
 page.locator('#exportBeforeConnect').click()
 page.locator('#token').fill('tb_'+'a'*50)
 page.get_by_role('button',name='Connect account').click()
 page.wait_for_function('window.__calls.length === 2')
 calls=page.evaluate('window.__calls')
 assert calls[0]['exported']
 assert calls[1]['confirmReplace'] is True
 assert calls[1]['token'].startswith('tb_')
 page2=browser.new_page(viewport={'width':460,'height':850})
 page2.on('pageerror',lambda e: errs.append(str(e)))
 page2.set_content(html)
 page2.add_style_tag(content=(src/'hub.css').read_text())
 state['paired']=True
 page2.evaluate('(s)=>window.__mock=s',state)
 page2.evaluate(mock)
 page2.add_script_tag(content=(src/'hub.js').read_text())
 page2.get_by_role('button',name='Open settings').click()
 assert not page2.get_by_role('button',name='Connect account').is_visible()
 assert page2.get_by_role('button',name='Disconnect').is_visible()
 assert page2.locator('#appearance').input_value()=='dark'
 assert not errs,errs
 print('PASS: board dropdown, cloud-authoritative pairing, backup export and hub settings')
 browser.close()
