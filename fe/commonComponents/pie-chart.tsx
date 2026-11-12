import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface PieChartData {
  label: string;
  value: number;
  color?: string;
}

export interface PieChartProps {
  data: PieChartData[];
  width?: number;
  height?: number;
  colors?: string[];
  showLabels?: boolean;
  showLegend?: boolean;
  legendPosition?: 'right' | 'bottom' | 'top' | 'left';
  margin?: { top: number; right: number; bottom: number; left: number };
  className?: string;
  onSliceClick?: (data: PieChartData, index: number) => void;
  innerRadius?: number; // For donut chart
  tooltipFormat?: (d: PieChartData) => string;
}

const PieChart: React.FC<PieChartProps> = ({
  data,
  width = 400,
  height = 400,
  colors = d3.schemeCategory10,
  showLabels = true,
  showLegend = true,
  legendPosition = 'right',
  margin = { top: 20, right: 20, bottom: 20, left: 20 },
  className = "",
  onSliceClick,
  innerRadius = 0,
  tooltipFormat = (d) => `${d.label}: ${d.value}`,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    try {
      setError(null);
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;

      const g = svg
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

      const colorScale = d3.scaleOrdinal(colors);

      const pie = d3.pie<PieChartData>()
        .value(d => d.value)
        .sort(null);

      const arc = d3.arc<d3.PieArcDatum<PieChartData>>()
        .innerRadius(innerRadius)
        .outerRadius(radius);

      const arcHover = d3.arc<d3.PieArcDatum<PieChartData>>()
        .innerRadius(innerRadius)
        .outerRadius(radius * 1.05);

      const arcs = g.selectAll(".arc")
        .data(pie(data))
        .enter()
        .append("g")
        .attr("class", "arc");

      arcs.append("path")
        .attr("d", arc)
        .attr("fill", (d, i) => d?.data?.color || colorScale(i.toString()))
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr("d", arcHover);

          // Tooltip
          const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("opacity", 0);

          tooltip.transition()
            .duration(200)
            .style("opacity", 1);

          tooltip.html(tooltipFormat(d?.data))
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function (event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr("d", arc);

          d3.selectAll(".tooltip").remove();
        })
        .on("click", (event, d) => {
          if (onSliceClick) {
            onSliceClick(d?.data, d?.index);
          }
        });

      if (showLabels) {
        const labelArc = d3.arc<d3.PieArcDatum<PieChartData>>()
          .innerRadius(radius * 0.7)
          .outerRadius(radius * 0.7);

        arcs.append("text")
          .attr("transform", d => `translate(${labelArc.centroid(d)})`)
          .attr("text-anchor", "middle")
          .style("font-size", "12px")
          .style("fill", "white")
          .style("font-weight", "bold")
          .style("pointer-events", "none")
          .text(d => {
            const percent = (d.value / data.reduce((sum, item) => sum + item.value, 0)) * 100;
            return percent > 5 ? `${percent.toFixed(1)}%` : "";
          });
      }

      if (showLegend) {
        const legend = svg.append("g")
          .attr("class", "legend");

        let legendX, legendY;
        const legendItemHeight = 20;
        const legendItemWidth = 15;
        const legendGap = 15; // Extra gap between items

        switch (legendPosition) {
          case 'right':
            legendX = width - margin.right - 100;
            legendY = margin.top;
            break;
          case 'bottom':
            legendX = margin.left;
            legendY = height - margin.bottom - data.length * (legendItemHeight + legendGap);
            break;
          case 'top':
            legendX = margin.left;
            legendY = margin.top;
            break;
          case 'left':
            legendX = margin.left;
            legendY = margin.top;
            break;
        }

        const legendItems = legend.selectAll(".legend-item")
          .data(data)
          .enter()
          .append("g")
          .attr("class", "legend-item")
          .attr("transform", (d, i) => {
            // Always use column layout (vertical stacking) with gap
            return `translate(${legendX}, ${legendY + i * (legendItemHeight + legendGap)})`;
          });

        legendItems.append("rect")
          .attr("width", legendItemWidth)
          .attr("height", legendItemHeight)
          .attr("fill", (d, i) => d?.color || colorScale(i.toString()));

        legendItems.append("text")
          .attr("x", legendItemWidth + 12)
          .attr("y", legendItemHeight / 2)
          .attr("dy", ".35em")
          .style("font-size", "12px")
          .text(d => d?.label || '');
      }

    } catch (err) {
      console.error('PieChart rendering error:', err);
      setError('Failed to render chart');
    }
  }, [data, width, height, colors, showLabels, showLegend, legendPosition, margin, onSliceClick, innerRadius, tooltipFormat]);

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default PieChart;
