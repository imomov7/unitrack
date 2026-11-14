/* UI translation only. Never changes stored values, course codes or official names.
   New UI text belongs in locales/ar.js. Uses text nodes, not replacement HTML. */
(function(root){
 const key='acadely-language-v1';let language='en';try{language=localStorage.getItem(key)==='ar'?'ar':'en';}catch{}
 const texts=new WeakMap(),attributes=new WeakMap();let observer;
 function translate(value){
  if(language!=='ar')return String(value);
  const raw=String(value),trim=raw.trim(),dictionary=root.ACADELY_AR||{};
  if(dictionary[trim])return raw.replace(trim,dictionary[trim]);
  // Preserve interpolated values verbatim; translate only the declared UI fragments.
  for(const [pattern,replacement] of patterns){if(pattern.test(trim))return raw.replace(trim,trim.replace(pattern,replacement));}
  // Translate status fragments around unchanged names and codes.
  if(trim.includes(' · '))return raw.replace(trim,trim.split(' · ').map(part=>{
   if(typeof root.acadelyProtectedText==='function'&&root.acadelyProtectedText().has(part))return part;
   return translate(part);
  }).join(' · '));
  return raw;
 }
 const patterns=[
  [/^([\d.]+) semester credits$/,'$1 ساعات فصلية معتمدة'],[/^([\d.]+) MIT units$/,'$1 وحدات MIT'],
  [/^across the remaining ([\d.]+)% of the course\.$/,'في $1% المتبقية من المقرر.'],
  [/^Even with 100% on all remaining work, your maximum final grade is ([\d.]+)%\.$/,'حتى مع الحصول على 100% في العمل المتبقي، أعلى درجة نهائية ممكنة هي $1%.'],
  [/^Current assessment average is based on ([\d.]+)% of course weight; ([\d.]+)% remains\.$/,'يعتمد متوسط التقييم على $1% من وزن المقرر؛ يتبقى $2%.'],
  [/^With a hypothetical ([\d.]+)% average, your projected final grade is$/,'مع متوسط افتراضي $1%، درجتك النهائية المتوقعة هي'],
  [/^The top grade boundary must award the full ([\d.]+) GPA points\.$/,'يجب أن يمنح الحد الأعلى كامل نقاط المعدل: $1.'],

  [/^([\d.]+)% graded$/,'$1% تم تقييمه'],
  [/^Current assessment average; ([\d.]+)% weight remains.$/,'متوسط التقييم الحالي؛ يتبقى $1% من الوزن.'],
  [/^([\d.]+)\/([\d.]+) marks$/,'$1/$2 درجة'],[/^([\d.]+)% course weight$/,'$1% من وزن المقرر'],
  [/^([\d.]+) hours$/,'$1 ساعات'],

  [/^Remove grade boundary (\d+)$/,'إزالة حد الدرجة $1'],
  [/^(\d+) completed sessions this week. Only saved and completed sessions are counted.$/,'$1 جلسات مكتملة هذا الأسبوع. تُحتسب الجلسات المحفوظة والمكتملة فقط.'],
  [/^([\d.]+) hours per day. Timetable classes are displayed on the dashboard; you can adjust available study hours independently in Settings.$/,'$1 ساعات يوميًا. تظهر المحاضرات في لوحة التحكم؛ يمكنك ضبط ساعات الدراسة المتاحة بشكل مستقل في الإعدادات.'],
  [/^Select (.+)$/,'اختيار $1'],[/^Official catalogue · (.+) ↗$/,'الدليل الرسمي · $1 ↗'],

  [/^(\d+(?:\.\d+)?) credits$/,'$1 ساعات معتمدة'],[/^(\d+(?:\.\d+)?) graded credits$/,'$1 ساعات معتمدة مُقيّمة'],
  [/^Current courses · (.+) graded credits$/,'المقررات الحالية · $1 ساعات معتمدة مُقيّمة'],
  [/^(\d+) of (\d+) assignments completed$/,'اكتملت $1 من $2 واجبات'],[/^(\d+) on your schedule$/,'$1 في جدولك'],
  [/^(.+) days away$/,'بعد $1 أيام'],[/^(.+) days ago$/,'منذ $1 أيام'],
  [/^Workspace \/ (.+)$/,'مساحة العمل / $1'],[/^Professor (.+)$/,'الأستاذ $1'],
  [/^GPA points \((.+)\)$/,'نقاط المعدل ($1)'],[/^Required average: (.+)$/,'المتوسط المطلوب: $1'],
  [/^Assignment: (.+)$/,'واجب: $1'],[/^Exam: (.+)$/,'امتحان: $1'],[/^Class: (.+)$/,'محاضرة: $1'],
  [/^Personal: (.+)$/,'شخصي: $1'],[/^Study: (.+)$/,'دراسة: $1'],[/^Academic deadline: (.+)$/,'موعد أكاديمي: $1'],
  [/^Events · (.+)$/,'الأحداث · $1'],[/^Select (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (.+)$/,'اختيار $1، $2'],
  [/^Delete (.+) and its (\d+) linked records\? This can’t be undone\.$/,'حذف $1 و$2 سجلات مرتبطة به؟ لا يمكن التراجع.'],
  [/^Final course grade must be between 0% and 100%\.$/,'يجب أن تكون الدرجة النهائية بين 0% و100%.'],
 ];
 function protectedText(node){
  const p=node.parentElement;if(!p||p.closest('script,style,textarea,input,code,[translate="no"],[data-official]'))return true;
  // User values can coincide with UI labels (e.g. a course called Calendar).
  // Protect data presentation elements; controls continue translating their labels.
  if(p.closest('button,label,summary,option,nav,.nav-item,.breadcrumb,.context-nav,.context-navigation'))return false;
  const val=node.nodeValue.trim();return typeof root.acadelyProtectedText==='function'&&root.acadelyProtectedText().has(val);
 }
 function textNode(node){if(protectedText(node))return;let record=texts.get(node);if(!record||node.nodeValue!==record.last)record={source:node.nodeValue,last:node.nodeValue};const next=translate(record.source);if(node.nodeValue!==next)node.nodeValue=next;record.last=next;texts.set(node,record);}
 function apply(scope=document.body){
  if(!scope)return;observer?.disconnect();
  if(scope.nodeType===3)textNode(scope);else{
   const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);while(walker.nextNode())textNode(walker.currentNode);
   const elements=scope.querySelectorAll?.('[aria-label],[placeholder],[title]')||[];
   for(const el of elements){if(el.closest('[translate="no"],[data-official]'))continue;let attrs=attributes.get(el)||{};for(const name of ['aria-label','placeholder','title']){const current=el.getAttribute(name);if(current===null)continue;let record=attrs[name];if(!record||record.last!==current)record={source:current};const next=translate(record.source);if(current!==next)el.setAttribute(name,next);record.last=next;attrs[name]=record;}attributes.set(el,attrs);}
  }
  observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder','title']});
 }
 function set(next){language=next==='ar'?'ar':'en';try{localStorage.setItem(key,language);}catch{}document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';apply();root.dispatchEvent(new CustomEvent('acadely-language-changed',{detail:language}));}
 function start(){document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';observer=new MutationObserver(records=>{const scopes=new Set();for(const r of records){if(r.type==='childList')r.addedNodes.forEach(n=>scopes.add(n));else scopes.add(r.target);}for(const scope of scopes)if(scope.isConnected)apply(scope);});apply();}
 root.AcadelyI18n={t:translate,apply,set,get language(){return language;},get locale(){return language==='ar'?'ar':'en';}};
 const originalConfirm=root.confirm?.bind(root);if(originalConfirm)root.confirm=message=>originalConfirm(translate(message));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
