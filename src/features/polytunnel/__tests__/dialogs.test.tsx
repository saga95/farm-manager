import { fireEvent, render, screen } from '@testing-library/react';
import type { InputItem, Zone } from '@/lib/api';
import { ActivityDialog } from '../components/ActivityDialog';
import { CycleDialog } from '../components/CycleDialog';
import { HarvestDialog } from '../components/HarvestDialog';

jest.mock('@mui/material/useMediaQuery', () => () => false);

const zones: Zone[] = [
  {
    id: 'z0',
    tenantId: 't',
    farmId: 'f',
    name: 'Backyard',
    zoneType: 'BACKYARD',
    status: 'ACTIVE',
    version: 1,
  },
  {
    id: 'z1',
    tenantId: 't',
    farmId: 'f',
    name: 'Polytunnel',
    zoneType: 'POLYTUNNEL',
    status: 'ACTIVE',
    version: 1,
  },
];
const compost: InputItem = {
  id: 'i1',
  farmId: 'f',
  name: 'Compost',
  category: 'FERTILIZER',
  unit: 'KG',
  quantity: 20,
  lowStock: false,
  status: 'ACTIVE',
  version: 1,
};
const save = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: label }));

describe('CycleDialog (#91, AC-PC-001)', () => {
  it('a 180-plant ginger cycle in the polytunnel, named by crop and month', () => {
    const onSave = jest.fn();
    render(
      <CycleDialog
        open
        zones={zones}
        spaces={[]}
        today='2026-01-15'
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/cycleDialog.crop/), {
      target: { value: 'Ginger' },
    });
    fireEvent.change(screen.getByLabelText('cycleDialog.plants'), {
      target: { value: '180' },
    });
    save('cycleDialog.save');
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ginger 2026-01',
        cropName: 'Ginger',
        zoneId: 'z1',
        estimatedPlantCount: 180,
      }),
      true
    );
  });

  it('needs a crop', () => {
    const onSave = jest.fn();
    render(
      <CycleDialog
        open
        zones={zones}
        spaces={[]}
        today='2026-01-15'
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    save('cycleDialog.save');
    expect(screen.getByText('cycleDialog.needCrop')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('ActivityDialog (#94, AC-MA-001)', () => {
  it('one tap picks the type; watering saves without extras', () => {
    const onSave = jest.fn();
    render(
      <ActivityDialog
        open
        today='2026-02-01'
        inputs={[compost]}
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: 'activity.WEEDING' }));
    save('activityDialog.save');
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: 'WEEDING',
        activityDate: '2026-02-01',
        inputItemId: null,
      })
    );
  });

  it('fertiliser from farm inputs needs an amount within stock', () => {
    const onSave = jest.fn();
    render(
      <ActivityDialog
        open
        today='2026-02-01'
        inputs={[compost]}
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: 'activity.FERTILIZER' }));
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'activityDialog.fromStock' })
    );
    fireEvent.click(screen.getByRole('option', { name: 'Compost' }));
    save('activityDialog.save');
    expect(screen.getByText('activityDialog.needQuantity')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/activityDialog.quantityOf/), {
      target: { value: '25' },
    });
    save('activityDialog.save');
    expect(screen.getByText('activityDialog.tooMuch')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/activityDialog.quantityOf/), {
      target: { value: '12.5' },
    });
    save('activityDialog.save');
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: 'FERTILIZER',
        inputItemId: 'i1',
        quantity: 12.5,
        materialName: null,
      })
    );
  });
});

describe('HarvestDialog (#95, AC-PT-003)', () => {
  it('records 12.5 kg', () => {
    const onSave = jest.fn();
    render(
      <HarvestDialog
        open
        cropName='Cucumber'
        today='2026-04-10'
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/harvestDialog.quantity/), {
      target: { value: '12.5' },
    });
    save('harvestDialog.save');
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 12.5,
        unit: 'KG',
        harvestDate: '2026-04-10',
        qualityNote: null,
      })
    );
  });

  it('pieces are typed as whole numbers; zero is refused', () => {
    const onSave = jest.fn();
    render(
      <HarvestDialog
        open
        cropName='Cucumber'
        today='2026-04-10'
        defaultUnit='COUNT'
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    const field = screen.getByLabelText(/harvestDialog.quantity/);
    fireEvent.change(field, { target: { value: '12.5' } });
    expect(field).toHaveValue('125');
    fireEvent.change(field, { target: { value: '0' } });
    save('harvestDialog.save');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('harvestDialog.invalid')).toBeInTheDocument();
  });
});
