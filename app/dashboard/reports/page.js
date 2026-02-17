import Card from '@/components/Card';
import styles from './page.module.css';

const reportTypes = [
  {
    id: 'pwd',
    title: 'PWD List',
    description: 'Generate list of all Persons with Disability',
    count: 3,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="4" r="2" />
        <path d="M12 6v6" />
        <path d="M12 12l-4 4-2 2" />
        <path d="M12 12l4 4 2 2" />
      </svg>
    ),
    color: '#1e40af',
    bgColor: '#dbeafe',
  },
  {
    id: 'senior',
    title: 'Senior Citizens List',
    description: 'Generate list of all Senior Citizens',
    count: 3,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: '#16a34a',
    bgColor: '#dcfce7',
  },
  {
    id: 'soloparent',
    title: 'Solo Parent List',
    description: 'Generate list of all Solo Parents',
    count: 2,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
    color: '#dc2626',
    bgColor: '#fee2e2',
  },
  {
    id: 'all',
    title: 'All Residents',
    description: 'Generate complete list of all registered residents',
    count: 8,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: '#7c3aed',
    bgColor: '#ede9fe',
  },
];

const summaryStats = [
  { label: 'PWD', value: 3, icon: '♿' },
  { label: 'Senior Citizens', value: 3, icon: '👴' },
  { label: 'Solo Parents', value: 2, icon: '❤️' },
];

export default function ReportsPage() {
  const handleGenerateReport = (reportId) => {
    // TODO: Implement report generation with Supabase data
    console.log('Generating report:', reportId);
    alert(`Report generation for ${reportId} will be implemented with Supabase integration.`);
  };

  return (
    <div className={styles.reportsPage}>
      <Card title="Generate Reports" subtitle="Select a report type to generate and export resident lists">
        <div className={styles.reportGrid}>
          {reportTypes.map((report) => (
            <button
              key={report.id}
              className={styles.reportCard}
              onClick={() => handleGenerateReport(report.id)}
            >
              <div className={styles.reportIcon} style={{ backgroundColor: report.bgColor, color: report.color }}>
                {report.icon}
              </div>
              <div className={styles.reportInfo}>
                <h3 className={styles.reportTitle}>{report.title}</h3>
                <p className={styles.reportDesc}>{report.description}</p>
              </div>
              <span className={styles.reportCount}>{report.count} records</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Report Summary" subtitle="Overview of registered residents by sector">
        <div className={styles.summaryGrid}>
          {summaryStats.map((stat, index) => (
            <div key={index} className={styles.summaryCard}>
              <span className={styles.summaryIcon}>{stat.icon}</span>
              <span className={styles.summaryLabel}>{stat.label}</span>
              <span className={styles.summaryValue}>{stat.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
