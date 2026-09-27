import { useEffect, useMemo, useRef, useState } from 'react'
import { classifyWafer, examples, parseWaferCsv, type WaferGrid } from './model/classifier'

const copyGrid = (grid: WaferGrid) => grid.map((row) => [...row])
const initialExample = examples.find((example) => example.label === 'Edge-Ring') ?? examples[0]

function MiniMap({ grid }: { grid: WaferGrid }) {
  return (
    <div className="mini-map" style={{ gridTemplateColumns: `repeat(${grid[0]?.length ?? 1}, 1fr)` }} aria-hidden="true">
      {grid.flat().map((cell, index) => <i key={index} className={`mini-cell state-${cell}`} />)}
    </div>
  )
}

function App() {
  const [selectedId, setSelectedId] = useState(initialExample?.id ?? '')
  const [grid, setGrid] = useState<WaferGrid>(() => copyGrid(initialExample?.grid ?? []))
  const [source, setSource] = useState(initialExample?.label ?? 'No map loaded')
  const [fileError, setFileError] = useState('')
  const [editCount, setEditCount] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const analysis = useMemo(() => grid.length ? classifyWafer(grid) : null, [grid])
  const dieCount = grid.flat().filter((cell) => cell !== 0).length
  const failedCount = grid.flat().filter((cell) => cell === 2).length
  const top = analysis?.candidates[0]

  useEffect(() => {
    if (!zoomed || !stageRef.current) return
    const stage = stageRef.current
    stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2
    stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2
  }, [zoomed])

  const loadExample = (id: string) => {
    const example = examples.find((item) => item.id === id)
    if (!example) return
    setGrid(copyGrid(example.grid))
    setSelectedId(id)
    setSource(example.label)
    setEditCount(0)
    setFileError('')
  }

  const updateDie = (row: number, column: number) => {
    if (grid[row]?.[column] === 0) return
    setGrid((current) => current.map((line, y) =>
      line.map((cell, x) => y === row && x === column ? (cell === 1 ? 2 : 1) : cell),
    ))
    setEditCount((count) => count + 1)
  }

  const handleUpload = async (file?: File) => {
    if (!file) return
    try {
      const parsed = parseWaferCsv(await file.text())
      if (parsed.length > 64 || parsed[0].length > 64) throw new Error('The interactive editor supports up to 64 × 64 dies. Use a smaller CSV grid.')
      setGrid(parsed)
      setSource(file.name)
      setSelectedId('')
      setEditCount(0)
      setFileError('')
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Could not read this CSV.')
    } finally {
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Wafer Lens home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>wafer<span className="brand-light">lens</span></span>
        </a>
        <span className="header-context">Pattern triage studio <span className="header-dot" /> Portfolio prototype</span>
        <a className="header-link" href="#method">How to read this <span aria-hidden="true">↗</span></a>
      </header>

      <main id="top">
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <div className="signal-line"><span className="pulse" /> Inspect the pattern, question the match</div>
            <h1 id="page-title">Wafer patterns,<br /><em>in focus.</em></h1>
            <p>Explore how a die-map resembles known spatial patterns. Change a cell and watch the evidence move with it.</p>
            <div className="intro-actions">
              <a className="primary-link" href="#studio">Open the studio <span aria-hidden="true">↘</span></a>
              <span>Interactive demo · No account needed</span>
            </div>
          </div>
          <div className="hero-optics" aria-hidden="true">
            <img src="/wafer-optics.svg" alt="" />
            <div className="optic-corner corner-a" /><div className="optic-corner corner-b" />
            <span className="optic-caption">FIG 01 / SPATIAL SIGNATURE</span>
            <span className="optic-coordinate">x 026.4<br />y 078.9</span>
          </div>
        </section>

        <section className="studio" id="studio" aria-labelledby="studio-title">
          <div className="section-heading">
            <div><span className="section-index">01 / WORKSPACE</span><h2 id="studio-title">Pattern workbench</h2></div>
            <p>Start with a sample or bring a CSV. Click any active die to switch between pass and fail.</p>
          </div>

          <div className="workspace">
            <div className="map-panel">
              <div className="panel-toolbar">
                <div><span className="panel-kicker">CURRENT MAP</span><h3>{source}</h3></div>
                <span className="live-badge"><span /> Live analysis</span>
              </div>
              <a className="grid-skip" href="#map-controls">Skip die grid to map controls ↓</a>
              <div ref={stageRef} className={`map-stage ${zoomed ? 'zoomed' : ''}`}>
                <div className="map-axis axis-top">0 <span>DIE FIELD / X</span> {String(grid[0]?.length ?? 0).padStart(2, '0')}</div>
                <div className="wafer-shell">
                  <div className="wafer-map" role="group" aria-label="Editable wafer die map" style={{ gridTemplateColumns: `repeat(${grid[0]?.length ?? 1}, 1fr)` }}>
                    {grid.map((row, rowIndex) => row.map((cell, columnIndex) => (
                      <button
                        key={`${rowIndex}-${columnIndex}`}
                        type="button"
                        className={`die state-${cell}`}
                        disabled={cell === 0}
                        onClick={() => updateDie(rowIndex, columnIndex)}
                        aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}: ${cell === 0 ? 'outside wafer' : cell === 1 ? 'pass, click to mark fail' : 'fail, click to mark pass'}`}
                      />
                    )))}
                  </div>
                </div>
                <div className="map-axis axis-bottom">{String(grid.length).padStart(2, '0')} <span>FLAT NOTCH / ORIENTATION</span> 0</div>
              </div>
              <div className="map-footer">
                <div className="legend"><span><i className="legend-pass" /> Pass</span><span><i className="legend-fail" /> Fail</span><span><i className="legend-void" /> Outside</span></div>
                <div className="map-stats"><strong>{failedCount}</strong> failed / {dieCount} active <span className="stat-separator">|</span> {editCount} edits</div>
                <button className="map-zoom" type="button" aria-pressed={zoomed} onClick={() => setZoomed((value) => !value)}>{zoomed ? 'Fit map' : 'Zoom to edit'}</button>
              </div>
            </div>

            <aside className="controls-panel" aria-label="Map inputs and analysis">
              <div className="control-block">
                <div className="block-head"><span className="block-number">A</span><h3 id="map-controls" tabIndex={-1}>Choose a map</h3></div>
                <div className="example-list">
                  {examples.map((example) => (
                    <button key={example.id} type="button" className={`example-option ${selectedId === example.id ? 'selected' : ''}`} onClick={() => loadExample(example.id)} aria-pressed={selectedId === example.id}>
                      <MiniMap grid={example.grid} />
                      <span className="example-copy"><strong>{example.label}</strong><small>{example.description}</small></span>
                      <span className="option-arrow" aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
                <label className="upload-control">
                  <input ref={uploadRef} type="file" accept=".csv,text/csv" onChange={(event) => void handleUpload(event.target.files?.[0])} />
                  <span aria-hidden="true">＋</span> Upload a die-map CSV
                </label>
                {fileError && <p className="input-error" role="alert">{fileError}</p>}
                <p className="input-hint">Rectangular matrix: 0 outside, 1 pass, 2 fail. Files stay in this browser session.</p>
              </div>
              <div className="control-block interpretation">
                <div className="block-head"><span className="block-number">B</span><h3>Reading the result</h3></div>
                <p>Scores show relative support from nearby example maps, not calibrated probabilities. A pattern match does not identify a root cause.</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="analysis-section" aria-labelledby="analysis-title">
          <div className="section-heading analysis-heading">
            <div><span className="section-index">02 / INTERPRETATION</span><h2 id="analysis-title">What the map suggests</h2></div>
            <p>Pattern labels help prioritize review. Engineering context and process data are still required.</p>
          </div>
          <div className="analysis-grid">
            <div className="readout-panel">
              <div className="readout-top"><span>TOP MATCH</span><span>LIVE / {String(grid.length).padStart(2, '0')} × {String(grid[0]?.length ?? 0).padStart(2, '0')}</span></div>
              <div className="top-match"><div><span className="match-label">Current strongest pattern</span><h3>{analysis?.abstained ? 'Insufficient match' : top?.label ?? 'No analysis'}</h3></div><div className="match-glyph" aria-hidden="true">⌖</div></div>
              <p className="match-note">{analysis?.abstained ? analysis.reason ?? 'The examples do not support a reliable pattern suggestion.' : 'This is a similarity cue for triage, not a diagnosis.'}</p>
              <div className="support-list">
                {analysis?.candidates.map((candidate, index) => (
                  <div className="support-row" key={candidate.label}>
                    <div className="support-name"><span>{String(index + 1).padStart(2, '0')}</span><strong>{candidate.label}</strong><span>{Math.round(candidate.score * 100)}%</span></div>
                    <div className="support-track"><i style={{ width: `${Math.max(0, Math.min(100, candidate.score * 100))}%` }} /></div>
                  </div>
                ))}
              </div>
              <span className="score-footnote">Relative neighbor support · Scores are not calibrated confidence</span>
            </div>
            <div className="uncertainty-panel">
              <span className="metric-title">UNCERTAINTY / 0–1</span>
              <div className="uncertainty-value">{analysis ? analysis.uncertainty.toFixed(2) : '—'}<span>/ 1.00</span></div>
              <div className="uncertainty-scale"><i style={{ left: `${Math.max(0, Math.min(100, (analysis?.uncertainty ?? 0) * 100))}%` }} /></div>
              <div className="scale-labels"><span>Lower</span><span>Higher</span></div>
              <p>Higher values mean the available examples disagree more or offer weaker support. Review the neighboring maps below.</p>
            </div>
          </div>

          <div className="evidence-panel">
            <div className="evidence-head"><div><span className="section-index">EVIDENCE TRACE</span><h3>Closest examples</h3></div><p>Nearest labeled maps used to form this suggestion</p></div>
            <div className="neighbors">
              {analysis?.nearestExamples.map((example, index) => (
                <div className="neighbor" key={`${example.id}-${index}`}>
                  <div className="neighbor-map"><MiniMap grid={example.grid} /></div>
                  <div className="neighbor-meta"><span>NEIGHBOR {String(index + 1).padStart(2, '0')}</span><strong>{example.label}</strong><small>Distance {example.distance.toFixed(3)}</small></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="method-section" id="method" aria-labelledby="method-title">
          <div><span className="section-index">03 / MODEL CARD</span><h2 id="method-title">Built for review,<br />not verdicts.</h2></div>
          <div className="method-copy">
            <p>This prototype compares a wafer map with labeled examples using a lightweight nearest-neighbor pattern model. The suggestions respond immediately as you edit the die field.</p>
            <dl>
              <div><dt>Data boundary</dt><dd>Derived from the public <a href="https://www.kaggle.com/datasets/qingyi/wm811k-wafer-map/metadata" target="_blank" rel="noreferrer">WM-811K wafer-map listing</a> by QINGYI, marked CC0 on Kaggle; upstream provenance is unverified. No SK hynix internal data.</dd></div>
              <div><dt>Evaluation boundary</dt><dd>Exploratory v2 evaluation on 351 maps: 60.4% correct including abstentions; 22.8% abstained; 78.2% correct among accepted maps. V2 training and validation lots were disjoint, but 36 evaluated wafer IDs appeared in earlier v1 training. Labels may be noisy; this is not a validated production yield predictor.</dd></div>
              <div><dt>Decision boundary</dt><dd>Use a suggested pattern to organize further inspection. Confirm any action with process history, metrology, and engineering review.</dd></div>
            </dl>
          </div>
        </section>
      </main>
      <footer><span className="footer-brand">wafer<span>lens</span></span><span>Independent AI hackathon portfolio prototype</span><span>Pattern triage, with evidence in view.</span></footer>
    </div>
  )
}

export default App
