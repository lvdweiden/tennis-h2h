import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jbmzupbvpoyifdyrgvvb.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ngjCzqZnAK3e3b0qf_NqOg_U2QQxJFA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function fetchProfiles() {
  const { data } = await supabase.from('tennis_player_profiles').select('*')
  return data || []
}

export async function upsertProfile(profile: Record<string, unknown>) {
  return supabase.from('tennis_player_profiles').upsert(profile, { onConflict: 'player_id' })
}

export async function fetchPoules(): Promise<Array<{id: number, name: string, created_at?: string, player_ids: number[]}>> {
  const [{ data: poules }, { data: members }] = await Promise.all([
    supabase.from('tennis_poules').select('*').order('created_at'),
    supabase.from('tennis_poule_members').select('poule_id, player_id')
  ])
  return (poules || []).map((p: {id: number, name: string, created_at?: string}) => ({
    id: p.id,
    name: p.name,
    created_at: p.created_at,
    player_ids: (members || [])
      .filter((m: {poule_id: number, player_id: number}) => m.poule_id === p.id)
      .map((m: {poule_id: number, player_id: number}) => m.player_id)
  }))
}

export async function addPouleMember(poule_id: number, player_id: number) {
  return supabase.from('tennis_poule_members').insert({ poule_id, player_id })
}

export async function removePouleMember(poule_id: number, player_id: number) {
  return supabase.from('tennis_poule_members').delete().eq('poule_id', poule_id).eq('player_id', player_id)
}

export async function createPoule(name: string) {
  return supabase.from('tennis_poules').insert({ name }).select().single()
}

export async function deletePoule(id: number) {
  return supabase.from('tennis_poules').delete().eq('id', id)
}
