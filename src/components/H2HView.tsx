import { useState, useEffect, useRef } from 'react'
import type { Match, Player, Poule } from '../types'
import { SURFACES, SURFACE_COLORS } from '../types'
import EditMatchModal from './EditMatchModal'

interface Props {
  players: Player[]
  matches: Match[]
  poules: Poule[]
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


export default function H2HView({ players, matches, poules, onEditMatch, onDeleteMatch, isUnlocked }: Props) {
  const [selectedP1, setSelectedP1] = useState<number | null>(null)
  const [selectedP1Partner, setSelectedP1Partner] = useState<number | null>(null)
  const [selectedP2, setSelectedP2] = useState<number | null>(null)
  const [selectedP2Partner, setSelectedP2Partner] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [detailMatch, setDetailMatch] = useState<Match | null>(null)

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
    parsed.forEach((set) => {
      const [t1, t2, isStb] = set
      const myGames = p1inTeam1 ? t1 : t2
      const oppGames = p1inTeam1 ? t2 : t1
      if (!isStb) { p1Games += myGames; p2Games += oppGames }
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

  // Duo record: record van twee spelers als team samen in alle dubbels
  function getPairRecord(id1: number, id2: number) {
    const pairMatches = matches.filter(m => {
      if (m.match_type !== 'doubles') return false
      const team1 = [m.player1_id, m.team1_player2_id]
      const team2 = [m.player2_id, m.team2_player2_id]
      return (team1.includes(id1) && team1.includes(id2)) || (team2.includes(id1) && team2.includes(id2))
    })
    const wins = pairMatches.filter(m => {
      const inTeam1 = [m.player1_id, m.team1_player2_id].includes(id1)
      const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
      return inTeam1 ? winnerTeam === 'team1' : winnerTeam === 'team2'
    }).length
    return { total: pairMatches.length, wins, losses: pairMatches.length - wins }
  }

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

  // Animatie: tel getallen op van 0 naar doel
  const [animP1Wins, setAnimP1Wins] = useState(0)
  const [animP2Wins, setAnimP2Wins] = useState(0)
  const [animP1Sets, setAnimP1Sets] = useState(0)
  const [animP2Sets, setAnimP2Sets] = useState(0)
  const [animP1Games, setAnimP1Games] = useState(0)
  const [animP2Games, setAnimP2Games] = useState(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start animatie wanneer scores veranderen
  useEffect(() => {
    if (animRef.current) clearInterval(animRef.current)
    setAnimP1Wins(0)
    setAnimP2Wins(0)
    setAnimP1Sets(0)
    setAnimP2Sets(0)
    setAnimP1Games(0)
    setAnimP2Games(0)

    const targets = [p1wins, p2wins, p1Sets, p2Sets, p1Games, p2Games]
    const max = Math.max(...targets, 1)
    const steps = Math.min(max, 20)
    let step = 0

    animRef.current = setInterval(() => {
      step++
      const progress = step / steps
      setAnimP1Wins(Math.round(p1wins * progress))
      setAnimP2Wins(Math.round(p2wins * progress))
      setAnimP1Sets(Math.round(p1Sets * progress))
      setAnimP2Sets(Math.round(p2Sets * progress))
      setAnimP1Games(Math.round(p1Games * progress))
      setAnimP2Games(Math.round(p2Games * progress))
      if (step >= steps) {
        clearInterval(animRef.current!)
        setAnimP1Wins(p1wins)
        setAnimP2Wins(p2wins)
        setAnimP1Sets(p1Sets)
        setAnimP2Sets(p2Sets)
        setAnimP1Games(p1Games)
        setAnimP2Games(p2Games)
      }
    }, 40)

    return () => { if (animRef.current) clearInterval(animRef.current) }
  }, [p1wins, p2wins, p1Sets, p2Sets, p1Games, p2Games])

  return (
    <div>
      {editingMatch && (
        <EditMatchModal
          match={editingMatch}
          players={players}
          poules={poules}
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
                  {selectedP1Partner && (() => {
                    const rec = getPairRecord(selectedP1, selectedP1Partner)
                    const n1 = players.find(p => p.id === selectedP1)?.name?.split(' ')[0]
                    const n2 = players.find(p => p.id === selectedP1Partner)?.name?.split(' ')[0]
                    return (
                      <div className="mt-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center gap-1 flex-wrap text-xs">
                        <span className="text-gray-500 dark:text-gray-400">🤝 {n1} &amp; {n2}:</span>
                        {rec.total === 0
                          ? <span className="text-gray-400">Nog geen dubbels samen</span>
                          : <><span className="font-bold text-green-600">{rec.wins}W</span><span className="text-gray-400 mx-0.5">–</span><span className="font-bold text-red-500">{rec.losses}V</span><span className="text-gray-400 ml-1">({rec.total} dubbels)</span></>
                        }
                      </div>
                    )
                  })()}
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
                  {selectedP2Partner && (() => {
                    const rec = getPairRecord(selectedP2, selectedP2Partner)
                    const n1 = players.find(p => p.id === selectedP2)?.name?.split(' ')[0]
                    const n2 = players.find(p => p.id === selectedP2Partner)?.name?.split(' ')[0]
                    return (
                      <div className="mt-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center gap-1 flex-wrap text-xs">
                        <span className="text-gray-500 dark:text-gray-400">🤝 {n1} &amp; {n2}:</span>
                        {rec.total === 0
                          ? <span className="text-gray-400">Nog geen dubbels samen</span>
                          : <><span className="font-bold text-green-600">{rec.wins}W</span><span className="text-gray-400 mx-0.5">–</span><span className="font-bold text-red-500">{rec.losses}V</span><span className="text-gray-400 ml-1">({rec.total} dubbels)</span></>
                        }
                      </div>
                    )
                  })()}
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
                  <div className="text-4xl font-black transition-all duration-100">{animP1Wins}</div>
                  <button
                    onClick={() => setShowPlayerStats(v => !v)}
                    className="text-lg font-semibold mt-1 underline decoration-dotted underline-offset-2 cursor-pointer hover:opacity-80 bg-transparent border-none text-white"
                  >
                    {p1?.name}{selectedP1Partner && <span className="text-sm opacity-80"> & {players.find(p => p.id === selectedP1Partner)?.name}</span>}
                  </button>
                  <div className="text-xs opacity-70 mt-2">🎯 Sets: {animP1Sets}</div>
                  <div className="text-xs opacity-70">🎾 Games: {animP1Games}</div>
                </div>
                <div className="text-center px-4">
                  <div className="text-2xl font-bold opacity-60">VS</div>
                  <div className="text-xs opacity-50 mt-1">{filteredMatches.length} wedstrijden</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-4xl font-black transition-all duration-100">{animP2Wins}</div>
                  <button
                    onClick={() => setShowPlayerStats(v => !v)}
                    className="text-lg font-semibold mt-1 underline decoration-dotted underline-offset-2 cursor-pointer hover:opacity-80 bg-transparent border-none text-white"
                  >
                    {p2?.name}{selectedP2Partner && <span className="text-sm opacity-80"> & {players.find(p => p.id === selectedP2Partner)?.name}</span>}
                  </button>
                  <div className="text-xs opacity-70 mt-2">🎯 Sets: {animP2Sets}</div>
                  <div className="text-xs opacity-70">🎾 Games: {animP2Games}</div>
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
                <div key={m.id} className={`card shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow ${p1won ? 'border-l-blue-500' : 'border-l-red-400'}`} onClick={() => setDetailMatch(m)}>
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
                          {parsedSets.map((s, i) => <span key={i} className="mr-2">{s[0]}-{s[1]}{s[2] === 1 ? <span className="text-xs text-orange-500 ml-0.5">Supertiebreak</span> : null}</span>)}
                        </div>
                      </div>

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

      {/* Match Detail Modal */}
      {detailMatch && (() => {
        const dm = detailMatch
        const ps = parseSets(dm.sets)
        const p1n = getPlayerName(players, dm.player1_id)
        const p2n = getPlayerName(players, dm.player2_id)
        const t1p2n = dm.team1_player2_id ? getPlayerName(players, dm.team1_player2_id) : null
        const t2p2n = dm.team2_player2_id ? getPlayerName(players, dm.team2_player2_id) : null
        const dTeam1 = dm.match_type === 'doubles' && t1p2n ? `${p1n} & ${t1p2n}` : p1n
        const dTeam2 = dm.match_type === 'doubles' && t2p2n ? `${p2n} & ${t2p2n}` : p2n
        const winnerTeam = dm.winner_id === dm.player1_id ? 'team1' : 'team2'
        const poule = poules.find(p => p.id === dm.poule_id)
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailMatch(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">🎾 Wedstrijd details</h3>
                <button onClick={() => setDetailMatch(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {dm.match_type === 'doubles' && <span className="badge badge-secondary badge-sm">Dubbel</span>}
                  {dm.surface && <span className={`badge badge-sm ${SURFACE_COLORS[dm.surface] || 'badge-neutral'}`}>{dm.surface}</span>}
                  {poule && <span className="badge badge-sm badge-outline">{poule.name}</span>}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex gap-4 flex-wrap">
                  <span>📅 {dm.date}</span>
                  {dm.location && <span>📍 {dm.location}</span>}
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold text-base ${winnerTeam === 'team1' ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
                      {winnerTeam === 'team1' ? '🏆 ' : ''}{dTeam1}
                    </span>
                    <span className="text-xs text-gray-400">{winnerTeam === 'team1' ? 'gewonnen' : ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-base ${winnerTeam === 'team2' ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
                      {winnerTeam === 'team2' ? '🏆 ' : ''}{dTeam2}
                    </span>
                    <span className="text-xs text-gray-400">{winnerTeam === 'team2' ? 'gewonnen' : ''}</span>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Sets</p>
                  <div className="flex gap-2 flex-wrap">
                    {ps.map((s, i) => (
                      <div key={i} className="text-center">
                        <div className={`text-lg font-bold ${(winnerTeam === 'team1' ? s[0] > s[1] : s[1] > s[0]) ? 'text-green-600' : 'text-gray-400'}`}>
                          {s[0]}–{s[1]}
                        </div>
                        {s[2] === 1 && <div className="text-xs text-orange-500">Supertiebreak</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {isUnlocked && (
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <button onClick={() => { setDetailMatch(null); onEditMatch(dm); }} className="btn btn-sm btn-outline flex-1">✏️ Bewerken</button>
                  <button onClick={() => { setDetailMatch(null); onDeleteMatch(dm.id); }} className="btn btn-sm btn-error btn-outline flex-1">🗑️ Verwijderen</button>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
