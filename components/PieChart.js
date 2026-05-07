'use client';

import { useState } from 'react';
import styles from './PieChart.module.css';

/**
 * PieChart Component - Ready for backend data integration
 * Uses SVG for proper rendering
 * @param {Object} props
 * @param {Array} props.data - Array of objects with label, value, and optional color
 * @param {string} props.labelKey - Key for the label in data objects (default: 'label')
 * @param {string} props.valueKey - Key for the value in data objects (default: 'value')
 * @param {string} props.colorKey - Key for the color in data objects (default: 'color')
 * @param {number} props.size - Chart size in pixels (default: 150)
 * @param {boolean} props.showLegend - Show legend (default: true)
 * @param {boolean} props.donut - Show as donut chart (default: true)
 */

const DEFAULT_COLORS = [
  '#7c3aed', // Purple
  '#1e40af', // Blue
  '#16a34a', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#8b5cf6', // Violet
];

export default function PieChart({ 
  data = [], 
  labelKey = 'label', 
  valueKey = 'value',
  colorKey = 'color',
  size = 150,
  showLegend = true,
  donut = true
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!data || data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No data available</p>
      </div>
    );
  }

  // Calculate total
  const total = data.reduce((sum, item) => sum + (item[valueKey] || 0), 0);
  
  if (total === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No data available</p>
      </div>
    );
  }

  // Calculate slices with percentages and angles (linear time, no array re-alloc per item)
  const { slices } = data.reduce(
    (acc, item, index) => {
      const value = item[valueKey] || 0;
      const percentage = (value / total) * 100;
      const startPercentage = acc.cumulative;
      const endPercentage = startPercentage + percentage;

      acc.slices.push({
        label: item[labelKey] || `Item ${index + 1}`,
        value,
        percentage,
        color: item[colorKey] || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        startPercentage,
        endPercentage,
      });

      acc.cumulative = endPercentage;
      return acc;
    },
    { cumulative: 0, slices: [] },
  );

  // SVG parameters
  const center = size / 2;
  const radius = size / 2 - 2;
  const innerRadius = donut ? radius * 0.6 : 0;

  // Convert percentage to SVG arc path
  const getArcPath = (startPercent, endPercent) => {
    const startAngle = (startPercent / 100) * 360 - 90;
    const endAngle = (endPercent / 100) * 360 - 90;
    
    const startRadians = (startAngle * Math.PI) / 180;
    const endRadians = (endAngle * Math.PI) / 180;
    
    const x1 = center + radius * Math.cos(startRadians);
    const y1 = center + radius * Math.sin(startRadians);
    const x2 = center + radius * Math.cos(endRadians);
    const y2 = center + radius * Math.sin(endRadians);
    
    const largeArcFlag = endPercent - startPercent > 50 ? 1 : 0;
    
    if (donut) {
      const ix1 = center + innerRadius * Math.cos(startRadians);
      const iy1 = center + innerRadius * Math.sin(startRadians);
      const ix2 = center + innerRadius * Math.cos(endRadians);
      const iy2 = center + innerRadius * Math.sin(endRadians);
      
      return `
        M ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        L ${ix2} ${iy2}
        A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1}
        Z
      `;
    }
    
    return `
      M ${center} ${center}
      L ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
      Z
    `;
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div className={styles.pieChartContainer}>
      <div className={styles.chartWrapper}>
        <svg 
          width={size} 
          height={size} 
          viewBox={`0 0 ${size} ${size}`}
          className={styles.pieChart}
          onMouseMove={handleMouseMove}
        >
          {slices.map((slice, index) => (
            <path
              key={index}
              d={getArcPath(slice.startPercentage, slice.endPercentage)}
              fill={slice.color}
              className={`${styles.slice} ${hoveredIndex === index ? styles.sliceHovered : ''}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                filter: hoveredIndex === index ? 'brightness(1.1)' : 'none',
                transform: hoveredIndex === index ? `scale(1.02)` : 'scale(1)',
                transformOrigin: `${center}px ${center}px`
              }}
            />
          ))}
        </svg>
        {hoveredIndex !== null && (
          <div 
            className={styles.tooltip}
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y - 50
            }}
          >
            <div 
              className={styles.tooltipColor}
              style={{ backgroundColor: slices[hoveredIndex].color }}
            />
            <div className={styles.tooltipContent}>
              <span className={styles.tooltipLabel}>{slices[hoveredIndex].label}</span>
              <span className={styles.tooltipValue}>
                {slices[hoveredIndex].value} ({slices[hoveredIndex].percentage.toFixed(1)}%)
              </span>
            </div>
          </div>
        )}
      </div>

      {showLegend && (
        <div className={styles.legend}>
          {slices.map((slice, index) => (
            <div 
              key={index} 
              className={`${styles.legendItem} ${hoveredIndex === index ? styles.legendItemActive : ''}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div 
                className={styles.legendColor} 
                style={{ backgroundColor: slice.color }}
              />
              <span className={styles.legendLabel}>
                {slice.label} ({slice.percentage.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
