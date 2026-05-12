import type { Player, Match } from '../types'
import { SURFACE_COLORS } from '../types'

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500'
]

function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function parseSetScore(setsStr: string): number[][] {
  try { return JSON.parse(setsStr) } catch { return [] }
}

interface Props {
  player: Player
  players: Player[]
  matches: Match[]
  onBack: () => void
}

export default function PlayerProfile({ player, players, matches, onBack }: Props) {
  // Alle wedstrijden van deze speler
  const myMatches = matches.filter(m =>
    [m.player1_id, m.player2_id, m.team1_player2_id, m.team2_player2_id].includes(player.id)
  )

  const singlesMatches = myMatches.filter(m => m.match_type === 'singles')
  const doublesMatches = myMatches.filter(m => m.match_type === 'doubles')

  function isWin(m: Match): boolean {
    const inTeam1 = m.player1_id === player.id || m.team1_player2_id === player.id
    const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
    return inTeam1 ? winnerTeam === 'team1' : winnerTeam === 'team2'
  }

  const totalWins = myMatches.filter(isWin).length
  const totalLosses = myMatches.length - totalWins
  const singlesWins = singlesMatches.filter(isWin).length
  const doublesWins = doublesMatches.filter(isWin).length
  const winPct = myMatches.length ? Math.round(totalWins / myMatches.length * 100) : 0

  // Langste winnende reeks
  const sortedByDate = [...myMatches].sort((a, b) => a.date.localeCompare(b.date))
  let maxStreak = 0, curStreak = 0
  sortedByDate.forEach(m => {
    if (isWin(m)) { curStreak++; if (curStreak > maxStreak) maxStreak = curStreak }
    else curStreak = 0
  })

  // Stats per ondergrond
  const surfaces = ['Kunstgras', 'Gravel', 'Smashcourt', 'Hardcourt binnen', 'Hardcourt buiten']
  const surfaceStats = surfaces.map(s => {
    const sm = myMatches.filter(m => m.surface === s)
    const sw = sm.filter(isWin).length
    return { surface: s, played: sm.length, wins: sw, losses: sm.length - sw, pct: sm.length ? Math.round(sw / sm.length * 100) : 0 }
  }).filter(s => s.played > 0)

  const favSurface = surfaceStats.reduce((a, b) => b.played > a.played ? b : a, surfaceStats[0])
  const bestSurface = surfaceStats.reduce((a, b) => b.pct > a.pct ? b : a, surfaceStats[0])

  // Laatste 10 wedstrijden (vorm)
  const last10 = [...myMatches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)

  // H2H vs elke andere speler
  const otherPlayers = players.filter(p => p.id !== player.id)
  const h2hStats = otherPlayers.map(opp => {
    const h2h = myMatches.filter(m => {
      const team1 = [m.player1_id, m.team1_player2_id]
      const team2 = [m.player2_id, m.team2_player2_id]
      return (team1.includes(player.id) && team2.includes(opp.id)) ||
             (team2.includes(player.id) && team1.includes(opp.id))
    })
    const w = h2h.filter(isWin).length
    return { opp, played: h2h.length, wins: w, losses: h2h.length - w }
  }).filter(h => h.played > 0).sort((a, b) => b.played - a.played)

  // Ranglijst positie
  const allStats = players.map(p => {
    const pm = matches.filter(m => [m.player1_id, m.player2_id, m.team1_player2_id, m.team2_player2_id].includes(p.id))
    const pw = pm.filter(m => {
      const inTeam1 = m.player1_id === p.id || m.team1_player2_id === p.id
      const wt = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
      return inTeam1 ? wt === 'team1' : wt === 'team2'
    }).length
    return { id: p.id, wins: pw, total: pm.length, pct: pm.length ? pw / pm.length : 0 }
  }).sort((a, b) => b.wins - a.wins || b.pct - a.pct)
  const rank = allStats.findIndex(s => s.id === player.id) + 1

  return (
    <div className="max-w-lg mx-auto">
      {/* Terug knop */}
      <button onClick={onBack} className="btn btn-outline btn-sm mb-4 gap-2 flex items-center">
        <span className="text-lg leading-none">←</span> Terug naar overzicht
      </button>

      {/* Hero sectie */}
      <div className="card bg-base-100 shadow-md mb-4">
        <div className="card-body py-5 px-5">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full ${getAvatarColor(player.id)} flex items-center justify-center text-white text-2xl font-black shadow-lg`}>
              {getInitials(player.name)}
            </div>
            <div className="flex-1">
              <div className="text-2xl font-black">{player.name}</div>
              <div className="text-gray-400 text-sm">#{rank} op de ranglijst</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-blue-600">{winPct}%</div>
              <div className="text-xs text-gray-400">Win%</div>
            </div>
          </div>

          {/* Record balk */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-base-200 justify-around text-center">
            <div>
              <div className="text-xl font-bold text-green-600">{totalWins}</div>
              <div className="text-xs text-gray-400">Gewonnen</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-400">{totalLosses}</div>
              <div className="text-xs text-gray-400">Verloren</div>
            </div>
            <div>
              <div className="text-xl font-bold">{myMatches.length}</div>
              <div className="text-xs text-gray-400">Totaal</div>
            </div>
            {maxStreak >= 3 && (
              <div>
                <div className="text-xl font-bold text-orange-500">{maxStreak}</div>
                <div className="text-xs text-gray-400">Beste reeks</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enkel / Dubbel */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body py-3 px-4 text-center">
            <div className="text-xs text-gray-400 mb-1">🎾 Enkelspel</div>
            <div className="font-bold text-lg">{singlesWins}–{singlesMatches.length - singlesWins}</div>
            <div className="text-xs text-gray-400">{singlesMatches.length} wedstrijden</div>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body py-3 px-4 text-center">
            <div className="text-xs text-gray-400 mb-1">🤝 Dubbelspel</div>
            <div className="font-bold text-lg">{doublesWins}–{doublesMatches.length - doublesWins}</div>
            <div className="text-xs text-gray-400">{doublesMatches.length} wedstrijden</div>
          </div>
        </div>
      </div>

      {/* Ondergrond stats */}
      {surfaceStats.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body py-4 px-4">
            <h3 className="font-bold mb-3">🏟️ Per Ondergrond</h3>
            <div className="space-y-2">
              {surfaceStats.map(s => (
                <div key={s.surface} className="flex items-center gap-3">
                  <span className={`badge badge-sm ${SURFACE_COLORS[s.surface] || 'badge-neutral'} min-w-[110px] justify-center`}>{s.surface}</span>
                  <div className="flex-1 bg-base-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-10 text-right">{s.pct}%</span>
                  <span className="text-xs text-gray-400">{s.wins}–{s.losses}</span>
                </div>
              ))}
            </div>
            {favSurface && bestSurface && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-base-200 text-xs text-gray-500 flex-wrap">
                {favSurface && <span>⭐ Meest gespeeld: <span className="font-semibold text-base-content">{favSurface.surface}</span></span>}
                {bestSurface && bestSurface.played >= 2 && <span>🔥 Sterkst op: <span className="font-semibold text-base-content">{bestSurface.surface}</span></span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Laatste 10 wedstrijden (vorm) */}
      {last10.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body py-4 px-4">
            <h3 className="font-bold mb-3">📈 Recente Vorm</h3>
            <div className="flex flex-wrap gap-2">
              {last10.map(m => {
                const win = isWin(m)
                const opp = players.find(p => {
                  const team1 = [m.player1_id, m.team1_player2_id]
                  const team2 = [m.player2_id, m.team2_player2_id]
                  const myTeam = team1.includes(player.id) ? team1 : team2
                  const oppTeam = myTeam === team1 ? team2 : team1
                  return oppTeam.includes(p.id) && p.id !== player.id
                })
                return (
                  <div key={m.id} className="flex flex-col items-center gap-0.5" title={`${opp?.name || '?'} — ${m.date}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow ${win ? 'bg-green-500' : 'bg-red-400'}`}>
                      {win ? 'W' : 'V'}
                    </div>
                    <div className="text-xs text-gray-400">{opp?.name.split(' ')[0] || '?'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* H2H vs anderen */}
      {h2hStats.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body py-4 px-4">
            <h3 className="font-bold mb-3">⚔️ H2H Overzicht</h3>
            <div className="space-y-2">
              {h2hStats.map(h => {
                const pct = Math.round(h.wins / h.played * 100)
                const color = h.wins > h.losses ? 'text-green-600' : h.wins < h.losses ? 'text-red-400' : 'text-yellow-500'
                return (
                  <div key={h.opp.id} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(h.opp.id)} flex items-center justify-center text-white text-xs font-bold`}>
                      {getInitials(h.opp.name)}
                    </div>
                    <div className="flex-1 text-sm font-medium">{h.opp.name}</div>
                    <div className={`font-bold text-sm ${color}`}>{h.wins}–{h.losses}</div>
                    <div className="text-xs text-gray-400 w-8 text-right">{pct}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Wedstrijdgeschiedenis */}
      {myMatches.length > 0 && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body py-4 px-4">
            <h3 className="font-bold mb-3">📋 Wedstrijdgeschiedenis</h3>
            <div className="space-y-2">
              {[...myMatches].sort((a, b) => b.date.localeCompare(a.date)).map(m => {
                const win = isWin(m)
                const p1 = players.find(p => p.id === m.player1_id)?.name || '?'
                const p2 = players.find(p => p.id === m.player2_id)?.name || '?'
                const tp1 = m.team1_player2_id ? ` & ${players.find(p => p.id === m.team1_player2_id)?.name?.split(' ')[0] || '?'}` : ''
                const tp2 = m.team2_player2_id ? ` & ${players.find(p => p.id === m.team2_player2_id)?.name?.split(' ')[0] || '?'}` : ''
                const team1 = p1.split(' ')[0] + tp1
                const team2 = p2.split(' ')[0] + tp2
                const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id ? 'team1' : 'team2'
                const sets = parseSetScore(m.sets)
                return (
                  <div key={m.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg border-l-4 ${win ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10' : 'border-l-red-400 bg-red-50 dark:bg-red-900/10'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${win ? 'bg-green-500' : 'bg-red-400'}`}>
                      {win ? 'W' : 'V'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className={`font-semibold ${winnerTeam === 'team1' ? 'text-green-600' : 'text-gray-500'}`}>{team1}</span>
                        <span className="text-gray-400 mx-1">vs</span>
                        <span className={`font-semibold ${winnerTeam === 'team2' ? 'text-green-600' : 'text-gray-500'}`}>{team2}</span>
                      </div>
                      <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                        <span>{m.date}</span>
                        {m.surface && <span className={`badge badge-xs ${SURFACE_COLORS[m.surface] || 'badge-neutral'}`}>{m.surface}</span>}
                        {m.location && <span>📍 {m.location}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 text-right flex-shrink-0">
                      {sets.map((s, i) => <span key={i} className="block">{s[0]}–{s[1]}</span>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
