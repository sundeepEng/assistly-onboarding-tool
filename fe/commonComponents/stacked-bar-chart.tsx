import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface StackedBarSegment {
  key: string;
  value: number;
}

export interface StackedBarChartData {
  label: string;
  segments: StackedBarSegment[];
}

export interface StackedBarChartProps {
  data: StackedBarChartData[];
  /**
   * Ordered list of segment keys with their display labels and colors.
   * Order here also defines the stacking order from left to right.
   */
  series: { key: string; label: string; color: string }[];
  width?: number;
  height?: number;
  showLegend?: boolean;
  showValues?: boolean;
  margin?: { top: number; right: number; bottom: number; left: number };
  className?: string;
  onSegmentClick?: (
    row: StackedBarChartData,
    segment: StackedBarSegment,
    seriesKey: string,
  ) => void;
  /**
   * Custom tooltip renderer. Receives the hovered row and the active segment's
   * series key, and should return an HTML string. By default the tooltip lists
   * every segment in the row with its color swatch, label, and value, with the
   * hovered segment highlighted.
   */
  tooltipFormat?: (
    row: StackedBarChartData,
    activeKey: string,
    series: { key: string; label: string; color: string }[],
  ) => string;
  barPadding?: number;
  lightTooltip?: boolean;
}

const StackedBarChart: React.FC<StackedBarChartProps> = ({
  data,
  series,
  width = 700,
  height = 420,
  showLegend = true,
  showValues = false,
  margin = { top: 20, right: 30, bottom: 60, left: 120 },
  className = "",
  onSegmentClick,
  tooltipFormat,
  barPadding = 0.35,
  lightTooltip = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length || !series.length) return;

    try {
      setError(null);
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      svg.attr("width", width).attr("height", height);

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Tooltip
      const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "stacked-bar-chart-tooltip")
        .style("position", "absolute")
        .style("padding", lightTooltip ? "10px 14px" : "6px 10px")
        .style("background", lightTooltip ? "#fff" : "rgba(0,0,0,0.78)")
        .style("color", lightTooltip ? "#111" : "#fff")
        .style("border-radius", lightTooltip ? "10px" : "4px")
        .style("box-shadow", lightTooltip ? "0 4px 16px rgba(0,0,0,0.13)" : "none")
        .style("font-size", "13px")
        .style("min-width", lightTooltip ? "180px" : "auto")
        .style("pointer-events", "none")
        .style("opacity", 0);

      const seriesByKey = new Map(series.map((s) => [s.key, s]));

      const defaultTooltip = (
        row: StackedBarChartData,
        activeKey: string,
      ) => {
        const textColor = lightTooltip ? "#374151" : "#fff";
        const valuColor = lightTooltip ? "#111" : "#fff";
        const rows = series
          .map((s) => {
            const seg = row.segments.find((sg) => sg.key === s.key);
            const value = seg?.value ?? 0;
            const isActive = s.key === activeKey;
            return `
              <div style="display:flex;align-items:center;gap:8px;margin:3px 0;${isActive ? `font-weight:700;` : `opacity:0.85;`}">
                <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${s.color};flex-shrink:0;"></span>
                <span style="flex:1;color:${textColor};">${s.label}</span>
                <span style="font-weight:600;color:${valuColor};">${value}</span>
              </div>`;
          })
          .join("");
        return `
          <div style="font-weight:700;margin-bottom:6px;font-size:14px;color:${valuColor};">${row.label}</div>
          ${rows}`;
      };

      const renderTooltip = (
        row: StackedBarChartData,
        activeKey: string,
      ) =>
        tooltipFormat
          ? tooltipFormat(row, activeKey, series)
          : defaultTooltip(row, activeKey);

      // Compute per-row totals to scale bars
      const rowTotals = data.map((row) =>
        row.segments.reduce((sum, s) => sum + (s.value || 0), 0),
      );
      const maxTotal = d3.max(rowTotals) || 1;

      const yScale = d3
        .scaleBand()
        .domain(data.map((d) => d.label))
        .range([0, innerHeight])
        .padding(barPadding);

      const xScale = d3
        .scaleLinear()
        .domain([0, maxTotal])
        .range([0, innerWidth]);

      // Y-axis (row labels)
      const yAxis = d3.axisLeft(yScale).tickSize(0);
      const maxLabelWidth = 120;
      g.append("g")
        .call(yAxis)
        .call((sel) => sel.select(".domain").remove())
        .selectAll<SVGTextElement, string>("text")
        .style("font-size", "13px")
        .style("fill", "#374151")
        .each(function (d) {
          const textEl = this as SVGTextElement;
          const fullLabel = d as string;
          textEl.textContent = fullLabel;
          // Append a native SVG <title> for full-text tooltip on hover
          const titleEl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "title",
          );
          titleEl.textContent = fullLabel;
          textEl.appendChild(titleEl);

          if (textEl.getComputedTextLength() <= maxLabelWidth) return;

          let truncated = fullLabel;
          while (
            truncated.length > 1 &&
            textEl.getComputedTextLength() > maxLabelWidth
          ) {
            truncated = truncated.slice(0, -1);
            textEl.firstChild!.nodeValue = `${truncated}…`;
          }
        });

      // Render stacked segments
      data.forEach((row) => {
        let cursorX = 0;
        const rowY = yScale(row.label) || 0;
        const barH = yScale.bandwidth();

        // Render in series order so colors stay consistent across rows
        series.forEach((s) => {
          const segment = row.segments.find((seg) => seg.key === s.key);
          if (!segment || !segment.value) return;

          const segWidth = xScale(segment.value);

          const rect = g
            .append("rect")
            .attr("x", cursorX)
            .attr("y", rowY)
            .attr("width", segWidth)
            .attr("height", barH)
            .attr("fill", s.color)
            .style("cursor", onSegmentClick ? "pointer" : "default");

          rect
            .on("mouseover", function (event) {
              d3.select(this).transition().duration(120).attr("opacity", 0.85);
              tooltip
                .style("opacity", 1)
                .html(renderTooltip(row, s.key))
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 20}px`);
            })
            .on("mousemove", function (event) {
              tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 20}px`);
            })
            .on("mouseout", function () {
              d3.select(this).transition().duration(120).attr("opacity", 1);
              tooltip.style("opacity", 0);
            })
            .on("click", () => {
              if (onSegmentClick) onSegmentClick(row, segment, s.key);
            });

          if (showValues && segWidth > 18) {
            g.append("text")
              .attr("x", cursorX + segWidth / 2)
              .attr("y", rowY + barH / 2)
              .attr("dy", "0.35em")
              .attr("text-anchor", "middle")
              .style("fill", "#fff")
              .style("font-size", "12px")
              .style("font-weight", "600")
              .style("pointer-events", "none")
              .text(segment.value);
          }

          cursorX += segWidth;
        });
      });

      // Legend
      if (showLegend) {
        const legendStartY = margin.top + innerHeight + 30;
        const availableWidth = width - margin.left;
        const itemGap = 18;
        const rowGap = 22;
        const swatchSize = 12;

        const legend = svg
          .append("g")
          .attr("transform", `translate(${margin.left},${legendStartY})`);

        // First pass: append all items at origin so we can measure text widths
        const legendItemData: Array<{
          g: d3.Selection<SVGGElement, unknown, null, undefined>;
          measuredWidth: number;
        }> = [];

        series.forEach((s) => {
          const item = legend.append("g");

          item
            .append("circle")
            .attr("cx", swatchSize / 2)
            .attr("cy", swatchSize / 2)
            .attr("r", swatchSize / 2)
            .attr("fill", s.color);

          const text = item
            .append("text")
            .attr("x", swatchSize + 6)
            .attr("y", swatchSize / 2)
            .attr("dy", "0.35em")
            .style("font-size", "13px")
            .style("fill", "#374151")
            .text(s.label);

          const node = text.node() as SVGTextElement | null;
          const textW = node ? node.getComputedTextLength() : s.label.length * 7.5;
          legendItemData.push({ g: item, measuredWidth: swatchSize + 6 + textW + itemGap });
        });

        // Second pass: reposition items with wrapping when they exceed available width
        let xCursor = 0;
        let yCursor = 0;

        legendItemData.forEach(({ g, measuredWidth }) => {
          if (xCursor > 0 && xCursor + measuredWidth - itemGap > availableWidth) {
            xCursor = 0;
            yCursor += rowGap;
          }
          g.attr("transform", `translate(${xCursor},${yCursor})`);
          xCursor += measuredWidth;
        });

        // Expand the SVG height to fit all legend rows
        const neededHeight = legendStartY + yCursor + swatchSize + 10;
        if (neededHeight > height) {
          svg.attr("height", neededHeight);
        }
      }

      // suppress unused warning
      void seriesByKey;

      return () => {
        tooltip.remove();
      };
    } catch (e: any) {
      setError(e?.message || "Failed to render stacked bar chart");
    }
  }, [
    data,
    series,
    width,
    height,
    showLegend,
    showValues,
    margin,
    onSegmentClick,
    tooltipFormat,
    barPadding,
    lightTooltip,
  ]);

  if (error) {
    return <div className={`text-red-500 text-sm ${className}`}>{error}</div>;
  }

  return (
    <div className={className}>
      <svg ref={svgRef} />
    </div>
  );
};

export default StackedBarChart;
