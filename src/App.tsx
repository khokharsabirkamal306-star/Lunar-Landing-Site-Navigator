import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Layers,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { LUNAR_SITES } from './data/lunarSites';
import {
  MissionPriority,
  SiteAssessment,
  computeLunarEphemeris,
  computeSynodicProfile,
  evaluateSiteAtDate,
  formatSelenographicCoord,
} from './utils/lunarEphemeris';
import {
  CameraPreset,
  LunarGlobeViewport,
} from './components/LunarGlobeViewport';
import { LocalTerrainViewport } from './components/LocalTerrainViewport';
import { SynodicChart } from './components/SynodicChart';

type WorkspaceTab = 'explorer' | 'analyzer' | 'compare' | 'methodology';
type SortKey = 'index' | 'sun' | 'earth' | 'slope' | 'elev';

function toDateInputValue(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('explorer');
  const [selectedSiteId, setSelectedSiteId] = useState<string>(LUNAR_SITES[0].id);

  // Ephemeris epoch defaults to current date
  const [baseDateStr, setBaseDateStr] = useState<string>('2026-11-14');
  const [dayOffset, setDayOffset] = useState<number>(0); // -15 to +15 days around baseDate
  const [utcHour, setUtcHour] = useState<number>(12);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Mission analyzer parameters
  const [priority, setPriority] = useState<MissionPriority>('balanced');
  const [maxSlopeLimitDeg, setMaxSlopeLimitDeg] = useState<number>(12);
  const [showSlopeMap, setShowSlopeMap] = useState<boolean>(false);

  // 3D Explorer viewport controls & collapsible dock
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('south-pole');
  const [presetTrigger, setPresetTrigger] = useState<number>(0);
  const [showGraticule, setShowGraticule] = useState<boolean>(true);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showMarkers, setShowMarkers] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  // Comparison table sorting
  const [sortKey, setSortKey] = useState<SortKey>('index');

  // Keyboard shortcut 'H' to toggle 3D HUD dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Synodic time-lapse playback (advances 1 lunar day every ~2.5s)
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setDayOffset((prev) => {
        const next = prev + 0.12;
        return next > 15 ? -15 : next;
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const observationDate = useMemo(() => {
    const parts = baseDateStr.split('-').map(Number);
    const y = parts[0] || 2026;
    const m = (parts[1] || 11) - 1;
    const d = parts[2] || 14;
    const ms =
      Date.UTC(y, m, d, utcHour, 0, 0) + dayOffset * 86400000;
    return new Date(ms);
  }, [baseDateStr, dayOffset, utcHour]);

  const ephemeris = useMemo(
    () => computeLunarEphemeris(observationDate),
    [observationDate],
  );

  const assessments = useMemo(() => {
    const map: Record<string, SiteAssessment> = {};
    for (const site of LUNAR_SITES) {
      map[site.id] = evaluateSiteAtDate(
        site,
        ephemeris,
        priority,
        maxSlopeLimitDeg,
      );
    }
    return map;
  }, [ephemeris, priority, maxSlopeLimitDeg]);

  const activeSite = useMemo(
    () => LUNAR_SITES.find((s) => s.id === selectedSiteId) || LUNAR_SITES[0],
    [selectedSiteId],
  );
  const activeAssessment = assessments[activeSite.id];

  const synodicSamples = useMemo(
    () => computeSynodicProfile(activeSite, observationDate, 30, 61),
    [activeSite, observationDate],
  );

  const sortedAssessments = useMemo(() => {
    const list = LUNAR_SITES.map((s) => assessments[s.id]);
    list.sort((a, b) => {
      if (sortKey === 'index') return b.compositeIndex - a.compositeIndex;
      if (sortKey === 'sun')
        return b.effectiveSunElevationDeg - a.effectiveSunElevationDeg;
      if (sortKey === 'earth')
        return b.effectiveEarthElevationDeg - a.effectiveEarthElevationDeg;
      if (sortKey === 'slope') return a.site.meanSlopeDeg - b.site.meanSlopeDeg;
      return b.site.elevationKm - a.site.elevationKm;
    });
    return list;
  }, [assessments, sortKey]);

  const handleSelectCamera = (preset: CameraPreset) => {
    setCameraPreset(preset);
    setPresetTrigger((n) => n + 1);
  };

  const formatUtcDisplay = (d: Date) => {
    const iso = d.toISOString();
    return `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`;
  };

  const getStatusGlyph = (label: SiteAssessment['suitabilityLabel']) => {
    if (label === 'Nominal')
      return <span className="text-emerald-400">● Nominal</span>;
    if (label === 'Marginal')
      return <span className="text-amber-400">▲ Marginal</span>;
    return <span className="text-rose-400">✖ Shadowed</span>;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#06090F] text-[#E6EDF7]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="h-14 shrink-0 border-b border-slate-800/90 bg-[#070B13] px-6 flex items-center justify-between gap-8 z-30">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#explorer"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('explorer');
          }}
          className="font-display text-lg font-semibold tracking-wider text-slate-100 whitespace-nowrap shrink-0"
        >
          LUNA NAV
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary workspace navigation"
          className="flex items-center gap-6 overflow-x-auto"
        >
          {(
            [
              ['explorer', '3D Explorer'],
              ['analyzer', 'Site Analyzer'],
              ['compare', 'Comparison'],
              ['methodology', 'Methodology'],
            ] as const
          ).map(([id, label]) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-sky-400 text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary CTA */}
        <div className="shrink-0">
          <button
            onClick={() =>
              setActiveTab(activeTab === 'analyzer' ? 'explorer' : 'analyzer')
            }
            className="px-4 py-2 text-xs font-semibold rounded-md bg-sky-400 text-slate-950 hover:bg-sky-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {activeTab === 'analyzer' ? '3D Globe View' : 'Analyze Site'}
          </button>
        </div>
      </header>

      {/* Workspace 1: Full-Viewport 3D Lunar South Pole & Globe Explorer */}
      {activeTab === 'explorer' && (
        <main className="relative flex-1 h-[calc(100vh-3.5rem)] overflow-hidden">
          <LunarGlobeViewport
            sites={LUNAR_SITES}
            selectedSiteId={selectedSiteId}
            onSelectSite={setSelectedSiteId}
            ephemeris={ephemeris}
            assessments={assessments}
            cameraPreset={cameraPreset}
            presetTrigger={presetTrigger}
            showGraticule={showGraticule}
            showVectors={showVectors}
            showMarkers={showMarkers}
            isPlaying={isPlaying}
          />

          {/* Minimal Top-Left Uncluttered Telemetry Readout (solid dark surface, zero backdrop-blur over WebGL) */}
          <div className="absolute top-4 left-4 z-10 bg-[#0B111C]/95 border border-slate-800 rounded-lg px-4 py-3 max-w-sm pointer-events-auto">
            <div className="flex items-center justify-between gap-4">
              <h1 className="font-display text-base font-semibold text-slate-100 truncate">
                {activeSite.name}
              </h1>
              <span className="text-xs font-mono-tabular whitespace-nowrap shrink-0">
                {getStatusGlyph(activeAssessment.suitabilityLabel)}
              </span>
            </div>
            <div className="mt-1 text-xs font-mono-tabular text-slate-400">
              {formatSelenographicCoord(activeSite.latDeg, activeSite.lonDeg)} ·
              Elev +{activeSite.elevationKm.toFixed(2)} km
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-800/90 grid grid-cols-3 gap-3 text-xs font-mono-tabular">
              <div>
                <div className="text-slate-500 text-[11px]">Sun Elev</div>
                <div className="text-amber-400 font-medium mt-0.5">
                  {activeAssessment.effectiveSunElevationDeg >= 0 ? '+' : ''}
                  {activeAssessment.effectiveSunElevationDeg.toFixed(2)}°
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[11px]">Earth Elev</div>
                <div className="text-sky-400 font-medium mt-0.5">
                  {activeAssessment.effectiveEarthElevationDeg >= 0 ? '+' : ''}
                  {activeAssessment.effectiveEarthElevationDeg.toFixed(2)}°
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[11px]">Mean Slope</div>
                <div className="text-slate-200 font-medium mt-0.5">
                  {activeSite.meanSlopeDeg.toFixed(1)}°
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Bottom Control Dock (zero viewport occlusion) */}
          <div
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(960px,95vw)] transition-transform duration-200 ease-out ${
              dockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
            }`}
          >
            <div className="flex justify-center">
              <button
                onClick={() => setDockCollapsed((c) => !c)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 bg-[#0B111C] border border-b-0 border-slate-800 rounded-t-md hover:text-white cursor-pointer whitespace-nowrap"
                title="Toggle 3D controls (H)"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show Controls
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Hide Controls
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#0B111C]/96 border border-slate-800 rounded-lg p-3 shadow-2xl">
              {/* Row 1: Candidate Site Selector + Camera Presets */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-800/80">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {LUNAR_SITES.map((s) => {
                    const active = s.id === selectedSiteId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSiteId(s.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-slate-800 text-slate-100 border border-slate-600'
                            : 'bg-[#070B13] text-slate-400 border border-slate-800/90 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-xs shrink-0"
                          style={{ backgroundColor: s.accentHex }}
                        />
                        {s.name.replace(' Connecting Ridge', '').replace(' Plateau', '')}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 bg-[#070B13] p-1 rounded border border-slate-800/90">
                  {(
                    [
                      ['south-pole', 'South Pole'],
                      ['orbital', 'Orbital'],
                      ['surface-rim', 'Surface Rim'],
                      ['earth-view', 'Earth Line'],
                    ] as const
                  ).map(([preset, label]) => (
                    <button
                      key={preset}
                      onClick={() => handleSelectCamera(preset)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        cameraPreset === preset
                          ? 'bg-sky-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Ephemeris Time Scrubber & 3D Layer Toggles */}
              <div className="pt-2.5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                  <button
                    onClick={() => setIsPlaying((p) => !p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-slate-800 text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-sky-400" />
                        Simulate
                      </>
                    )}
                  </button>

                  <input
                    type="date"
                    aria-label="Observation base date"
                    value={baseDateStr}
                    onChange={(e) => {
                      if (e.target.value) setBaseDateStr(e.target.value);
                    }}
                    className="bg-[#070B13] border border-slate-800 rounded px-2 py-1 text-xs font-mono-tabular text-slate-200 shrink-0"
                  />

                  <div className="flex-1 flex items-center gap-2.5 min-w-[140px]">
                    <input
                      type="range"
                      aria-label="Synodic day offset"
                      min={-15}
                      max={15}
                      step={0.1}
                      value={dayOffset}
                      onChange={(e) => setDayOffset(parseFloat(e.target.value))}
                      className="aero-slider w-full"
                    />
                    <span className="text-xs font-mono-tabular text-slate-300 whitespace-nowrap shrink-0">
                      {formatUtcDisplay(observationDate)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowGraticule((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      showGraticule
                        ? 'border-slate-600 bg-slate-800 text-slate-100'
                        : 'border-slate-800 bg-[#070B13] text-slate-500'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    Grid
                  </button>
                  <button
                    onClick={() => setShowVectors((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      showVectors
                        ? 'border-slate-600 bg-slate-800 text-slate-100'
                        : 'border-slate-800 bg-[#070B13] text-slate-500'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Vectors
                  </button>
                  <button
                    onClick={() => setShowMarkers((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      showMarkers
                        ? 'border-slate-600 bg-slate-800 text-slate-100'
                        : 'border-slate-800 bg-[#070B13] text-slate-500'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Markers
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Workspace 2: Scientific Site Analyzer (Asymmetric Split Console) */}
      {activeTab === 'analyzer' && (
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left Parameter & Telemetry Column */}
            <aside className="w-full lg:w-[350px] shrink-0 bg-[#0B111C] border border-slate-800/90 rounded-lg p-5 space-y-5">
              <div>
                <h1 className="font-display text-lg font-semibold text-slate-100">
                  Site Ephemeris Analyzer
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Compute local horizon visibility, grazing illumination, and terrain grade margins.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="analyzer-site"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Candidate Region
                  </label>
                  <select
                    id="analyzer-site"
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    className="w-full bg-[#070B13] border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
                  >
                    {LUNAR_SITES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({Math.abs(s.latDeg).toFixed(2)}° S)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="analyzer-date"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Date (UTC)
                    </label>
                    <input
                      id="analyzer-date"
                      type="date"
                      value={toDateInputValue(observationDate)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setBaseDateStr(e.target.value);
                          setDayOffset(0);
                        }
                      }}
                      className="w-full bg-[#070B13] border border-slate-700 rounded-md px-2.5 py-2 text-xs font-mono-tabular text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="analyzer-hour"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      UTC Hour ({String(utcHour).padStart(2, '0')}:00)
                    </label>
                    <input
                      id="analyzer-hour"
                      type="range"
                      min={0}
                      max={23}
                      step={1}
                      value={utcHour}
                      onChange={(e) => setUtcHour(parseInt(e.target.value, 10))}
                      className="aero-slider w-full mt-2.5"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-300 mb-1.5">
                    Mission Weighting
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 bg-[#070B13] p-1 rounded-md border border-slate-800">
                    {(
                      [
                        ['balanced', 'Balanced'],
                        ['power', 'Solar Power'],
                        ['comms', 'Earth Comms'],
                        ['terrain', 'Terrain Safety'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setPriority(val)}
                        className={`px-2.5 py-1.5 text-xs rounded transition-colors cursor-pointer whitespace-nowrap ${
                          priority === val
                            ? 'bg-sky-400 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">
                      Max Safe Slope Threshold
                    </span>
                    <span className="font-mono-tabular text-sky-400">
                      {maxSlopeLimitDeg.toFixed(0)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Max safe slope threshold"
                    min={6}
                    max={18}
                    step={1}
                    value={maxSlopeLimitDeg}
                    onChange={(e) =>
                      setMaxSlopeLimitDeg(parseInt(e.target.value, 10))
                    }
                    className="aero-slider w-full"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-slate-300">
                    Local 3D Shading Mode
                  </span>
                  <div className="flex items-center gap-1 bg-[#070B13] p-1 rounded border border-slate-800">
                    <button
                      onClick={() => setShowSlopeMap(false)}
                      className={`px-2.5 py-1 text-xs rounded cursor-pointer whitespace-nowrap ${
                        !showSlopeMap
                          ? 'bg-slate-800 text-slate-100 font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Regolith
                    </button>
                    <button
                      onClick={() => setShowSlopeMap(true)}
                      className={`px-2.5 py-1 text-xs rounded cursor-pointer whitespace-nowrap ${
                        showSlopeMap
                          ? 'bg-slate-800 text-slate-100 font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Slope Grade
                    </button>
                  </div>
                </div>
              </div>

              {/* Calculated Telemetry Readouts */}
              <div className="pt-4 border-t border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Suitability Index</span>
                  <div className="flex items-center gap-2.5 font-mono-tabular">
                    <span className="text-lg font-semibold text-slate-100">
                      {activeAssessment.compositeIndex}/100
                    </span>
                    <span className="text-xs">
                      {getStatusGlyph(activeAssessment.suitabilityLabel)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono-tabular pt-1">
                  <div className="py-2 border-t border-slate-800/70">
                    <div className="text-slate-500">Sun Elevation</div>
                    <div className="text-amber-400 text-sm font-medium mt-0.5">
                      {activeAssessment.effectiveSunElevationDeg >= 0 ? '+' : ''}
                      {activeAssessment.effectiveSunElevationDeg.toFixed(2)}°
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Az {activeAssessment.sunAzimuthDeg.toFixed(1)}°
                    </div>
                  </div>
                  <div className="py-2 border-t border-slate-800/70">
                    <div className="text-slate-500">Earth Elevation</div>
                    <div className="text-sky-400 text-sm font-medium mt-0.5">
                      {activeAssessment.effectiveEarthElevationDeg >= 0 ? '+' : ''}
                      {activeAssessment.effectiveEarthElevationDeg.toFixed(2)}°
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Az {activeAssessment.earthAzimuthDeg.toFixed(1)}°
                    </div>
                  </div>
                  <div className="py-2 border-t border-slate-800/70">
                    <div className="text-slate-500">Sub-Solar Lat</div>
                    <div className="text-slate-200 text-sm font-medium mt-0.5">
                      {ephemeris.subSolarLatDeg.toFixed(2)}°
                    </div>
                  </div>
                  <div className="py-2 border-t border-slate-800/70">
                    <div className="text-slate-500">Earth Libration</div>
                    <div className="text-slate-200 text-sm font-medium mt-0.5">
                      {ephemeris.subEarthLatDeg >= 0 ? '+' : ''}
                      {ephemeris.subEarthLatDeg.toFixed(2)}° lat
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setBaseDateStr('2026-11-14');
                    setDayOffset(0);
                    setUtcHour(12);
                    setPriority('balanced');
                    setMaxSlopeLimitDeg(12);
                    setShowSlopeMap(false);
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#070B13] border border-slate-800 rounded-md hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Epoch & Thresholds
                </button>
              </div>
            </aside>

            {/* Right 3D Local Crater Relief Stage & Synodic Profile */}
            <div className="flex-1 min-w-0 space-y-5 w-full">
              <LocalTerrainViewport
                site={activeSite}
                assessment={activeAssessment}
                showSlopeMap={showSlopeMap}
                maxSlopeLimitDeg={maxSlopeLimitDeg}
              />

              <SynodicChart
                samples={synodicSamples}
                horizonMaskDeg={activeSite.horizonMaskDeg}
                siteName={activeSite.name}
              />

              <div className="bg-[#0B111C] border border-slate-800/90 rounded-lg p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Terrain & Geological Context — {activeSite.regionLabel}
                  </h2>
                  <span className="text-xs font-mono-tabular text-slate-400">
                    Relief {activeSite.maxReliefM} m · Mean Slope{' '}
                    {activeSite.meanSlopeDeg.toFixed(1)}° · Elevation +
                    {activeSite.elevationKm.toFixed(2)} km
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                  {activeSite.geologySummary}
                </p>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Workspace 3: Precision Candidate Comparison Matrix */}
      {activeTab === 'compare' && (
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-slate-100">
                South Pole Candidate Comparison
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Evaluated simultaneously at{' '}
                <span className="font-mono-tabular text-slate-200">
                  {formatUtcDisplay(observationDate)}
                </span>{' '}
                using {priority} mission weighting.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Sort by</span>
              <div className="flex items-center gap-1 bg-[#0B111C] p-1 rounded border border-slate-800">
                {(
                  [
                    ['index', 'Index'],
                    ['sun', 'Sun Elev'],
                    ['earth', 'Earth Elev'],
                    ['slope', 'Low Slope'],
                    ['elev', 'Altitude'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSortKey(k)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer whitespace-nowrap ${
                      sortKey === k
                        ? 'bg-sky-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#0B111C] border border-slate-800/90 rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-3.5 px-4 font-medium">Candidate Site</th>
                  <th className="py-3.5 px-4 font-medium">Selenographic Coord</th>
                  <th className="py-3.5 px-4 font-medium text-right">Elevation</th>
                  <th className="py-3.5 px-4 font-medium text-right">Mean Slope</th>
                  <th className="py-3.5 px-4 font-medium text-right">Sun Elev</th>
                  <th className="py-3.5 px-4 font-medium text-right">Earth Elev</th>
                  <th className="py-3.5 px-4 font-medium text-right">Index</th>
                  <th className="py-3.5 px-4 font-medium">Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {sortedAssessments.map((item) => {
                  const isSelected = item.site.id === selectedSiteId;
                  return (
                    <tr
                      key={item.site.id}
                      onClick={() => {
                        setSelectedSiteId(item.site.id);
                        setActiveTab('analyzer');
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-950/30'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-medium text-slate-100 whitespace-nowrap">
                        {item.site.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-400 whitespace-nowrap">
                        {formatSelenographicCoord(
                          item.site.latDeg,
                          item.site.lonDeg,
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular text-right text-slate-200">
                        +{item.site.elevationKm.toFixed(2)} km
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular text-right text-slate-200">
                        {item.site.meanSlopeDeg.toFixed(1)}°
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular text-right text-amber-400">
                        {item.effectiveSunElevationDeg >= 0 ? '+' : ''}
                        {item.effectiveSunElevationDeg.toFixed(2)}°
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular text-right text-sky-400">
                        {item.effectiveEarthElevationDeg >= 0 ? '+' : ''}
                        {item.effectiveEarthElevationDeg.toFixed(2)}°
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular text-right font-semibold text-slate-100">
                        {item.compositeIndex}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono-tabular whitespace-nowrap">
                        {getStatusGlyph(item.suitabilityLabel)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* Workspace 4: Methodology & Scientific Pipeline */}
      {activeTab === 'methodology' && (
        <main className="flex-1 max-w-[1120px] w-full mx-auto px-6 py-8 space-y-8">
          <div className="max-w-2xl">
            <h1 className="font-display text-2xl font-semibold text-slate-100">
              Ephemeris & Terrain Methodology
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              LUNA NAV models lunar South Polar illumination, Earth optical libration, and crater-rim terrain relief in a unified selenographic 3D coordinate frame.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-[#0B111C] border border-slate-800/90 rounded-lg p-6 space-y-3">
              <h2 className="text-base font-semibold text-slate-100">
                01. Selenographic Coordinate Frame
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                All candidate sites, sun vectors, and Earth sightlines operate in the Lunar Mean Earth / Polar Axis (ME) frame, where 0° longitude defines the sub-Earth prime meridian and −90° latitude marks the Lunar South Pole.
              </p>
              <div className="pt-2 text-xs font-mono-tabular text-slate-400 space-y-1">
                <div>Mean Lunar Radius: 1,737.4 km</div>
                <div>Axial Obliquity to Ecliptic: 1.5424°</div>
                <div>Synodic Solar Cycle: 29.5306 Earth days</div>
              </div>
            </section>

            <section className="bg-[#0B111C] border border-slate-800/90 rounded-lg p-6 space-y-3">
              <h2 className="text-base font-semibold text-slate-100">
                02. Solar & Earth Libration Geometry
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Sub-solar latitude tracks the Moon's seasonal 1.54° tilt relative to the ecliptic, explaining multi-week polar sunlight variations. Earth elevation incorporates optical libration in longitude (±7.7°) and latitude (±6.7°), demonstrating why near-side massifs like Malapert preserve continuous direct-to-Earth links.
              </p>
            </section>

            <section className="bg-[#0B111C] border border-slate-800/90 rounded-lg p-6 space-y-3">
              <h2 className="text-base font-semibold text-slate-100">
                03. 3D Relief & Shadow Simulation
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                The 3D globe and local 12 × 12 km crater inspector displace geometry along surface normals and compute physical directional shadows at grazing polar angles, illustrating how crater walls create Permanently Shadowed Regions (PSRs) adjacent to sunlit ridges.
              </p>
            </section>

            <section className="bg-[#0B111C] border border-slate-800/90 rounded-lg p-6 space-y-3">
              <h2 className="text-base font-semibold text-slate-100">
                04. Authoritative NASA & JPL Data Sources
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                For flight-certified landing ellipse verification, pair this analytical model with high-resolution DEMs and SPICE kernels:
              </p>
              <ul className="text-sm space-y-1.5 text-sky-400">
                <li>
                  <a
                    href="https://ssd.jpl.nasa.gov/horizons/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    NASA / JPL Horizons Ephemeris System ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://pgda.gsfc.nasa.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    NASA LRO / LOLA Planetary Geodesy Data Archive ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://quickmap.lroc.asu.edu/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    LROC QuickMap Lunar Reconnaissance Imagery ↗
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
