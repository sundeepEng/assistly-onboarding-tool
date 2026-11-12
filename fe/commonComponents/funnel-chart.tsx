import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface FunnelChartData {
  label: string;
  value: number;
  color?: string;
}

export interface FunnelChartProps {
  data: FunnelChartData[];
  width?: number;
  height?: number;
  colors?: string[];
  showLabels?: boolean;
  showValues?: boolean;
  margin?: { top: number; right: number; bottom: number; left: number };
  className?: string;
  onSegmentClick?: (data: FunnelChartData, index: number) => void;
  tooltipFormat?: (d: FunnelChartData) => string;
  animated?: boolean;
  /**
   * Width of each segment as a fraction of total width.
   * If provided, segments will use these fractions; otherwise widths
   * shrink linearly with the value.
   */
  segmentWidths?: number[];
  /**
   * Gap between stacked segments in pixels.
   */
  segmentGap?: number;
}

const DEFAULT_COLORS = [
  "#8a5cf6",
  "#06b6d4",
  // "#f97316",
  "#8dc248",
  "#e35518",
];

// const DEFAULT_COLORS = [
//   "#514CEB",
//   "#E9E9F9",
//   "#FFE9E0",
//   "#8dc248",
//   "#E6FBF5",
// ];

const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  width = 600,
  height = 400,
  colors = DEFAULT_COLORS,
  showLabels = true,
  showValues = true,
  margin = { top: 20, right: 140, bottom: 20, left: 20 },
  className = "",
  onSegmentClick,
  tooltipFormat = (d) => `${d.label}: ${d.value}`,
  animated = false,
  segmentWidths,
  segmentGap = 2,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    try {
      setError(null);
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      svg.attr("width", width).attr("height", height);

      // Define per-color linear gradients (top → bottom, full color → 30% opacity)
      const defs = svg.append("defs");
      colors.forEach((color, i) => {
        const grad = defs
          .append("linearGradient")
          .attr("id", `funnel-grad-${i}`)
          .attr("x1", "0%").attr("y1", "0%")
          .attr("x2", "0%").attr("y2", "100%");
        grad.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", color)
          .attr("stop-opacity", 0.7);
        grad.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", color)
          .attr("stop-opacity", 0.2);
      });

      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Tooltip
      const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "funnel-chart-tooltip")
        .style("position", "absolute")
        .style("padding", "6px 10px")
        .style("background", "rgba(0,0,0,0.75)")
        .style("color", "#fff")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0);

      const segmentHeight =
        (innerHeight - segmentGap * (data.length - 1)) / data.length;
      const centerX = innerWidth / 2;

      // Fixed funnel shape: linearly decreases from 100% → 15% of innerWidth
      // based purely on position — counts do NOT affect the shape.
      const topWidths = data.map((d, i) => {
        if (segmentWidths && segmentWidths[i] != null) {
          return segmentWidths[i] * innerWidth;
        }
        const fraction =
          data.length === 1
            ? 1
            : 1 - (i / (data.length - 1)) * 0.85;
        return fraction * innerWidth;
      });

      // Bottom width of segment i is top width of segment i+1 (or a point)
      const bottomWidths = topWidths.map((_, i) =>
        i < topWidths.length - 1 ? topWidths[i + 1] : 0
      );

      data.forEach((d, i) => {
        const yTop = i * (segmentHeight + segmentGap);
        const yBottom = yTop + segmentHeight;
        const topW = topWidths[i];
        const bottomW = bottomWidths[i];

        const points = [
          [centerX - topW / 2, yTop],
          [centerX + topW / 2, yTop],
          [centerX + bottomW / 2, yBottom],
          [centerX - bottomW / 2, yBottom],
        ]
          .map((p) => p.join(","))
          .join(" ");

        const colorIdx = i % colors.length;
        const fill = d.color ? d.color : `url(#funnel-grad-${colorIdx})`;

        const polygon = g
          .append("polygon")
          .attr("points", points)
          .attr("fill", fill)
          .style("cursor", onSegmentClick ? "pointer" : "default")
          .style("opacity", animated ? 0 : 1);

        if (animated) {
          polygon
            .transition()
            .duration(600)
            .delay(i * 100)
            .style("opacity", 1);
        }

        polygon
          .on("mouseover", function (event) {
            d3.select(this).transition().duration(150).attr("opacity", 0.85);
            tooltip
              .style("opacity", 1)
              .html(tooltipFormat(d))
              .style("left", `${event.pageX + 10}px`)
              .style("top", `${event.pageY - 20}px`);
          })
          .on("mousemove", function (event) {
            tooltip
              .style("left", `${event.pageX + 10}px`)
              .style("top", `${event.pageY - 20}px`);
          })
          .on("mouseout", function () {
            d3.select(this).transition().duration(150).attr("opacity", 1);
            tooltip.style("opacity", 0);
          })
          .on("click", () => {
            if (onSegmentClick) onSegmentClick(d, i);
          });

        // Value label inside the segment (centered)
        if (showValues) {
          g.append("text")
            .attr("x", centerX)
            .attr("y", yTop + segmentHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("fill", "#61615e")
            .style("font-size", "16px")
            .style("font-weight", "800")
            .style("pointer-events", "none")
            .text(d.value);
        }

        // External label to the right of the segment
        if (showLabels) {
          g.append("text")
            .attr("x", centerX + topW / 2 + 12)
            .attr("y", yTop + segmentHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("fill", "#6b7280")
            .style("font-size", "13px")
            .text(d.label);
        }
      });

      return () => {
        tooltip.remove();
      };
    } catch (e: any) {
      setError(e?.message || "Failed to render funnel chart");
    }
  }, [
    data,
    width,
    height,
    colors,
    showLabels,
    showValues,
    margin,
    onSegmentClick,
    tooltipFormat,
    animated,
    segmentWidths,
    segmentGap,
  ]);

  if (error) {
    return (
      <div className={`text-red-500 text-sm ${className}`}>{error}</div>
    );
  }

  return (
    <div className={className}>
      <svg ref={svgRef} />
    </div>
  );
};

export default FunnelChart;
