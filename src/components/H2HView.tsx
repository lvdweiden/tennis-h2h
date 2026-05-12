import { useState } from 'react'
import type { Match, Player } from '../types'
import { SURFACES, SURFACE_COLORS } from '../types'
import EditMatchModal from './EditMatchModal'

interface Props {
  players: Player[]
  matches: Match[]
  onEditMatch: (id: number, updates: Partial<Match>) => void
  onDeleteMatch: (id: number) => void
  isUnlocked: boolean
}

type FilterType = 'all' | 'singles' | 'doubles'

function getPlayerName(players: Player[], id: number | null) {
  if (!id) return '?'
  return players.find(p => p.id === id)?.name || '?'
}

function parseSets(sets: string): number[][] {
  try { return JSON.parse(sets) } catch { return [] }
}


export default function H2HView({ players, matches, onEditMatch, onDeleteMatch, isUnlocked }: Props) {
  const [selectedP1, setSelectedP1] = useState<number | null>(null)
  const [selectedP2, setSelectedP2] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)

  const relevantMatches = matches.filter(m => {
    if (!selectedP1 || !selectedP2 || selectedP1 === selectedP2) return false
    if (m.match_type === 'doubles') {
      // Alleen tellen als ze op VERSCHILLENDE teams staan
      const p1inTeam1 = m.player1_id === selectedP1 || m.team1_player2_id === selectedP1
      const p1inTeam2 = m.player2_id === selectedP1 || m.team2_player2_id === selectedP1
      const p2inTeam1 = m.player1_id === selectedP2 || m.team1_player2_id === selectedP2
      const p2inTeam2 = m.player2_id === selectedP2 || m.team2_player2_id === selectedP2
      return (p1inTeam1 && p2inTeam2) || (p1inTeam2 && p2inTeam1)
    } else {
      const ids = [m.player1_id, m.player2_id]
      return ids.includes(selectedP1) && ids.includes(selectedP2)
    }
  })

  const filteredMatches = relevantMatches.filter(m => {
    if (filter === 'singles') return m.match_type === 'singles'
    if (filter === 'doubles') return m.match_type === 'doubles'
    return true
  })

  const p1wins = filteredMatches.filter(m => {
    const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
    const p1inTeam1 = m.player1_id === selectedP1 || m.team1_player2_id === selectedP1
    return p1inTeam1 ? winnerTeam === 'team1' : winnerTeam === 'team2'
  }).length
  const p2wins = filteredMatches.length - p1wins

  // Sets & games berekening
  let p1Sets = 0, p2Sets = 0, p1Games = 0, p2Games = 0
  filteredMatches.forEach(m => {
    const p1inTeam1 = m.player1_id === selectedP1 || m.team1_player2_id === selectedP1
    const parsed = parseSets(m.sets)
    parsed.forEach(([t1, t2]) => {
      const myGames = p1inTeam1 ? t1 : t2
      const oppGames = p1inTeam1 ? t2 : t1
      p1Games += myGames
      p2Games += oppGames
      if (myGames > oppGames) p1Sets++
      else if (oppGames > myGames) p2Sets++
    })
  })

  const singlesCount = relevantMatches.filter(m => m.match_type === 'singles').length
  const doublesCount = relevantMatches.filter(m => m.match_type === 'doubles').length

  const surfaceStats = SURFACES.map(s => {
    const sm = filteredMatches.filter(m => m.surface === s)
    const sw = sm.filter(m => {
      const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
      const p1inTeam1 = m.player1_id === selectedP1 || m.team1_player2_id === selectedP1
      return p1inTeam1 ? winnerTeam === 'team1' : winnerTeam === 'team2'
    }).length
    return { surface: s, total: sm.length, p1wins: sw, p2wins: sm.length - sw }
  }).filter(s => s.total > 0)

  const p1 = players.find(p => p.id === selectedP1)
  const p2 = players.find(p => p.id === selectedP2)

  return (
    <div>
      {editingMatch && (
        <EditMatchModal
          match={editingMatch}
          players={players}
          onSave={(id, updates) => { onEditMatch(id, updates); setEditingMatch(null) }}
          onDelete={(id) => { onDeleteMatch(id); setEditingMatch(null) }}
          onClose={() => setEditingMatch(null)}
        />
      )}

      <div className="card bg-base-100 shadow-md mb-6">
        <div className="card-body">
          <h2 className="card-title text-xl mb-4">🎾 Head to Head</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label"><span className="label-text font-semibold">Speler 1</span></label>
              <select className="select select-bordered w-full" value={selectedP1 || ''} onChange={e => setSelectedP1(e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">Kies speler...</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text font-semibold">Speler 2</span></label>
              <select className="select select-bordered w-full" value={selectedP2 || ''} onChange={e => setSelectedP2(e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">Kies speler...</option>
                {players.filter(p => p.id !== selectedP1).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {selectedP1 && selectedP2 && (
        <>
          {/* Score Header */}
          <div className="card bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl mb-4">
            <div className="card-body py-6">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="text-4xl font-black">{p1wins}</div>
                  <div className="text-lg font-semibold mt-1">{p1?.name}</div>
                  <div className="text-xs opacity-70 mt-2">🎯 Sets: {p1Sets}</div>
                  <div className="text-xs opacity-70">🎾 Games: {p1Games}</div>
                </div>
                <div className="text-center px-4">
                  <div className="text-2xl font-bold opacity-60">VS</div>
                  <div className="text-xs opacity-50 mt-1">{filteredMatches.length} wedstrijden</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-4xl font-black">{p2wins}</div>
                  <div className="text-lg font-semibold mt-1">{p2?.name}</div>
                  <div className="text-xs opacity-70 mt-2">🎯 Sets: {p2Sets}</div>
                  <div className="text-xs opacity-70">🎾 Games: {p2Games}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'all', label: `Alles (${relevantMatches.length})` },
              { key: 'singles', label: `Enkel (${singlesCount})` },
              { key: 'doubles', label: `Dubbel (${doublesCount})` },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key as FilterType)}
                className={`btn btn-sm flex-1 ${filter === f.key ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Surface breakdown */}
          {surfaceStats.length > 0 && (
            <div className="card bg-base-100 shadow-md mb-4">
              <div className="card-body py-4">
                <h3 className="font-semibold text-sm text-gray-500 mb-3">PER ONDERGROND</h3>
                <div className="space-y-2">
                  {surfaceStats.map(s => (
                    <div key={s.surface} className="flex items-center gap-3">
                      <span className={`badge badge-sm ${SURFACE_COLORS[s.surface]}`}>{s.surface}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-sm font-bold w-4 text-right">{s.p1wins}</span>
                        <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-gray-100">
                          <div className="bg-blue-500" style={{ width: `${s.total ? (s.p1wins / s.total) * 100 : 50}%` }}></div>
                          <div className="bg-red-400" style={{ width: `${s.total ? (s.p2wins / s.total) * 100 : 50}%` }}></div>
                        </div>
                        <span className="text-sm font-bold w-4">{s.p2wins}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Match history */}
          <div className="space-y-2">
            {filteredMatches.length === 0 && (
              <div className="text-center text-gray-400 py-8">Geen wedstrijden gevonden</div>
            )}
            {filteredMatches.sort((a, b) => b.date.localeCompare(a.date)).map(m => {
              const p1inTeam1 = m.player1_id === selectedP1 || m.team1_player2_id === selectedP1
              const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
              const p1won = p1inTeam1 ? winnerTeam === 'team1' : winnerTeam === 'team2'

              const team1 = m.match_type === 'doubles'
                ? `${getPlayerName(players, m.player1_id)} & ${getPlayerName(players, m.team1_player2_id)}`
                : getPlayerName(players, m.player1_id)
              const team2 = m.match_type === 'doubles'
                ? `${getPlayerName(players, m.player2_id)} & ${getPlayerName(players, m.team2_player2_id)}`
                : getPlayerName(players, m.player2_id)

              const parsedSets = parseSets(m.sets)

              return (
                <div key={m.id} className={`card shadow-sm border-l-4 ${p1won ? 'border-l-blue-500' : 'border-l-red-400'}`}>
                  <div className="card-body py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {m.match_type === 'doubles' && <span className="badge badge-xs badge-secondary">Dubbel</span>}
                          {m.surface && <span className={`badge badge-xs ${SURFACE_COLORS[m.surface] || 'badge-neutral'}`}>{m.surface}</span>}
                          <span className="text-xs text-gray-400">{m.date}</span>
                          {m.location && <span className="text-xs text-gray-400">📍 {m.location}</span>}
                        </div>
                        <div className="mt-1">
                          <span className={`font-semibold text-sm ${winnerTeam === 'team1' ? 'text-green-600' : 'text-gray-500'}`}>{team1}</span>
                          <span className="text-gray-400 mx-2 text-xs">vs</span>
                          <span className={`font-semibold text-sm ${winnerTeam === 'team2' ? 'text-green-600' : 'text-gray-500'}`}>{team2}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {parsedSets.map((s, i) => <span key={i} className="mr-2">{s[0]}-{s[1]}</span>)}
                        </div>
                      </div>
                      {isUnlocked && <button onClick={() => setEditingMatch(m)} className="btn btn-ghost btn-xs ml-2">✏️</button>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!selectedP1 || !selectedP2 ? (
        <div className="text-center text-gray-400 py-12">
          <div className="text-5xl mb-3">🎾</div>
          <p>Kies twee spelers om hun H2H te bekijken</p>
        </div>
      ) : null}
    </div>
  )
}
