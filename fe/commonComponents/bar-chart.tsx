import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface BarChartData {
  label: string;
  value?: number;
  values?: number[];
  color?: string;
  colors?: string[];
  legendLabels?: string[];
}

export interface BarChartProps {
  data: BarChartData[];
  width?: number;
  height?: number;
  colors?: string[];
  showLabels?: boolean;
  showValues?: boolean;
  showGrid?: boolean;
  orientation?: 'vertical' | 'horizontal';
  margin?: { top: number; right: number; bottom: number; left: number };
  className?: string;
  onBarClick?: (data: BarChartData, index: number) => void;
  tooltipFormat?: (d: BarChartData) => string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  barPadding?: number;
  animated?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  width = 600,
  height = 400,
  colors = d3.schemeCategory10,
  showLabels = true,
  showValues = true,
  showGrid = true,
  orientation = 'vertical',
  margin: marginProp = { top: 40, right: 40, bottom: 60, left: 60 },
  className = "",
  onBarClick,
  tooltipFormat = (d) => `${d.label}: ${d.value}`,
  yAxisLabel = "",
  xAxisLabel = "",
  barPadding = 0.1,
  animated = true,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    try {
      setError(null);
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      // Use wider left margin for horizontal charts to fit category labels
      const margin = orientation === 'horizontal'
        ? { ...marginProp, left: Math.max(marginProp.left, 100) }
        : marginProp;
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const g = svg
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const colorScale = d3.scaleOrdinal(colors);

      // Check if we have grouped data (values array) or single data (value)
      const isGrouped = data.some(d => d?.values && d?.values?.length > 0);

      let xScale: any;
      let yScale: any;
      let maxValue = 0;

      if (isGrouped) {
        // For grouped bars, find the max value across all groups
        maxValue = d3.max(data, d => d3.max(d?.values || [])) || 0;
      } else {
        // For single bars, find the max value
        maxValue = d3.max(data, d => d?.value || 0) || 0;
      }

      if (orientation === 'vertical') {
        xScale = d3.scaleBand()
          .domain(data.map(d => d?.label || ''))
          .range([0, innerWidth])
          .padding(barPadding);

        yScale = d3.scaleLinear()
          .domain([0, maxValue])
          .nice()
          .range([innerHeight, 0]);
      } else {
        xScale = d3.scaleLinear()
          .domain([0, maxValue * 1.1]) // Add 10% padding for value labels
          .nice()
          .range([0, innerWidth]);

        yScale = d3.scaleBand()
          .domain(data.map(d => d?.label || ''))
          .range([0, innerHeight])
          .padding(barPadding);
      }

      // Grid lines
      if (showGrid) {
        if (orientation === 'vertical') {
          const yAxisGrid = d3.axisLeft(yScale)
            .tickSize(-innerWidth)
            .tickFormat(() => "");

          g.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,0)`)
            .call(yAxisGrid)
            .style("stroke-dasharray", "3,3")
            .style("opacity", 0.3);
        } else {
          const xAxisGrid = d3.axisBottom(xScale)
            .tickSize(-innerHeight)
            .tickFormat(() => "");

          g.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxisGrid)
            .style("stroke-dasharray", "3,3")
            .style("opacity", 0.3);
        }
      }

      // Axes
      if (orientation === 'vertical') {
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        g.append("g")
          .attr("transform", `translate(0,${innerHeight})`)
          .call(xAxis);

        g.append("g")
          .call(yAxis);

        // Axis labels
        if (xAxisLabel) {
          svg.append("text")
            .attr("transform", `translate(${width / 2},${height - 10})`)
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .text(xAxisLabel);
        }

        if (yAxisLabel) {
          svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0)
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .text(yAxisLabel);
        }
      } else {
        const maxLabelChars = 12;
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale)
          .tickFormat((label: string) =>
            label.length > maxLabelChars ? label.slice(0, maxLabelChars) + '...' : label
          );

        g.append("g")
          .attr("transform", `translate(0,${innerHeight})`)
          .call(xAxis);

        const yAxisG = g.append("g")
          .call(yAxis);

        // Add title tooltip on truncated labels so full text shows on hover
        yAxisG.selectAll(".tick text")
          .each(function (this: SVGTextElement, d: any) {
            if (String(d).length > maxLabelChars) {
              d3.select(this).append("title").text(d);
            }
          });

        // Axis labels
        if (xAxisLabel) {
          svg.append("text")
            .attr("transform", `translate(${width / 2},${height - 10})`)
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .text(xAxisLabel);
        }

        if (yAxisLabel) {
          svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0)
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .text(yAxisLabel);
        }
      }

      // Bars
      if (isGrouped) {
        // Overlapping bars rendering — render larger values first (background), then smaller on top
        const groupColors = d3.schemeCategory10.slice(0, 2);

        if (orientation === 'vertical') {
          data.forEach((d, i) => {
            const group = g.append("g").attr("class", "bar-group");
            const values = d?.values || [];

            // Sort indices by value descending so larger bar renders first (behind)
            const sortedIndices = values
              .map((v, idx) => ({ value: v, index: idx }))
              .sort((a, b) => b.value - a.value);

            sortedIndices.forEach(({ value, index: j }) => {
              if (value !== null) {
                const bar = group.append("rect")
                  .attr("x", xScale(d?.label) || 0)
                  .attr("width", xScale.bandwidth())
                  .attr("y", innerHeight)
                  .attr("height", 0)
                  .attr("fill", d?.colors?.[j] || groupColors[j])
                  .attr("rx", 3)
                  .style("cursor", "pointer");

                if (animated) {
                  bar.transition()
                    .duration(800)
                    .attr("y", yScale(value) || 0)
                    .attr("height", innerHeight - (yScale(value) || 0));
                } else {
                  bar
                    .attr("y", yScale(value) || 0)
                    .attr("height", innerHeight - (yScale(value) || 0));
                }

                // Interactivity
                bar
                  .on("mouseover", function (event) {
                    d3.select(this)
                      .transition()
                      .duration(200)
                      .attr("opacity", 0.8);

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

                    tooltip.html(`${d.label} - ${d.legendLabels?.[j] || (j === 0 ? 'Actual' : 'Forecast')}: ${value !== null ? '$' + value.toLocaleString() : 'N/A'}`)
                      .style("left", (event.pageX + 10) + "px")
                      .style("top", (event.pageY - 28) + "px");
                  })
                  .on("mouseout", function () {
                    d3.select(this)
                      .transition()
                      .duration(200)
                      .attr("opacity", 1);

                    d3.selectAll(".tooltip").remove();
                  })
                  .on("click", (event) => {
                    if (onBarClick) {
                      onBarClick({ ...d, value }, i);
                    }
                  });
              }
            });
          });
        } else {
          // Horizontal overlapping bars
          data.forEach((d, i) => {
            const group = g.append("g").attr("class", "bar-group");
            const values = d?.values || [];

            const sortedIndices = values
              .map((v, idx) => ({ value: v, index: idx }))
              .sort((a, b) => b.value - a.value);

            sortedIndices.forEach(({ value, index: j }) => {
              if (value !== null) {
                const bar = group.append("rect")
                  .attr("x", 0)
                  .attr("width", 0)
                  .attr("y", yScale(d?.label) || 0)
                  .attr("height", yScale.bandwidth())
                  .attr("fill", d?.colors?.[j] || groupColors[j])
                  .attr("rx", 3)
                  .style("cursor", "pointer");

                if (animated) {
                  bar.transition()
                    .duration(800)
                    .attr("width", xScale(value) || 0);
                } else {
                  bar
                    .attr("width", xScale(value) || 0);
                }

                // Interactivity
                bar
                  .on("mouseover", function (event) {
                    d3.select(this)
                      .transition()
                      .duration(200)
                      .attr("opacity", 0.8);

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

                    tooltip.html(`${d.label} - ${d.legendLabels?.[j] || (j === 0 ? 'Actual' : 'Forecast')}: ${value !== null ? '$' + value.toLocaleString() : 'N/A'}`)
                      .style("left", (event.pageX + 10) + "px")
                      .style("top", (event.pageY - 28) + "px");
                  })
                  .on("mouseout", function () {
                    d3.select(this)
                      .transition()
                      .duration(200)
                      .attr("opacity", 1);

                    d3.selectAll(".tooltip").remove();
                  })
                  .on("click", (event) => {
                    if (onBarClick) {
                      onBarClick({ ...d, value }, i);
                    }
                  });
              }
            });
          });
        }
      } else {
        // Single bars rendering (original logic)
        const bars = g.selectAll(".bar")
          .data(data)
          .enter()
          .append("g")
          .attr("class", "bar");

        let barElement;
        if (orientation === 'vertical') {
          barElement = bars.append("rect")
            .attr("x", d => xScale(d.label) || 0)
            .attr("width", xScale.bandwidth())
            .attr("y", innerHeight)
            .attr("height", 0)
            .attr("fill", (d, i) => d?.color || colorScale(i.toString()))
            .style("cursor", "pointer");

          if (animated) {
            barElement.transition()
              .duration(800)
              .attr("y", d => yScale(d.value) || 0)
              .attr("height", d => innerHeight - (yScale(d.value) || 0));
          } else {
            barElement
              .attr("y", d => yScale(d.value) || 0)
              .attr("height", d => innerHeight - (yScale(d.value) || 0));
          }
        } else {
          barElement = bars.append("rect")
            .attr("x", 0)
            .attr("width", 0)
            .attr("y", d => yScale(d.label) || 0)
            .attr("height", yScale.bandwidth())
            .attr("fill", (d, i) => d?.color || colorScale(i.toString()))
            .style("cursor", "pointer");

          if (animated) {
            barElement.transition()
              .duration(800)
              .attr("width", d => xScale(d.value) || 0);
          } else {
            barElement
              .attr("width", d => xScale(d.value) || 0);
          }
        }

        // Interactivity for single bars
        barElement
          .on("mouseover", function (event, d) {
            d3.select(this)
              .transition()
              .duration(200)
              .attr("opacity", 0.8);

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

            tooltip.html(tooltipFormat(d))
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 28) + "px");
          })
          .on("mouseout", function () {
            d3.select(this)
              .transition()
              .duration(200)
              .attr("opacity", 1);

            d3.selectAll(".tooltip").remove();
          })
          .on("click", (event, d) => {
            if (onBarClick) {
              onBarClick(d, data.indexOf(d));
            }
          });
      }

      // Value labels
      if (showValues) {
        if (orientation === 'vertical') {
          if (isGrouped) {
            data.forEach((d, i) => {
              const values = d?.values || [];
              // Show label for actual value (index 0) on top of the bar
              if (values[0] !== null && values[0] !== undefined) {
                g.append("text")
                  .attr("x", (xScale(d.label) || 0) + xScale.bandwidth() / 2)
                  .attr("y", (yScale(values[0]) || 0) - 5)
                  .attr("text-anchor", "middle")
                  .style("font-size", "12px")
                  .style("fill", "#333")
                  .text('$' + values[0].toLocaleString());
              }
            });
          } else {
            g.selectAll(".value-label")
              .data(data)
              .enter()
              .append("text")
              .attr("x", d => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
              .attr("y", d => (yScale(d.value) || 0) - 5)
              .attr("text-anchor", "middle")
              .style("font-size", "12px")
              .style("fill", "#333")
              .text(d => d.value?.toString() || '');
          }
        } else {
          // Horizontal orientation value labels
          if (isGrouped) {
            data.forEach((d, i) => {
              const values = d?.values || [];
              if (values[0] !== null && values[0] !== undefined) {
                g.append("text")
                  .attr("x", (xScale(values[0]) || 0) + 5)
                  .attr("y", (yScale(d.label) || 0) + yScale.bandwidth() / 2)
                  .attr("text-anchor", "start")
                  .style("font-size", "12px")
                  .style("fill", "#333")
                  .text('$' + values[0].toLocaleString());
              }
            });
          } else {
            if (!isGrouped) {
              g.selectAll(".value-label")
                .data(data)
                .enter()
                .append("text")
                .attr("x", d => (xScale(d.value) || 0) + 5)
                .attr("y", d => (yScale(d.label) || 0) + yScale.bandwidth() / 2)
                .attr("text-anchor", "start")
                .style("font-size", "12px")
                .style("fill", "#333")
                .text(d => d.value?.toString() || '');
            }
          }
        }
      }
    } catch (err) {
      console.error('BarChart rendering error:', err);
      setError('Failed to render chart');
    }
  }, [data, width, height, colors, showLabels, showValues, showGrid, orientation, marginProp, onBarClick, tooltipFormat, xAxisLabel, yAxisLabel, barPadding, animated]);

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

export default BarChart;
