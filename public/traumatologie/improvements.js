/* Additional offline-friendly imaging and report tools. All imagery is fictional. */
const scanAssets={Radiographie:'assets/atlas-radio.jpg',Scanner:'assets/atlas-scanner.jpg',IRM:'assets/atlas-irm.jpg',Échographie:'assets/atlas-echo.jpg'};
const scanRegions=[['Tête',0],['Thorax',1],['Abdomen',2],['Bassin',3],['Épaule gauche',4],['Épaule droite',4],['Main gauche',5],['Main droite',5],['Cuisse gauche',6],['Cuisse droite',6],['Genou gauche',7],['Genou droit',7],['Pied gauche',8],['Pied droit',8]];
const scanFindings={0:['Contusion cranio-faciale','Suspicion de fracture crânienne','Corps étranger visible','Examen sans anomalie décrite'],1:['Contusion thoracique','Suspicion de fracture costale','Épanchement thoracique','Examen sans anomalie décrite'],2:['Contusion abdominale','Épanchement abdominal','Lésion des tissus mous','Examen sans anomalie décrite'],3:['Contusion du bassin','Suspicion de fracture du bassin','Lésion des tissus mous','Examen sans anomalie décrite'],4:['Contusion de l’épaule','Suspicion de fracture','Suspicion de luxation','Examen sans anomalie décrite'],5:['Contusion de la main','Suspicion de fracture','Corps étranger visible','Examen sans anomalie décrite'],6:['Contusion de la cuisse','Suspicion de fracture','Lésion des tissus mous','Examen sans anomalie décrite'],7:['Contusion du genou','Suspicion de fracture','Épanchement articulaire','Examen sans anomalie décrite'],8:['Contusion du pied','Suspicion de fracture','Lésion des tissus mous','Examen sans anomalie décrite']};
let chosenScan=null,chosenRegion=null;
prescriptions.splice(0,prescriptions.length,'Paracétamol','Ibuprofène / AINS','Tramadol','Antibiotique','Bétadine / povidone iodée','Antiseptique local','Crème cicatrisante','Pommade antiseptique','Sérum physiologique','Pansement','Compresses stériles','Bandage');
const rightColumn=document.querySelector('.layout > .column:last-child');
const operationCard=$('operations').closest('.card'),careCard=$('care').closest('.card'),prescriptionCard=$('prescription').closest('.card');
rightColumn.insertBefore(careCard,operationCard);
careCard.querySelector('h3').innerHTML='<span class="num">05</span>Soins / pré-opération';
operationCard.querySelector('h3').innerHTML='<span class="num">06</span>Opérations effectuées';
prescriptionCard.querySelector('h3').innerHTML='<span class="num">07</span>Prescription';
// Correct coordinates against the actual proportions of the commissioned illustration.
document.querySelectorAll('.hotspot').forEach(button=>{
  const view=button.dataset.view;
  const original=(view==='Face'?base:back).find(z=>z[0]===button.dataset.zone);
  const [name,ox,oy,ow,oh]=original;
  const x=ox+(view==='Face'?3:0);
  const y=oy<=30?oy:oy<50?30+(oy-30)*.72:44+(oy-50)*1.09;
  const w=/Thorax|dos|Abdomen/.test(name)?Math.min(ow,15):/Bassin/.test(name)?15:ow;
  const h=oh;
  button.style.left=(x-w/2)+'%';button.style.top=(y-h/2)+'%';button.style.width=w+'%';button.style.height=h+'%';
  button.onclick=()=>{s.zone=s.zone?.name===name&&s.zone?.view===view?null:{name,view,x,y,w,h};render()};
});
const scanCard=document.createElement('section');scanCard.className='card';scanCard.innerHTML=`<div class="card-head"><h3>Imagerie</h3><span class="muted">Illustrations fictives</span></div><div class="card-body"><div class="group"><span class="label">Examen</span><div class="choices" id="scanModalities"></div></div><div class="group"><span class="label">Région à documenter</span><div class="scan-grid" id="scanRegions"></div></div><div class="scan-selection" id="scanSelection">Sélectionnez un examen et une région.</div><button class="ghost" id="addScan" disabled>Ajouter l'examen</button><div class="scan-cards" id="scanCards"></div><p class="notice">Images illustratives fictives, sans interprétation médicale.</p></div>`;
document.querySelector('.layout > .column:first-child').append(scanCard);
function renderScans(){
  s.exams??=[];
  chips('scanModalities',Object.keys(scanAssets),chosenScan?[chosenScan]:[],v=>{chosenScan=chosenScan===v?null:v;renderScans()});
  $('scanRegions').replaceChildren();
  scanRegions.forEach(([name])=>{const b=document.createElement('button');b.type='button';b.className='chip'+(chosenRegion===name?' selected':'');b.textContent=name;b.setAttribute('aria-pressed',chosenRegion===name);b.onclick=()=>{chosenRegion=chosenRegion===name?null:name;renderScans()};$('scanRegions').append(b)});
  $('scanSelection').textContent=chosenScan&&chosenRegion?`${chosenScan} · ${chosenRegion}`:'Sélectionnez un examen et une région.';
  $('addScan').disabled=!(chosenScan&&chosenRegion);
  $('scanCards').replaceChildren();
  s.exams.forEach((exam,i)=>{
    const card=document.createElement('div');card.className='scan-card';
    const head=document.createElement('div');head.className='scan-card-head';const title=document.createElement('strong');title.textContent=`${exam.modality} · ${exam.region}`;
    const remove=document.createElement('button');remove.type='button';remove.textContent='Retirer';remove.setAttribute('aria-label',`Retirer ${exam.modality} ${exam.region}`);remove.onclick=()=>{s.exams.splice(i,1);render()};head.append(title,remove);
    const frame=document.createElement('div');frame.className='scan-window';const img=document.createElement('img');img.src=scanAssets[exam.modality];img.alt=`Illustration fictive : ${exam.modality}, ${exam.region}`;img.style.left=`-${exam.cell%3*100}%`;img.style.top=`-${Math.floor(exam.cell/3)*100}%`;frame.append(img);
    const caption=document.createElement('div');caption.className='scan-caption';caption.textContent='Illustration fictive · Choisir un constat';
    const findings=document.createElement('div');findings.className='choices scan-findings';
    scanFindings[exam.cell].forEach(label=>{const b=document.createElement('button');b.type='button';b.className='chip'+(exam.finding===label?' selected':'');b.textContent=label;b.setAttribute('aria-pressed',exam.finding===label);b.onclick=()=>{exam.finding=exam.finding===label?null:label;render()};findings.append(b)});
    card.append(head,frame,caption,findings);$('scanCards').append(card)
  });
  const old=$('summary').querySelector('[data-imaging]');old?.remove();
  if(s.exams.length){const row=document.createElement('div');row.className='summary-item';row.dataset.imaging='';const b=document.createElement('b');b.textContent='Imagerie';const span=document.createElement('span');span.textContent=s.exams.map(e=>`${e.modality} · ${e.region}`).join(' · ');row.append(b,span);const pres=[...$('summary').children].find(e=>e.querySelector('b')?.textContent==='Prescription');$('summary').insertBefore(row,pres||null)}
}
const diagnosisBeforeImaging=diagnosis;
diagnosis=function(){const base=diagnosisBeforeImaging().replace(/\.$/,'');const findings=(s.exams||[]).filter(e=>e.finding).map(e=>`${e.modality.toLowerCase()} ${e.region.toLowerCase()} : ${e.finding.toLowerCase()}`);return [base,...findings].filter(Boolean).join(' · ')+([base,...findings].some(Boolean)?'.':'')};
const renderBeforeImaging=render;
render=function(){renderBeforeImaging();renderScans()};
$('addScan').onclick=()=>{if(!chosenScan||!chosenRegion)return;const cell=scanRegions.find(r=>r[0]===chosenRegion)[1];s.exams??=[];s.exams.push({modality:chosenScan,region:chosenRegion,cell});chosenScan=chosenRegion=null;render()};
const previousNew=$('new').onclick;$('new').onclick=()=>{const before=s;previousNew();if(s!==before){chosenScan=chosenRegion=null;render()}};
render();
function loadScan(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src})}
async function exportImprovedPNG(){
  const W=900,pad=52,content=W-2*pad,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const exams=s.exams||[];
  const atlas={};try{await Promise.all([...new Set(exams.map(e=>e.modality))].map(async m=>atlas[m]=await loadScan(scanAssets[m])))}catch{alert("Une illustration d'imagerie n'a pas pu être chargée. Réessayez une fois les images affichées.");return}
  ctx.font='17px system-ui';
  const wrap=text=>{const lines=[];String(text).split('\n').forEach(p=>{let line='';p.split(/\s+/).forEach(word=>{let candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width>content-48&&line){lines.push(line);line=word}else line=candidate;while(ctx.measureText(line).width>content-48&&line.length>1){let cut=line.length-1;while(cut>1&&ctx.measureText(line.slice(0,cut)).width>content-48)cut--;lines.push(line.slice(0,cut));line=line.slice(cut)}});if(line)lines.push(line)});return lines};
  const blocks=[];const add=(title,items,extra)=>{const lines=items.filter(Boolean).flatMap(wrap);if(lines.length)blocks.push({title,lines,extra,height:58+lines.length*27+(extra==='map'?350:extra?.image?400:0)})};
  if(s.zone)add('LOCALISATION',[`${s.zone.name} · ${s.zone.view}`],'map');
  add('BLESSURE',[s.injury,...s.detail]);add('GRAVITÉ',[s.severity]);
  add('ÉTAT DU PATIENT',Object.entries(s.patient).map(([k,v])=>`${k} : ${v==='Aucun'?'Absence de saignement':v==='Aucune'?'Absence de douleur':v}`));
  add('DIAGNOSTIC',[diagnosis().replaceAll('aucun','absence de saignement').replaceAll('aucune','absence de douleur')]);
  add('SOINS / PRÉ-OPÉRATION',s.care);
  add('OPÉRATIONS EFFECTUÉES',s.operations.map((v,i)=>`${i+1}. ${v}`));
  exams.forEach(exam=>add(`IMAGERIE · ${exam.modality.toUpperCase()}`,[exam.region],{image:exam}));
  add('PRESCRIPTION',s.prescription);add('MÉDECIN',[s.doctor.trim()]);add('NOTES',[s.notes.trim()]);
  const H=180+blocks.reduce((v,b)=>v+b.height+16,0)+52;
  const scale=H>7500?1:2;canvas.width=W*scale;canvas.height=H*scale;ctx.scale(scale,scale);
  ctx.fillStyle='#f2f6fa';ctx.fillRect(0,0,W,H);ctx.fillStyle='#0d2037';ctx.fillRect(0,0,W,145);ctx.fillStyle='#ae2142';ctx.fillRect(0,0,10,145);
  const logo=document.querySelector('.logo');if(logo.complete&&logo.naturalWidth)ctx.drawImage(logo,48,24,96,96);
  ctx.fillStyle='#fff';ctx.font='bold 28px system-ui';ctx.fillText('DOSSIER TRAUMATOLOGIQUE',159,68);ctx.fillStyle='#c2d8e9';ctx.font='16px system-ui';ctx.fillText('Emergency Medical Services — Los Santos',160,100);
  let y=175;blocks.forEach(b=>{
    ctx.fillStyle='#fff';ctx.fillRect(pad,y,content,b.height);ctx.fillStyle='#ae2142';ctx.fillRect(pad,y,5,b.height);
    ctx.fillStyle='#164369';ctx.font='bold 16px system-ui';ctx.fillText(b.title,pad+22,y+30);
    let textY=y+62;ctx.fillStyle='#18334b';ctx.font='17px system-ui';b.lines.forEach(line=>{ctx.fillText(line,pad+22,textY);textY+=27});
    if(b.extra==='map'){
      const img=$('bodyImg'),iw=340,ih=iw*img.naturalHeight/img.naturalWidth,dy=textY+5;
      ctx.drawImage(img,pad+22,dy,iw,ih);const z=s.zone;ctx.fillStyle='#e7305877';ctx.strokeStyle='#f32c56';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(pad+22+iw*z.x/100,dy+ih*z.y/100,iw*z.w/200,ih*z.h/200,0,0,Math.PI*2);ctx.fill();ctx.stroke()
    }else if(b.extra?.image){const exam=b.extra.image,img=atlas[exam.modality],sw=img.naturalWidth/3,sh=img.naturalHeight/3,col=exam.cell%3,row=Math.floor(exam.cell/3);ctx.drawImage(img,col*sw,row*sh,sw,sh,pad+22,textY+4,320,320);ctx.fillStyle='#647a8d';ctx.font='13px system-ui';ctx.fillText('Illustration fictive',pad+22,textY+341);if(exam.finding){ctx.fillStyle='#18334b';ctx.font='17px system-ui';ctx.fillText('Constat : '+exam.finding,pad+22,textY+372)}}
    y+=b.height+16
  });
  ctx.fillStyle='#61788e';ctx.font='13px system-ui';ctx.fillText('Document fictif · EMS Los Santos',pad,H-30);
  try{const a=document.createElement('a');a.download='dossier-traumatologique.png';a.href=canvas.toDataURL('image/png');a.click()}catch{alert('Le PNG n’a pas pu être créé dans ce navigateur.')}
}
$('export').onclick=exportImprovedPNG;
