import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import type { Player } from '../types'

interface Variant {
  id: number
  name: string
  description?: string
}

interface VariantMatch {
  id: number
  variant_id: number
  date: string
  player1_id: number
  player2_id: number
  winner_id: number
  location?: string | null
  notes?: string | null
}

interface MatchForm {
  date: string
  player1_id: number | null
  player2_id: number | null
  winner_id: number | null
  location: string
  notes: string
}

const PIN = '2729'
const formatDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}-${m}-${y}` }
const today = () => new Date().toISOString().split('T')[0]

function emptyForm(p1?: number | null, p2?: number | null): MatchForm {
  return { date: today(), player1_id: p1 ?? null, player2_id: p2 ?? null, winner_id: null, location: '', notes: '' }
}

interface SearchDropProps {
  players: Player[]
  selected: Player | null
  onSelect: (p: Player | null) => void
  placeholder: string
  exclude?: number | null
}

function SearchDrop({ players, selected, onSelect, placeholder, exclude }: SearchDropProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = players.filter(p => p.id !== exclude && p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div ref={ref} className="relative flex-1">
      <div
        className="input input-bordered w-full flex items-center justify-between cursor-pointer text-sm px-3 py-2 h-auto min-h-[2.5rem]"
        onClick={() => { setOpen(o => !o); setSearch('') }}
      >
        <span className={selected ? 'font-semibold text-gray-900' : 'text-gray-400'}>{selected ? selected.name : placeholder}</span>
        <span className="text-gray-400 ml-1">▾</span>
      </div>
      {open && (
        <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 w-full max-h-60 overflow-y-auto">
          <div className="p-2 border-b">
            <input autoFocus className="input input-bordered input-sm w-full" placeholder="Zoek speler..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {selected && (
            <button className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50" onClick={() => { onSelect(null); setOpen(false) }}>✕ Wis selectie</button>
          )}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Geen spelers gevonden</div>}
          {filtered.map(p => (
            <button key={p.id} className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 ${selected?.id === p.id ? 'bg-green-100 font-semibold' : ''}`}
              onClick={() => { onSelect(p); setOpen(false); setSearch('') }}>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  players: Player[]
  isUnlocked: boolean
  onRequestUnlock: () => void
}

export default function VariantenView({ players, isUnlocked, onRequestUnlock }: Props) {
  const [variants, setVariants] = useState<Variant[]>([])
  const [matches, setMatches] = useState<VariantMatch[]>([])
  const [showMatches, setShowMatches] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)
  const [loading, setLoading] = useState(true)
  const [playerA, setPlayerA] = useState<Player | null>(null)
  const [playerB, setPlayerB] = useState<Player | null>(null)

  // Add match modal
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<MatchForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  // Edit/detail popup
  const [detailMatch, setDetailMatch] = useState<VariantMatch | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<MatchForm>(emptyForm())
  const [deletePin, setDeletePin] = useState('')
  const [deletePinError, setDeletePinError] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Add variant modal
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [newVariantName, setNewVariantName] = useState('')
  const [newVariantDesc, setNewVariantDesc] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: vData }, { data: mData }] = await Promise.all([
        supabase.from('tennis_variants').select('*').order('created_at'),
        supabase.from('tennis_variant_matches').select('*').order('date', { ascending: false })
      ])
      const vs = vData || []
      setVariants(vs)
      setMatches(mData || [])
      if (vs.length > 0) setSelectedVariant(vs[0])
      setLoading(false)
    }
    load()
  }, [])

  const variantMatches = selectedVariant ? matches.filter(m => m.variant_id === selectedVariant.id) : []

  // Reset showMatches when players change
  useEffect(() => { setShowMatches(false) }, [playerA?.id, playerB?.id])

  const h2hMatches = (playerA && playerB)
    ? variantMatches.filter(m =>
        (m.player1_id === playerA.id && m.player2_id === playerB.id) ||
        (m.player1_id === playerB.id && m.player2_id === playerA.id)
      )
    : []

  const winsA = playerA ? h2hMatches.filter(m => m.winner_id === playerA.id).length : 0
  const winsB = playerB ? h2hMatches.filter(m => m.winner_id === playerB.id).length : 0

  async function handleAddMatch() {
    if (!selectedVariant || !addForm.player1_id || !addForm.player2_id || !addForm.winner_id || !addForm.date) return
    setSaving(true)
    const { data: newMatch } = await supabase.from('tennis_variant_matches').insert({
      variant_id: selectedVariant.id,
      date: addForm.date,
      player1_id: addForm.player1_id,
      player2_id: addForm.player2_id,
      winner_id: addForm.winner_id,
      location: addForm.location || null,
      notes: addForm.notes || null,
    }).select().single()
    if (newMatch) setMatches(prev => [newMatch, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
    setSaving(false)
    setShowAdd(false)
    setAddForm(emptyForm(playerA?.id, playerB?.id))
  }

  async function handleSaveEdit() {
    if (!detailMatch || !editForm.player1_id || !editForm.player2_id || !editForm.winner_id) return
    setSaving(true)
    const update = {
      date: editForm.date,
      player1_id: editForm.player1_id,
      player2_id: editForm.player2_id,
      winner_id: editForm.winner_id,
      location: editForm.location || null,
      notes: editForm.notes || null,
    }
    await supabase.from('tennis_variant_matches').update(update).eq('id', detailMatch.id)
    setMatches(prev => prev.map(m => m.id === detailMatch.id ? { ...m, ...update } : m))
    setSaving(false)
    setEditing(false)
    setDetailMatch(null)
  }

  async function handleDelete() {
    if (!detailMatch) return
    if (deletePin !== PIN) { setDeletePinError(true); return }
    await supabase.from('tennis_variant_matches').delete().eq('id', detailMatch.id)
    setMatches(prev => prev.filter(m => m.id !== detailMatch.id))
    setDetailMatch(null)
    setShowDeleteConfirm(false)
    setDeletePin('')
    setDeletePinError(false)
  }

  async function handleAddVariant() {
    if (!newVariantName.trim()) return
    const { data } = await supabase.from('tennis_variants').insert({ name: newVariantName.trim(), description: newVariantDesc.trim() || null }).select().single()
    if (data) {
      setVariants(prev => [...prev, data])
      setSelectedVariant(data)
    }
    setNewVariantName('')
    setNewVariantDesc('')
    setShowAddVariant(false)
  }

  if (loading) return <div className="text-center py-20"><span className="loading loading-spinner loading-lg text-green-600"></span></div>

  return (
    <div>
      {/* Variant tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {variants.map(v => (
          <button key={v.id} onClick={() => setSelectedVariant(v)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${selectedVariant?.id === v.id ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            {v.name}
          </button>
        ))}
        {isUnlocked && (
          <button onClick={() => setShowAddVariant(true)}
            className="px-3 py-2 rounded-full text-sm font-semibold border border-dashed border-gray-400 text-gray-500 hover:bg-gray-50">
            + Variant
          </button>
        )}
        {!isUnlocked && (
          <button onClick={onRequestUnlock} className="px-3 py-2 rounded-full text-sm text-gray-400 border border-dashed border-gray-300 hover:bg-gray-50">
            🔒 + Variant
          </button>
        )}
      </div>

      {variants.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🎮</div>
          <p className="font-medium">Nog geen varianten</p>
          <p className="text-sm">Ontgrendel en voeg een variant toe</p>
        </div>
      )}

      {selectedVariant && (
        <div className="card bg-base-100 shadow-md mb-4">
          <div className="card-body py-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg">🎮 {selectedVariant.name}</h2>
              {isUnlocked && (
                <button onClick={() => { setAddForm(emptyForm(playerA?.id, playerB?.id)); setShowAdd(true) }}
                  className="btn btn-sm bg-green-600 text-white hover:bg-green-700 border-0">
                  + Wedstrijd
                </button>
              )}
              {!isUnlocked && (
                <button onClick={onRequestUnlock} className="btn btn-sm btn-ghost text-gray-500">🔒 + Wedstrijd</button>
              )}
            </div>
            {selectedVariant.description && (
              <p className="text-xs text-gray-400 mb-3">{selectedVariant.description}</p>
            )}

            {/* Player selectors */}
            <div className="flex items-center gap-2 mb-4">
              <SearchDrop players={players} selected={playerA} onSelect={setPlayerA} placeholder="Speler A" exclude={playerB?.id} />
              <span className="font-bold text-gray-400">vs</span>
              <SearchDrop players={players} selected={playerB} onSelect={setPlayerB} placeholder="Speler B" exclude={playerA?.id} />
            </div>

            {/* H2H record */}
            {playerA && playerB && (
              <div
                className="flex items-center justify-center gap-6 py-3 px-4 bg-gray-50 rounded-xl mb-4 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => h2hMatches.length > 0 && setShowMatches(s => !s)}
              >
                <div className="text-center">
                  <div className="text-2xl font-black text-green-600">{winsA}</div>
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-100">{playerA.name.split(' ')[0]}</div>
                </div>
                <div className="text-center flex flex-col items-center">
                  <div className="text-xs text-gray-400 font-medium">{h2hMatches.length} gespeeld</div>
                  <div className="text-lg font-bold text-gray-400">–</div>
                  {h2hMatches.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">{showMatches ? '▲ verberg' : '▼ toon'}</div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-green-600">{winsB}</div>
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-100">{playerB.name.split(' ')[0]}</div>
                </div>
              </div>
            )}

            {/* Match list */}
            {!playerA || !playerB ? (
              <div className="text-center text-gray-400 py-6 text-sm">
                Kies twee spelers om het H2H record te zien
              </div>
            ) : h2hMatches.length === 0 ? (
              <div className="text-center text-gray-400 py-6 text-sm">
                Nog geen wedstrijden tussen {playerA.name.split(' ')[0]} en {playerB.name.split(' ')[0]}
              </div>
            ) : null}
            {showMatches && (
            <div className="space-y-2">
              {h2hMatches.map(m => {
                const p1 = players.find(p => p.id === m.player1_id)
                const p2 = players.find(p => p.id === m.player2_id)
                const winner = players.find(p => p.id === m.winner_id)
                const loser = m.winner_id === m.player1_id ? p2 : p1
                return (
                  <div key={m.id} className="border border-gray-100 rounded-xl px-4 py-3 bg-white shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => { setDetailMatch(m); setEditing(false) }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs text-gray-400">{formatDate(m.date)}</span>
                          {m.location && <span className="text-xs text-gray-400">📍 {m.location}</span>}
                        </div>
                        <div className="text-sm">
                          <span className="font-bold text-green-600">🏆 {winner?.name}</span>
                          <span className="text-gray-400 mx-2">vs</span>
                          <span className="text-gray-500">{loser?.name}</span>
                        </div>
                        {m.notes && <div className="text-xs text-gray-400 mt-1">💬 {m.notes}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Add Match Modal */}
      {showAdd && selectedVariant && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">+ {selectedVariant.name} wedstrijd</h3>
            <div className="space-y-3">
              <div>
                <label className="label label-text text-xs font-semibold">Datum</label>
                <input type="date" className="input input-bordered w-full" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="label label-text text-xs font-semibold">Speler 1</label>
                <select className="select select-bordered w-full" value={addForm.player1_id ?? ''} onChange={e => setAddForm(f => ({ ...f, player1_id: Number(e.target.value) || null, winner_id: null }))}>
                  <option value="">Kies speler...</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label label-text text-xs font-semibold">Speler 2</label>
                <select className="select select-bordered w-full" value={addForm.player2_id ?? ''} onChange={e => setAddForm(f => ({ ...f, player2_id: Number(e.target.value) || null, winner_id: null }))}>
                  <option value="">Kies speler...</option>
                  {players.filter(p => p.id !== addForm.player1_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {addForm.player1_id && addForm.player2_id && (
                <div>
                  <label className="label label-text text-xs font-semibold">Winnaar</label>
                  <div className="flex gap-2">
                    {[addForm.player1_id, addForm.player2_id].map(pid => {
                      const p = players.find(x => x.id === pid)
                      const isWinner = addForm.winner_id === pid
                      return (
                        <button key={pid} onClick={() => setAddForm(f => ({ ...f, winner_id: pid }))}
                          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors border-2 ${isWinner ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'}`}>
                          🏆 {p?.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="label label-text text-xs font-semibold">Locatie (optioneel)</label>
                <input type="text" className="input input-bordered w-full" placeholder="bijv. Smash Utrecht" value={addForm.location} onChange={e => setAddForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <label className="label label-text text-xs font-semibold">Opmerking (optioneel)</label>
                <textarea className="textarea textarea-bordered w-full" rows={2} placeholder="Bijv. spannende finale..." value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-action">
              <button onClick={() => setShowAdd(false)} className="btn btn-ghost">Annuleren</button>
              <button onClick={handleAddMatch} disabled={saving || !addForm.player1_id || !addForm.player2_id || !addForm.winner_id || !addForm.date}
                className="btn bg-green-600 text-white hover:bg-green-700 border-0">
                {saving ? <span className="loading loading-spinner loading-sm"></span> : 'Opslaan'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAdd(false)}></div>
        </div>
      )}

      {/* Detail / Edit popup */}
      {detailMatch && (() => {
        const p1 = players.find(p => p.id === detailMatch.player1_id)
        const p2 = players.find(p => p.id === detailMatch.player2_id)
        const winner = players.find(p => p.id === detailMatch.winner_id)
        const loser = detailMatch.winner_id === detailMatch.player1_id ? p2 : p1
        return (
          <div className="modal modal-open">
            <div className="modal-box max-w-sm" style={{ background: 'white', color: '#111' }}>
              {!editing && !showDeleteConfirm && (
                <>
                  <h3 className="font-bold text-lg mb-3">🎮 {selectedVariant?.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-semibold">📅 Datum:</span> {formatDate(detailMatch.date)}</div>
                    {detailMatch.location && <div><span className="font-semibold">📍 Locatie:</span> {detailMatch.location}</div>}
                    <div><span className="font-semibold">🏆 Winnaar:</span> <span className="text-green-600 font-bold">{winner?.name}</span></div>
                    <div><span className="font-semibold">❌ Verliezer:</span> {loser?.name}</div>
                    {detailMatch.notes && <div><span className="font-semibold">💬 Opmerking:</span> {detailMatch.notes}</div>}
                  </div>
                  <div className="modal-action flex gap-2 justify-between">
                    <button onClick={() => setDetailMatch(null)} className="btn btn-ghost" style={{ color: '#555' }}>Sluiten</button>
                    {isUnlocked && (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditing(true); setEditForm({ date: detailMatch.date, player1_id: detailMatch.player1_id, player2_id: detailMatch.player2_id, winner_id: detailMatch.winner_id, location: detailMatch.location || '', notes: detailMatch.notes || '' }) }}
                          className="btn btn-sm btn-outline" style={{ color: '#333', borderColor: '#999' }}>✏️ Bewerken</button>
                        <button onClick={() => setShowDeleteConfirm(true)} className="btn btn-sm btn-error">🗑️</button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {editing && (
                <>
                  <h3 className="font-bold text-lg mb-4">✏️ Wedstrijd bewerken</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="label label-text text-xs font-semibold" style={{ color: '#555' }}>Datum</label>
                      <input type="date" className="input input-bordered w-full" style={{ color: '#111', background: 'white' }} value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label label-text text-xs font-semibold" style={{ color: '#555' }}>Speler 1</label>
                      <select className="select select-bordered w-full" style={{ color: '#111', background: 'white' }} value={editForm.player1_id ?? ''} onChange={e => setEditForm(f => ({ ...f, player1_id: Number(e.target.value) || null, winner_id: null }))}>
                        {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label label-text text-xs font-semibold" style={{ color: '#555' }}>Speler 2</label>
                      <select className="select select-bordered w-full" style={{ color: '#111', background: 'white' }} value={editForm.player2_id ?? ''} onChange={e => setEditForm(f => ({ ...f, player2_id: Number(e.target.value) || null, winner_id: null }))}>
                        {players.filter(p => p.id !== editForm.player1_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {editForm.player1_id && editForm.player2_id && (
                      <div>
                        <label className="label label-text text-xs font-semibold" style={{ color: '#555' }}>Winnaar</label>
                        <div className="flex gap-2">
                          {[editForm.player1_id, editForm.player2_id].map(pid => {
                            const p = players.find(x => x.id === pid)
                            const isWinner = editForm.winner_id === pid
                            return (
                              <button key={pid} onClick={() => setEditForm(f => ({ ...f, winner_id: pid }))}
                                className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${isWinner ? 'bg-green-600 text-white border-green-600' : 'bg-white border-gray-300 hover:border-green-400'}`} style={{ color: isWinner ? 'white' : '#333' }}>
                                🏆 {p?.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="label label-text text-xs font-semibold" style={{ color: '#555' }}>Locatie</label>
                      <input type="text" className="input input-bordered w-full" style={{ color: '#111', background: 'white' }} value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label label-text text-xs font-semibold" style={{ color: '#555' }}>Opmerking</label>
                      <textarea className="textarea textarea-bordered w-full" style={{ color: '#111', background: 'white' }} rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="modal-action gap-2">
                    <button onClick={() => setEditing(false)} className="btn btn-ghost" style={{ color: '#555' }}>Annuleren</button>
                    <button onClick={handleSaveEdit} disabled={saving || !editForm.winner_id}
                      className="btn bg-green-600 text-white hover:bg-green-700 border-0">
                      {saving ? <span className="loading loading-spinner loading-sm"></span> : 'Opslaan'}
                    </button>
                  </div>
                </>
              )}

              {showDeleteConfirm && (
                <>
                  <h3 className="font-bold text-lg mb-2 text-center" style={{ color: '#111' }}>🗑️ Verwijderen</h3>
                  <p className="text-sm text-center mb-4" style={{ color: '#555' }}>Voer de pincode in om deze wedstrijd te verwijderen</p>
                  <input type="password" inputMode="numeric" maxLength={6}
                    className={`input input-bordered w-full text-center text-2xl tracking-widest mb-2 ${deletePinError ? 'input-error' : ''}`}
                    style={{ color: '#111', background: 'white' }}
                    placeholder="••••" value={deletePin}
                    onChange={e => { setDeletePin(e.target.value); setDeletePinError(false) }}
                    onKeyDown={e => e.key === 'Enter' && handleDelete()}
                    autoFocus
                  />
                  {deletePinError && <p className="text-error text-sm text-center mb-2">Onjuiste pincode</p>}
                  <div className="modal-action justify-center gap-2">
                    <button onClick={() => { setShowDeleteConfirm(false); setDeletePin(''); setDeletePinError(false) }} className="btn btn-ghost" style={{ color: '#555' }}>Annuleren</button>
                    <button onClick={handleDelete} disabled={!deletePin} className="btn btn-error">Verwijderen</button>
                  </div>
                </>
              )}
            </div>
            <div className="modal-backdrop" onClick={() => { setDetailMatch(null); setEditing(false); setShowDeleteConfirm(false); setDeletePin('') }}></div>
          </div>
        )
      })()}

      {/* Add variant modal */}
      {showAddVariant && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">🎮 Nieuwe variant</h3>
            <div className="space-y-3">
              <div>
                <label className="label label-text text-xs font-semibold">Naam</label>
                <input type="text" className="input input-bordered w-full" placeholder="bijv. King of the Court" value={newVariantName} onChange={e => setNewVariantName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label label-text text-xs font-semibold">Omschrijving (optioneel)</label>
                <textarea className="textarea textarea-bordered w-full" rows={2} placeholder="Hoe werkt het spel?" value={newVariantDesc} onChange={e => setNewVariantDesc(e.target.value)} />
              </div>
            </div>
            <div className="modal-action">
              <button onClick={() => { setShowAddVariant(false); setNewVariantName(''); setNewVariantDesc('') }} className="btn btn-ghost">Annuleren</button>
              <button onClick={handleAddVariant} disabled={!newVariantName.trim()} className="btn bg-green-600 text-white hover:bg-green-700 border-0">Toevoegen</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAddVariant(false)}></div>
        </div>
      )}
    </div>
  )
}
