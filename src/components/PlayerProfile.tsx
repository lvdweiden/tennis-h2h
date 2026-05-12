import { useState, useRef } from 'react'
import type { Player, Match, PlayerProfile } from '../types'
import { SURFACE_COLORS } from '../types'
import { upsertProfile } from '../supabase'

const MASTER_PIN = '2729'

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

function resizeImageToBase64(file: File, maxSize = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = reject
    img.src = url
  })
}

interface Props {
  player: Player
  players: Player[]
  matches: Match[]
  profile: PlayerProfile | null
  onBack: () => void
  onProfileSaved: (profile: PlayerProfile) => void
}

export default function PlayerProfile({ player, players, matches, profile, onBack, onProfileSaved }: Props) {
  // Edit state
  const [mode, setMode] = useState<'view' | 'pin' | 'edit'>('view')
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url || '')
  const [height, setHeight] = useState(profile?.height?.toString() || '')
  const [preferredHand, setPreferredHand] = useState(profile?.preferred_hand || '')
  const [birthdate, setBirthdate] = useState(profile?.birthdate || '')
  const [club, setClub] = useState(profile?.club || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [newPin, setNewPin] = useState('')
  const [removePin, setRemovePin] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasPin = !!profile?.pincode

  // Stats calculations
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

  const sortedByDate = [...myMatches].sort((a, b) => a.date.localeCompare(b.date))
  let maxStreak = 0, curStreak = 0
  sortedByDate.forEach(m => {
    if (isWin(m)) { curStreak++; if (curStreak > maxStreak) maxStreak = curStreak }
    else curStreak = 0
  })

  const surfaces = ['Kunstgras', 'Gravel', 'Smashcourt', 'Hardcourt binnen', 'Hardcourt buiten']
  const surfaceStats = surfaces.map(s => {
    const sm = myMatches.filter(m => m.surface === s)
    const sw = sm.filter(isWin).length
    return { surface: s, played: sm.length, wins: sw, losses: sm.length - sw, pct: sm.length ? Math.round(sw / sm.length * 100) : 0 }
  }).filter(s => s.played > 0)

  const favSurface = surfaceStats.length ? surfaceStats.reduce((a, b) => b.played > a.played ? b : a) : null
  const bestSurface = surfaceStats.length ? surfaceStats.reduce((a, b) => b.pct > a.pct ? b : a) : null

  const last10 = [...myMatches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)

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

  // Age from birthdate
  function calcAge(bd: string) {
    if (!bd) return null
    const diff = Date.now() - new Date(bd).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  }

  // Pincode check
  function handlePinSubmit() {
    if (pinInput === MASTER_PIN || pinInput === profile?.pincode) {
      setMode('edit')
      setPinError(false)
      setPinInput('')
    } else {
      setPinError(true)
    }
  }

  function startEdit() {
    if (hasPin) {
      setMode('pin')
    } else {
      setMode('edit')
    }
  }

  function cancelEdit() {
    setMode('view')
    setPhotoUrl(profile?.photo_url || '')
    setHeight(profile?.height?.toString() || '')
    setPreferredHand(profile?.preferred_hand || '')
    setBirthdate(profile?.birthdate || '')
    setClub(profile?.club || '')
    setBio(profile?.bio || '')
    setNewPin('')
    setRemovePin(false)
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await resizeImageToBase64(file)
    setPhotoUrl(base64)
  }

  async function handleSave() {
    setSaving(true)
    const pincodeToSave = removePin ? null : (newPin.length >= 4 ? newPin : profile?.pincode || null)
    const profileData: PlayerProfile = {
      player_id: player.id,
      photo_url: photoUrl || null,
      height: height ? parseInt(height) : null,
      preferred_hand: preferredHand || null,
      birthdate: birthdate || null,
      club: club || null,
      bio: bio || null,
      pincode: pincodeToSave,
    }
    await upsertProfile(profileData as unknown as Record<string, unknown>)
    onProfileSaved(profileData)
    setSaving(false)
    setMode('view')
  }

  const displayPhoto = photoUrl || profile?.photo_url

  // ---- RENDER ----

  return (
    <div className="max-w-lg mx-auto">
      {/* Terug knop */}
      <button onClick={onBack} className="btn btn-sm mb-4 gap-2 flex items-center bg-gray-800 text-white hover:bg-gray-700 border-0">
        <span className="text-lg leading-none">←</span> Terug naar overzicht
      </button>

      {/* PIN invoer scherm */}
      {mode === 'pin' && (
        <div className="card bg-base-100 shadow-md mb-4">
          <div className="card-body py-5 px-5">
            <h3 className="font-bold text-lg mb-3">🔐 Pincode invoeren</h3>
            <p className="text-sm text-gray-500 mb-3">Dit profiel is beveiligd met een persoonlijke pincode.</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Voer pincode in"
              className={`input input-bordered w-full mb-2 ${pinError ? 'input-error' : ''}`}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false) }}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
              autoFocus
            />
            {pinError && <p className="text-error text-sm mb-2">Onjuiste pincode ❌</p>}
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={handlePinSubmit}>Bevestigen</button>
              <button className="btn btn-ghost flex-1" onClick={() => { setMode('view'); setPinInput(''); setPinError(false) }}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT formulier */}
      {mode === 'edit' && (
        <div className="card bg-base-100 shadow-md mb-4">
          <div className="card-body py-5 px-5">
            <h3 className="font-bold text-lg mb-4">✏️ Profiel bewerken</h3>

            {/* Foto */}
            <div className="flex items-center gap-4 mb-4">
              <div
                className={`w-16 h-16 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer ${!displayPhoto ? getAvatarColor(player.id) : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                {displayPhoto
                  ? <img src={displayPhoto} alt="foto" className="w-full h-full object-cover" />
                  : <span className="text-white text-2xl font-black">{getInitials(player.name)}</span>
                }
              </div>
              <div>
                <button className="btn btn-sm btn-outline" onClick={() => fileInputRef.current?.click()}>
                  📸 Foto uploaden
                </button>
                {displayPhoto && (
                  <button className="btn btn-sm btn-ghost text-error ml-2" onClick={() => setPhotoUrl('')}>
                    Verwijderen
                  </button>
                )}
                <p className="text-xs text-gray-400 mt-1">Max. ~300×300px, wordt automatisch verkleind</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>

            {/* Velden */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">📏 Lengte (cm)</label>
                <input
                  type="number"
                  placeholder="bijv. 185"
                  className="input input-bordered input-sm w-full"
                  value={height}
                  onChange={e => setHeight(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">🤚 Voorkeurshand</label>
                <select className="select select-bordered select-sm w-full" value={preferredHand} onChange={e => setPreferredHand(e.target.value)}>
                  <option value="">Kies...</option>
                  <option value="rechts">Rechts</option>
                  <option value="links">Links</option>
                  <option value="tweehandig">Tweehandig</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">🎂 Geboortedatum</label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={birthdate}
                  onChange={e => setBirthdate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">🏠 Thuisclub</label>
                <input
                  type="text"
                  placeholder="bijv. TC De Bataaf"
                  className="input input-bordered input-sm w-full"
                  value={club}
                  onChange={e => setClub(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">✍️ Bio</label>
              <textarea
                placeholder="Kort tekstje over jezelf..."
                className="textarea textarea-bordered w-full text-sm"
                rows={2}
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
            </div>

            {/* Pincode sectie */}
            <div className="border-t border-base-200 pt-4 mb-4">
              <h4 className="text-sm font-semibold mb-2">🔐 Pincode</h4>
              {hasPin && !removePin ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-500">Profiel is beveiligd ✅</span>
                  <button className="btn btn-xs btn-outline" onClick={() => setRemovePin(true)}>Pincode verwijderen</button>
                  <div className="w-full mt-2">
                    <label className="text-xs text-gray-400 mb-1 block">Nieuwe pincode instellen (optioneel)</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Laat leeg om huidig te behouden"
                      className="input input-bordered input-sm w-full"
                      value={newPin}
                      onChange={e => setNewPin(e.target.value)}
                    />
                  </div>
                </div>
              ) : removePin ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-error">Pincode wordt verwijderd</span>
                  <button className="btn btn-xs btn-ghost" onClick={() => setRemovePin(false)}>Ongedaan maken</button>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Stel een pincode in om je profiel te beveiligen (optioneel)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Minimaal 4 cijfers"
                    className="input input-bordered input-sm w-full"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Laat leeg om profiel open te laten</p>
                </div>
              )}
            </div>

            {/* Opslaan/Annuleren */}
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Opslaan...' : '💾 Opslaan'}
              </button>
              <button className="btn btn-ghost flex-1" onClick={cancelEdit}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE */}
      {mode === 'view' && (
        <>
          {/* Hero sectie */}
          <div className="card bg-base-100 shadow-md mb-4">
            <div className="card-body py-5 px-5">
              <div className="flex items-center gap-4">
                {/* Avatar / Foto */}
                <div className={`w-16 h-16 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center shadow-lg ${!profile?.photo_url ? getAvatarColor(player.id) : ''}`}>
                  {profile?.photo_url
                    ? <img src={profile.photo_url} alt={player.name} className="w-full h-full object-cover" />
                    : <span className="text-white text-2xl font-black">{getInitials(player.name)}</span>
                  }
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-black">{player.name}</div>
                  <div className="text-gray-400 text-sm">#{rank} op de ranglijst</div>
                  {/* Extra profielinfo */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                    {profile?.birthdate && <span>🎂 {calcAge(profile.birthdate)} jaar</span>}
                    {profile?.height && <span>📏 {profile.height} cm</span>}
                    {profile?.preferred_hand && <span>🤚 {profile.preferred_hand}</span>}
                    {profile?.club && <span>🏠 {profile.club}</span>}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-blue-600">{winPct}%</div>
                  <div className="text-xs text-gray-400">Win%</div>
                </div>
              </div>

              {/* Bio */}
              {profile?.bio && (
                <div className="mt-3 pt-3 border-t border-base-200 text-sm text-gray-500 italic">
                  "{profile.bio}"
                </div>
              )}

              {/* Lock indicator + edit knop */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-200">
                <span className="text-xs text-gray-400">
                  {hasPin ? '🔒 Beveiligd profiel' : '🔓 Vrij te bewerken'}
                </span>
                <button className="btn btn-sm btn-outline" onClick={startEdit}>✏️ Bewerken</button>
              </div>

              {/* Record balk */}
              <div className="flex gap-4 mt-3 pt-3 border-t border-base-200 justify-around text-center">
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
                        <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${s.pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold w-10 text-right">{s.pct}%</span>
                      <span className="text-xs text-gray-400">{s.wins}–{s.losses}</span>
                    </div>
                  ))}
                </div>
                {(favSurface || bestSurface) && (
                  <div className="flex gap-4 mt-3 pt-3 border-t border-base-200 text-xs text-gray-500 flex-wrap">
                    {favSurface && <span>⭐ Meest gespeeld: <span className="font-semibold text-base-content">{favSurface.surface}</span></span>}
                    {bestSurface && bestSurface.played >= 2 && <span>🔥 Sterkst op: <span className="font-semibold text-base-content">{bestSurface.surface}</span></span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vorm */}
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
                      <div key={m.id} className="flex flex-col items-center gap-0.5">
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
        </>
      )}
    </div>
  )
}
