/* Private, origin-local worker context and notification action handoff. No auth tokens. */
(function(root){
 function transact(mode,fn){return new Promise((resolve,reject)=>{
  if(!root.indexedDB){reject(new Error('Device storage unavailable'));return;}
  const req=indexedDB.open('acadely-push-device-v1',1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('device'))req.result.createObjectStore('device');};
  req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('device',mode);let result;
   try{result=fn(tx.objectStore('device'));}catch(e){db.close();reject(e);return;}
   tx.oncomplete=()=>{db.close();resolve(result?.result);};tx.onerror=()=>{db.close();reject(tx.error);};
  };
 });}
 function updateQueue(change){return transact('readwrite',store=>{const request=store.get('intents');request.onsuccess=()=>store.put(change(Array.isArray(request.result)?request.result:[]),'intents');return request;});}
 root.AcadelyPushStore={get:key=>transact('readonly',s=>s.get(key)),set:(key,value)=>transact('readwrite',s=>s.put(value,key)),remove:key=>transact('readwrite',s=>s.delete(key)),queueIntent:value=>updateQueue(rows=>rows.some(r=>r.id===value.id)?rows:[...rows,value]),getIntent:async userId=>{const rows=await transact('readonly',s=>s.get('intents'));return Array.isArray(rows)?rows.find(r=>!userId||r.userId===userId):null;},removeIntent:id=>updateQueue(rows=>rows.filter(r=>r.id!==id))};
})(typeof self!=='undefined'?self:globalThis);
