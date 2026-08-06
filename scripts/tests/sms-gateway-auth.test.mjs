import c from 'crypto'
const BASE='http://localhost:8080/api/public/gateway/sms-verify'
const key=s=>c.createHash('sha256').update('vibtribe_gw_secret:'+s).digest('hex')
const sign=(k,msg)=>c.createHmac('sha256',k).update(msg).digest('hex')
let fails=0
async function call({dev,secret,body,ts=Date.now(),nonce=c.randomUUID(),badSig=false}){
  const raw=JSON.stringify(body)
  const sig=badSig?'00'.repeat(32):sign(key(secret),`${ts}.${nonce}.${raw}`)
  const r=await fetch(BASE,{method:'POST',headers:{'content-type':'application/json','x-vt-gateway-id':dev,'x-vt-timestamp':String(ts),'x-vt-nonce':nonce,'x-vt-signature':sig},body:raw})
  return {status:r.status,json:await r.json().catch(()=>({})),nonce}
}
const body=(id)=>({token:'UNKNOWNTOK1',from_msisdn:'+919999999999',sms_id:id})
function check(name,cond,got){ console.log((cond?'PASS':'FAIL')+' - '+name+' -> '+JSON.stringify(got)); if(!cond)fails++ }

const A={dev:'gw_test_active',secret:'TESTSECRET_ACTIVE'}
let r
r=await call({...A,body:body('sms_'+Date.now())}); check('valid device + unknown token → 422 unknown_token', r.status===422&&r.json.outcome==='unknown_token', r)
r=await call({dev:'gw_does_not_exist',secret:'x',body:body('a')}); check('unknown device → 401', r.status===401&&r.json.error==='unknown_device', r)
r=await call({dev:'gw_test_revoked',secret:'TESTSECRET_REVOKED',body:body('b')}); check('revoked device → 401', r.status===401&&r.json.error==='device_revoked', r)
r=await call({...A,body:body('c'),badSig:true}); check('invalid signature → 401', r.status===401&&r.json.error==='invalid_signature', r)
r=await call({...A,body:body('d'),ts:Date.now()-600000}); check('expired timestamp → 401', r.status===401&&r.json.error==='timestamp_out_of_range', r)
const n=c.randomUUID(); const sid='sms_'+Date.now()+'_dup'
r=await call({...A,body:body(sid),nonce:n}); check('first request accepted (processed)', r.status===422&&r.json.duplicate===false, r)
r=await call({...A,body:body(sid),nonce:n}); check('reused nonce → 409 replay_detected', r.status===409&&r.json.error==='replay_detected', r)
r=await call({...A,body:body(sid)}); check('duplicate sms_id → idempotent duplicate:true', r.json.duplicate===true, r)
r=await call({...A,body:{token:'x'}}); check('bad body → 400 invalid_body', r.status===400&&r.json.error==='invalid_body', r)
console.log(fails?`\n${fails} FAILURES`:'\nALL PASS')
