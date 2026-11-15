import React, { useMemo, useState } from 'react';
import { SynodicSample } from '../utils/lunarEphemeris';

interface SynodicChartProps {
  samples: SynodicSample[];
  horizonMaskDeg: number;
  siteName: string;
}

export const SynodicChart: React.FC<SynodicChartProps> = ({
  samples,
  horizonMaskDeg,
  siteName,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 640;
  const height = 210;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const { minY, maxY, sunPath, earthPath, horizonY, maskY } = useMemo(() => {
    let lo = -8;
    let hi = 12;
    for (const s of samples) {
      lo = Math.min(lo, s.effectiveSunDeg, s.effectiveEarthDeg);
      hi = Math.max(hi, s.effectiveSunDeg, s.effectiveEarthDeg);
    }
    const minVal = Math.floor(lo - 1);
    const maxVal = Math.ceil(hi + 1);
    const toX = (i: number) =>
      padL + (i / Math.max(samples.length - 1, 1)) * plotW;
    const toY = (v: number) =>
      padT + ((maxVal - v) / Math.max(maxVal - minVal, 1)) * plotH;

    const sunD = samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(s.effectiveSunDeg).toFixed(1)}`)
      .join(' ');
    const earthD = samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(s.effectiveEarthDeg).toFixed(1)}`)
      .join(' ');

    return {
      minY: minVal,
      maxY: maxVal,
      sunPath: sunD,
      earthPath: earthD,
      horizonY: toY(0),
      maskY: toY(horizonMaskDeg),
    };
  }, [samples, horizonMaskDeg, plotW, plotH]);

  const toX = (i: number) =>
    padL + (i / Math.max(samples.length - 1, 1)) * plotW;
  const toY = (v: number) =>
    padT + ((maxY - v) / Math.max(maxY - minY, 1)) * plotH;

  const activeIdx =
    hoverIdx !== null ? hoverIdx : Math.floor(samples.length / 2);
  const activeSample = samples[activeIdx];
  const centerX = toX(Math.floor(samples.length / 2));

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxY - minY > 18 ? 5 : 4;
    for (let v = Math.ceil(minY / step) * step; v <= maxY; v += step) {
      ticks.push(v);
    }
    if (!ticks.includes(0)) ticks.push(0);
    return ticks.sort((a, b) => a - b);
  }, [minY, maxY]);

  return (
    <div className="bg-[#0B111C] border border-slate-800/90 rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            30-Day Synodic Horizon Profile — {siteName}
          </h3>
          <p className="text-xs text-slate-400">
            Effective elevation above local crater horizon (mask {horizonMaskDeg.toFixed(1)}°)
          </p>
        </div>
        {activeSample && (
          <div className="flex items-center gap-4 text-xs font-mono-tabular">
            <span className="text-slate-400">{activeSample.dateLabel} UTC</span>
            <span className="text-amber-400">
              Sun {activeSample.effectiveSunDeg >= 0 ? '+' : ''}
              {activeSample.effectiveSunDeg.toFixed(2)}°
            </span>
            <span className="text-sky-400">
              Earth {activeSample.effectiveEarthDeg >= 0 ? '+' : ''}
              {activeSample.effectiveEarthDeg.toFixed(2)}°
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            const norm = Math.max(0, Math.min(1, (relX - padL) / plotW));
            const idx = Math.round(norm * (samples.length - 1));
            setHoverIdx(idx);
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Horizontal grid & Y axis ticks */}
          {yTicks.map((v) => {
            const y = toY(v);
            return (
              <g key={v}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  stroke={v === 0 ? '#475569' : '#1E293B'}
                  strokeWidth={v === 0 ? 1.2 : 0.75}
                  strokeDasharray={v === 0 ? undefined : '3 3'}
                />
                <text
                  x={padL - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#94A3B8"
                  fontSize="10"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {v}°
                </text>
              </g>
            );
          })}

          {/* Shaded below-horizon zone */}
          <rect
            x={padL}
            y={horizonY}
            width={plotW}
            height={Math.max(0, padT + plotH - horizonY)}
            fill="#020617"
            opacity={0.48}
          />

          {/* Local terrain horizon mask threshold */}
          <line
            x1={padL}
            y1={maskY}
            x2={width - padR}
            y2={maskY}
            stroke="#64748B"
            strokeWidth={0.8}
            strokeDasharray="2 3"
          />

          {/* Selected date vertical marker */}
          <line
            x1={centerX}
            y1={padT}
            x2={centerX}
            y2={padT + plotH}
            stroke="#334155"
            strokeWidth={1}
          />

          {/* Earth elevation (dashed cyan) */}
          <path
            d={earthPath}
            fill="none"
            stroke="#38BDF8"
            strokeWidth={1.75}
            strokeDasharray="5 3"
          />

          {/* Solar elevation (solid amber) */}
          <path
            d={sunPath}
            fill="none"
            stroke="#F59E0B"
            strokeWidth={2}
          />

          {/* Active hover crosshair */}
          {activeSample && (
            <g>
              <line
                x1={toX(activeIdx)}
                y1={padT}
                x2={toX(activeIdx)}
                y2={padT + plotH}
                stroke="#94A3B8"
                strokeWidth={0.9}
              />
              <circle
                cx={toX(activeIdx)}
                cy={toY(activeSample.effectiveSunDeg)}
                r={3.5}
                fill="#F59E0B"
                stroke="#0B111C"
                strokeWidth={1.5}
              />
              <circle
                cx={toX(activeIdx)}
                cy={toY(activeSample.effectiveEarthDeg)}
                r={3.5}
                fill="#38BDF8"
                stroke="#0B111C"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* X-axis date labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const idx = Math.round(t * (samples.length - 1));
            const s = samples[idx];
            if (!s) return null;
            return (
              <text
                key={idx}
                x={toX(idx)}
                y={height - 8}
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="10"
                fontFamily="IBM Plex Mono, monospace"
              >
                {s.dateLabel}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-5 mt-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-0.5 bg-amber-400 inline-block" />
          Solar elevation (effective)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-sky-400 inline-block" />
          Earth elevation (optical libration)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-2 bg-slate-950 border border-slate-700 inline-block" />
          Below geometric horizon (&lt; 0°)
        </span>
      </div>
    </div>
  );
};
