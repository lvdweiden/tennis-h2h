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
