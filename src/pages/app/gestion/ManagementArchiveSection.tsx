import { useState } from 'react'
import { ArchiveSection as PayoutArchiveSection } from './ArchiveSection'
import { RecruitmentArchiveSection } from './RecruitmentArchiveSection'
import { PatientArchiveSection } from './PatientArchiveSection'
import { Button } from '@/components/ui/Button'
type Tab='candidatures'|'patients'|'payes'
export function ManagementArchiveSection(){
 const [tab,setTab]=useState<Tab>('candidatures')
 return <div className="flex flex-col gap-4"><div className="flex flex-wrap gap-2"><Button size="sm" variant={tab==='candidatures'?'red':'ghost'} onClick={()=>setTab('candidatures')}>Candidatures</Button><Button size="sm" variant={tab==='patients'?'red':'ghost'} onClick={()=>setTab('patients')}>Messages patients</Button><Button size="sm" variant={tab==='payes'?'red':'ghost'} onClick={()=>setTab('payes')}>Payes</Button></div>{tab==='candidatures'?<RecruitmentArchiveSection/>:tab==='patients'?<PatientArchiveSection/>:<PayoutArchiveSection/>}</div>
}
