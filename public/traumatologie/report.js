/* Canvas report: all sections are conditional and sized to the selected content. */
async function exportPremiumPNG(){
  const exams=s.exams||[],atlases={};
  try{await Promise.all([...new Set(exams.map(e=>e.modality))].map(async modality=>{atlases[modality]=await loadScan(scanAssets[modality])}))}
  catch{alert('Une illustration ne peut pas être chargée. Réessayez lorsque les images sont visibles.');return}
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const W=1000,P=62,C=W-2*P;
  const colors={navy:'#0d2137',navy2:'#163b59',burgundy:'#a61f41',red:'#ce3657',ink:'#172f46',muted:'#637b90',line:'#dce6ee',paper:'#f0f4f7',white:'#ffffff'};
  const textLines=(value,maxWidth=C-58)=>{
    ctx.font='18px system-ui';const lines=[];
    String(value).split('\n').forEach(paragraph=>{
      let line='';
      paragraph.split(/\s+/).forEach(word=>{
        const next=line?line+' '+word:word;
        if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word}else line=next;
        while(ctx.measureText(line).width>maxWidth&&line.length>1){let i=line.length-1;while(i>1&&ctx.measureText(line.slice(0,i)).width>maxWidth)i--;lines.push(line.slice(0,i));line=line.slice(i)}
      });
      if(line)lines.push(line)
    });return lines
  };
  const blocks=[];
  function addText(title,values,feature=false){const lines=values.filter(Boolean).flatMap(v=>textLines(v));if(lines.length)blocks.push({type:'text',title,lines,feature,height:94+lines.length*30})}
  addText('Patient',[[s.patientLastName,s.patientFirstName].filter(Boolean).join(' ')]);
  const zones=s.zones||[];
  if(zones.length)blocks.push({type:'body',title:'Localisations',height:Math.max(455,140+zones.length*35)});
  addText('Blessure',[s.injury,...s.detail]);
  addText('Gravité',[s.severity]);
  addText('État du patient',Object.entries(s.patient).map(([key,v])=>`${key} : ${v==='Aucun'?'Absence de saignement':v==='Aucune'?'Absence de douleur':v}`));
  addText('Diagnostic',[diagnosis().replaceAll('aucun','absence de saignement').replaceAll('aucune','absence de douleur')],true);
  addText('Soins / pré-opération',s.care);
  if(s.operations.length){const items=s.operations.map((value,i)=>({number:i+1,lines:textLines(value,C-110)}));blocks.push({type:'timeline',title:'Opérations effectuées',items,height:85+items.reduce((n,item)=>n+Math.max(38,item.lines.length*27+11),0)})}
  exams.forEach(exam=>blocks.push({type:'scan',title:`Imagerie · ${exam.modality}`,exam,height:525}));
  addText('Prescription',s.prescription);
  addText('Nom du médecin',[s.doctor.trim()]);
  addText('Notes',[s.notes.trim()]);
  const H=215+blocks.reduce((n,b)=>n+b.height+18,0)+85;
  const scale=H>7000?1:2;canvas.width=W*scale;canvas.height=H*scale;ctx.scale(scale,scale);
  const rounded=(x,y,w,h,r,fill,stroke)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}};
  ctx.fillStyle=colors.paper;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=colors.navy;ctx.fillRect(0,0,W,182);
  ctx.fillStyle=colors.burgundy;ctx.fillRect(0,0,13,182);
  ctx.fillStyle=colors.red;ctx.fillRect(0,179,W,3);
  const logo=document.querySelector('.logo');if(logo.complete&&logo.naturalWidth)ctx.drawImage(logo,61,31,116,116);
  ctx.fillStyle='#94bad6';ctx.font='bold 14px system-ui';ctx.fillText('EMERGENCY MEDICAL SERVICES  /  LOS SANTOS',205,52);
  ctx.fillStyle=colors.white;ctx.font='bold 31px system-ui';ctx.fillText('DOSSIER TRAUMATOLOGIQUE',205,96);
  ctx.fillStyle='#c1d6e7';ctx.font='18px system-ui';ctx.fillText('Compte rendu documentaire',205,129);
  let y=211;
  blocks.forEach((block,index)=>{
    rounded(P,y,C,block.height,16,colors.white,colors.line);
    ctx.fillStyle=block.feature?colors.burgundy:colors.navy2;
    ctx.fillRect(P,y+20,5,33);
    ctx.fillStyle=block.feature?colors.burgundy:colors.navy2;
    ctx.font='bold 18px system-ui';ctx.fillText(block.title.toLocaleUpperCase('fr-FR'),P+27,y+43);
    ctx.fillStyle=colors.muted;ctx.font='bold 13px system-ui';ctx.fillText(String(index+1).padStart(2,'0'),P+C-50,y+42);
    ctx.strokeStyle=colors.line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(P+27,y+65);ctx.lineTo(P+C-27,y+65);ctx.stroke();
    if(block.type==='text'){
      ctx.fillStyle=colors.ink;ctx.font=block.feature?'bold 18px system-ui':'18px system-ui';
      block.lines.forEach((line,i)=>ctx.fillText(line,P+28,y+98+i*30));
    }
    if(block.type==='body'){
      rounded(P+28,y+83,405,335,12,colors.navy);
      const img=$('bodyImg'),iw=358,ih=iw*img.naturalHeight/img.naturalWidth,dx=P+52,dy=y+83+(335-ih)/2;
      ctx.drawImage(img,dx,dy,iw,ih);
      zones.forEach(z=>{ctx.fillStyle='#ee345a8c';ctx.strokeStyle='#ffced6';ctx.lineWidth=3;
        ctx.beginPath();ctx.ellipse(dx+iw*z.x/100,dy+ih*z.y/100,iw*z.w/200,ih*z.h/200,0,0,Math.PI*2);ctx.fill();ctx.stroke();});
      ctx.fillStyle=colors.muted;ctx.font='bold 14px system-ui';ctx.fillText('ZONES SÉLECTIONNÉES',P+475,y+110);
      ctx.fillStyle=colors.ink;ctx.font='17px system-ui';
      zones.forEach((z,i)=>ctx.fillText(z.name+' · '+z.view,P+475,y+147+i*35));
    }
    if(block.type==='timeline'){
      let rowY=y+91;
      block.items.forEach(item=>{
        rounded(P+27,rowY-20,34,31,8,'#f8e9ed');ctx.fillStyle=colors.burgundy;ctx.font='bold 15px system-ui';ctx.fillText(String(item.number).padStart(2,'0'),P+33,rowY+1);
        ctx.fillStyle=colors.ink;ctx.font='17px system-ui';item.lines.forEach((line,i)=>ctx.fillText(line,P+77,rowY+i*27));
        rowY+=Math.max(38,item.lines.length*27+11)
      })
    }
    if(block.type==='scan'){
      const e=block.exam,atlas=atlases[e.modality],sw=atlas.naturalWidth/3,sh=atlas.naturalHeight/3,col=e.cell%3,row=Math.floor(e.cell/3);
      ctx.fillStyle=colors.ink;ctx.font='bold 21px system-ui';ctx.fillText(e.region,P+28,y+98);
      rounded(P+28,y+116,366,366,10,'#07111d');
      ctx.drawImage(atlas,col*sw,row*sh,sw,sh,P+35,y+123,352,352);
      ctx.fillStyle=colors.muted;ctx.font='14px system-ui';ctx.fillText('ILLUSTRATION FICTIVE',P+427,y+153);
      if(e.finding){ctx.fillStyle=colors.navy2;ctx.font='bold 14px system-ui';ctx.fillText('CONSTAT SÉLECTIONNÉ',P+427,y+203);ctx.fillStyle=colors.ink;ctx.font='17px system-ui';textLines(e.finding,350).forEach((line,i)=>ctx.fillText(line,P+427,y+235+i*27))}
    }
    y+=block.height+18
  });
  ctx.fillStyle=colors.muted;ctx.font='13px system-ui';ctx.fillText('EMS LOS SANTOS  ·  DOCUMENT FICTIF',P,H-37);
  ctx.fillStyle=colors.burgundy;ctx.fillRect(W-P-68,H-43,68,3);
  try{const a=document.createElement('a');a.download='dossier-traumatologique.png';a.href=canvas.toDataURL('image/png');a.click()}
  catch{alert('Le PNG ne peut pas être créé dans ce navigateur.')}
}
$('export').onclick=exportPremiumPNG;
