import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Box, Check, ChevronDown, Download, Eye, FlipHorizontal2,
  FlipVertical2, Grid3X3, LayoutTemplate, Maximize2, Minus, MoreHorizontal, Move,
  Printer, QrCode, Redo2, Save, SlidersHorizontal,
  Sparkles, Type, Undo2, Upload, ZoomIn, ZoomOut
} from 'lucide-react'
import './App.css'

type CellMode = 'detailed' | 'compact' | 'micro'
type Orientation = 0 | 90 | 180 | 270
type ViewDirection = 'top' | 'bottom'
type EmptyStyle = 'coordinate' | 'dash' | 'blank'
type DateFormat = 'YYYY-MM-DD' | 'YY-MM-DD' | 'MM/DD'

type Slot = {
  row: number
  col: number
  name: string
  info: string
  date: string
  status?: 'normal' | 'expiring' | 'expired' | 'reserved'
}

type TemplateState = {
  templateName: string
  boxName: string
  boxId: string
  location: string
  owner: string
  rows: number
  columns: number
  widthMm: number
  heightMm: number
  paddingMm: number
  gridGapMm: number
  headerHeightMm: number
  footerHeightMm: number
  showHeader: boolean
  showFooter: boolean
  showQr: boolean
  showCoordinates: boolean
  showGridLines: boolean
  showStatus: boolean
  orientation: Orientation
  viewDirection: ViewDirection
  flipHorizontal: boolean
  flipVertical: boolean
  mode: CellMode | 'auto'
  emptyStyle: EmptyStyle
  dateFormat: DateFormat
  minFontPt: number
  zoom: number
  slots: Slot[]
}

const initialSlots: Slot[] = [
  { row: 0, col: 0, name: 'HCT116', info: 'P12 Control', date: '2026-07-20', status: 'normal' },
  { row: 0, col: 1, name: 'DLD-1', info: 'P8 + RSV', date: '2026-07-18', status: 'expiring' },
  { row: 0, col: 2, name: 'RKO', info: 'CRT 2 Gy', date: '2026-07-17', status: 'normal' },
  { row: 0, col: 3, name: '4T1 JEDI', info: 'Early vial', date: '2026-06-30', status: 'reserved' },
  { row: 1, col: 0, name: 'Mouse T cells', info: 'CD8+ 68%', date: '2026-07-19', status: 'normal' },
  { row: 1, col: 1, name: 'Patient 042', info: 'CRC biopsy', date: '2026-07-16', status: 'normal' },
  { row: 1, col: 2, name: 'BioTracker 490', info: 'Aliquot 3', date: '2026-05-12', status: 'expired' },
  { row: 2, col: 0, name: 'Anti-PD-1', info: '1 mg/mL', date: '2026-07-02', status: 'normal' },
  { row: 2, col: 2, name: 'Very long specimen name for overflow testing', info: 'Long metadata value', date: '2026-07-21', status: 'normal' },
]

const initialState: TemplateState = {
  templateName: 'Freezer Box — Detailed',
  boxName: 'Cell Line Storage',
  boxId: 'BX-204',
  location: 'Freezer 2 / Rack 3 / Shelf B',
  owner: 'Cancer Biology Lab',
  rows: 6,
  columns: 8,
  widthMm: 100,
  heightMm: 75,
  paddingMm: 2,
  gridGapMm: 0.35,
  headerHeightMm: 12,
  footerHeightMm: 10,
  showHeader: true,
  showFooter: true,
  showQr: true,
  showCoordinates: true,
  showGridLines: true,
  showStatus: true,
  orientation: 0,
  viewDirection: 'top',
  flipHorizontal: false,
  flipVertical: false,
  mode: 'auto',
  emptyStyle: 'coordinate',
  dateFormat: 'YY-MM-DD',
  minFontPt: 5,
  zoom: 1.05,
  slots: initialSlots,
}

function rowLabel(index: number) {
  let n = index + 1
  let result = ''
  while (n > 0) {
    n--
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return result
}

function formatDate(date: string, format: DateFormat) {
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  if (format === 'YY-MM-DD') return `${y.slice(-2)}-${m}-${d}`
  if (format === 'MM/DD') return `${m}/${d}`
  return date
}

function makeQrPattern(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  const cells = Array.from({ length: 121 }, (_, i) => {
    const x = i % 11
    const y = Math.floor(i / 11)
    const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7)
    if (finder) return !(x === 1 || y === 1) || (x === 1 && y === 1)
    return ((hash >> ((i + x * y) % 24)) & 1) === 1
  })
  return cells
}

function App() {
  const [state, setState] = useState<TemplateState>(() => {
    const saved = localStorage.getItem('lab-label-template')
    if (!saved) return initialState
    try { return { ...initialState, ...JSON.parse(saved) } } catch { return initialState }
  })
  const [history, setHistory] = useState<TemplateState[]>([])
  const [future, setFuture] = useState<TemplateState[]>([])
  const [activePanel, setActivePanel] = useState<'grid' | 'label' | 'data'>('grid')
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [toast, setToast] = useState<string>('')
  const [previewMode, setPreviewMode] = useState<'editor' | 'print'>('editor')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const update = useCallback((patch: Partial<TemplateState>) => {
    setState(prev => {
      setHistory(h => [...h.slice(-39), prev])
      setFuture([])
      return { ...prev, ...patch }
    })
  }, [])

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setFuture(f => [state, ...f])
    setState(previous)
    setHistory(h => h.slice(0, -1))
  }

  const redo = () => {
    const next = future[0]
    if (!next) return
    setHistory(h => [...h, state])
    setState(next)
    setFuture(f => f.slice(1))
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const cellWidthMm = useMemo(() => {
    const coordinateAllowance = state.showCoordinates ? 4 : 0
    return (state.widthMm - state.paddingMm * 2 - coordinateAllowance - state.gridGapMm * (state.columns - 1)) / state.columns
  }, [state])

  const gridAvailableHeight = state.heightMm - state.paddingMm * 2 - (state.showHeader ? state.headerHeightMm : 0) - (state.showFooter ? state.footerHeightMm : 0) - (state.showCoordinates ? 4 : 0)
  const cellHeightMm = (gridAvailableHeight - state.gridGapMm * (state.rows - 1)) / state.rows

  const resolvedMode: CellMode = state.mode === 'auto'
    ? cellWidthMm >= 11 && cellHeightMm >= 8 ? 'detailed'
      : cellWidthMm >= 7 && cellHeightMm >= 4.8 ? 'compact' : 'micro'
    : state.mode

  const warnings = useMemo(() => {
    const list: string[] = []
    if (cellWidthMm < 4 || cellHeightMm < 3) list.push('Cells are too small for readable text.')
    if (state.showQr && state.footerHeightMm < 8) list.push('QR region may be too small for reliable scanning.')
    if (state.rows * state.columns > 144) list.push('Large grids may render slowly when printing.')
    if (state.slots.some(s => s.name.length > 24) && resolvedMode !== 'detailed') list.push('Some long names will be truncated in this variant.')
    return list
  }, [cellWidthMm, cellHeightMm, state, resolvedMode])

  const saveTemplate = () => {
    localStorage.setItem('lab-label-template', JSON.stringify(state))
    setToast('Template saved locally')
    setTimeout(() => setToast(''), 2200)
  }

  const exportTemplate = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${state.templateName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importTemplate = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        update({ ...initialState, ...parsed })
        setToast('Template imported')
      } catch {
        setToast('Could not import this file')
      }
      setTimeout(() => setToast(''), 2400)
    }
    reader.readAsText(file)
  }

  const updateSlot = (row: number, col: number, patch: Partial<Slot>) => {
    const exists = state.slots.find(s => s.row === row && s.col === col)
    const slots = exists
      ? state.slots.map(s => s.row === row && s.col === col ? { ...s, ...patch } : s)
      : [...state.slots, { row, col, name: '', info: '', date: new Date().toISOString().slice(0, 10), ...patch }]
    update({ slots })
  }

  const transformedSlots = useMemo(() => {
    const matrix = Array.from({ length: state.rows }, (_, r) =>
      Array.from({ length: state.columns }, (_, c) => state.slots.find(s => s.row === r && s.col === c)))
    let oriented = matrix
    if (state.viewDirection === 'bottom') oriented = oriented.map(row => [...row].reverse())
    if (state.flipHorizontal) oriented = oriented.map(row => [...row].reverse())
    if (state.flipVertical) oriented = [...oriented].reverse()
    return oriented
  }, [state])

  const print = () => {
    setPreviewMode('print')
    setTimeout(() => window.print(), 100)
  }

  return (
    <div className={`app ${previewMode === 'print' ? 'print-preview' : ''}`}>
      <header className="topbar no-print">
        <div className="brand">
          <div className="brand-mark"><Grid3X3 size={20}/></div>
          <div><strong>Label Studio</strong><span>Lab Inventory</span></div>
        </div>
        <div className="template-title">
          <input value={state.templateName} onChange={e => update({ templateName: e.target.value })}/>
          <span className="saved-pill"><Check size={12}/> Draft</span>
        </div>
        <div className="top-actions">
          <button className="icon-btn" onClick={undo} disabled={!history.length} title="Undo"><Undo2 size={18}/></button>
          <button className="icon-btn" onClick={redo} disabled={!future.length} title="Redo"><Redo2 size={18}/></button>
          <span className="divider"/>
          <button className="soft-btn" onClick={saveTemplate}><Save size={16}/> Save</button>
          <button className="soft-btn" onClick={exportTemplate}><Download size={16}/> Export</button>
          <button className="primary-btn" onClick={print}><Printer size={16}/> Print</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="left-panel no-print">
          <div className="panel-heading"><span>Elements</span><button className="icon-btn"><MoreHorizontal size={17}/></button></div>
          <div className="tool-grid">
            <button className="tool active"><Grid3X3/><span>Box grid</span></button>
            <button className="tool"><Type/><span>Text</span></button>
            <button className="tool"><QrCode/><span>QR code</span></button>
            <button className="tool"><Minus/><span>Divider</span></button>
          </div>

          <div className="section-label">Layers</div>
          <div className="layers">
            <button onClick={() => setActivePanel('label')}><LayoutTemplate size={16}/><span>Label canvas</span><Eye size={15}/></button>
            <button className={activePanel === 'grid' ? 'selected' : ''} onClick={() => setActivePanel('grid')}><Grid3X3 size={16}/><span>Smart box grid</span><Eye size={15}/></button>
            <button><Type size={16}/><span>Box header</span><Eye size={15}/></button>
            <button><QrCode size={16}/><span>Box QR</span><Eye size={15}/></button>
          </div>

          <div className="section-label">Data source</div>
          <button className="data-source" onClick={() => setActivePanel('data')}>
            <div className="source-icon"><Box size={18}/></div>
            <div><strong>{state.boxName}</strong><span>{state.boxId} · {state.rows} × {state.columns}</span></div>
            <ChevronDown size={16}/>
          </button>

          <div className="left-footer">
            <button className="text-btn" onClick={() => fileInputRef.current?.click()}><Upload size={15}/> Import template</button>
            <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={e => e.target.files?.[0] && importTemplate(e.target.files[0])}/>
          </div>
        </aside>

        <main className="canvas-area">
          <div className="canvas-toolbar no-print">
            <div className="segmented">
              <button className="active"><Move size={14}/> Design</button>
              <button onClick={() => setPreviewMode('print')}><Eye size={14}/> Preview</button>
            </div>
            <div className="canvas-meta">
              <span>{state.widthMm} × {state.heightMm} mm</span>
              <span className="dot">•</span>
              <span>{resolvedMode[0].toUpperCase() + resolvedMode.slice(1)} variant</span>
            </div>
            <div className="zoom-control">
              <button onClick={() => update({ zoom: Math.max(.6, state.zoom - .1) })}><ZoomOut size={16}/></button>
              <span>{Math.round(state.zoom * 100)}%</span>
              <button onClick={() => update({ zoom: Math.min(1.8, state.zoom + .1) })}><ZoomIn size={16}/></button>
            </div>
          </div>

          <div className="canvas-stage">
            <div className="ruler ruler-x"/>
            <div className="ruler ruler-y"/>
            <LabelCanvas
              state={state}
              transformedSlots={transformedSlots}
              resolvedMode={resolvedMode}
              selectedCell={selectedCell}
              setSelectedCell={setSelectedCell}
            />
            <div className="stage-hint no-print"><Maximize2 size={14}/> Physical size preview · Print at 100%</div>
          </div>

          <div className="statusbar no-print">
            <div className={warnings.length ? 'warning-status' : 'ok-status'}>
              {warnings.length ? <AlertTriangle size={15}/> : <Check size={15}/>} {warnings.length ? `${warnings.length} layout warning${warnings.length > 1 ? 's' : ''}` : 'Ready to print'}
            </div>
            <div>{state.slots.filter(s => s.row < state.rows && s.col < state.columns).length} occupied · {state.rows * state.columns - state.slots.filter(s => s.row < state.rows && s.col < state.columns).length} empty</div>
          </div>
        </main>

        <aside className="right-panel no-print">
          {activePanel === 'grid' && <GridProperties state={state} update={update} resolvedMode={resolvedMode} cellWidthMm={cellWidthMm} cellHeightMm={cellHeightMm}/>} 
          {activePanel === 'label' && <LabelProperties state={state} update={update}/>} 
          {activePanel === 'data' && <DataProperties state={state} update={update}/>} 
          {selectedCell && <CellEditor state={state} selectedCell={selectedCell} updateSlot={updateSlot} onClose={() => setSelectedCell(null)}/>} 
          {warnings.length > 0 && <div className="validation-card"><div><AlertTriangle size={16}/><strong>Validation</strong></div>{warnings.map(w => <p key={w}>{w}</p>)}</div>}
        </aside>
      </div>
      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </div>
  )
}

function LabelCanvas({ state, transformedSlots, resolvedMode, selectedCell, setSelectedCell }: {
  state: TemplateState
  transformedSlots: (Slot | undefined)[][]
  resolvedMode: CellMode
  selectedCell: { row: number; col: number } | null
  setSelectedCell: (v: { row: number; col: number } | null) => void
}) {
  const qr = makeQrPattern(state.boxId)
  const pxPerMm = 7.2 * state.zoom
  const transform = `rotate(${state.orientation}deg)`
  return (
    <div className="label-shadow" style={{ width: state.widthMm * pxPerMm, height: state.heightMm * pxPerMm, '--print-width': `${state.widthMm}mm`, '--print-height': `${state.heightMm}mm` } as React.CSSProperties}>
      <div className="label-canvas" style={{ padding: state.paddingMm * pxPerMm, transform }}>
        {state.showHeader && (
          <div className="label-header" style={{ height: state.headerHeightMm * pxPerMm }}>
            <div className="header-main"><strong>{state.boxName}</strong><span>{state.location}</span></div>
            <div className="header-id"><span>{state.boxId}</span><small>{state.rows} × {state.columns} box</small></div>
          </div>
        )}
        <div className={`grid-wrap mode-${resolvedMode}`}>
          {state.showCoordinates && <div className="corner-coordinate"/>}
          {state.showCoordinates && transformedSlots[0]?.map((_, c) => <div className="col-coordinate" key={`c-${c}`}>{c + 1}</div>)}
          {transformedSlots.map((row, r) => (
            <div className="grid-row" key={r}>
              {state.showCoordinates && <div className="row-coordinate">{rowLabel(r)}</div>}
              <div className="cells-row" style={{ gridTemplateColumns: `repeat(${state.columns}, 1fr)`, gap: `${state.gridGapMm * pxPerMm}px` }}>
                {row.map((slot, c) => {
                  const coordinate = `${rowLabel(r)}${c + 1}`
                  const selected = selectedCell?.row === r && selectedCell?.col === c
                  return (
                    <button
                      key={coordinate}
                      className={`label-cell ${slot ? 'occupied' : 'empty'} status-${slot?.status || 'none'} ${selected ? 'cell-selected' : ''} ${state.showGridLines ? '' : 'no-lines'}`}
                      onClick={() => setSelectedCell({ row: r, col: c })}
                    >
                      {state.showStatus && slot?.status && slot.status !== 'normal' && <span className="status-marker">{slot.status === 'expired' ? '!' : slot.status === 'expiring' ? '◷' : 'R'}</span>}
                      {slot ? (
                        <>
                          <strong title={slot.name}>{resolvedMode === 'micro' ? slot.name.slice(0, 8) : slot.name}</strong>
                          {resolvedMode !== 'micro' && <span title={slot.info}>{slot.info}</span>}
                          <small>{formatDate(slot.date, state.dateFormat)}</small>
                        </>
                      ) : (
                        <span className="empty-content">{state.emptyStyle === 'coordinate' ? coordinate : state.emptyStyle === 'dash' ? '—' : ''}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {state.showFooter && (
          <div className="label-footer" style={{ height: state.footerHeightMm * pxPerMm }}>
            <div className="footer-meta"><strong>{state.owner}</strong><span>Scan for live inventory · Printed {new Date().toLocaleDateString()}</span></div>
            {state.showQr && <div className="qr" aria-label="QR code preview">{qr.map((on, i) => <i key={i} className={on ? 'on' : ''}/>)}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function PropertySection({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return <section className="property-section"><div className="property-title"><span>{title}</span><ChevronDown size={15} style={{ transform: open ? '' : 'rotate(-90deg)' }}/></div>{open && <div className="property-content">{children}</div>}</section>
}

function NumberField({ label, value, onChange, min = 0, max = 999, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return <label className="field"><span>{label}</span><div className="number-input"><input type="number" value={value} min={min} max={max} step={step} onChange={e => onChange(Number(e.target.value))}/>{suffix && <em>{suffix}</em>}</div></label>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}/><i/></label>
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>
}

function GridProperties({ state, update, resolvedMode, cellWidthMm, cellHeightMm }: { state: TemplateState; update: (p: Partial<TemplateState>) => void; resolvedMode: CellMode; cellWidthMm: number; cellHeightMm: number }) {
  return <>
    <div className="right-heading"><div><Grid3X3 size={17}/><strong>Smart box grid</strong></div><button className="icon-btn"><MoreHorizontal size={17}/></button></div>
    <PropertySection title="Structure">
      <div className="two-col"><NumberField label="Rows" value={state.rows} min={1} max={26} onChange={rows => update({ rows })}/><NumberField label="Columns" value={state.columns} min={1} max={24} onChange={columns => update({ columns })}/></div>
      <NumberField label="Cell gap" value={state.gridGapMm} min={0} max={4} step={0.05} suffix="mm" onChange={gridGapMm => update({ gridGapMm })}/>
      <div className="metric-strip"><span>Calculated cell</span><strong>{cellWidthMm.toFixed(1)} × {cellHeightMm.toFixed(1)} mm</strong></div>
      <Toggle label="Grid lines" checked={state.showGridLines} onChange={showGridLines => update({ showGridLines })}/>
      <Toggle label="Coordinates" checked={state.showCoordinates} onChange={showCoordinates => update({ showCoordinates })}/>
    </PropertySection>
    <PropertySection title="Cell layout">
      <SelectField label="Variant" value={state.mode} onChange={mode => update({ mode: mode as TemplateState['mode'] })}>
        <option value="auto">Auto — {resolvedMode}</option><option value="detailed">Detailed</option><option value="compact">Compact</option><option value="micro">Micro</option>
      </SelectField>
      <div className="cell-preview"><div className={`mini-cell ${resolvedMode}`}><strong>[Item name]</strong>{resolvedMode !== 'micro' && <span>[Info]</span>}<small>[Date]</small></div><button><SlidersHorizontal size={14}/> Edit master cell</button></div>
      <SelectField label="Date format" value={state.dateFormat} onChange={dateFormat => update({ dateFormat: dateFormat as DateFormat })}><option>YYYY-MM-DD</option><option>YY-MM-DD</option><option>MM/DD</option></SelectField>
      <SelectField label="Empty cells" value={state.emptyStyle} onChange={emptyStyle => update({ emptyStyle: emptyStyle as EmptyStyle })}><option value="coordinate">Show coordinate</option><option value="dash">Show dash</option><option value="blank">Blank</option></SelectField>
      <NumberField label="Minimum font" value={state.minFontPt} min={4} max={10} step={0.5} suffix="pt" onChange={minFontPt => update({ minFontPt })}/>
      <Toggle label="Status markers" checked={state.showStatus} onChange={showStatus => update({ showStatus })}/>
    </PropertySection>
    <PropertySection title="Orientation">
      <SelectField label="View from" value={state.viewDirection} onChange={viewDirection => update({ viewDirection: viewDirection as ViewDirection })}><option value="top">Lid / top</option><option value="bottom">Bottom</option></SelectField>
      <div className="button-grid four"><button className={state.orientation === 0 ? 'active' : ''} onClick={() => update({ orientation: 0 })}>0°</button><button onClick={() => update({ orientation: 90 })}>90°</button><button onClick={() => update({ orientation: 180 })}>180°</button><button onClick={() => update({ orientation: 270 })}>270°</button></div>
      <div className="button-grid two"><button className={state.flipHorizontal ? 'active' : ''} onClick={() => update({ flipHorizontal: !state.flipHorizontal })}><FlipHorizontal2 size={15}/> Horizontal</button><button className={state.flipVertical ? 'active' : ''} onClick={() => update({ flipVertical: !state.flipVertical })}><FlipVertical2 size={15}/> Vertical</button></div>
    </PropertySection>
  </>
}

function LabelProperties({ state, update }: { state: TemplateState; update: (p: Partial<TemplateState>) => void }) {
  return <><div className="right-heading"><div><LayoutTemplate size={17}/><strong>Label canvas</strong></div></div>
    <PropertySection title="Physical size"><div className="two-col"><NumberField label="Width" value={state.widthMm} min={25} max={210} suffix="mm" onChange={widthMm => update({ widthMm })}/><NumberField label="Height" value={state.heightMm} min={15} max={297} suffix="mm" onChange={heightMm => update({ heightMm })}/></div><NumberField label="Safe padding" value={state.paddingMm} min={0} max={10} step={0.5} suffix="mm" onChange={paddingMm => update({ paddingMm })}/></PropertySection>
    <PropertySection title="Regions"><Toggle label="Header" checked={state.showHeader} onChange={showHeader => update({ showHeader })}/>{state.showHeader && <NumberField label="Header height" value={state.headerHeightMm} min={5} max={30} suffix="mm" onChange={headerHeightMm => update({ headerHeightMm })}/>}<Toggle label="Footer" checked={state.showFooter} onChange={showFooter => update({ showFooter })}/>{state.showFooter && <NumberField label="Footer height" value={state.footerHeightMm} min={5} max={30} suffix="mm" onChange={footerHeightMm => update({ footerHeightMm })}/>}<Toggle label="QR code" checked={state.showQr} onChange={showQr => update({ showQr })}/></PropertySection>
  </>
}

function DataProperties({ state, update }: { state: TemplateState; update: (p: Partial<TemplateState>) => void }) {
  return <><div className="right-heading"><div><Box size={17}/><strong>Preview data</strong></div></div><PropertySection title="Box"><label className="field"><span>Box name</span><input value={state.boxName} onChange={e => update({ boxName: e.target.value })}/></label><label className="field"><span>Box ID</span><input value={state.boxId} onChange={e => update({ boxId: e.target.value })}/></label><label className="field"><span>Location</span><input value={state.location} onChange={e => update({ location: e.target.value })}/></label><label className="field"><span>Owner</span><input value={state.owner} onChange={e => update({ owner: e.target.value })}/></label></PropertySection><div className="info-card"><Sparkles size={16}/><div><strong>Live preview</strong><p>Click any grid cell to edit its sample name, information, date, and status.</p></div></div></>
}

function CellEditor({ state, selectedCell, updateSlot, onClose }: { state: TemplateState; selectedCell: { row: number; col: number }; updateSlot: (r: number, c: number, p: Partial<Slot>) => void; onClose: () => void }) {
  const slot = state.slots.find(s => s.row === selectedCell.row && s.col === selectedCell.col)
  return <div className="cell-editor"><div className="cell-editor-title"><div><strong>Edit {rowLabel(selectedCell.row)}{selectedCell.col + 1}</strong><span>Preview record</span></div><button onClick={onClose}>×</button></div><label className="field"><span>Name</span><input value={slot?.name || ''} placeholder="Sample name" onChange={e => updateSlot(selectedCell.row, selectedCell.col, { name: e.target.value })}/></label><label className="field"><span>Info</span><input value={slot?.info || ''} placeholder="Passage, treatment, concentration…" onChange={e => updateSlot(selectedCell.row, selectedCell.col, { info: e.target.value })}/></label><label className="field"><span>Date</span><input type="date" value={slot?.date || ''} onChange={e => updateSlot(selectedCell.row, selectedCell.col, { date: e.target.value })}/></label><SelectField label="Status" value={slot?.status || 'normal'} onChange={status => updateSlot(selectedCell.row, selectedCell.col, { status: status as Slot['status'] })}><option value="normal">Normal</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option><option value="reserved">Reserved</option></SelectField></div>
}

export default App
