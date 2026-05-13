import { useState, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { supabase, fetchProfiles, fetchPoules, createPoule, deletePoule, addPouleMember, removePouleMember } from './supabase'
import type { Player, Match, PlayerProfile as TPlayerProfile, Poule } from './types'
import { SURFACE_COLORS } from './types'
import AddMatchModal from './components/AddMatchModal'
import H2HView from './components/H2HView'
import PlayerProfile from './components/PlayerProfile'

const PIN = '2729'

// Dark mode: volg automatisch systeeminstellingen
function useDarkMode() {
  useEffect(() => {
    const apply = (dark: boolean) => {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    apply(mq.matches)
    const handler = (e: MediaQueryListEvent) => apply(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
}

type Tab = 'h2h' | 'uitslagen' | 'matrix'
type SortKey = 'name' | 'wins' | 'losses' | 'winpct'

function MatrixView({ players, matches }: { players: Player[], matches: Match[] }) {
  if (players.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="table table-xs border border-base-300 w-full">
        <thead>
          <tr>
            <th className="bg-base-200 border border-base-300 text-xs">vs</th>
            {players.map(p => (
              <th key={p.id} className="bg-base-200 border border-base-300 text-xs text-center whitespace-nowrap" style={{ maxWidth: 80 }}>
                {p.name.split(' ')[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(p1 => {
            return (
              <tr key={p1.id}>
                <td className="font-semibold text-xs border border-base-300 bg-base-100 whitespace-nowrap">{p1.name}</td>
                {players.map(p2 => {
                  if (p1.id === p2.id) {
                    return <td key={p2.id} className="bg-base-200 border border-base-300 text-center">—</td>
                  }
                  const h2h = matches.filter(m => {
                    const team1 = [m.player1_id, m.team1_player2_id]
                    const team2 = [m.player2_id, m.team2_player2_id]
                    return (team1.includes(p1.id) && team2.includes(p2.id)) ||
                           (team2.includes(p1.id) && team1.includes(p2.id))
                  })
                  const w = h2h.filter(m => {
                    const p1inTeam1 = m.player1_id === p1.id || m.team1_player2_id === p1.id
                    const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
                    return p1inTeam1 ? winnerTeam === 'team1' : winnerTeam === 'team2'
                  }).length
                  const l = h2h.length - w
                  if (h2h.length === 0) return <td key={p2.id} className="border border-base-300 text-center text-gray-300 text-xs">-</td>
                  const bg = w > l ? 'bg-green-50 text-green-700' : w < l ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                  return <td key={p2.id} className={`border border-base-300 text-center text-xs font-bold ${bg}`}>{w}-{l}</td>
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatsView({ players, matches, onSelectPlayer }: { players: Player[], matches: Match[], onSelectPlayer: (p: Player) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('wins')
  const stats = players.map(p => {
    const myMatches = matches.filter(m => [m.player1_id, m.player2_id, m.team1_player2_id, m.team2_player2_id].includes(p.id))
    let setsWon = 0, setsLost = 0, gamesWon = 0, gamesLost = 0
    const wins = myMatches.filter(m => {
      const inTeam1 = m.player1_id === p.id || m.team1_player2_id === p.id
      const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
      const sets: number[][] = (() => { try { return JSON.parse(m.sets) } catch { return [] } })()
      sets.forEach(([t1, t2]) => {
        const myGames = inTeam1 ? t1 : t2
        const oppGames = inTeam1 ? t2 : t1
        gamesWon += myGames
        gamesLost += oppGames
        if (myGames > oppGames) setsWon++; else setsLost++
      })
      return inTeam1 ? winnerTeam === 'team1' : winnerTeam === 'team2'
    }).length
    return { player: p, wins, losses: myMatches.length - wins, total: myMatches.length, pct: myMatches.length ? Math.round(wins / myMatches.length * 100) : 0, setsWon, setsLost, gamesWon, gamesLost }
  }).sort((a, b) => {
    if (sortKey === 'name') return a.player.name.localeCompare(b.player.name)
    if (sortKey === 'wins') return b.wins - a.wins
    if (sortKey === 'losses') return b.losses - a.losses
    return b.pct - a.pct
  })

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {([['wins','🏆 Overwinningen'],['losses','❌ Nederlagen'],['winpct','% Win'],['name','Naam']] as [SortKey, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSortKey(k)} className={`btn btn-xs ${sortKey === k ? 'bg-blue-700 text-white border-blue-700' : 'bg-gray-200 text-gray-800 border-gray-300 hover:bg-gray-300'}`}>{l}</button>
        ))}
      </div>
      <div className="space-y-2">
        {stats.map((s, i) => (
          <div key={s.player.id} className="card bg-base-100 shadow-sm">
            <div className="card-body py-3 px-4">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-black text-gray-200 w-8">#{i + 1}</div>
                <div className="flex-1">
                  <button onClick={() => onSelectPlayer(s.player)} className="font-semibold hover:text-blue-600 hover:underline text-left transition-colors">{s.player.name}</button>
                  <div className="text-xs text-gray-400">{s.total} wedstrijden</div>
                </div>
                <div className="flex gap-3 text-center">
                  <div><div className="text-lg font-bold text-green-600">{s.wins}</div><div className="text-xs text-gray-400">W</div></div>
                  <div><div className="text-lg font-bold text-red-400">{s.losses}</div><div className="text-xs text-gray-400">V</div></div>
                  <div><div className="text-lg font-bold text-blue-500">{s.pct}%</div><div className="text-xs text-gray-400">Win%</div></div>
                </div>
              </div>
              <div className="flex gap-4 mt-2 pt-2 border-t border-base-200 text-xs text-gray-500">
                <span>🎯 Sets: <span className="font-semibold text-green-600">{s.setsWon}</span>–<span className="font-semibold text-red-400">{s.setsLost}</span></span>
                <span>🎾 Games: <span className="font-semibold text-green-600">{s.gamesWon}</span>–<span className="font-semibold text-red-400">{s.gamesLost}</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  useDarkMode()
  const [tab, setTab] = useState<Tab>('h2h')
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [showManagePlayers, setShowManagePlayers] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [saving, setSaving] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('tennis_unlocked') === '1')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [profiles, setProfiles] = useState<TPlayerProfile[]>([])
  const [poules, setPoules] = useState<Poule[]>([])
  const [selectedPoule, setSelectedPoule] = useState<number | null>(null)
  const [showManagePoules, setShowManagePoules] = useState(false)
  const [newPouleName, setNewPouleName] = useState('')
  const [expandedPoule, setExpandedPoule] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'poule' | 'player', id: number, name: string, pinInput: string, pinError: boolean
  } | null>(null)

  const loadData = async () => {
    setLoading(true)
    const [{ data: pData }, { data: mData }, prData, poulesData] = await Promise.all([
      supabase.from('tennis_players').select('*').order('name'),
      supabase.from('tennis_matches').select('*').order('date', { ascending: false }),
      fetchProfiles(),
      fetchPoules()
    ])
    if (pData) setPlayers(pData)
    if (mData) setMatches(mData)
    setProfiles(prData)
    setPoules(poulesData)
    setLoading(false)
  }

  const handleAddPoule = async () => {
    const name = newPouleName.trim()
    if (!name) return
    const { data } = await createPoule(name)
    if (data) setPoules(prev => [...prev, data])
    setNewPouleName('')
  }

  const handleDeletePoule = (id: number, name: string) => {
    setDeleteConfirm({ type: 'poule', id, name, pinInput: '', pinError: false })
  }

  const handleTogglePouleMember = async (pouleId: number, playerId: number, isMember: boolean) => {
    if (isMember) {
      await removePouleMember(pouleId, playerId)
      setPoules(prev => prev.map(p => p.id === pouleId
        ? ({ ...p, player_ids: (p.player_ids || []).filter(id => id !== playerId) }) as typeof p
        : p))
    } else {
      await addPouleMember(pouleId, playerId)
      setPoules(prev => prev.map(p => p.id === pouleId
        ? ({ ...p, player_ids: [...(p.player_ids || []), playerId] }) as typeof p
        : p))
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    if (deleteConfirm.pinInput !== PIN) {
      setDeleteConfirm(prev => prev ? { ...prev, pinError: true, pinInput: '' } : null)
      return
    }
    if (deleteConfirm.type === 'poule') {
      await deletePoule(deleteConfirm.id)
      setPoules(prev => prev.filter(p => p.id !== deleteConfirm.id))
      if (selectedPoule === deleteConfirm.id) setSelectedPoule(null)
    } else {
      await supabase.from('tennis_players').delete().eq('id', deleteConfirm.id)
      await loadData()
    }
    setDeleteConfirm(null)
  }

  useEffect(() => { loadData() }, [])

  const handleUnlock = () => {
    if (pinInput === PIN) {
      sessionStorage.setItem('tennis_unlocked', '1')
      setIsUnlocked(true)
      setShowPinModal(false)
      setPinInput('')
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  const handleLock = () => {
    sessionStorage.removeItem('tennis_unlocked')
    setIsUnlocked(false)
  }

  const filteredMatches = selectedPoule !== null ? matches.filter(m => m.poule_id === selectedPoule) : matches
  const filteredPlayers = selectedPoule !== null
    ? players.filter(p => poules.find(po => po.id === selectedPoule)?.player_ids?.includes(p.id) ?? false)
    : players

  const handleAddMatch = async (matchData: Omit<Match, 'id'>) => {
    setSaving(true)
    await supabase.from('tennis_matches').insert(matchData)
    await loadData()
    setShowAddMatch(false)
    setSaving(false)
    // 🎉 Confetti!
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#f97316', '#3b82f6', '#eab308', '#ec4899'],
    })
  }

  const handleEditMatch = async (id: number, updates: Partial<Match>) => {
    setSaving(true)
    await supabase.from('tennis_matches').update(updates).eq('id', id)
    await loadData()
    setSaving(false)
  }

  const handleDeleteMatch = async (id: number) => {
    setSaving(true)
    await supabase.from('tennis_matches').delete().eq('id', id)
    await loadData()
    setSaving(false)
  }

  const handleAddPlayer = async () => {
    const name = newPlayerName.trim()
    if (!name) return
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      alert('Deze speler bestaat al!')
      return
    }
    setSaving(true)
    await supabase.from('tennis_players').insert({ name })
    await loadData()
    setNewPlayerName('')
    setShowManagePlayers(false)
    setSaving(false)
  }

  const handleDeletePlayer = (playerId: number, playerName: string) => {
    const hasMatches = matches.some(m =>
      m.player1_id === playerId || m.player2_id === playerId ||
      m.team1_player2_id === playerId || m.team2_player2_id === playerId
    )
    if (hasMatches) return
    setDeleteConfirm({ type: 'player', id: playerId, name: playerName, pinInput: '', pinError: false })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-900 text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">🎾 Tennis H2H</h1>
              <p className="text-green-200 text-xs mt-0.5">Head to Head Tracker</p>
            </div>
            <div className="flex gap-2 items-center">
              {isUnlocked ? (
                <>
                  <button onClick={() => setShowManagePlayers(true)} className="btn btn-sm btn-outline text-white border-white hover:bg-white hover:text-green-800" title="Spelers beheren">
                    👥
                  </button>
                  <button onClick={() => setShowManagePoules(true)} className="btn btn-sm btn-outline text-white border-white hover:bg-white hover:text-green-800" title="Poules beheren">
                    🏆
                  </button>
                  <button onClick={() => setShowAddMatch(true)} className="btn btn-sm bg-white text-green-800 hover:bg-green-50 font-bold">
                    + Uitslag
                  </button>
                  <button onClick={handleLock} className="btn btn-sm btn-ghost text-white" title="Vergrendelen">
                    🔓
                  </button>
                </>
              ) : (
                <button onClick={() => { setShowPinModal(true); setPinError(false); setPinInput('') }} className="btn btn-sm btn-ghost text-white" title="Ontgrendelen">
                  🔒
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex">
            {([['h2h','🎾 H2H'], ['matrix','📊 Matrix'], ['uitslagen','📋 Uitslagen']] as [Tab, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t ? 'border-green-600 text-green-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Poule filter */}
      {poules.length > 0 && (
        <div className="bg-white border-b">
          <div className="max-w-2xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
            <button onClick={() => setSelectedPoule(null)}
              className={`btn btn-xs flex-shrink-0 ${selectedPoule === null ? '!bg-green-700 !text-white !border-green-700' : 'btn-outline !text-gray-700 !border-gray-400 hover:!bg-gray-100 hover:!text-gray-900'}`}>
              Alle poules
            </button>
            {poules.map(p => (
              <button key={p.id} onClick={() => setSelectedPoule(p.id)}
                className={`btn btn-xs flex-shrink-0 ${selectedPoule === p.id ? '!bg-green-700 !text-white !border-green-700' : 'btn-outline !text-gray-700 !border-gray-400 hover:!bg-gray-100 hover:!text-gray-900'}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20"><span className="loading loading-spinner loading-lg text-green-600"></span></div>
        ) : (
          <>
            {tab === 'h2h' && <H2HView players={filteredPlayers} matches={filteredMatches} poules={poules} onEditMatch={handleEditMatch} onDeleteMatch={handleDeleteMatch} isUnlocked={isUnlocked} />}
            {tab === 'matrix' && (
              selectedPlayer ? (
                <PlayerProfile
                  player={selectedPlayer}
                  players={players}
                  matches={matches}
                  profile={profiles.find(pr => pr.player_id === selectedPlayer.id) || null}
                  onBack={() => setSelectedPlayer(null)}
                  onProfileSaved={(saved: TPlayerProfile) => {
                    setProfiles(prev => {
                      const idx = prev.findIndex(pr => pr.player_id === saved.player_id)
                      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n }
                      return [...prev, saved]
                    })
                  }}
                />
              ) : (
                <div>
                  <div className="card bg-base-100 shadow-md mb-4">
                    <div className="card-body py-4">
                      <h2 className="font-bold text-lg mb-3">📊 H2H Matrix</h2>
                      <MatrixView players={filteredPlayers} matches={filteredMatches} />
                    </div>
                  </div>
                  <StatsView players={filteredPlayers} matches={filteredMatches} onSelectPlayer={(p) => setSelectedPlayer(p)} />
                </div>
              )
            )}
            {tab === 'uitslagen' && (
              <div className="space-y-2">
                <h2 className="font-bold text-lg mb-3 text-gray-900">📋 Alle Uitslagen</h2>
                {filteredMatches.length === 0 && <div className="text-center text-gray-400 py-8">Nog geen wedstrijden</div>}
                {filteredMatches.map(m => {
                  const p1 = players.find(p => p.id === m.player1_id)?.name || '?'
                  const p2 = players.find(p => p.id === m.player2_id)?.name || '?'
                  const tp1 = m.team1_player2_id ? ` & ${players.find(p => p.id === m.team1_player2_id)?.name || '?'}` : ''
                  const tp2 = m.team2_player2_id ? ` & ${players.find(p => p.id === m.team2_player2_id)?.name || '?'}` : ''
                  const team1 = p1 + tp1
                  const team2 = p2 + tp2
                  const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
                  const sets: number[][] = (() => { try { return JSON.parse(m.sets) } catch { return [] } })()
                  
                  return (
                    <div key={m.id} className="card bg-base-100 shadow-sm border-l-4 border-l-green-500">
                      <div className="card-body py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {m.match_type === 'doubles' && <span className="badge badge-xs badge-secondary">Dubbel</span>}
                              {m.surface && <span className={`badge badge-xs ${SURFACE_COLORS[m.surface] || 'badge-neutral'}`}>{m.surface}</span>}
                              <span className="text-xs text-gray-400">{m.date}</span>
                              {m.location && <span className="text-xs text-gray-400">📍 {m.location}</span>}
                            </div>
                            <div className="text-sm">
                              <span className={`font-semibold ${winnerTeam === 'team1' ? 'text-green-600' : 'text-gray-500'}`}>{team1}</span>
                              <span className="text-gray-400 mx-2">vs</span>
                              <span className={`font-semibold ${winnerTeam === 'team2' ? 'text-green-600' : 'text-gray-500'}`}>{team2}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {sets.map((s, i) => <span key={i} className="mr-2">{s[0]}-{s[1]}</span>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-xs text-center">
            <h3 className="font-bold text-lg mb-1">🔐 Pincode invoeren</h3>
            <p className="text-sm text-gray-500 mb-4">Voer de pincode in om te bewerken</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              className={`input input-bordered w-full text-center text-2xl tracking-widest mb-2 ${pinError ? 'input-error' : ''}`}
              placeholder="••••"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false) }}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              autoFocus
            />
            {pinError && <p className="text-error text-sm mb-2">Onjuiste pincode</p>}
            <div className="modal-action justify-center gap-2">
              <button onClick={() => setShowPinModal(false)} className="btn btn-ghost">Annuleren</button>
              <button onClick={handleUnlock} disabled={!pinInput} className="btn btn-primary">Ontgrendelen</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowPinModal(false)}></div>
        </div>
      )}

      {/* Modals */}
      {showAddMatch && (
        <AddMatchModal
          players={players}
          poules={poules}
          onSave={handleAddMatch}
          onClose={() => setShowAddMatch(false)}
        />
      )}

      {showManagePoules && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">🏆 Poules Beheren</h3>
            <div className="space-y-2 mb-4">
              {poules.length === 0 && <p className="text-sm text-gray-400">Nog geen poules aangemaakt.</p>}
              {poules.map(p => (
                <div key={p.id} className="bg-base-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2">
                    <button
                      className="flex items-center gap-2 flex-1 text-left font-medium"
                      onClick={() => setExpandedPoule(expandedPoule === p.id ? null : p.id)}
                    >
                      <span>{expandedPoule === p.id ? '▾' : '▸'}</span>
                      <span>{p.name}</span>
                      <span className="text-xs text-gray-400 font-normal">({(p.player_ids || []).length} spelers)</span>
                    </button>
                    <button onClick={() => handleDeletePoule(p.id, p.name)} className="btn btn-ghost btn-xs text-red-500">🗑️</button>
                  </div>
                  {expandedPoule === p.id && (
                    <div className="px-3 pb-3 border-t border-base-300 pt-2">
                      <p className="text-xs text-gray-500 mb-2">Vink spelers aan om ze aan deze poule toe te voegen:</p>
                      <div className="space-y-1">
                        {players.map(player => {
                          const isMember = (p.player_ids || []).includes(player.id)
                          return (
                            <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-base-300 rounded px-2 py-1">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm checkbox-primary"
                                checked={isMember}
                                onChange={() => handleTogglePouleMember(p.id, player.id, isMember)}
                              />
                              <span className="text-sm">{player.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                className="input input-bordered input-sm flex-1"
                placeholder="Nieuwe poule naam..."
                value={newPouleName}
                onChange={e => setNewPouleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddPoule()}
              />
              <button onClick={handleAddPoule} disabled={!newPouleName.trim()} className="btn btn-primary btn-sm">+ Toevoegen</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">💡 Wedstrijden zonder poule zijn altijd zichtbaar bij "Alle poules".</p>
            <div className="modal-action">
              <button onClick={() => { setShowManagePoules(false); setExpandedPoule(null) }} className="btn btn-primary">Klaar</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setShowManagePoules(false); setExpandedPoule(null) }}></div>
        </div>
      )}

      {showManagePlayers && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">👥 Spelers Beheren</h3>

            {/* Bestaande spelers */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">Spelers</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {players.map(p => {
                  const hasMatches = matches.some(m =>
                    m.player1_id === p.id || m.player2_id === p.id ||
                    m.team1_player2_id === p.id || m.team2_player2_id === p.id
                  )
                  return (
                    <div key={p.id} className="flex items-center justify-between py-1 px-2 rounded bg-gray-50">
                      <span className="text-sm font-medium text-gray-800">{p.name}</span>
                      {hasMatches ? (
                        <span className="text-xs text-gray-400">heeft wedstrijden</span>
                      ) : (
                        <button
                          onClick={() => handleDeletePlayer(p.id, p.name)}
                          disabled={saving}
                          className="btn btn-xs btn-error btn-outline"
                          title="Verwijderen"
                        >🗑️ Verwijder</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Nieuwe speler toevoegen */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">Nieuwe speler toevoegen</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered input-sm flex-1"
                  placeholder="Naam van de speler"
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
                />
                <button onClick={handleAddPlayer} disabled={!newPlayerName.trim() || saving} className="btn btn-primary btn-sm">+ Voeg toe</button>
              </div>
            </div>

            <div className="modal-action">
              <button onClick={() => { setShowManagePlayers(false); setNewPlayerName('') }} className="btn btn-primary">Klaar</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setShowManagePlayers(false); setNewPlayerName('') }}></div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal modal-open">
          <div className="modal-box max-w-xs text-center" style={{ background: 'white', color: '#111' }}>
            <h3 className="font-bold text-lg mb-1">🗑️ Verwijderen</h3>
            <p className="text-sm text-gray-500 mb-4">Voer de pincode in om <strong>"{deleteConfirm.name}"</strong> te verwijderen</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              className={`input input-bordered w-full text-center text-2xl tracking-widest mb-2 ${deleteConfirm.pinError ? 'input-error' : ''}`}
              placeholder="••••"
              value={deleteConfirm.pinInput}
              onChange={e => setDeleteConfirm(prev => prev ? { ...prev, pinInput: e.target.value, pinError: false } : null)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmDelete()}
              autoFocus
            />
            {deleteConfirm.pinError && <p className="text-error text-sm mb-2">Onjuiste pincode</p>}
            <div className="modal-action justify-center gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost">Annuleren</button>
              <button onClick={handleConfirmDelete} disabled={!deleteConfirm.pinInput} className="btn btn-error">Verwijderen</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}></div>
        </div>
      )}
    </div>
  )
}
