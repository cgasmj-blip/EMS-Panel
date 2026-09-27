import { useEffect, useState } from 'react'
import { supabase, type Staff } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { HistoriqueTab } from '../HistoriqueTab'

export function HistoriqueSection() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [searchStaffId, setSearchStaffId] = useState('')

  useEffect(() => {
    supabase
      .from('staff')
      .select('*')
      .order('full_name')
      .then(({ data }) => {
        if (data) setStaffList(data)
      })
  }, [])

  return (
    <Card className="p-5">
      <h2 className="text-[var(--ink)] font-bold text-sm mb-4">Historique par utilisateur</h2>
      <Select className="mb-4" value={searchStaffId} onChange={(e) => setSearchStaffId(e.target.value)}>
        <option value="">Choisir un agent...</option>
        {staffList.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name}
          </option>
        ))}
      </Select>
      {searchStaffId && <HistoriqueTab staffId={searchStaffId} />}
    </Card>
  )
}
