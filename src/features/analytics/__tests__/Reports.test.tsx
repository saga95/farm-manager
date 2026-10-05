import { fireEvent, render, screen } from '@testing-library/react';
import { BarChart } from '@/components/ui/BarChart/BarChart';
import {
  CoconutReport,
  CropsReport,
  SalesStockReport,
} from '../components/Reports';
import { sampleReport } from '../sampleReport';

describe('BarChart', () => {
  const props = {
    title: 'Coconuts by month',
    data: [
      { key: 'a', label: 'Jan', value: 310, fullLabel: 'January 2026' },
      { key: 'b', label: 'Feb', value: 0, fullLabel: 'February 2026' },
    ],
    valueLabel: 'Coconuts',
    categoryLabel: 'Month',
    showTableLabel: 'Show as table',
    showChartLabel: 'Show as chart',
  };
  it('each bar is focusable with its value; focus shows a tooltip', () => {
    render(<BarChart {...props} />);
    const bar = screen.getByLabelText('January 2026: 310');
    fireEvent.focus(bar);
    expect(screen.getByRole('status')).toHaveTextContent('310');
  });
  it('has a real table view', () => {
    render(<BarChart {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(
      screen.getByRole('cell', { name: 'February 2026' })
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '0' })).toBeInTheDocument();
  });
});

describe('Reports (#99, #100)', () => {
  it('coconut: facts are worded as records, missing values show as —', () => {
    render(<CoconutReport report={sampleReport} />);
    expect(screen.getByText('coconut.insight.TOP_AVERAGE')).toBeInTheDocument();
    expect(
      screen.getByText('coconut.insight.NO_RECENT_RECORD_NEVER')
    ).toBeInTheDocument();
    expect(screen.getByText('coconut.treesNote')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /C-020/ });
    expect(row).toHaveTextContent('coconut.none');
  });

  it('sales: realized per coconut always states its scope; low stock listed', () => {
    render(<SalesStockReport report={sampleReport} currency='LKR' />);
    expect(screen.getByText('sales.realizedScope')).toBeInTheDocument();
    expect(screen.getByText('stock.lowLine')).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'sales.byCrop' })
    ).toBeInTheDocument();
  });

  it('crops: one chart per crop, with its total', () => {
    render(<CropsReport report={sampleReport} />);
    expect(screen.getByText('crops.harvested')).toBeInTheDocument();
    expect(screen.getByText('crops.total')).toBeInTheDocument();
  });
});
