export interface Player {
  id: number
  name: string
}

export interface Match {
  id: number
  date: string
  player1_id: number
  player2_id: number
  winner_id: number
  sets: string
  surface: string
  location: string
  match_type: 'singles' | 'doubles'
  team1_player2_id: number | null
  team2_player2_id: number | null
}

export type Surface = 'Kunstgras' | 'Gravel' | 'Smashcourt' | 'Hardcourt binnen' | 'Hardcourt buiten'

export const SURFACES: Surface[] = ['Kunstgras', 'Gravel', 'Smashcourt', 'Hardcourt binnen', 'Hardcourt buiten']

export interface PlayerProfile {
  id?: number
  player_id: number
  photo_url?: string | null
  height?: number | null
  preferred_hand?: string | null
  birthdate?: string | null
  club?: string | null
  bio?: string | null
  pincode?: string | null
}

export const SURFACE_COLORS: Record<string, string> = {
  Kunstgras: 'bg-green-500 text-white',
  Gravel: 'bg-orange-500 text-white',
  Smashcourt: 'bg-red-500 text-white',
  'Hardcourt binnen': 'bg-sky-400 text-white',
  'Hardcourt buiten': 'bg-blue-900 text-white',
}
