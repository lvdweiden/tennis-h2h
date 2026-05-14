import { useState } from 'react'
import type { Match, Player, Poule } from '../types'
import { SURFACES, SURFACE_COLORS } from '../types'

interface Props {
  match: Match
  players: Player[]
  poules: Poule[]
  onSave: (id: number, updates: Partial<Match>) => void
  onDelete: (id: number) => void
  onClose: () => void
}

export default function EditMatchModal({ match, players, poules, onSave, onDelete, onClose }: Props) {
  const parsedSets: number[][] = (() => { try { return JSON.parse(match.sets) } catch { return [[0,0]] } })()
  const [date, setDate] = useState(match.date)
  const [player1, setPlayer1] = useState(String(match.player1_id))
  const [player2, setPlayer2] = useState(String(match.player2_id))
  const [team1p2, setTeam1p2] = useState(match.team1_player2_id ? String(match.team1_player2_id) : '')
  const [team2p2, setTeam2p2] = useState(match.team2_player2_id ? String(match.team2_player2_id) : '')
  const [winner, setWinner] = useState<'team1' | 'team2'>(match.winner_id === match.player1_id ? 'team1' : 'team2')
  const [sets, setSets] = useState(parsedSets.map(s => ({ p1: String(s[0]), p2: String(s[1]), stb: s[2] === 1 })))
  const [surface, setSurface] = useState(match.surface || 'Kunstgras')
  const [location, setLocation] = useState(match.location || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pouleId, setPouleId] = useState<number | null>(match.poule_id ?? null)

  const addSet = () => setSets([...sets, { p1: '', p2: '', stb: false }])
  const removeSet = (i: number) => setSets(sets.filter((_, idx) => idx !== i))
  const updateSet = (i: number, key: 'p1' | 'p2', val: string) => {
    const s = [...sets]; s[i] = { ...s[i], [key]: val }; setSets(s)
  }
  const toggleStb = (i: number) => {
    const s = [...sets]; s[i] = { ...s[i], stb: !s[i].stb }; setSets(s)
  }

  const handleSave = () => {
    const setsData = sets.map(s => s.stb ? [parseInt(s.p1) || 0, parseInt(s.p2) || 0, 1] : [parseInt(s.p1) || 0, parseInt(s.p2) || 0])
    const p1id = parseInt(player1)
    const p2id = parseInt(player2)
    onSave(match.id, {
      date,
      player1_id: p1id,
      player2_id: p2id,
      winner_id: winner === 'team1' ? p1id : p2id,
      sets: JSON.stringify(setsData),
      surface,
      location,
      team1_player2_id: match.match_type === 'doubles' ? (team1p2 ? parseInt(team1p2) : null) : null,
      team2_player2_id: match.match_type === 'doubles' ? (team2p2 ? parseInt(team2p2) : null) : null,
      poule_id: pouleId,
    })
  }

  const p1name = players.find(p => p.id === parseInt(player1))?.name || 'Team 1'
  const p2name = players.find(p => p.id === parseInt(player2))?.name || 'Team 2'
  const t1p2name = players.find(p => p.id === parseInt(team1p2))?.name || ''
  const t2p2name = players.find(p => p.id === parseInt(team2p2))?.name || ''
  const team1Label = match.match_type === 'doubles' && t1p2name ? `${p1name} & ${t1p2name}` : p1name
  const team2Label = match.match_type === 'doubles' && t2p2name ? `${p2name} & ${t2p2name}` : p2name

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">✏️ Uitslag Bewerken</h3>
        <div className="form-control mb-3">
          <label className="label"><span className="label-text font-semibold">Datum</span></label>
          <input type="date" className="input input-bordered" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {match.match_type === 'doubles' && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label"><span className="label-text font-semibold">Team 1 - Speler 1</span></label>
              <select className="select select-bordered w-full" value={player1} onChange={e => setPlayer1(e.target.value)}>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text font-semibold">Team 1 - Speler 2</span></label>
              <select className="select select-bordered w-full" value={team1p2} onChange={e => setTeam1p2(e.target.value)}>
                <option value="">Kies partner...</option>
                {players.filter(p => p.id !== parseInt(player1)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text font-semibold">Team 2 - Speler 1</span></label>
              <select className="select select-bordered w-full" value={player2} onChange={e => setPlayer2(e.target.value)}>
                {players.filter(p => p.id !== parseInt(player1)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text font-semibold">Team 2 - Speler 2</span></label>
              <select className="select select-bordered w-full" value={team2p2} onChange={e => setTeam2p2(e.target.value)}>
                <option value="">Kies partner...</option>
                {players.filter(p => p.id !== parseInt(player1) && p.id !== parseInt(team1p2) && p.id !== parseInt(player2)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        )}
        {match.match_type === 'singles' && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label"><span className="label-text font-semibold">Speler 1</span></label>
              <select className="select select-bordered w-full" value={player1} onChange={e => setPlayer1(e.target.value)}>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label"><span className="label-text font-semibold">Speler 2</span></label>
              <select className="select select-bordered w-full" value={player2} onChange={e => setPlayer2(e.target.value)}>
                {players.filter(p => p.id !== parseInt(player1)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="form-control mb-3">
          <label className="label"><span className="label-text font-semibold">Sets</span></label>
          {sets.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs text-gray-500">{s.stb ? '' : `Set ${i + 1}`}</span>
              <input type="number" min="0" max={s.stb ? 99 : 7} className="input input-bordered input-sm w-16 text-center" value={s.p1} onChange={e => updateSet(i, 'p1', e.target.value)} />
              <span className="font-bold">-</span>
              <input type="number" min="0" max={s.stb ? 99 : 7} className="input input-bordered input-sm w-16 text-center" value={s.p2} onChange={e => updateSet(i, 'p2', e.target.value)} />
              <button
                type="button"
                onClick={() => toggleStb(i)}
                className={`btn btn-xs rounded-full border px-3 transition-colors ${s.stb ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-500'}`}
              >
                🏆 Supertiebreak
              </button>
              {sets.length > 1 && <button onClick={() => removeSet(i)} className="btn btn-ghost btn-xs text-red-500">✕</button>}
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
                🏆 {opt.label}
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
        {poules.length > 0 && (
          <div className="form-control mb-4">
            <label className="label"><span className="label-text font-semibold">Poule (optioneel)</span></label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setPouleId(null)}
                className={`btn btn-sm ${pouleId === null ? 'btn-primary' : 'btn-outline'}`}>
                Geen poule
              </button>
              {poules.map(p => (
                <button key={p.id} onClick={() => setPouleId(p.id)}
                  className={`btn btn-sm ${pouleId === p.id ? 'btn-primary' : 'btn-outline'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="modal-action justify-between">
          <div>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="btn btn-outline btn-error btn-sm">🗑️ Verwijderen</button>
            ) : (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-red-500">Zeker weten?</span>
                <button onClick={() => onDelete(match.id)} className="btn btn-error btn-sm">Ja, verwijder</button>
                <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost btn-sm">Nee</button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">Annuleren</button>
            <button onClick={handleSave} className="btn btn-primary">💾 Opslaan</button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  )
}
