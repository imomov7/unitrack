// Runs independently of the app modules so startup failures never look like zero grades.
(function () {
  let rendered = false;
  function showReload() {
    if (rendered) return;
    const message=document.querySelector('#startup-message');
    if(message)message.textContent='Acadely could not finish loading. Check your connection and reload. Your saved academic data has not been cleared.';
    const button=document.querySelector('#startup-reload');
    if(button)button.hidden=false;
  }
  const timeout=setTimeout(showReload,12000);
  window.addEventListener('acadely-rendered',()=>{rendered=true;clearTimeout(timeout);});
  window.addEventListener('error',event=>{
    const target=event.target;
    if(target?.tagName==='SCRIPT' || event.filename?.includes('/js/'))showReload();
  },true);
  document.querySelector('#startup-reload')?.addEventListener('click',()=>location.reload());
})();
