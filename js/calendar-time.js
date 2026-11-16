/* Calendar presentation only: never writes workspace records or settings. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AcadelyCalendarTime=api;})(typeof window!=='undefined'?window:globalThis,function(){
 const HOUR_HEIGHT=96,DAY_MINUTES=1440;
 function validZone(zone){try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();return !!zone;}catch{return false;}}
 function timezone(settings={},profile={},fallback){const local=fallback||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';return [settings.calendarTimezone,settings.notificationPrefs?.timezone,profile.timezone,local,'UTC'].find(validZone);}
 function clock(now,zone){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,minutes:Number(p.hour)*60+Number(p.minute)};}
 function minutes(time){if(!/^\d{2}:\d{2}$/.test(time||''))return null;const [h,m]=time.split(':').map(Number);return h<24&&m<60?h*60+m:null;}
 function nextDate(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
 function segments(events,date){const list=[];for(const item of events){const start=minutes(item.start),end=minutes(item.end);if(start===null)continue;
  const overnight=end!==null&&end<=start;
  if(item.date===date)list.push({item,start,end:overnight?1440:Math.min(1440,end===null?start+45:end),continuation:false});
  if(overnight&&nextDate(item.date)===date&&end>0)list.push({item,start:0,end,continuation:true});
 }
 // Assign simultaneous events separate lanes; touching endpoints do not overlap.
 list.sort((a,b)=>a.start-b.start||b.end-a.end);let group=[],until=-1;
 function finish(){const lanes=[];for(const entry of group){let lane=lanes.findIndex(end=>end<=entry.start);if(lane<0)lane=lanes.length;lanes[lane]=entry.end;entry.lane=lane;}for(const entry of group)entry.lanes=lanes.length;group=[];}
 for(const entry of list){if(entry.start>=until){finish();until=entry.end;}else until=Math.max(until,entry.end);group.push(entry);}finish();return list;
 }
 function grid({dates,events,zone,renderEvent,escape,locale='en'}){
  const cols=dates.length,headings=dates.map(date=>{const label=new Date(date+'T12:00:00Z').toLocaleDateString(locale,{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'});return `<button type="button" class="calendar-time-date" data-action="calendar-select" data-date="${date}" data-time-date="${date}" translate="no">${escape(label)}</button>`;}).join('');
  const untimed=events.filter(item=>dates.includes(item.date)&&minutes(item.start)===null);
  const hours=Array.from({length:24},(_,hour)=>`<span class="calendar-hour-label" style="top:${hour/24*100}%" dir="ltr">${String(hour).padStart(2,'0')}:00</span>`).join('');
  const columns=dates.map(date=>`<div class="calendar-time-column" data-time-column="${date}">${segments(events,date).map(entry=>`<div class="calendar-timed-event${entry.continuation?' is-continuation':''}" style="top:${entry.start/1440*100}%;height:${(entry.end-entry.start)/1440*100}%;inset-inline-start:calc(${entry.lane/entry.lanes*100}% + 3px);width:calc(${100/entry.lanes}% - 6px)">${renderEvent(entry.item)}</div>`).join('')}<div class="calendar-now-line" data-calendar-now hidden><i></i></div></div>`).join('');
  return `${untimed.length?`<div class="calendar-untimed"><strong>All-day & date-only events</strong><div class="calendar-untimed-cards">${untimed.map(item=>`<div><small translate="no">${escape(item.date)}</small>${renderEvent(item)}</div>`).join('')}</div></div>`:''}<p class="calendar-timezone"><span>Calendar timezone</span>: <span translate="no">${escape(zone)}</span> · <span>Current time</span>: <time data-calendar-live-label translate="no"></time></p><div class="calendar-time-scroll" data-calendar-time-grid data-timezone="${escape(zone)}" data-range="${dates.join(',')}" tabindex="0" role="region" aria-label="Calendar time grid"><div class="calendar-time-shell" style="--time-columns:${cols};--hour-height:${HOUR_HEIGHT}px;--time-min-width:${cols===1?280:56+cols*180}px"><div class="calendar-time-head"><span></span>${headings}</div><div class="calendar-time-body"><div class="calendar-hour-gutter">${hours}</div>${columns}</div></div></div>`;
 }
 let timer=null,active=null,visibilityHandler=null;
 function mount(container){
  if(typeof document==='undefined')return;
  if(timer!==null)clearTimeout(timer);timer=null;
  if(visibilityHandler)document.removeEventListener('visibilitychange',visibilityHandler);visibilityHandler=null;
  const grid=container.querySelector('[data-calendar-time-grid]');
  if(!grid){active=null;return;}
  const key=grid.dataset.range+'|'+grid.dataset.timezone,previous=active;active={grid,key,scrollTop:0,scrollLeft:0};
  const firstOpen=!previous||previous.key!==key;
  if(previous?.key===key){grid.scrollTop=previous.scrollTop;grid.scrollLeft=previous.scrollLeft;}
  function rememberScroll(){if(active?.grid===grid){active.scrollTop=grid.scrollTop;active.scrollLeft=grid.scrollLeft;}}
  grid.addEventListener?.('scroll',rememberScroll,{passive:true});
  function tick(scroll=false){
   if(!grid.isConnected)return;
   const now=clock(Date.now(),grid.dataset.timezone);const label=container.querySelector('[data-calendar-live-label]');if(label){label.textContent=now.time;label.dateTime=new Date().toISOString();}
   let todayColumn=null;
   grid.querySelectorAll('[data-time-column]').forEach(column=>{const current=column.dataset.timeColumn===now.date,line=column.querySelector('[data-calendar-now]');column.classList.toggle('is-today',current);line.hidden=!current;if(current){todayColumn=column;line.style.top=(now.minutes/DAY_MINUTES*100)+'%';line.setAttribute('aria-label',(typeof window!=='undefined'?window.AcadelyI18n?.t('Current time'):'Current time')+': '+now.time);line.setAttribute('role','img');}});
   grid.querySelectorAll('[data-time-date]').forEach(date=>date.classList.toggle('is-today',date.dataset.timeDate===now.date));
   if(scroll&&todayColumn){const head=grid.querySelector('.calendar-time-head').offsetHeight;grid.scrollTop=Math.max(0,head+now.minutes/60*HOUR_HEIGHT-grid.clientHeight*.35);if(grid.scrollWidth>grid.clientWidth){const a=todayColumn.getBoundingClientRect(),b=grid.getBoundingClientRect();grid.scrollLeft+=a.left-b.left-(grid.clientWidth-a.width)/2;}}
   rememberScroll();
  }
  function schedule(){if(timer!==null)clearTimeout(timer);timer=setTimeout(()=>{tick();schedule();},60000-Date.now()%60000+20);}
  tick(firstOpen);schedule();visibilityHandler=()=>{if(!document.hidden){tick();schedule();}};document.addEventListener('visibilitychange',visibilityHandler);
 }
 return {HOUR_HEIGHT,timezone,clock,minutes,segments,grid,mount,focusNow(){active=null;}};
});
