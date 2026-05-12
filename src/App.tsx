import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import type { Player, Match } from './types'
import { SURFACE_COLORS } from './types'
import AddMatchModal from './components/AddMatchModal'
import H2HView from './components/H2HView'

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
                    const ids = [m.player1_id, m.player2_id, m.team1_player2_id, m.team2_player2_id]
                    return ids.includes(p1.id) && ids.includes(p2.id)
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

function StatsView({ players, matches }: { players: Player[], matches: Match[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('wins')
  const stats = players.map(p => {
    const myMatches = matches.filter(m => [m.player1_id, m.player2_id, m.team1_player2_id, m.team2_player2_id].includes(p.id))
    const wins = myMatches.filter(m => {
      const p1inTeam1 = m.player1_id === p.id || m.team1_player2_id === p.id
      const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
      return p1inTeam1 ? winnerTeam === 'team1' : winnerTeam === 'team2'
    }).length
    return { player: p, wins, losses: myMatches.length - wins, total: myMatches.length, pct: myMatches.length ? Math.round(wins / myMatches.length * 100) : 0 }
  }).sort((a, b) => {
    if (sortKey === 'name') return a.player.name.localeCompare(b.player.name)
    if (sortKey === 'wins') return b.wins - a.wins
    if (sortKey === 'losses') return b.losses - a.losses
    return b.pct - a.pct
  })

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {([['wins','🏆 Wins'],['losses','❌ Verliezen'],['winpct','% Win'],['name','Naam']] as [SortKey, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSortKey(k)} className={`btn btn-xs ${sortKey === k ? 'btn-primary' : 'btn-outline'}`}>{l}</button>
        ))}
      </div>
      <div className="space-y-2">
        {stats.map((s, i) => (
          <div key={s.player.id} className="card bg-base-100 shadow-sm">
            <div className="card-body py-3 px-4 flex-row items-center gap-4">
              <div className="text-2xl font-black text-gray-200 w-8">#{i + 1}</div>
              <div className="flex-1">
                <div className="font-semibold">{s.player.name}</div>
                <div className="text-xs text-gray-400">{s.total} wedstrijden</div>
              </div>
              <div className="flex gap-3 text-center">
                <div><div className="text-lg font-bold text-green-600">{s.wins}</div><div className="text-xs text-gray-400">W</div></div>
                <div><div className="text-lg font-bold text-red-400">{s.losses}</div><div className="text-xs text-gray-400">V</div></div>
                <div><div className="text-lg font-bold text-blue-500">{s.pct}%</div><div className="text-xs text-gray-400">Win</div></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('h2h')
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const [{ data: pData }, { data: mData }] = await Promise.all([
      supabase.from('tennis_players').select('*').order('name'),
      supabase.from('tennis_matches').select('*').order('date', { ascending: false })
    ])
    if (pData) setPlayers(pData)
    if (mData) setMatches(mData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleAddMatch = async (matchData: Omit<Match, 'id'>) => {
    setSaving(true)
    await supabase.from('tennis_matches').insert(matchData)
    await loadData()
    setShowAddMatch(false)
    setSaving(false)
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
    setShowAddPlayer(false)
    setSaving(false)
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
            <div className="flex gap-2">
              <button onClick={() => setShowAddPlayer(true)} className="btn btn-sm btn-outline text-white border-white hover:bg-white hover:text-green-800" title="Speler toevoegen">
                👤+
              </button>
              <button onClick={() => setShowAddMatch(true)} className="btn btn-sm bg-white text-green-800 hover:bg-green-50 font-bold">
                + Uitslag
              </button>
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
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20"><span className="loading loading-spinner loading-lg text-green-600"></span></div>
        ) : (
          <>
            {tab === 'h2h' && <H2HView players={players} matches={matches} onEditMatch={handleEditMatch} onDeleteMatch={handleDeleteMatch} />}
            {tab === 'matrix' && (
              <div>
                <div className="card bg-base-100 shadow-md mb-4">
                  <div className="card-body py-4">
                    <h2 className="font-bold text-lg mb-3">📊 H2H Matrix</h2>
                    <MatrixView players={players} matches={matches} />
                  </div>
                </div>
                <StatsView players={players} matches={matches} />
              </div>
            )}
            {tab === 'uitslagen' && (
              <div className="space-y-2">
                <h2 className="font-bold text-lg mb-3">📋 Alle Uitslagen</h2>
                {matches.length === 0 && <div className="text-center text-gray-400 py-8">Nog geen wedstrijden</div>}
                {matches.map(m => {
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

      {/* Modals */}
      {showAddMatch && (
        <AddMatchModal
          players={players}
          onSave={handleAddMatch}
          onClose={() => setShowAddMatch(false)}
        />
      )}

      {showAddPlayer && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">👤 Speler Toevoegen</h3>
            <input
              type="text"
              className="input input-bordered w-full mb-4"
              placeholder="Naam van de speler"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
              autoFocus
            />
            <div className="modal-action">
              <button onClick={() => setShowAddPlayer(false)} className="btn btn-ghost">Annuleren</button>
              <button onClick={handleAddPlayer} disabled={!newPlayerName.trim() || saving} className="btn btn-primary">Toevoegen</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAddPlayer(false)}></div>
        </div>
      )}
    </div>
  )
}
