'use client';

import { useState } from 'react';
import styles from './BarChart.module.css';

/**
 * BarChart Component - Ready for backend data integration
 * @param {Object} props
 * @param {Array} props.data - Array of objects with label and value keys
 * @param {string} props.labelKey - Key for the label in data objects (default: 'label')
 * @param {string} props.valueKey - Key for the value in data objects (default: 'value')
 * @param {string} props.color - Bar color (default: gradient blue)
 * @param {boolean} props.showValues - Show values on top of bars (default: true)
 * @param {number} props.height - Chart height in pixels (default: 200)
 */
export default function BarChart({ 
  data = [], 
  labelKey = 'label', 
  valueKey = 'value',
  color,
  showValues = true,
  height = 200 
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

  // Calculate max value for scaling
  const maxValue = Math.max(...data.map(item => item[valueKey] || 0), 1);

  const handleMouseEnter = (e, index) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ 
      x: rect.left + rect.width / 2, 
      y: rect.top - 10 
    });
    setHoveredIndex(index);
  };

  return (
    <div className={styles.chartContainer} style={{ height: `${height}px` }}>
      <div className={styles.barChart}>
        {data.map((item, index) => {
          const value = item[valueKey] || 0;
          const label = item[labelKey] || '';
          const percentage = (value / maxValue) * 100;

          return (
            <div key={index} className={styles.barGroup}>
              <div className={styles.barWrapper}>
                {showValues && (
                  <span className={styles.barValue}>{value}</span>
                )}
                <div 
                  className={`${styles.bar} ${hoveredIndex === index ? styles.barHovered : ''}`}
                  style={{ 
                    height: `${percentage}%`,
                    background: color || 'linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)'
                  }}
                  onMouseEnter={(e) => handleMouseEnter(e, index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
                {hoveredIndex === index && (
                  <div className={styles.tooltip}>
                    <span className={styles.tooltipLabel}>{label}</span>
                    <span className={styles.tooltipValue}>{value}</span>
                  </div>
                )}
              </div>
              <span className={styles.barLabel}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
