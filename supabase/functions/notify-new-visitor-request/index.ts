import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

async function rest(path:string) {
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`}});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sendDm(discordId:string, content:string) {
  if(!DISCORD_BOT_TOKEN || !discordId) return false;
  const channelRes=await fetch("https://discord.com/api/v10/users/@me/channels",{method:"POST",headers:{Authorization:`Bot ${DISCORD_BOT_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({recipient_id:discordId})});
  if(!channelRes.ok) return false;
  const channel=await channelRes.json();
  const dm=await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`,{method:"POST",headers:{Authorization:`Bot ${DISCORD_BOT_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({content,allowed_mentions:{parse:[]}})});
  return dm.ok;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try {
    const auth=req.headers.get("Authorization");
    if(!auth) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:cors});
    const userRes=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:auth}});
    if(!userRes.ok) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:cors});
    const user=await userRes.json();
    const { public_id }=await req.json();
    if(!public_id) return new Response(JSON.stringify({error:"Missing public_id"}),{status:400,headers:cors});

    const requests=await rest(`visitor_requests?public_id=eq.${encodeURIComponent(public_id)}&select=id,public_id,request_type,subject_id,subject,full_name,discord_id,discord_username,created_at`);
    const vr=requests?.[0];
    if(!vr) return new Response(JSON.stringify({error:"Request not found"}),{status:404,headers:cors});
    const callerDiscord=String(user?.user_metadata?.provider_id ?? user?.user_metadata?.sub ?? "");
    if(!callerDiscord || callerDiscord!==String(vr.discord_id||"")) return new Response(JSON.stringify({error:"Forbidden"}),{status:403,headers:cors});

    const subjects=await rest(`visitor_request_subjects?id=eq.${vr.subject_id}&select=id,label,grade,sous_grade_id,affiliation_id`);
    const subject=subjects?.[0];
    if(!subject) throw new Error("Subject not found");

    const staff=await rest("staff?active=eq.true&role=neq.membre&discord_id=not.is.null&select=id,discord_id,role");
    const sous=subject.sous_grade_id ? await rest(`staff_sous_grades?sous_grade_id=eq.${encodeURIComponent(subject.sous_grade_id)}&select=staff_id`) : [];
    const aff=subject.affiliation_id ? await rest(`staff_affiliations?affiliation_id=eq.${encodeURIComponent(subject.affiliation_id)}&select=staff_id`) : [];
    const sousIds=new Set(sous.map((x:any)=>x.staff_id));
    const affIds=new Set(aff.map((x:any)=>x.staff_id));
    const grades=Array.isArray(subject.grade)?subject.grade:[];
    const recipients=staff.filter((s:any)=>
      (!grades.length || grades.includes(s.role)) &&
      (!subject.sous_grade_id || sousIds.has(s.id)) &&
      (!subject.affiliation_id || affIds.has(s.id))
    );

    const ref=String(vr.public_id).slice(0,8).toUpperCase();
    const type=vr.request_type==="recrutement"?"candidature":vr.request_type==="rendez_vous"?"demande de rendez-vous":"demande visiteur";
    const staffText=`**EMS Los Santos — Nouvelle demande visiteur**\n\nUne nouvelle ${type} correspondant à vos habilitations est disponible.\n\n**Demandeur :** ${vr.full_name}\n**Objet :** ${vr.subject}\n**Référence :** ${ref}\n\nConsultez le panel EMS pour prendre connaissance de la demande et la traiter.`;
    let staffSent=0;
    for(const s of recipients) if(await sendDm(String(s.discord_id),staffText)) staffSent++;

    const visitorText=`**EMS Los Santos — Demande reçue**\n\nBonjour ${vr.discord_username || vr.full_name},\n\nVotre demande **« ${vr.subject} »** a bien été transmise au service concerné.\n\nRéférence : ${ref}\n\nVous serez informé lorsque votre demande évoluera. Vous pouvez également suivre son historique depuis votre espace visiteur.`;
    const visitorSent=await sendDm(String(vr.discord_id),visitorText);

    return new Response(JSON.stringify({ok:true,staff_recipients:recipients.length,staff_dm_sent:staffSent,visitor_dm_sent:visitorSent}),{headers:cors});
  } catch(error) {
    return new Response(JSON.stringify({error:error instanceof Error?error.message:String(error)}),{status:500,headers:cors});
  }
});