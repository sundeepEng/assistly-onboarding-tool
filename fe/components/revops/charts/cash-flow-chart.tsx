import { useMemo, useState } from "react";
import { format } from "date-fns";
import { bisector, extent, max } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import { area, curveMonotoneX } from "d3-shape";
import type { CashFlowPoint } from "../../../utils/revops/mock-data";
import { clamp, formatCurrency, useElementSize } from "./chart-utils";

export default function CashFlowChart({
  data,
  height = 220,
}: {
  data: CashFlowPoint[];
  height?: number;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  const width = size.width || 600;
  const padding = { top: 14, right: 14, bottom: 26, left: 36 };

  const series = useMemo(() => {
    const safe = (data || [])
      .filter((d) => d && d.date)
      .map((d) => ({ ...d, dateObj: new Date(d.date) }))
      .filter((d) => !Number.isNaN(d.dateObj.getTime()));

    const innerW = Math.max(1, width - padding.left - padding.right);
    const innerH = Math.max(1, height - padding.top - padding.bottom);

    const xDomain = extent(safe, (d) => d.dateObj) as [Date | undefined, Date | undefined];
    const yMax = max(safe, (d) => Math.max(d.income, d.expense)) ?? 0;

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

    const incomeArea = area<(typeof safe)[number]>()
      .x((d) => xScale(d.dateObj))
      .y0(() => yScale(0))
      .y1((d) => yScale(d.income))
      .curve(curveMonotoneX);

    const expenseArea = area<(typeof safe)[number]>()
      .x((d) => xScale(d.dateObj))
      .y0(() => yScale(0))
      .y1((d) => yScale(d.expense))
      .curve(curveMonotoneX);

    const areaIncomePath = safe.length ? incomeArea(safe) ?? "" : "";
    const areaExpensePath = safe.length ? expenseArea(safe) ?? "" : "";

    const b = bisector((d: (typeof safe)[number]) => d.dateObj).left;

    return {
      safe,
      innerW,
      innerH,
      xScale,
      yScale,
      areaIncomePath,
      areaExpensePath,
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

          <path d={series.areaExpensePath} fill="#111827" opacity={0.12} />
          <path d={series.areaIncomePath} fill="#514ceb" opacity={0.22} />

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
            <text x={padding.left} y={height - 8} fill="#6B7280" fontSize={11}>
              Income
            </text>
            <text x={padding.left + 60} y={height - 8} fill="#6B7280" fontSize={11}>
              Expense
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
            <div className="text-[#111827]">Income: {formatCurrency(hovered.income)}</div>
            <div className="text-[#111827]">Expense: {formatCurrency(hovered.expense)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
