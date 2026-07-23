import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lock, TriangleAlert as AlertTriangle, Check, Download, Grid3x2 as Grid3X3, Monitor, Printer, Redo2, Save, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import './App.css'

type Slot = {
  row: number
  col: number
  name: string
  info: string
  date: string
}

type LockedParam = 'cellWidth' | 'gapH' | 'paddingH'

type SidebarTab = 'structure' | 'headerFooter' | 'grid'

type TemplateState = {
  templateName: string
  boxName: string
  boxId: string
  location: string
  owner: string
  canvasWidthMm: number
  canvasHeightMm: number
  rows: number
  columns: number
  paddingHMm: number
  paddingVMm: number
  gridGapHMm: number
  gridGapVMm: number
  cellWidthMm: number
  cellAspectRatio: number
  headerHeightMm: number
  footerHeightMm: number
  showHeader: boolean
  showFooter: boolean
  showQr: boolean
  showCoordinates: boolean
  showGridLines: boolean
  lockedParam: LockedParam
  zoom: number
  slots: Slot[]
  nameFontSize: number
  infoFontSize: number
  dateFontSize: number
  showName: boolean
  showInfo: boolean
  showDate: boolean
  boldName: boolean
  boldInfo: boolean
  boldDate: boolean
  printDate: string
  boxNameFontSize: number
  boxIdFontSize: number
  locationFontSize: number
  ownerFontSize: number
  printDateFontSize: number
}

type DimensionPreset = {
  label: string
  width: number
  height: number
}

const DIMENSION_PRESETS: DimensionPreset[] = [
  { label: 'A3', width: 297, height: 420 },
  { label: 'A4', width: 210, height: 297 },
  { label: 'A5', width: 148, height: 210 },
  { label: 'US Letter', width: 215.9, height: 279.4 },
  { label: 'US Legal', width: 215.9, height: 355.6 },
  { label: 'Tabloid', width: 279.4, height: 431.8 },
]

const initialSlots: Slot[] = [
  { row: 0, col: 0, name: 'HCT116', info: 'P12 Control', date: '2026-07-20' },
  { row: 0, col: 1, name: 'DLD-1', info: 'P8 + RSV', date: '2026-07-18' },
  { row: 0, col: 2, name: 'RKO', info: 'CRT 2 Gy', date: '2026-07-17' },
  { row: 0, col: 3, name: '4T1 JEDI', info: 'Early vial', date: '2026-06-30' },
  { row: 1, col: 0, name: 'Mouse T cells', info: 'CD8+ 68%', date: '2026-07-19' },
  { row: 1, col: 1, name: 'Patient 042', info: 'CRC biopsy', date: '2026-07-16' },
  { row: 1, col: 2, name: 'BioTracker 490', info: 'Aliquot 3', date: '2026-05-12' },
  { row: 2, col: 0, name: 'Anti-PD-1', info: '1 mg/mL', date: '2026-07-02' },
  { row: 2, col: 2, name: 'Very long specimen name for overflow testing', info: 'Long metadata value', date: '2026-07-21' },
]

const initialState: TemplateState = {
  templateName: 'Freezer Box — Detailed',
  boxName: 'Cell Line Storage',
  boxId: 'BX-204',
  location: 'Freezer 2 / Rack 3 / Shelf B',
  owner: 'Cancer Biology Lab',
  canvasWidthMm: 210,
  canvasHeightMm: 297,
  rows: 6,
  columns: 8,
  paddingHMm: 5,
  paddingVMm: 5,
  gridGapHMm: 0.5,
  gridGapVMm: 0.5,
  cellWidthMm: 0,
  cellAspectRatio: 1.0,
  headerHeightMm: 14,
  footerHeightMm: 12,
  showHeader: true,
  showFooter: true,
  showQr: true,
  showCoordinates: true,
  showGridLines: true,
  lockedParam: 'cellWidth',
  zoom: 0.85,
  slots: initialSlots,
  nameFontSize: 8,
  infoFontSize: 6,
  dateFontSize: 6,
  showName: true,
  showInfo: true,
  showDate: true,
  boldName: true,
  boldInfo: false,
  boldDate: false,
  printDate: new Date().toLocaleDateString(),
  boxNameFontSize: 15,
  boxIdFontSize: 10,
  locationFontSize: 8,
  ownerFontSize: 10,
  printDateFontSize: 8,
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

function computeGridMetrics(state: TemplateState) {
  const canvasW = state.canvasWidthMm
  const canvasH = state.canvasHeightMm
  const coordAllowanceX = state.showCoordinates ? 5 : 0
  const coordAllowanceY = state.showCoordinates ? 4 : 0

  let cellWidth: number
  let gapH: number
  let paddingH: number

  if (state.lockedParam === 'cellWidth') {
    gapH = state.gridGapHMm
    paddingH = state.paddingHMm
    const availW = canvasW - paddingH * 2 - coordAllowanceX - gapH * (state.columns - 1)
    cellWidth = availW / state.columns
  } else if (state.lockedParam === 'gapH') {
    cellWidth = state.cellWidthMm
    paddingH = state.paddingHMm
    gapH = state.columns > 1
      ? (canvasW - paddingH * 2 - coordAllowanceX - cellWidth * state.columns) / (state.columns - 1)
      : 0
  } else {
    cellWidth = state.cellWidthMm
    gapH = state.gridGapHMm
    paddingH = (canvasW - coordAllowanceX - cellWidth * state.columns - gapH * (state.columns - 1)) / 2
  }

  const availableHeight = canvasH - state.paddingVMm * 2
    - (state.showHeader ? state.headerHeightMm : 0)
    - (state.showFooter ? state.footerHeightMm : 0)
    - coordAllowanceY
    - state.gridGapVMm * (state.rows - 1)
  const maxCellHeight = availableHeight / state.rows

  const desiredCellHeight = cellWidth / state.cellAspectRatio

  const clamped = desiredCellHeight > maxCellHeight
  const cellHeight = clamped ? maxCellHeight : desiredCellHeight
  const effectiveRatio = cellWidth / cellHeight

  const minRatio = cellWidth / maxCellHeight

  return { cellWidth, cellHeight, maxCellHeight, clamped, effectiveRatio, minRatio, effectiveGapH: gapH, effectivePaddingH: paddingH }
}

function App() {
  const [state, setState] = useState<TemplateState>(() => {
    const saved = localStorage.getItem('lab-label-template')
    if (!saved) return initialState
    try { return { ...initialState, ...JSON.parse(saved) } } catch { return initialState }
  })
  const [history, setHistory] = useState<TemplateState[]>([])
  const [future, setFuture] = useState<TemplateState[]>([])
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [toast, setToast] = useState<string>('')
  const [activeTab, setActiveTab] = useState<SidebarTab>('structure')

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

  const metrics = useMemo(() => computeGridMetrics(state), [state])

  const slotsMatrix = useMemo(() => {
    return Array.from({ length: state.rows }, (_, r) =>
      Array.from({ length: state.columns }, (_, c) => state.slots.find(s => s.row === r && s.col === c)))
  }, [state.rows, state.columns, state.slots])

  const warnings = useMemo(() => {
    const list: string[] = []
    if (metrics.cellWidth < 4 || metrics.cellHeight < 3) list.push('Cells are too small for readable text.')
    if (state.showQr && state.footerHeightMm < 8) list.push('QR region may be too small for reliable scanning.')
    if (state.rows * state.columns > 144) list.push('Large grids may render slowly when printing.')
    return list
  }, [metrics, state])

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

  const updateSlot = (row: number, col: number, patch: Partial<Slot>) => {
    const exists = state.slots.find(s => s.row === row && s.col === col)
    const slots = exists
      ? state.slots.map(s => s.row === row && s.col === col ? { ...s, ...patch } : s)
      : [...state.slots, { row, col, name: '', info: '', date: new Date().toISOString().slice(0, 10), ...patch }]
    update({ slots })
  }

  const print = () => { window.print() }

  const handleAspectRatioChange = (v: number) => {
    const clamped = Math.max(metrics.minRatio, v)
    update({ cellAspectRatio: clamped })
  }

  const handleCellWidthChange = (v: number) => {
    const coordAllowanceX = state.showCoordinates ? 5 : 0
    if (state.lockedParam === 'gapH') {
      const newGap = state.columns > 1
        ? (state.canvasWidthMm - state.paddingHMm * 2 - coordAllowanceX - v * state.columns) / (state.columns - 1)
        : 0
      if (newGap < 0) return
    } else if (state.lockedParam === 'paddingH') {
      const newPad = (state.canvasWidthMm - coordAllowanceX - v * state.columns - state.gridGapHMm * (state.columns - 1)) / 2
      if (newPad < 0) return
    }
    const oldHeight = metrics.cellWidth / state.cellAspectRatio
    const newRatio = v / oldHeight
    update({ cellWidthMm: v, cellAspectRatio: Math.max(metrics.minRatio, newRatio) })
  }

  const handleCellHeightChange = (v: number) => {
    if (v <= 0) return
    const newRatio = metrics.cellWidth / v
    update({ cellAspectRatio: Math.max(metrics.minRatio, newRatio) })
  }

  const handleGapHChange = (v: number) => {
    const coordAllowanceX = state.showCoordinates ? 5 : 0
    if (state.lockedParam === 'cellWidth') {
      const newCellW = (state.canvasWidthMm - state.paddingHMm * 2 - coordAllowanceX - v * (state.columns - 1)) / state.columns
      if (newCellW < 0) return
    } else if (state.lockedParam === 'paddingH') {
      const newPad = (state.canvasWidthMm - coordAllowanceX - state.cellWidthMm * state.columns - v * (state.columns - 1)) / 2
      if (newPad < 0) return
    }
    update({ gridGapHMm: v })
  }

  const handlePadHChange = (v: number) => {
    const coordAllowanceX = state.showCoordinates ? 5 : 0
    if (state.lockedParam === 'cellWidth') {
      const newCellW = (state.canvasWidthMm - v * 2 - coordAllowanceX - state.gridGapHMm * (state.columns - 1)) / state.columns
      if (newCellW < 0) return
    } else if (state.lockedParam === 'gapH') {
      const newGap = state.columns > 1
        ? (state.canvasWidthMm - v * 2 - coordAllowanceX - state.cellWidthMm * state.columns) / (state.columns - 1)
        : 0
      if (newGap < 0) return
    }
    update({ paddingHMm: v })
  }

  const handleLockChange = (param: LockedParam) => {
    if (param === state.lockedParam) return
    update({
      lockedParam: param,
      cellWidthMm: metrics.cellWidth,
      gridGapHMm: metrics.effectiveGapH,
      paddingHMm: metrics.effectivePaddingH,
    })
  }

  const handleCanvasWidthChange = (v: number) => {
    if (v <= 0) return
    update({ canvasWidthMm: v })
  }

  const handleCanvasHeightChange = (v: number) => {
    if (v <= 0) return
    update({ canvasHeightMm: v })
  }

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value)
    if (isNaN(idx) || idx < 0) return
    const preset = DIMENSION_PRESETS[idx]
    if (preset) {
      update({ canvasWidthMm: preset.width, canvasHeightMm: preset.height })
    }
  }

  const activePresetIndex = DIMENSION_PRESETS.findIndex(
    p => p.width === state.canvasWidthMm && p.height === state.canvasHeightMm
  )

  return (
    <div className="app">
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
          <button className="icon-btn" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)"><Undo2 size={18}/></button>
          <button className="icon-btn" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)"><Redo2 size={18}/></button>
          <span className="divider"/>
          <button className="soft-btn" onClick={saveTemplate}><Save size={16}/> Save</button>
          <button className="soft-btn" onClick={exportTemplate}><Download size={16}/> Export</button>
          <button className="primary-btn" onClick={print}><Printer size={16}/> Print</button>
        </div>
      </header>

      <div className="workspace">
        <main className="canvas-area">

          <div className="canvas-stage">
            <LabelCanvas
              state={state}
              slotsMatrix={slotsMatrix}
              metrics={metrics}
              selectedCell={selectedCell}
              setSelectedCell={setSelectedCell}
            />

          </div>

          <div className="statusbar no-print">
            <div>{state.slots.filter(s => s.row < state.rows && s.col < state.columns).length} occupied · {state.rows * state.columns - state.slots.filter(s => s.row < state.rows && s.col < state.columns).length} empty</div>
            <div className="zoom-control">
              <button onClick={() => update({ zoom: Math.max(.4, state.zoom - .1) })}><ZoomOut size={16}/></button>
              <span>{Math.round(state.zoom * 100)}%</span>
              <button onClick={() => update({ zoom: Math.min(1.5, state.zoom + .1) })}><ZoomIn size={16}/></button>
            </div>
          </div>
        </main>

        <aside className="right-panel no-print">
          <div className="tab-bar">
            <button className={`tab-btn${activeTab === 'structure' ? ' tab-active' : ''}`} onClick={() => setActiveTab('structure')}>Structure</button>
            <button className={`tab-btn${activeTab === 'headerFooter' ? ' tab-active' : ''}`} onClick={() => setActiveTab('headerFooter')}>Header & Footer</button>
            <button className={`tab-btn${activeTab === 'grid' ? ' tab-active' : ''}`} onClick={() => setActiveTab('grid')}>Grid</button>
          </div>

          {activeTab === 'structure' && (
            <div className="tab-content">
              <div className="subsection">
                <h4 className="subsection-title">Canvas Size</h4>
                <label className="field">
                  <span>Preset</span>
                  <select value={activePresetIndex >= 0 ? activePresetIndex : ''} onChange={handlePresetChange} className="preset-select">
                    <option value="" disabled>Custom</option>
                    {DIMENSION_PRESETS.map((p, i) => (
                      <option key={i} value={i}>{p.label} ({p.width} x {p.height} mm)</option>
                    ))}
                  </select>
                </label>
                <div className="two-col">
                  <NumberField label="Width (mm)" value={state.canvasWidthMm} min={20} max={500} step={0.1} onChange={handleCanvasWidthChange}/>
                  <NumberField label="Height (mm)" value={state.canvasHeightMm} min={20} max={600} step={0.1} onChange={handleCanvasHeightChange}/>
                </div>
              </div>
              <div className="three-col">
                <NumberField label="Rows" value={state.rows} min={1} max={20} onChange={rows => update({ rows })}/>
                <NumberField label="Columns" value={state.columns} min={1} max={20} onChange={columns => update({ columns })}/>
                <NumberField label="Ratio" value={Math.round(state.cellAspectRatio * 100) / 100} min={Math.round(metrics.minRatio * 100) / 100} max={5} step={0.05} onChange={handleAspectRatioChange}/>
              </div>
              {metrics.clamped && <div className="clamp-notice">Ratio limited to fit page height</div>}
              <div className="three-col">
                <NumberField label="Cell W" value={Number(metrics.cellWidth.toFixed(2))} min={1} max={80} step={0.1} locked={state.lockedParam === 'cellWidth'} onLockClick={() => handleLockChange('cellWidth')} onChange={handleCellWidthChange}/>
                <NumberField label="Gap H" value={Number(metrics.effectiveGapH.toFixed(2))} min={0} max={10} step={0.05} locked={state.lockedParam === 'gapH'} onLockClick={() => handleLockChange('gapH')} onChange={handleGapHChange}/>
                <NumberField label="Pad H" value={Number(metrics.effectivePaddingH.toFixed(2))} min={0} max={30} step={0.5} locked={state.lockedParam === 'paddingH'} onLockClick={() => handleLockChange('paddingH')} onChange={handlePadHChange}/>
              </div>
              <div className="three-col">
                <NumberField label="Cell H" value={Number(metrics.cellHeight.toFixed(2))} min={1} max={80} step={0.1} onChange={handleCellHeightChange}/>
                <NumberField label="Gap V" value={state.gridGapVMm} min={0} max={4} step={0.05} onChange={gridGapVMm => update({ gridGapVMm })}/>
                <NumberField label="Pad V" value={state.paddingVMm} min={0} max={20} step={0.5} onChange={paddingVMm => update({ paddingVMm })}/>
              </div>
              <Toggle label="Grid lines" checked={state.showGridLines} onChange={showGridLines => update({ showGridLines })}/>
              <Toggle label="Coordinates" checked={state.showCoordinates} onChange={showCoordinates => update({ showCoordinates })}/>
            </div>
          )}

          {activeTab === 'headerFooter' && (
            <div className="tab-content">
              <div className="subsection">
                <h4 className="subsection-title">Header</h4>
                <Toggle label="Show header" checked={state.showHeader} onChange={showHeader => update({ showHeader })}/>
                {state.showHeader && <RangeField label="Height" value={state.headerHeightMm} min={5} max={30} step={1} suffix="mm" onChange={headerHeightMm => update({ headerHeightMm })}/>}
                <div className="field-with-size">
                  <label className="field"><span>Box name</span><input value={state.boxName} onChange={e => update({ boxName: e.target.value })}/></label>
                  <label className="field range-field size-slider"><span>Size <em className="range-value">{state.boxNameFontSize}px</em></span><input type="range" min={6} max={24} step={0.5} value={state.boxNameFontSize} onChange={e => update({ boxNameFontSize: Number(e.target.value) })}/></label>
                </div>
                <div className="field-with-size">
                  <label className="field"><span>Box ID</span><input value={state.boxId} onChange={e => update({ boxId: e.target.value })}/></label>
                  <label className="field range-field size-slider"><span>Size <em className="range-value">{state.boxIdFontSize}px</em></span><input type="range" min={5} max={20} step={0.5} value={state.boxIdFontSize} onChange={e => update({ boxIdFontSize: Number(e.target.value) })}/></label>
                </div>
                <div className="field-with-size">
                  <label className="field"><span>Location</span><input value={state.location} onChange={e => update({ location: e.target.value })}/></label>
                  <label className="field range-field size-slider"><span>Size <em className="range-value">{state.locationFontSize}px</em></span><input type="range" min={4} max={16} step={0.5} value={state.locationFontSize} onChange={e => update({ locationFontSize: Number(e.target.value) })}/></label>
                </div>
              </div>
              <div className="subsection">
                <h4 className="subsection-title">Footer</h4>
                <Toggle label="Show footer" checked={state.showFooter} onChange={showFooter => update({ showFooter })}/>
                {state.showFooter && <RangeField label="Height" value={state.footerHeightMm} min={5} max={30} step={1} suffix="mm" onChange={footerHeightMm => update({ footerHeightMm })}/>}
                <div className="field-with-size">
                  <label className="field"><span>Owner</span><input value={state.owner} onChange={e => update({ owner: e.target.value })}/></label>
                  <label className="field range-field size-slider"><span>Size <em className="range-value">{state.ownerFontSize}px</em></span><input type="range" min={5} max={20} step={0.5} value={state.ownerFontSize} onChange={e => update({ ownerFontSize: Number(e.target.value) })}/></label>
                </div>
                <div className="field-with-size">
                  <label className="field"><span>Print date</span><input value={state.printDate} onChange={e => update({ printDate: e.target.value })}/></label>
                  <label className="field range-field size-slider"><span>Size <em className="range-value">{state.printDateFontSize}px</em></span><input type="range" min={4} max={16} step={0.5} value={state.printDateFontSize} onChange={e => update({ printDateFontSize: Number(e.target.value) })}/></label>
                </div>
                <Toggle label="Box QR code" checked={state.showQr} onChange={showQr => update({ showQr })}/>
              </div>

            </div>
          )}

          {activeTab === 'grid' && (
            <div className="tab-content">
              <div className="grid-text-row">
                <span className="grid-text-label">Name</span>
                <Toggle label="" checked={state.showName} onChange={showName => update({ showName })}/>
                <button className={`bold-btn ${state.boldName ? 'active' : ''}`} title="Bold" onClick={() => update({ boldName: !state.boldName })}>B</button>
                <input type="range" className="grid-text-slider" min={4} max={16} step={0.5} value={state.nameFontSize} onChange={e => update({ nameFontSize: Number(e.target.value) })}/>
                <em className="range-value">{state.nameFontSize}px</em>
              </div>
              <div className="grid-text-row">
                <span className="grid-text-label">Info</span>
                <Toggle label="" checked={state.showInfo} onChange={showInfo => update({ showInfo })}/>
                <button className={`bold-btn ${state.boldInfo ? 'active' : ''}`} title="Bold" onClick={() => update({ boldInfo: !state.boldInfo })}>B</button>
                <input type="range" className="grid-text-slider" min={3} max={14} step={0.5} value={state.infoFontSize} onChange={e => update({ infoFontSize: Number(e.target.value) })}/>
                <em className="range-value">{state.infoFontSize}px</em>
              </div>
              <div className="grid-text-row">
                <span className="grid-text-label">Date</span>
                <Toggle label="" checked={state.showDate} onChange={showDate => update({ showDate })}/>
                <button className={`bold-btn ${state.boldDate ? 'active' : ''}`} title="Bold" onClick={() => update({ boldDate: !state.boldDate })}>B</button>
                <input type="range" className="grid-text-slider" min={3} max={14} step={0.5} value={state.dateFontSize} onChange={e => update({ dateFontSize: Number(e.target.value) })}/>
                <em className="range-value">{state.dateFontSize}px</em>
              </div>
              <CellEditor state={state} selectedCell={selectedCell} updateSlot={updateSlot} onClose={() => setSelectedCell(null)}/>
            </div>
          )}

          {warnings.length > 0 && <div className="validation-card"><div><AlertTriangle size={16}/><strong>Validation</strong></div>{warnings.map(w => <p key={w}>{w}</p>)}</div>}
        </aside>
      </div>

      <div className="mobile-overlay no-print">
        <div className="mobile-card">
          <Monitor size={40}/>
          <h2>Desktop Required</h2>
          <p>Label Studio needs a wider screen to display the editor properly. Please use a tablet in landscape or desktop browser.</p>
          <small>Minimum width: 900px</small>
        </div>
      </div>

      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </div>
  )
}

function LabelCanvas({ state, slotsMatrix, metrics, selectedCell, setSelectedCell }: {
  state: TemplateState
  slotsMatrix: (Slot | undefined)[][]
  metrics: ReturnType<typeof computeGridMetrics>
  selectedCell: { row: number; col: number } | null
  setSelectedCell: (v: { row: number; col: number } | null) => void
}) {
  const qr = makeQrPattern(state.boxId)
  const pxPerMm = 3.78 * state.zoom
  const canvasW = state.canvasWidthMm * pxPerMm
  const canvasH = state.canvasHeightMm * pxPerMm
  const cellWpx = metrics.cellWidth * pxPerMm
  const cellHpx = metrics.cellHeight * pxPerMm
  const gapHpx = metrics.effectiveGapH * pxPerMm
  const gapVpx = state.gridGapVMm * pxPerMm

  return (
    <div className="label-shadow" style={{ width: canvasW, height: canvasH }}>
      <div className="label-canvas" style={{ padding: `${state.paddingVMm * pxPerMm}px ${metrics.effectivePaddingH * pxPerMm}px` }}>
        {state.showHeader && (
          <div className="label-header" style={{ height: state.headerHeightMm * pxPerMm }}>
            <div className="header-main"><strong style={{ fontSize: state.boxNameFontSize * state.zoom }}>{state.boxName}</strong><span style={{ fontSize: state.locationFontSize * state.zoom }}>{state.location}</span></div>
            <div className="header-id"><span style={{ fontSize: state.boxIdFontSize * state.zoom }}>{state.boxId}</span><small>{state.rows} × {state.columns} box</small></div>
          </div>
        )}
        <div className="grid-wrap" style={{ gap: `${gapVpx}px` }}>
          {state.showCoordinates && (
            <div className="col-coordinates-row" style={{ paddingLeft: 20, display: 'grid', gridTemplateColumns: `repeat(${state.columns}, ${cellWpx}px)`, gap: `0 ${gapHpx}px` }}>
              {Array.from({ length: state.columns }, (_, c) => <div className="col-coordinate" key={c}>{c + 1}</div>)}
            </div>
          )}
          {slotsMatrix.map((row, r) => (
            <div className="grid-row" key={r} style={{ height: cellHpx }}>
              {state.showCoordinates && <div className="row-coordinate">{rowLabel(r)}</div>}
              <div className="cells-row" style={{ gridTemplateColumns: `repeat(${state.columns}, ${cellWpx}px)`, gridTemplateRows: `${cellHpx}px`, gap: `0 ${gapHpx}px` }}>
                {row.map((slot, c) => {
                  const coordinate = `${rowLabel(r)}${c + 1}`
                  const selected = selectedCell?.row === r && selectedCell?.col === c
                  return (
                    <button
                      key={coordinate}
                      className={`label-cell ${slot ? 'occupied' : 'empty'} ${selected ? 'cell-selected' : ''} ${state.showGridLines ? '' : 'no-lines'}`}
                      style={{ width: cellWpx, height: cellHpx }}
                      onClick={() => setSelectedCell({ row: r, col: c })}
                    >
                      {slot ? (
                        <>
                          {state.showName && <strong title={slot.name} style={{ fontSize: state.nameFontSize + 'px', fontWeight: state.boldName ? 700 : 400 }}>{slot.name}</strong>}
                          {state.showInfo && <span title={slot.info} style={{ fontSize: state.infoFontSize + 'px', fontWeight: state.boldInfo ? 700 : 400 }}>{slot.info}</span>}
                          {state.showDate && <small style={{ fontSize: state.dateFontSize + 'px', fontWeight: state.boldDate ? 700 : 400 }}>{slot.date}</small>}
                        </>
                      ) : (
                        <span className="empty-content">{coordinate}</span>
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
            <div className="footer-meta"><strong style={{ fontSize: state.ownerFontSize * state.zoom }}>{state.owner}</strong></div>
            {state.printDate && <div className="footer-date"><span style={{ fontSize: state.printDateFontSize * state.zoom }}>Printed {state.printDate}</span></div>}
            {state.showQr && <div className="qr" aria-label="QR code preview">{qr.map((on, i) => <i key={i} className={on ? 'on' : ''}/>)}</div>}
          </div>
        )}
      </div>
    </div>
  )
}


function NumberField({ label, value, onChange, min = 0, max = 999, step = 1, suffix, disabled, locked, onLockClick }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; disabled?: boolean; locked?: boolean; onLockClick?: () => void }) {
  return <label className={`field${locked ? ' field-locked' : ''}`}><span>{label}{onLockClick !== undefined && <button type="button" className={`lock-btn${locked ? ' lock-active' : ''}`} onClick={e => { e.preventDefault(); onLockClick() }}><Lock size={10}/></button>}</span><div className="number-input"><input type="number" value={value} min={min} max={max} step={step} disabled={disabled || locked} onChange={e => onChange(Number(e.target.value))}/>{suffix && <em>{suffix}</em>}</div></label>
}

function RangeField({ label, value, onChange, min = 3, max = 16, step = 0.5, suffix = 'px' }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return <label className="field range-field"><span>{label}<em className="range-value">{value}{suffix}</em></span><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}/></label>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}/><i/></label>
}

function CellEditor({ state, selectedCell, updateSlot, onClose }: { state: TemplateState; selectedCell: { row: number; col: number } | null; updateSlot: (r: number, c: number, p: Partial<Slot>) => void; onClose: () => void }) {
  if (!selectedCell) {
    return <div className="cell-editor cell-editor-empty"><span>Click a cell to edit</span></div>
  }
  const slot = state.slots.find(s => s.row === selectedCell.row && s.col === selectedCell.col)
  return (
    <div className="cell-editor">
      <div className="cell-editor-title"><div><strong>Edit {rowLabel(selectedCell.row)}{selectedCell.col + 1}</strong><span>Preview record</span></div><button onClick={onClose}>×</button></div>
      <label className="field"><span>Name</span><input value={slot?.name || ''} placeholder="Sample name" onChange={e => updateSlot(selectedCell.row, selectedCell.col, { name: e.target.value })}/></label>
      <label className="field"><span>Info</span><input value={slot?.info || ''} placeholder="Passage, treatment, concentration…" onChange={e => updateSlot(selectedCell.row, selectedCell.col, { info: e.target.value })}/></label>
      <label className="field"><span>Date</span><input type="date" value={slot?.date || ''} onChange={e => updateSlot(selectedCell.row, selectedCell.col, { date: e.target.value })}/></label>
    </div>
  )
}

export default App
