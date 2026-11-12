import { useMemo, useState } from "react";
import { format } from "date-fns";
import { bisector, extent, max } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import type { BudgetPoint } from "../../../utils/revops/mock-data";
import { clamp, formatCurrency, useElementSize } from "./chart-utils";

export default function BudgetBurndownChart({
  data,
  height = 220,
}: {
  data: BudgetPoint[];
  height?: number;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  const width = size.width || 600;
  const padding = { top: 14, right: 14, bottom: 30, left: 48 };

  const series = useMemo(() => {
    const safe = (data || [])
      .filter((d) => d && d.date)
      .map((d) => ({ ...d, dateObj: new Date(d.date) }))
      .filter((d) => !Number.isNaN(d.dateObj.getTime()));

    const innerW = Math.max(1, width - padding.left - padding.right);
    const innerH = Math.max(1, height - padding.top - padding.bottom);

    const xDomain = extent(safe, (d) => d.dateObj) as [Date | undefined, Date | undefined];
    const yMax = max(safe, (d) => Math.max(d.planned, d.actual)) ?? 0;

    const xScale = scaleTime()
      .domain([
        xDomain[0] ?? new Date(),
        xDomain[1] ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      ])
      .range([padding.left, padding.left + innerW]);

    const yScale = scaleLinear()
      .domain([0, yMax || 1])
      .nice()
      .range([padding.top + innerH, padding.top]);

    const plannedLineGen = line<(typeof safe)[number]>()
      .x((d) => xScale(d.dateObj))
      .y((d) => yScale(d.planned))
      .curve(curveMonotoneX);

    const actualLineGen = line<(typeof safe)[number]>()
      .x((d) => xScale(d.dateObj))
      .y((d) => yScale(d.actual))
      .curve(curveMonotoneX);

    const plannedLine = safe.length ? plannedLineGen(safe) ?? "" : "";
    const actualLine = safe.length ? actualLineGen(safe) ?? "" : "";

    const b = bisector((d: (typeof safe)[number]) => d.dateObj).left;

    return {
      safe,
      innerW,
      innerH,
      xScale,
      yScale,
      plannedLine,
      actualLine,
      bisectLeft: b,
    };
  }, [data, width, height]);

  const onMove = (e: React.MouseEvent) => {
    if (series.safe.length === 0) return;

    const bounds = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const xClamped = clamp(x, padding.left, width - padding.right);
    const hoveredDate = series.xScale.invert(xClamped);

    const idxRight = series.bisectLeft(series.safe, hoveredDate, 1);
    const d0 = series.safe[idxRight - 1];
    const d1 = series.safe[idxRight];
    const idx = (() => {
      if (!d0) return 0;
      if (!d1) return series.safe.length - 1;
      return hoveredDate.getTime() - d0.dateObj.getTime() > d1.dateObj.getTime() - hoveredDate.getTime()
        ? idxRight
        : idxRight - 1;
    })();

    const safeIdx = clamp(idx, 0, series.safe.length - 1);
    setHoverIndex(safeIdx);
    setHoverX(series.xScale(series.safe[safeIdx].dateObj));
  };

  const onLeave = () => {
    setHoverIndex(null);
  };

  const hovered = hoverIndex != null ? series.safe[hoverIndex] : null;

  return (
    <div ref={ref} className="w-full">
      <div className="relative">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          className="block"
        >
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={10}
            fill="white"
          />

          <path
            d={series.plannedLine}
            fill="none"
            stroke="#94A3B8"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <path
            d={series.actualLine}
            fill="none"
            stroke="#514ceb"
            strokeWidth={2.5}
          />

          {hoverIndex != null && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="#CBD5E1"
              strokeWidth={1}
            />
          )}

          <g>
            <text x={padding.left} y={height - 10} fill="#6B7280" fontSize={11}>
              Planned Budget
            </text>
            <text
              x={padding.left + 105}
              y={height - 10}
              fill="#6B7280"
              fontSize={11}
            >
              Actual Spent
            </text>
          </g>
        </svg>

        {hovered && hoverIndex != null && (
          <div
            className="absolute top-3 bg-[white] border border-[#E5E7EB] rounded-md px-3 py-2 text-xs shadow"
            style={{
              left: clamp(hoverX - 70, 8, Math.max(8, width - 160)),
            }}
          >
            <div className="text-[#111827] font-semibold">
              {format(new Date(hovered.date), "MMM d, yyyy")}
            </div>
            <div className="text-[#111827]">Planned: {formatCurrency(hovered.planned)}</div>
            <div className="text-[#111827]">Actual: {formatCurrency(hovered.actual)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
