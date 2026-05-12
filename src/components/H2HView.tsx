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
  const [selectedP1Partner, setSelectedP1Partner] = useState<number | null>(null)
  const [selectedP2, setSelectedP2] = useState<number | null>(null)
  const [selectedP2Partner, setSelectedP2Partner] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)

  const relevantMatches = matches.filter(m => {
    if (!selectedP1 || !selectedP2 || selectedP1 === selectedP2) return false
    if (m.match_type === 'doubles') {
      const team1 = [m.player1_id, m.team1_player2_id]
      const team2 = [m.player2_id, m.team2_player2_id]
      const p1inTeam1 = team1.includes(selectedP1)
      const p1inTeam2 = team2.includes(selectedP1)
      const p2inTeam1 = team1.includes(selectedP2)
      const p2inTeam2 = team2.includes(selectedP2)
      const oppositeTeams = (p1inTeam1 && p2inTeam2) || (p1inTeam2 && p2inTeam1)
      if (!oppositeTeams) return false
      // Als partners gekozen zijn: check exact team
      if (selectedP1Partner) {
        const p1PartnerInTeam1 = team1.includes(selectedP1Partner)
        const p1PartnerInTeam2 = team2.includes(selectedP1Partner)
        if (p1inTeam1 && !p1PartnerInTeam1) return false
        if (p1inTeam2 && !p1PartnerInTeam2) return false
      }
      if (selectedP2Partner) {
        const p2PartnerInTeam1 = team1.includes(selectedP2Partner)
        const p2PartnerInTeam2 = team2.includes(selectedP2Partner)
        if (p2inTeam1 && !p2PartnerInTeam1) return false
        if (p2inTeam2 && !p2PartnerInTeam2) return false
      }
      return true
    } else {
      // Als er een partner geselecteerd is maar wedstrijd is enkel → niet tonen
      if (selectedP1Partner || selectedP2Partner) return false
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

  // Speler statistieken over ALLE wedstrijden (niet alleen H2H)
  function getPlayerStats(playerId: number) {
    function didWin(m: Match) {
      const inTeam1 = m.player1_id === playerId || m.team1_player2_id === playerId
      const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
      return inTeam1 ? winnerTeam === 'team1' : winnerTeam === 'team2'
    }
    const all = matches.filter(m => {
      if (m.match_type === 'doubles') return [m.player1_id, m.team1_player2_id, m.player2_id, m.team2_player2_id].includes(playerId)
      return m.player1_id === playerId || m.player2_id === playerId
    })
    const singles = all.filter(m => m.match_type === 'singles')
    const doubles = all.filter(m => m.match_type === 'doubles')
    const sorted = [...all].sort((a, b) => b.date.localeCompare(a.date))
    const last5 = sorted.slice(0, 5).map(m => didWin(m))
    return {
      total: all.length,
      totalW: all.filter(m => didWin(m)).length,
      singlesW: singles.filter(m => didWin(m)).length,
      singlesTotal: singles.length,
      doublesW: doubles.filter(m => didWin(m)).length,
      doublesTotal: doubles.length,
      last5,
    }
  }
  const [showPlayerStats, setShowPlayerStats] = useState<boolean>(false)

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
            <div className="space-y-2">
              <div>
                <label className="label"><span className="label-text font-semibold">Speler 1</span></label>
                <select className="select select-bordered w-full" value={selectedP1 || ''} onChange={e => { setSelectedP1(e.target.value ? parseInt(e.target.value) : null); setSelectedP1Partner(null) }}>
                  <option value="">Kies speler...</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {selectedP1 && (
                <div>
                  <label className="label"><span className="label-text text-xs text-gray-400">+ Partner (optioneel)</span></label>
                  <select className="select select-bordered select-sm w-full" value={selectedP1Partner || ''} onChange={e => setSelectedP1Partner(e.target.value ? parseInt(e.target.value) : null)}>
                    <option value="">Geen partner</option>
                    {players.filter(p => p.id !== selectedP1 && p.id !== selectedP2 && p.id !== selectedP2Partner).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <label className="label"><span className="label-text font-semibold">Speler 2</span></label>
                <select className="select select-bordered w-full" value={selectedP2 || ''} onChange={e => { setSelectedP2(e.target.value ? parseInt(e.target.value) : null); setSelectedP2Partner(null) }}>
                  <option value="">Kies speler...</option>
                  {players.filter(p => p.id !== selectedP1).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {selectedP2 && (
                <div>
                  <label className="label"><span className="label-text text-xs text-gray-400">+ Partner (optioneel)</span></label>
                  <select className="select select-bordered select-sm w-full" value={selectedP2Partner || ''} onChange={e => setSelectedP2Partner(e.target.value ? parseInt(e.target.value) : null)}>
                    <option value="">Geen partner</option>
                    {players.filter(p => p.id !== selectedP2 && p.id !== selectedP1 && p.id !== selectedP1Partner).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
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
                  <button
                    onClick={() => setShowPlayerStats(v => !v)}
                    className="text-lg font-semibold mt-1 underline decoration-dotted underline-offset-2 cursor-pointer hover:opacity-80 bg-transparent border-none text-white"
                  >
                    {p1?.name}{selectedP1Partner && <span className="text-sm opacity-80"> & {players.find(p => p.id === selectedP1Partner)?.name}</span>}
                  </button>
                  <div className="text-xs opacity-70 mt-2">🎯 Sets: {p1Sets}</div>
                  <div className="text-xs opacity-70">🎾 Games: {p1Games}</div>
                </div>
                <div className="text-center px-4">
                  <div className="text-2xl font-bold opacity-60">VS</div>
                  <div className="text-xs opacity-50 mt-1">{filteredMatches.length} wedstrijden</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-4xl font-black">{p2wins}</div>
                  <button
                    onClick={() => setShowPlayerStats(v => !v)}
                    className="text-lg font-semibold mt-1 underline decoration-dotted underline-offset-2 cursor-pointer hover:opacity-80 bg-transparent border-none text-white"
                  >
                    {p2?.name}{selectedP2Partner && <span className="text-sm opacity-80"> & {players.find(p => p.id === selectedP2Partner)?.name}</span>}
                  </button>
                  <div className="text-xs opacity-70 mt-2">🎯 Sets: {p2Sets}</div>
                  <div className="text-xs opacity-70">🎾 Games: {p2Games}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Speler statistieken paneel — beide spelers naast elkaar */}
          {showPlayerStats && selectedP1 && selectedP2 && (() => {
            const s1 = getPlayerStats(selectedP1)
            const s2 = getPlayerStats(selectedP2)
            const rows = [
              {
                label: 'TOTAAL W-V',
                v1: <>{s1.totalW}-{s1.total - s1.totalW} <span className="text-gray-400 text-xs">({s1.total})</span></>,
                v2: <>{s2.totalW}-{s2.total - s2.totalW} <span className="text-gray-400 text-xs">({s2.total})</span></>,
              },
              {
                label: 'ENKEL W-V',
                v1: <>{s1.singlesW}-{s1.singlesTotal - s1.singlesW} <span className="text-gray-400 text-xs">({s1.singlesTotal})</span></>,
                v2: <>{s2.singlesW}-{s2.singlesTotal - s2.singlesW} <span className="text-gray-400 text-xs">({s2.singlesTotal})</span></>,
              },
              {
                label: 'DUBBEL W-V',
                v1: <>{s1.doublesW}-{s1.doublesTotal - s1.doublesW} <span className="text-gray-400 text-xs">({s1.doublesTotal})</span></>,
                v2: <>{s2.doublesW}-{s2.doublesTotal - s2.doublesW} <span className="text-gray-400 text-xs">({s2.doublesTotal})</span></>,
              },
              {
                label: 'VORM',
                v1: (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {s1.last5.map((w, i) => (
                      <span key={i} className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white font-bold ${w ? 'bg-green-500' : 'bg-red-400'}`} style={{fontSize:'10px'}}>{w ? 'W' : 'V'}</span>
                    ))}
                  </div>
                ),
                v2: (
                  <div className="flex flex-wrap gap-1 justify-start">
                    {s2.last5.map((w, i) => (
                      <span key={i} className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white font-bold ${w ? 'bg-green-500' : 'bg-red-400'}`} style={{fontSize:'10px'}}>{w ? 'W' : 'V'}</span>
                    ))}
                  </div>
                ),
              },
            ]
            return (
              <div className="rounded-xl shadow-md mb-4 overflow-hidden border border-gray-200" style={{background:'#fff'}}>
                <div className="py-2 px-4 flex items-center justify-between" style={{background:'#1e3a5f'}}>
                  <span className="font-bold text-sm text-blue-300">{p1?.name}</span>
                  <span className="text-xs text-gray-300 tracking-widest">STATISTIEKEN</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-blue-300">{p2?.name}</span>
                    <button onClick={() => setShowPlayerStats(false)} className="text-gray-300 hover:text-white ml-2 text-lg leading-none">✕</button>
                  </div>
                </div>
                <table className="w-full text-sm" style={{background:'#fff'}}>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 px-4 font-bold text-right w-[38%]" style={{color:'#111'}}>{row.v1}</td>
                        <td className="py-3 px-2 text-center text-xs tracking-wide font-medium w-[24%]" style={{color:'#666', background:'#f5f5f5'}}>{row.label}</td>
                        <td className="py-3 px-4 font-bold text-left w-[38%]" style={{color:'#111'}}>{row.v2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs py-2 text-center" style={{color:'#888', background:'#f5f5f5'}}>Statistieken over alle wedstrijden in de app</p>
              </div>
            )
          })()}

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
