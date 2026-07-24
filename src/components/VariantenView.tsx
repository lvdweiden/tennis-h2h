import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import type { Player } from '../types'

type ScoreType = 'winner_only' | 'score_to_x' | 'sets'

interface Variant {
  id: number
  name: string
  description?: string
  score_type: ScoreType
  target_score?: number | null
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
  score?: any
}

interface MatchForm {
  date: string
  player1_id: number | null
  player2_id: number | null
  winner_id: number | null
  location: string
  notes: string
  p1_score: string
  p2_score: string
  sets: Array<[string, string]>
}

const PIN = '2729'
const formatDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}-${m}-${y}` }
const today = () => new Date().toISOString().split('T')[0]

function emptyForm(p1?: number | null, p2?: number | null): MatchForm {
  return { date: today(), player1_id: p1 ?? null, player2_id: p2 ?? null, winner_id: null, location: '', notes: '', p1_score: '', p2_score: '', sets: [['', '']] }
}

// Auto-detect winner from score
function detectWinner(form: MatchForm, scoreType: ScoreType, p1Id: number | null, p2Id: number | null): number | null {
  if (!p1Id || !p2Id) return null
  if (scoreType === 'score_to_x') {
    const s1 = parseInt(form.p1_score)
    const s2 = parseInt(form.p2_score)
    if (!isNaN(s1) && !isNaN(s2) && s1 !== s2) return s1 > s2 ? p1Id : p2Id
  } else if (scoreType === 'sets') {
    let w1 = 0, w2 = 0
    for (const [a, b] of form.sets) {
      const sa = parseInt(a), sb = parseInt(b)
      if (!isNaN(sa) && !isNaN(sb) && sa !== sb) { if (sa > sb) w1++; else w2++ }
    }
    if (w1 !== w2) return w1 > w2 ? p1Id : p2Id
  }
  return null
}

function buildScore(form: MatchForm, scoreType: ScoreType): any {
  if (scoreType === 'score_to_x') {
    const s1 = parseInt(form.p1_score), s2 = parseInt(form.p2_score)
    if (!isNaN(s1) && !isNaN(s2)) return [s1, s2]
  } else if (scoreType === 'sets') {
    const result = form.sets.map(([a, b]) => [parseInt(a) || 0, parseInt(b) || 0])
    if (result.length > 0) return result
  }
  return null
}

function displayScore(match: VariantMatch, variant: Variant, players: Player[]) {
  const p1 = players.find(p => p.id === match.player1_id)
  const p2 = players.find(p => p.id === match.player2_id)
  const winner = players.find(p => p.id === match.winner_id)
  const loser = match.winner_id === match.player1_id ? p2 : p1

  if (variant.score_type === 'score_to_x' && Array.isArray(match.score) && match.score.length === 2) {
    const [s1, s2] = match.score
    // show score in winner–loser order
    const winnerScore = match.winner_id === match.player1_id ? s1 : s2
    const loserScore = match.winner_id === match.player1_id ? s2 : s1
    return (
      <div className="text-sm">
        <span className="font-bold text-green-600">🏆 {winner?.name}</span>
        <span className="font-bold text-green-600 mx-2">{winnerScore}</span>
        <span className="text-gray-400">–</span>
        <span className="text-gray-500 mx-2">{loserScore}</span>
        <span className="text-gray-500">{loser?.name}</span>
      </div>
    )
  } else if (variant.score_type === 'sets' && Array.isArray(match.score)) {
    const sets = match.score as number[][]
    const setsP1 = sets.filter(([a, b]) => a > b).length
    const setsP2 = sets.filter(([a, b]) => b > a).length
    const winnerSets = match.winner_id === match.player1_id ? setsP1 : setsP2
    const loserSets = match.winner_id === match.player1_id ? setsP2 : setsP1
    const setStr = sets.map(([a, b]) => {
      const p1wins = match.winner_id === match.player1_id
      return p1wins ? `${a}-${b}` : `${b}-${a}`
    }).join(', ')
    return (
      <div className="text-sm">
        <span className="font-bold text-green-600">🏆 {winner?.name}</span>
        <span className="font-bold text-green-600 mx-2">{winnerSets}</span>
        <span className="text-gray-400">–</span>
        <span className="text-gray-500 mx-2">{loserSets}</span>
        <span className="text-gray-500">{loser?.name}</span>
        <span className="text-xs text-gray-400 ml-2">({setStr})</span>
      </div>
    )
  }
  // winner_only fallback
  return (
    <div className="text-sm">
      <span className="font-bold text-green-600">🏆 {winner?.name}</span>
      <span className="text-gray-400 mx-2">vs</span>
      <span className="text-gray-500">{loser?.name}</span>
    </div>
  )
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
        <span className={selected ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-400'}>{selected ? selected.name : placeholder}</span>
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
            <button key={p.id} className={`w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-green-50 ${selected?.id === p.id ? 'bg-green-100 font-semibold' : ''}`}
              onClick={() => { onSelect(p); setOpen(false); setSearch('') }}>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Score input component for add/edit forms
function ScoreInput({ form, setForm, variant, darkBg }: {
  form: MatchForm,
  setForm: (f: (prev: MatchForm) => MatchForm) => void,
  variant: Variant,
  darkBg?: boolean
}) {
  const inputStyle = darkBg ? { color: '#111', background: 'white' } : {}
  const labelStyle = darkBg ? { color: '#555' } : {}

  if (variant.score_type === 'score_to_x') {
    const p1Name = form.player1_id ? undefined : 'Speler 1'
    const p2Name = form.player2_id ? undefined : 'Speler 2'
    return (
      <div>
        <label className="label label-text text-xs font-semibold" style={labelStyle}>
          Score {variant.target_score ? `(tot ${variant.target_score})` : ''}
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 text-center">{p1Name ?? 'Speler 1'}</div>
            <input type="number" min={0} max={999} className="input input-bordered w-full text-center text-lg font-bold" style={inputStyle}
              placeholder="0" value={form.p1_score}
              onChange={e => setForm(f => ({ ...f, p1_score: e.target.value }))} />
          </div>
          <div className="text-xl font-bold text-gray-400 mt-4">–</div>
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 text-center">{p2Name ?? 'Speler 2'}</div>
            <input type="number" min={0} max={999} className="input input-bordered w-full text-center text-lg font-bold" style={inputStyle}
              placeholder="0" value={form.p2_score}
              onChange={e => setForm(f => ({ ...f, p2_score: e.target.value }))} />
          </div>
        </div>
      </div>
    )
  }

  if (variant.score_type === 'sets') {
    return (
      <div>
        <label className="label label-text text-xs font-semibold" style={labelStyle}>Sets</label>
        <div className="space-y-2">
          {form.sets.map((set, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-10">Set {i + 1}</span>
              <input type="number" min={0} max={99} className="input input-bordered w-16 text-center font-bold" style={inputStyle}
                placeholder="0" value={set[0]}
                onChange={e => setForm(f => { const s = [...f.sets]; s[i] = [e.target.value, s[i][1]]; return { ...f, sets: s } })} />
              <span className="font-bold text-gray-400">–</span>
              <input type="number" min={0} max={99} className="input input-bordered w-16 text-center font-bold" style={inputStyle}
                placeholder="0" value={set[1]}
                onChange={e => setForm(f => { const s = [...f.sets]; s[i] = [s[i][0], e.target.value]; return { ...f, sets: s } })} />
              {form.sets.length > 1 && (
                <button type="button" className="btn btn-xs btn-ghost text-gray-400"
                  onClick={() => setForm(f => ({ ...f, sets: f.sets.filter((_, j) => j !== i) }))}>✕</button>
              )}
            </div>
          ))}
          {form.sets.length < 5 && (
            <button type="button" className="btn btn-xs btn-ghost text-green-600"
              onClick={() => setForm(f => ({ ...f, sets: [...f.sets, ['', '']] }))}>
              + Set toevoegen
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
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
  const [newVariantScoreType, setNewVariantScoreType] = useState<ScoreType>('winner_only')
  const [newVariantTarget, setNewVariantTarget] = useState('')

  // Delete variant modal
  const [showDeleteVariant, setShowDeleteVariant] = useState(false)
  const [deleteVariantPin, setDeleteVariantPin] = useState('')
  const [deleteVariantPinError, setDeleteVariantPinError] = useState(false)
  const [deletingVariant, setDeletingVariant] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: vData }, { data: mData }] = await Promise.all([
        supabase.from('tennis_variants').select('*').order('created_at'),
        supabase.from('tennis_variant_matches').select('*').order('date', { ascending: false })
      ])
      const vs = (vData || []).map((v: any) => ({ ...v, score_type: v.score_type || 'winner_only' }))
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

  function getWinnerFromForm(form: MatchForm): number | null {
    if (!selectedVariant) return form.winner_id
    if (selectedVariant.score_type === 'winner_only') return form.winner_id
    const auto = detectWinner(form, selectedVariant.score_type, form.player1_id, form.player2_id)
    return auto ?? form.winner_id
  }

  async function handleAddMatch() {
    if (!selectedVariant || !addForm.player1_id || !addForm.player2_id || !addForm.date) return
    const winnerId = getWinnerFromForm(addForm)
    if (!winnerId) return
    setSaving(true)
    const scoreData = buildScore(addForm, selectedVariant.score_type)
    const { data: newMatch } = await supabase.from('tennis_variant_matches').insert({
      variant_id: selectedVariant.id,
      date: addForm.date,
      player1_id: addForm.player1_id,
      player2_id: addForm.player2_id,
      winner_id: winnerId,
      location: addForm.location || null,
      notes: addForm.notes || null,
      score: scoreData,
    }).select().single()
    if (newMatch) setMatches(prev => [newMatch, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
    setSaving(false)
    setShowAdd(false)
    setAddForm(emptyForm(playerA?.id, playerB?.id))
  }

  async function handleSaveEdit() {
    if (!detailMatch || !selectedVariant || !editForm.player1_id || !editForm.player2_id) return
    const winnerId = getWinnerFromForm(editForm)
    if (!winnerId) return
    setSaving(true)
    const scoreData = buildScore(editForm, selectedVariant.score_type)
    const update = {
      date: editForm.date,
      player1_id: editForm.player1_id,
      player2_id: editForm.player2_id,
      winner_id: winnerId,
      location: editForm.location || null,
      notes: editForm.notes || null,
      score: scoreData,
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

  async function handleDeleteVariant() {
    if (deleteVariantPin !== PIN) { setDeleteVariantPinError(true); return }
    if (!selectedVariant) return
    setDeletingVariant(true)
    await supabase.from('tennis_variant_matches').delete().eq('variant_id', selectedVariant.id)
    await supabase.from('tennis_variants').delete().eq('id', selectedVariant.id)
    const remaining = variants.filter(v => v.id !== selectedVariant.id)
    setVariants(remaining)
    setMatches(prev => prev.filter(m => m.variant_id !== selectedVariant.id))
    setSelectedVariant(remaining.length > 0 ? remaining[0] : null)
    setShowDeleteVariant(false)
    setDeleteVariantPin('')
    setDeleteVariantPinError(false)
    setDeletingVariant(false)
  }

  async function handleAddVariant() {
    if (!newVariantName.trim()) return
    const target = newVariantScoreType === 'score_to_x' && newVariantTarget ? parseInt(newVariantTarget) : null
    const { data } = await supabase.from('tennis_variants').insert({
      name: newVariantName.trim(),
      description: newVariantDesc.trim() || null,
      score_type: newVariantScoreType,
      target_score: target,
    }).select().single()
    if (data) {
      const v = { ...data, score_type: data.score_type || 'winner_only' }
      setVariants(prev => [...prev, v])
      setSelectedVariant(v)
    }
    setNewVariantName('')
    setNewVariantDesc('')
    setNewVariantScoreType('winner_only')
    setNewVariantTarget('')
    setShowAddVariant(false)
  }

  // Helper: load score into edit form
  function loadScoreIntoForm(match: VariantMatch, variant: Variant): Partial<MatchForm> {
    if (variant.score_type === 'score_to_x' && Array.isArray(match.score) && match.score.length === 2) {
      return { p1_score: String(match.score[0]), p2_score: String(match.score[1]) }
    }
    if (variant.score_type === 'sets' && Array.isArray(match.score)) {
      return { sets: (match.score as number[][]).map(([a, b]) => [String(a), String(b)] as [string, string]) }
    }
    return { p1_score: '', p2_score: '', sets: [['', '']] }
  }

  // Can save match?
  function canSave(form: MatchForm): boolean {
    if (!form.player1_id || !form.player2_id || !form.date) return false
    if (!selectedVariant) return false
    if (selectedVariant.score_type === 'winner_only') return !!form.winner_id
    if (selectedVariant.score_type === 'score_to_x') {
      return form.p1_score !== '' && form.p2_score !== '' && form.p1_score !== form.p2_score
    }
    if (selectedVariant.score_type === 'sets') {
      const validSets = form.sets.filter(([a, b]) => a !== '' && b !== '' && parseInt(a) !== parseInt(b))
      return validSets.length > 0
    }
    return false
  }

  if (loading) return <div className="text-center py-20"><span className="loading loading-spinner loading-lg text-green-600"></span></div>

  const scoreTypeLabel: Record<ScoreType, string> = {
    winner_only: 'Alleen winnaar',
    score_to_x: 'Score (getal)',
    sets: 'Sets',
  }

  return (
    <div>
      {/* Variant tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {variants.map(v => (
          <div key={v.id} className="flex items-center gap-1">
            <button onClick={() => setSelectedVariant(v)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${selectedVariant?.id === v.id ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              {v.name}
            </button>
            {isUnlocked && selectedVariant?.id === v.id && (
              <button
                onClick={() => { setShowDeleteVariant(true); setDeleteVariantPin(''); setDeleteVariantPinError(false) }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-xs"
                title="Variant verwijderen">
                🗑️
              </button>
            )}
          </div>
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
              <div>
                <h2 className="font-bold text-lg">🎮 {selectedVariant.name}</h2>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {scoreTypeLabel[selectedVariant.score_type]}
                  {selectedVariant.score_type === 'score_to_x' && selectedVariant.target_score ? ` tot ${selectedVariant.target_score}` : ''}
                </span>
              </div>
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
                {h2hMatches.map(m => (
                  <div key={m.id} className="border border-gray-100 rounded-xl px-4 py-3 bg-white shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => { setDetailMatch(m); setEditing(false) }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs text-gray-400">{formatDate(m.date)}</span>
                          {m.location && <span className="text-xs text-gray-400">📍 {m.location}</span>}
                        </div>
                        {displayScore(m, selectedVariant, players)}
                        {m.notes && <div className="text-xs text-gray-400 mt-1">💬 {m.notes}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Match Modal */}
      {showAdd && selectedVariant && (() => {
        const autoWinner = selectedVariant.score_type !== 'winner_only'
          ? detectWinner(addForm, selectedVariant.score_type, addForm.player1_id, addForm.player2_id)
          : null
        const autoWinnerName = autoWinner ? players.find(p => p.id === autoWinner)?.name : null
        return (
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

                {/* Score input or winner selector */}
                {addForm.player1_id && addForm.player2_id && selectedVariant.score_type !== 'winner_only' && (
                  <ScoreInput form={addForm} setForm={setAddForm} variant={selectedVariant} />
                )}
                {addForm.player1_id && addForm.player2_id && selectedVariant.score_type !== 'winner_only' && autoWinnerName && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <span className="text-green-700 text-sm">🏆 Winnaar: <strong>{autoWinnerName}</strong></span>
                  </div>
                )}
                {addForm.player1_id && addForm.player2_id && selectedVariant.score_type === 'winner_only' && (
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
                <button onClick={handleAddMatch} disabled={saving || !canSave(addForm)}
                  className="btn bg-green-600 text-white hover:bg-green-700 border-0">
                  {saving ? <span className="loading loading-spinner loading-sm"></span> : 'Opslaan'}
                </button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setShowAdd(false)}></div>
          </div>
        )
      })()}

      {/* Detail / Edit popup */}
      {detailMatch && selectedVariant && (() => {
        const p1 = players.find(p => p.id === detailMatch.player1_id)
        const p2 = players.find(p => p.id === detailMatch.player2_id)
        const winner = players.find(p => p.id === detailMatch.winner_id)
        const loser = detailMatch.winner_id === detailMatch.player1_id ? p2 : p1
        const autoWinner = selectedVariant.score_type !== 'winner_only'
          ? detectWinner(editForm, selectedVariant.score_type, editForm.player1_id, editForm.player2_id)
          : null
        const autoWinnerName = autoWinner ? players.find(p => p.id === autoWinner)?.name : null
        return (
          <div className="modal modal-open">
            <div className="modal-box max-w-sm" style={{ background: 'white', color: '#111' }}>
              {!editing && !showDeleteConfirm && (
                <>
                  <h3 className="font-bold text-lg mb-3">🎮 {selectedVariant.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-semibold">📅 Datum:</span> {formatDate(detailMatch.date)}</div>
                    {detailMatch.location && <div><span className="font-semibold">📍 Locatie:</span> {detailMatch.location}</div>}
                    {selectedVariant.score_type === 'score_to_x' && Array.isArray(detailMatch.score) && (
                      <div><span className="font-semibold">🎯 Score:</span> {p1?.name} {detailMatch.score[0]} – {detailMatch.score[1]} {p2?.name}</div>
                    )}
                    {selectedVariant.score_type === 'sets' && Array.isArray(detailMatch.score) && (
                      <div>
                        <span className="font-semibold">🎾 Sets:</span>{' '}
                        {(detailMatch.score as number[][]).map(([a, b], i) => (
                          <span key={i} className="mr-2">{a}–{b}</span>
                        ))}
                      </div>
                    )}
                    <div><span className="font-semibold">🏆 Winnaar:</span> <span className="text-green-600 font-bold">{winner?.name}</span></div>
                    <div><span className="font-semibold">❌ Verliezer:</span> {loser?.name}</div>
                    {detailMatch.notes && <div><span className="font-semibold">💬 Opmerking:</span> {detailMatch.notes}</div>}
                  </div>
                  <div className="modal-action flex gap-2 justify-between">
                    <button onClick={() => setDetailMatch(null)} className="btn btn-ghost" style={{ color: '#555' }}>Sluiten</button>
                    {isUnlocked && (
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setEditing(true)
                          setEditForm({
                            date: detailMatch.date,
                            player1_id: detailMatch.player1_id,
                            player2_id: detailMatch.player2_id,
                            winner_id: detailMatch.winner_id,
                            location: detailMatch.location || '',
                            notes: detailMatch.notes || '',
                            ...loadScoreIntoForm(detailMatch, selectedVariant),
                          } as MatchForm)
                        }}
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

                    {editForm.player1_id && editForm.player2_id && selectedVariant.score_type !== 'winner_only' && (
                      <ScoreInput form={editForm} setForm={setEditForm} variant={selectedVariant} darkBg />
                    )}
                    {editForm.player1_id && editForm.player2_id && selectedVariant.score_type !== 'winner_only' && autoWinnerName && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <span className="text-green-700 text-sm">🏆 Winnaar: <strong>{autoWinnerName}</strong></span>
                      </div>
                    )}
                    {editForm.player1_id && editForm.player2_id && selectedVariant.score_type === 'winner_only' && (
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
                    <button onClick={handleSaveEdit} disabled={saving || !canSave(editForm)}
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

      {/* Delete variant modal */}
      {showDeleteVariant && selectedVariant && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm" style={{ background: '#fff', color: '#111' }}>
            <h3 className="font-bold text-lg mb-1 text-center">🗑️ Variant verwijderen</h3>
            <p className="text-sm text-center mb-1" style={{ color: '#555' }}>
              Weet je zeker dat je <strong>{selectedVariant.name}</strong> wilt verwijderen?
            </p>
            <p className="text-xs text-center mb-4 text-red-500">
              Alle wedstrijden van deze variant worden ook verwijderd.
            </p>
            <input
              type="password"
              inputMode="numeric"
              className={`input input-bordered w-full text-center text-2xl tracking-widest mb-2 ${deleteVariantPinError ? 'input-error' : ''}`}
              placeholder="••••"
              value={deleteVariantPin}
              onChange={e => { setDeleteVariantPin(e.target.value); setDeleteVariantPinError(false) }}
              maxLength={4}
            />
            {deleteVariantPinError && <p className="text-error text-sm text-center mb-2">Onjuiste pincode</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowDeleteVariant(false)} className="btn btn-ghost flex-1">Annuleren</button>
              <button onClick={handleDeleteVariant} disabled={!deleteVariantPin || deletingVariant} className="btn btn-error flex-1">
                {deletingVariant ? 'Bezig...' : 'Verwijderen'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowDeleteVariant(false)}></div>
        </div>
      )}

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
              <div>
                <label className="label label-text text-xs font-semibold">Scoreformaat</label>
                <div className="space-y-2 mt-1">
                  {([
                    ['winner_only', '🏆 Alleen winnaar', 'Geen score, alleen wie wint'],
                    ['score_to_x', '🔢 Score (getal)', 'Bijv. 10–7 bij touwtrekken'],
                    ['sets', '🎾 Sets', 'Setscore per set'],
                  ] as [ScoreType, string, string][]).map(([val, label, sub]) => (
                    <label key={val} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${newVariantScoreType === val ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="scoreType" className="radio radio-sm radio-success mt-0.5" checked={newVariantScoreType === val} onChange={() => setNewVariantScoreType(val)} />
                      <div>
                        <div className="font-semibold text-sm">{label}</div>
                        <div className="text-xs text-gray-400">{sub}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {newVariantScoreType === 'score_to_x' && (
                <div>
                  <label className="label label-text text-xs font-semibold">Winscore (optioneel)</label>
                  <input type="number" min={1} max={999} className="input input-bordered w-full" placeholder="bijv. 10" value={newVariantTarget} onChange={e => setNewVariantTarget(e.target.value)} />
                  <label className="label label-text-alt text-gray-400">Hoeveel punten wint het spel? (ter info)</label>
                </div>
              )}
            </div>
            <div className="modal-action">
              <button onClick={() => { setShowAddVariant(false); setNewVariantName(''); setNewVariantDesc(''); setNewVariantScoreType('winner_only'); setNewVariantTarget('') }} className="btn btn-ghost">Annuleren</button>
              <button onClick={handleAddVariant} disabled={!newVariantName.trim()} className="btn bg-green-600 text-white hover:bg-green-700 border-0">Toevoegen</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAddVariant(false)}></div>
        </div>
      )}
    </div>
  )
}
