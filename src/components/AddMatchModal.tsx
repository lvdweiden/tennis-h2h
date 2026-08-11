import { useState } from 'react'
import type { Player } from '../types'
import { SURFACES, SURFACE_COLORS } from '../types'

interface Props {
  players: Player[]
  onSave: (match: {
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
    poule_id: number | null
    notes?: string | null
  }) => void
  onClose: () => void
}

export default function AddMatchModal({ players, onSave, onClose }: Props) {
  const [matchType, setMatchType] = useState<'singles' | 'doubles'>('singles')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [player1, setPlayer1] = useState('')
  const [player2, setPlayer2] = useState('')
  const [team1p2, setTeam1p2] = useState('')
  const [team2p2, setTeam2p2] = useState('')
  const [winner, setWinner] = useState<'team1' | 'team2' | ''>('')
  const [sets, setSets] = useState([{ p1: '', p2: '', stb: false, tb1: '', tb2: '' }])
  const [surface, setSurface] = useState('Kunstgras')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const addSet = () => setSets([...sets, { p1: '', p2: '', stb: false, tb1: '', tb2: '' }])
  const removeSet = (i: number) => setSets(sets.filter((_, idx) => idx !== i))
  const updateSet = (i: number, key: 'p1' | 'p2' | 'tb1' | 'tb2', val: string) => {
    const s = [...sets]; s[i] = { ...s[i], [key]: val }; setSets(s)
  }
  const toggleStb = (i: number) => {
    const s = [...sets]; s[i] = { ...s[i], stb: !s[i].stb }; setSets(s)
  }

  const handleSave = () => {
    if (!player1 || !player2 || !winner || !date) return
    if (matchType === 'doubles' && (!team1p2 || !team2p2)) return
    const setsData = sets.map(s => {
      const p1g = parseInt(s.p1) || 0
      const p2g = parseInt(s.p2) || 0
      if (s.stb) return [p1g, p2g, 1]
      if (p1g === 6 && p2g === 6 && s.tb1 !== '' && s.tb2 !== '') {
        const tb1 = parseInt(s.tb1) || 0
        const tb2 = parseInt(s.tb2) || 0
        if (tb1 > tb2) return [7, 6, tb1, tb2]
        if (tb2 > tb1) return [6, 7, tb1, tb2]
      }
      return [p1g, p2g]
    })
    const p1id = parseInt(player1)
    const p2id = parseInt(player2)
    const winnerId = winner === 'team1' ? p1id : p2id
    onSave({
      date,
      player1_id: p1id,
      player2_id: p2id,
      winner_id: winnerId,
      sets: JSON.stringify(setsData),
      surface,
      location,
      match_type: matchType,
      team1_player2_id: matchType === 'doubles' ? parseInt(team1p2) : null,
      team2_player2_id: matchType === 'doubles' ? parseInt(team2p2) : null,
      poule_id: null,
      notes: notes.trim() || null,
    })
  }

  const p1name = players.find(p => p.id === parseInt(player1))?.name || 'Team 1'
  const p2name = players.find(p => p.id === parseInt(player2))?.name || 'Team 2'
  const t1p2name = players.find(p => p.id === parseInt(team1p2))?.name || ''
  const t2p2name = players.find(p => p.id === parseInt(team2p2))?.name || ''
  const team1Label = matchType === 'doubles' && t1p2name ? `${p1name} & ${t1p2name}` : p1name
  const team2Label = matchType === 'doubles' && t2p2name ? `${p2name} & ${t2p2name}` : p2name

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">⚾ Uitslag Toevoegen</h3>
        <div className="flex gap-2 mb-4">
          {(['singles', 'doubles'] as const).map(t => (
            <button key={t} onClick={() => setMatchType(t)}
              className={`btn btn-sm flex-1 ${matchType === t ? 'btn-primary' : 'btn-outline'}`}>
              {t === 'singles' ? '🎾 Enkelspel' : '🎾🎾 Dubbelspel'}
            </button>
          ))}
        </div>
        <div className="form-control mb-3">
          <label className="label"><span className="label-text font-semibold">Datum</span></label>
          <input type="date" className="input input-bordered" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className={`grid ${matchType === 'doubles' ? 'grid-cols-1' : 'grid-cols-2'} gap-3 mb-3`}>
          <div>
            <label className="label"><span className="label-text font-semibold">{matchType === 'doubles' ? 'Team 1 - Speler 1' : 'Speler 1'}</span></label>
            <select className="select select-bordered w-full" value={player1} onChange={e => setPlayer1(e.target.value)}>
              <option value="">Kies speler...</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {matchType === 'doubles' && (
            <div>
              <label className="label"><span className="label-text font-semibold">Team 1 - Speler 2</span></label>
              <select className="select select-bordered w-full" value={team1p2} onChange={e => setTeam1p2(e.target.value)}>
                <option value="">Kies partner...</option>
                {players.filter(p => p.id !== parseInt(player1)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label"><span className="label-text font-semibold">{matchType === 'doubles' ? 'Team 2 - Speler 1' : 'Speler 2'}</span></label>
            <select className="select select-bordered w-full" value={player2} onChange={e => setPlayer2(e.target.value)}>
              <option value="">Kies speler...</option>
              {players.filter(p => p.id !== parseInt(player1)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {matchType === 'doubles' && (
            <div>
              <label className="label"><span className="label-text font-semibold">Team 2 - Speler 2</span></label>
              <select className="select select-bordered w-full" value={team2p2} onChange={e => setTeam2p2(e.target.value)}>
                <option value="">Kies partner...</option>
                {players.filter(p => p.id !== parseInt(player1) && p.id !== parseInt(team1p2) && p.id !== parseInt(player2)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="form-control mb-3">
          <label className="label"><span className="label-text font-semibold">Sets</span></label>
          {sets.map((s, i) => (
            <div key={i}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs text-gray-500">{s.stb ? '' : `Set ${i + 1}`}</span>
              <input type="number" min="0" max={s.stb ? 99 : 7} className="input input-bordered input-sm w-16 text-center" placeholder="0" value={s.p1} onChange={e => updateSet(i, 'p1', e.target.value)} />
              <span className="font-bold">-</span>
              <input type="number" min="0" max={s.stb ? 99 : 7} className="input input-bordered input-sm w-16 text-center" placeholder="0" value={s.p2} onChange={e => updateSet(i, 'p2', e.target.value)} />
              <button
                type="button"
                onClick={() => toggleStb(i)}
                className={`btn btn-xs rounded-full border px-3 transition-colors ${s.stb ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-500'}`}
              >
                🏆 Supertiebreak
              </button>
              {sets.length > 1 && <button onClick={() => removeSet(i)} className="btn btn-ghost btn-xs text-red-500">✕</button>}
            </div>
            {parseInt(s.p1) === 6 && parseInt(s.p2) === 6 && !s.stb && (
              <div className="flex items-center gap-1 mt-1 ml-6">
                <span className="text-xs text-gray-500">Tiebreak:</span>
                <input type="number" min="0" max="99" className="input input-bordered input-sm w-14 text-center" placeholder="0" value={s.tb1} onChange={e => updateSet(i, 'tb1', e.target.value)} />
                <span className="font-bold">-</span>
                <input type="number" min="0" max="99" className="input input-bordered input-sm w-14 text-center" placeholder="0" value={s.tb2} onChange={e => updateSet(i, 'tb2', e.target.value)} />
              </div>
            )}
            </div>
          ))}
          <button onClick={addSet} className="btn btn-ghost btn-xs mt-1 self-start">+ Set toevoegen</button>
        </div>
        <div className="form-control mb-3">
          <label className="label"><span className="label-text font-semibold">Winnaar</span></label>
          <div className="flex gap-2">
            {[{ key: 'team1', label: team1Label }, { key: 'team2', label: team2Label }].map(opt => (
              <button key={opt.key} onClick={() => setWinner(opt.key as 'team1' | 'team2')}
                className={`btn btn-sm flex-1 ${winner === opt.key ? 'bg-green-600 border-green-600 text-white font-bold' : 'btn-outline'}`}>
                🏆 {opt.label || (opt.key === 'team1' ? 'Team 1' : 'Team 2')}
              </button>
            ))}
          </div>
        </div>
        <div className="form-control mb-3">
          <label className="label"><span className="label-text font-semibold">Ondergrond</span></label>
          <div className="flex flex-wrap gap-2">
            {SURFACES.map(s => (
              <button key={s} onClick={() => setSurface(s)}
                className={`badge badge-lg cursor-pointer border-2 transition-all ${surface === s ? `${SURFACE_COLORS[s]} border-transparent scale-105` : 'badge-outline border-base-300 opacity-60'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="form-control mb-4">
          <label className="label"><span className="label-text font-semibold">Locatie</span></label>
          <input type="text" className="input input-bordered" placeholder="bijv. E.T.V. de Helster" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text font-semibold">💬 Opmerking <span className="text-gray-400 font-normal">(optioneel)</span></span></label>
          <textarea className="textarea textarea-bordered w-full" rows={2} placeholder="bijv. Geweldige finale!" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="modal-action">
          <button onClick={onClose} className="btn btn-ghost">Annuleren</button>
          <button onClick={handleSave} className="btn btn-primary">💾 Opslaan</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  )
}
