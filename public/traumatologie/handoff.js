/* Versioned, same-origin bridge. Authentication stays in the parent panel. */
(() => {
  const text = (v, max = 12000) => typeof v === 'string' ? v.slice(0, max) : '';
  const strings = v => Array.isArray(v) ? v.slice(0, 300).map(x => text(x, 1000)).filter(Boolean) : [];
  function normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Dossier invalide');
    const next = blank();
    next.injury = injuries.includes(input.injury) ? input.injury : null;
    next.detail = strings(input.detail).filter(x => (details[next.injury] || []).includes(x));
    next.severity = ['Légère','Modérée','Sévère','Critique'].includes(input.severity) ? input.severity : null;
    for (const [key, values] of Object.entries(patient)) if(values.includes(input.patient?.[key])) next.patient[key] = input.patient[key];
    next.operations = strings(input.operations);
    next.care = strings(input.care).filter(x => care.includes(x));
    next.prescription = strings(input.prescription);
    next.doctor = text(input.doctor, 200); next.notes = text(input.notes);
    const wanted = Array.isArray(input.zones) ? input.zones : input.zone ? [input.zone] : [];
    next.zones = [];
    for (const z of wanted.slice(0, 42)) {
      const button = [...document.querySelectorAll('.hotspot')].find(b => b.dataset.zone === z?.name && b.dataset.view === z?.view);
      if(!button || next.zones.some(x => x.name === z.name && x.view === z.view)) continue;
      const w=parseFloat(button.style.width), h=parseFloat(button.style.height);
      next.zones.push({name:z.name,view:z.view,x:parseFloat(button.style.left)+w/2,y:parseFloat(button.style.top)+h/2,w,h});
    }
    next.zone = next.zones[0] || null;
    next.exams = (Array.isArray(input.exams) ? input.exams : []).slice(0,100).flatMap(e => {
      const region = scanRegions.find(r => r[0] === e?.region);
      if(!region || !Object.hasOwn(scanAssets,e.modality)) return [];
      const result = {modality:e.modality,region:region[0],cell:region[1]};
      if(scanFindings[result.cell].includes(e.finding)) result.finding=e.finding;
      return [result];
    });
    return next;
  }
  function snapshot() {
    return {...s,doctor:$('doctor').value,notes:$('notes').value,draftInputs:{operation:$('customOperation').value,prescription:$('customPrescription').value}};
  }
  function load(payload) {
    s=normalize(payload); chosenScan=chosenRegion=null;
    $('doctor').value=s.doctor; $('notes').value=s.notes;
    $('customOperation').value=text(payload.draftInputs?.operation,180);
    $('customPrescription').value=text(payload.draftInputs?.prescription,180);
    render();
  }
  window.TraumaDraft={snapshot,load,normalize};
  window.addEventListener('message',event=>{
    if(event.source!==window.parent || event.origin!==location.origin || !event.data || event.data.channel!=='ems-trauma-v1') return;
    const {action,requestId,payload}=event.data;
    if(action==='readonly') { document.querySelector('.layout').inert=!!event.data.value; document.querySelector('.top').inert=!!event.data.value; document.querySelector('.intro').inert=!!event.data.value; return; }
    if(!['snapshot','load','reset'].includes(action)) return;
    try {
      if(action==='load') load(payload);
      if(action==='reset') load(blank());
      window.parent.postMessage({channel:'ems-trauma-v1',requestId,ok:true,payload:snapshot()},location.origin);
    } catch { window.parent.postMessage({channel:'ems-trauma-v1',requestId,ok:false,error:'Le dossier ne peut pas être chargé.'},location.origin); }
  });
  document.addEventListener('input',()=>{if(window.parent!==window) window.parent.postMessage({channel:'ems-trauma-v1',action:'changed'},location.origin);});
  const previousRender=render;
  render=function(){previousRender();if(window.parent!==window) window.parent.postMessage({channel:'ems-trauma-v1',action:'changed'},location.origin);};
  // The panel owns the saved-record identity: reset must go through its toolbar.
  if(window.parent!==window) $('new').hidden=true;
})();
