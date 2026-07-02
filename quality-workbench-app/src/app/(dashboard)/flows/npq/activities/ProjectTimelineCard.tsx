'use client';

import { type ReactNode, useMemo } from 'react';

// ─── 类型 ───

export interface StageNode {
  key: string;
  label: string;
  date: string | null;
}

export interface TrialPhase {
  key: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
}

interface Props {
  stageNodes: StageNode[];
  trialPhases: TrialPhase[];
  currentStage: string;
  projectStartDate: string | null;
  projectExpectedEndDate: string | null;
  headerAction?: ReactNode;
}

interface TimelineScale {
  domainStart: Date | null;
  domainEnd: Date | null;
  pctForDate: ((d: Date) => number) | null;
}

// ─── 常量 ───

const H_PCT = 6;
const STAGE_ROW_H = 108;
const TRIAL_ROW_H = 34;
const TRIAL_HEADER_H = 28;
const MIN_SEGMENT_W_PCT = 3.4;

// ─── 工具 ───

function toDate(v: string | null): Date | null {
  if (!v) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(v: string | null): string {
  const d = toDate(v);
  if (!d) return '-';
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtDateObj(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86400000;
}

// ─── 共用尺度 —— 返回百分比位置 ───

function useSharedScale(
  stageNodes: StageNode[],
  trialPhases: TrialPhase[],
  projectStartDate: string | null,
  projectExpectedEndDate: string | null,
) {
  return useMemo<TimelineScale>(() => {
    const projectStart = toDate(projectStartDate);
    const projectEnd = toDate(projectExpectedEndDate);

    if (projectStart && projectEnd) {
      const domainStart = projectStart <= projectEnd ? projectStart : projectEnd;
      const domainEnd = projectStart <= projectEnd ? projectEnd : projectStart;
      const totalDays = Math.max(daysBetween(domainStart, domainEnd), 1);
      const pctForDate = (d: Date) =>
        H_PCT + (daysBetween(domainStart, d) / totalDays) * (100 - H_PCT * 2);

      return { domainStart, domainEnd, pctForDate };
    }

    const dates: Date[] = [];
    for (const n of stageNodes) {
      const d = toDate(n.date);
      if (d) dates.push(d);
    }
    for (const p of trialPhases) {
      const sd = toDate(p.startDate);
      const ed = toDate(p.endDate);
      if (sd) dates.push(sd);
      if (ed) dates.push(ed);
    }
    if (projectStart) dates.push(projectStart);
    if (projectEnd) dates.push(projectEnd);

    if (dates.length === 0) {
      return {
        domainStart: null,
        domainEnd: null,
        pctForDate: null,
      };
    }

    let minD = dates[0]!;
    let maxD = dates[0]!;
    for (const d of dates) {
      if (d < minD) minD = d;
      if (d > maxD) maxD = d;
    }

    const span = daysBetween(minD, maxD) || 1;
    const pad = span * 0.03;
    const domainStart = new Date(minD.getTime() - pad * 86400000);
    const domainEnd = new Date(maxD.getTime() + pad * 86400000);
    const totalDays = Math.max(daysBetween(domainStart, domainEnd), 1);

    const pctForDate = (d: Date) =>
      H_PCT + (daysBetween(domainStart, d) / totalDays) * (100 - H_PCT * 2);

    return { domainStart, domainEnd, pctForDate };
  }, [stageNodes, trialPhases, projectStartDate, projectExpectedEndDate]);
}

function clampPct(value: number): number {
  return Math.max(H_PCT, Math.min(100 - H_PCT, value));
}

function isSameStage(a: string, b: string): boolean {
  return a.replace(/\s/g, '') === b.replace(/\s/g, '');
}

function useTrialBars(trialPhases: TrialPhase[], pctForDate: ((d: Date) => number) | null) {
  return useMemo(() => {
    return trialPhases
      .map((phase) => {
        const start = toDate(phase.startDate);
        const end = toDate(phase.endDate);
        const p1 = start && pctForDate ? clampPct(pctForDate(start)) : null;
        const p2 = end && pctForDate ? clampPct(pctForDate(end)) : null;
        if (p1 === null && p2 === null) return null;
        const rawStart = p1 ?? p2!;
        const rawEnd = p2 ?? p1!;
        const left = Math.min(rawStart, rawEnd);
        const right = Math.min(100 - H_PCT, Math.max(rawStart, rawEnd));
        return {
          phase,
          startText: fmtDate(phase.startDate),
          endText: fmtDate(phase.endDate),
          left,
          width: Math.min(100 - H_PCT - left, Math.max(right - left, MIN_SEGMENT_W_PCT)),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.left - b.left);
  }, [trialPhases, pctForDate]);
}

// ─── 主组件 ───

export function ProjectTimelineCard({
  stageNodes,
  trialPhases,
  currentStage,
  projectStartDate,
  projectExpectedEndDate,
  headerAction,
}: Props) {
  const scale = useSharedScale(stageNodes, trialPhases, projectStartDate, projectExpectedEndDate);
  const trialBars = useTrialBars(trialPhases, scale.pctForDate);
  const hasTrial = trialPhases.length > 0;
  const ready = Boolean(scale.domainStart && scale.domainEnd && scale.pctForDate);
  const displayStartText = scale.domainStart ? fmtDateObj(scale.domainStart) : '-';
  const displayEndText = scale.domainEnd ? fmtDateObj(scale.domainEnd) : '-';
  const trialHeight = hasTrial ? TRIAL_HEADER_H + Math.max(trialBars.length, 1) * TRIAL_ROW_H : 0;
  const cardH = STAGE_ROW_H + trialHeight + (hasTrial ? 14 : 0);
  const currentNode = stageNodes.find((node) => isSameStage(node.key, currentStage) || isSameStage(node.label, currentStage));
  const currentDate = toDate(currentNode?.date ?? null);
  const currentProgressPct = currentDate && scale.pctForDate ? clampPct(scale.pctForDate(currentDate)) - H_PCT : 0;
  const today = startOfToday();
  const todayPct =
    scale.domainStart && scale.domainEnd && scale.pctForDate && today >= scale.domainStart && today <= scale.domainEnd
      ? clampPct(scale.pctForDate(today))
      : null;

  return (
    <section data-testid="project-timeline-card" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <span className="text-sm font-semibold text-slate-950">项目时间轴</span>
          <span className="ml-2 text-xs text-slate-500">阶段里程碑与试产计划</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            当前阶段 <span className="font-semibold text-slate-950">{currentStage || '-'}</span>
          </span>
          {headerAction}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="relative" style={{ height: cardH }}>
          <div className="absolute inset-x-0 rounded-md bg-slate-50" style={{ top: 0, height: STAGE_ROW_H }}>
            <div className="absolute left-3 top-3">
              <LaneLabel label="阶段里程碑" />
            </div>
            <div className="relative h-full">
              {ready && (
                <>
                  <div
                    className="absolute h-px bg-slate-300"
                    style={{ top: 66, left: `${H_PCT}%`, right: `${H_PCT}%` }}
                  />
                  <div
                    className="absolute h-px bg-slate-900"
                    style={{ top: 66, left: `${H_PCT}%`, width: `${currentProgressPct}%` }}
                  />
                  <div
                    className="absolute text-[11px] text-slate-400"
                    style={{ top: 84, left: `${H_PCT}%`, transform: 'translateX(-4px)' }}
                  >
                    {displayStartText}
                  </div>
                  <div
                    className="absolute whitespace-nowrap text-[11px] text-slate-400"
                    style={{ top: 84, right: `${H_PCT}%`, transform: 'translateX(4px)' }}
                  >
                    {displayEndText}
                  </div>
                  {todayPct !== null && <TodayMarker pct={todayPct} />}
                </>
              )}
              {stageNodes.map((n) => {
                const d = toDate(n.date);
                const pct = d && scale.pctForDate ? clampPct(scale.pctForDate(d)) : H_PCT;
                return (
                  <StageDot key={n.key} node={n} dateText={fmtDate(n.date)} pct={pct} currentStage={currentStage} />
                );
              })}
            </div>
          </div>

          {hasTrial && (
            <div
              className="absolute inset-x-0 rounded-md border border-sky-100 bg-sky-50/60"
              style={{ top: STAGE_ROW_H + 10, height: trialHeight }}
            >
              <div className="absolute left-3 top-2">
                <LaneLabel label="试产计划" />
              </div>
              <div className="relative h-full">
                {trialBars.length === 0 ? (
                  <div className="absolute left-3 top-9 text-xs text-slate-400">暂无试产计划</div>
                ) : trialBars.map((item, index) => (
                  <TrialGanttRow
                    key={item.phase.key}
                    label={item.phase.label}
                    left={item.left}
                    width={item.width}
                    top={TRIAL_HEADER_H + index * TRIAL_ROW_H}
                    startText={item.startText}
                    endText={item.endText}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ProjectTimelineInline({
  stageNodes,
  trialPhases,
  currentStage,
  projectStartDate,
  projectExpectedEndDate,
}: Props) {
  const scale = useSharedScale(stageNodes, trialPhases, projectStartDate, projectExpectedEndDate);
  const trialBars = useTrialBars(trialPhases.slice(0, 1), scale.pctForDate);
  const ready = Boolean(scale.domainStart && scale.domainEnd && scale.pctForDate);
  const displayStartText = scale.domainStart ? fmtDateObj(scale.domainStart) : '-';
  const displayEndText = scale.domainEnd ? fmtDateObj(scale.domainEnd) : '-';
  const currentNode = stageNodes.find((node) => isSameStage(node.key, currentStage) || isSameStage(node.label, currentStage));
  const currentDate = toDate(currentNode?.date ?? null);
  const currentProgressPct = currentDate && scale.pctForDate ? clampPct(scale.pctForDate(currentDate)) : H_PCT;
  const today = startOfToday();
  const todayPct =
    scale.domainStart && scale.domainEnd && scale.pctForDate && today >= scale.domainStart && today <= scale.domainEnd
      ? clampPct(scale.pctForDate(today))
      : null;
  const hasTrial = trialBars.length > 0;
  const svgW = 760;
  const svgH = 150;
  const xForPct = (pct: number) => (pct / 100) * svgW;
  const axisStartX = xForPct(H_PCT);
  const axisEndX = xForPct(100 - H_PCT);
  const axisY = 62;

  return (
    <div className="mt-4 rounded-md bg-slate-50/80 px-3 py-3" data-testid="project-summary-timeline">
      <svg className="block h-auto w-full" viewBox={`0 0 ${svgW} ${svgH}`} role="img" aria-label="项目 TR 时间轴">
        <rect x="0" y="0" width={svgW} height={svgH} rx="8" fill="transparent" />
        <g>
          <rect x="0" y="0" width="54" height="15" rx="7.5" fill="white" stroke="#e2e8f0" />
          <text x="27" y="11" textAnchor="middle" fontSize="8.2" fontWeight="500" fill="#64748b">TR 时间轴</text>
        </g>
        {ready && (
          <>
            <line x1={axisStartX} y1={axisY} x2={axisEndX} y2={axisY} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={axisStartX} y1={axisY} x2={xForPct(currentProgressPct)} y2={axisY} stroke="#0f172a" strokeWidth="1.2" />
            <text x={axisStartX} y="82" textAnchor="middle" fontSize="8.5" fill="#94a3b8">{displayStartText}</text>
            <text x={axisEndX} y="82" textAnchor="middle" fontSize="8.5" fill="#94a3b8">{displayEndText}</text>
            {todayPct !== null && (
              <g transform={`translate(${xForPct(todayPct)} 70)`} aria-label="当前日期">
                <path d="M 0 -8 L 5 0 L -5 0 Z" fill="#f59e0b" />
                <text x="0" y="11" textAnchor="middle" fontSize="8.5" fontWeight="500" fill="#d97706">今天</text>
              </g>
            )}
          </>
        )}
        {stageNodes.map((node) => {
          const d = toDate(node.date);
          const pct = d && scale.pctForDate ? clampPct(scale.pctForDate(d)) : H_PCT;
          const x = xForPct(pct);
          const isCurrent = isSameStage(node.key, currentStage) || isSameStage(node.label, currentStage);
          return (
            <g key={node.key} transform={`translate(${x} 0)`}>
              <rect
                x={node.label.length > 3 ? -18 : -14}
                y="30"
                width={node.label.length > 3 ? 36 : 28}
                height="12"
                rx="6"
                fill={isCurrent ? '#0f172a' : '#ffffff'}
                stroke={isCurrent ? '#0f172a' : '#e2e8f0'}
              />
              <text x="0" y="39" textAnchor="middle" fontSize="7.8" fontWeight={isCurrent ? 700 : 500} fill={isCurrent ? '#ffffff' : '#475569'}>
                {node.label}
              </text>
              <text x="0" y="51" textAnchor="middle" fontSize="7" fill={isCurrent ? '#0f172a' : '#64748b'}>
                {fmtDate(node.date)}
              </text>
            </g>
          );
        })}
        <g transform="translate(0 104)">
          <rect x="0" y="0" width="50" height="15" rx="7.5" fill="white" stroke="#e2e8f0" />
          <text x="25" y="11" textAnchor="middle" fontSize="8.2" fontWeight="500" fill="#64748b">最近试产</text>
          {hasTrial ? trialBars.map((item) => {
            const rawX = xForPct(item.left);
            const w = Math.max(46, (item.width / 100) * svgW);
            const x = Math.min(rawX, svgW - w - 118);
            const dateText = item.startText === item.endText ? item.startText : `${item.startText} - ${item.endText}`;
            const dateX = Math.min(x + w + 8, svgW - 104);
            return (
              <g key={item.phase.key}>
                <rect x={x} y="26" width={w} height="14" rx="4" fill="#0ea5e9" />
                <text x={x + w / 2} y="36.5" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="white">{item.phase.label}</text>
                <text x={dateX} y="36.5" fontSize="8.5" fill="#0369a1">{dateText}</text>
              </g>
            );
          }) : (
            <text x={axisStartX} y="36.5" fontSize="8.5" fill="#94a3b8">暂无最近试产节点</text>
          )}
        </g>
      </svg>
    </div>
  );
}

// ── TR 阶段圆点 ──

function LaneLabel({ label }: { label: string }) {
  return (
    <div className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
      {label}
    </div>
  );
}

function StageDot({
  node,
  dateText,
  pct,
  currentStage,
  top = 32,
  compact = false,
  showDate = true,
}: {
  node: StageNode;
  dateText: string;
  pct: number;
  currentStage: string;
  top?: number;
  compact?: boolean;
  showDate?: boolean;
}) {
  const isCurrent = isSameStage(node.key, currentStage) || isSameStage(node.label, currentStage);

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{ left: `${pct}%`, top, transform: 'translateX(-50%)', width: compact ? 64 : 76 }}
    >
      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-center leading-none ${compact ? 'text-[11px]' : 'text-xs'} ${isCurrent ? 'bg-slate-950 font-semibold text-white' : 'bg-white font-medium text-slate-600 ring-1 ring-slate-200'}`}>
        {node.label}
      </span>
      {showDate && (
        <span className={`mt-1 whitespace-nowrap text-center leading-none ${compact ? 'text-[10px]' : 'text-[11px]'} ${isCurrent ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
          {dateText}
        </span>
      )}
    </div>
  );
}

function TodayMarker({ pct, top = 72 }: { pct: number; top?: number }) {
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{ left: `${pct}%`, top, transform: 'translateX(-50%)' }}
      title="当前日期"
      aria-label="当前日期"
    >
      <div className="h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-amber-500" />
      <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium leading-none text-amber-600">今天</span>
    </div>
  );
}

// ── 试产甘特行 ──

function TrialGanttRow({
  label,
  left,
  width,
  top,
  startText,
  endText,
  compact = false,
}: {
  label: string;
  left: number;
  width: number;
  top: number;
  startText: string;
  endText: string;
  compact?: boolean;
}) {
  const rangeText = startText === endText ? startText : `${startText} - ${endText}`;
  const dateLeft = Math.min(left + width + 1.2, 82);

  return (
    <div className={`absolute inset-x-0 ${compact ? 'h-6' : 'h-8'}`} style={{ top }} title={`${label}: ${rangeText}`}>
      <div
        className={`absolute flex items-center overflow-hidden rounded bg-sky-500 px-1.5 text-[10px] font-semibold text-white shadow-sm ${compact ? 'top-1 h-4' : 'top-1.5 h-4'}`}
        style={{ left: `${left}%`, width: `${width}%` }}
      >
        {label}
      </div>
      <div
        className={`absolute whitespace-nowrap text-sky-700 ${compact ? 'top-0.5 text-[10px]' : 'top-1 text-[11px]'}`}
        style={{ left: `${dateLeft}%` }}
      >
        {rangeText}
      </div>
    </div>
  );
}
