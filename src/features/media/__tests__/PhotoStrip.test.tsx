import { fireEvent, render, screen } from '@testing-library/react';
import type { Media } from '@/lib/api';
import { PhotoStrip } from '../components/PhotoStrip';
import { PhotoViewer } from '../components/PhotoViewer';
import type { QueuedUpload } from '../uploadQueue';

const photo = (id: string, extra: Partial<Media> = {}): Media => ({
  id,
  entityId: 'E1',
  targetType: 'TREE',
  category: 'TREE_PROFILE',
  contentType: 'image/jpeg',
  status: 'READY',
  thumbUrl: `https://x/${id}/thumb`,
  version: 2,
  ...extra,
});
const failed: QueuedUpload = {
  mediaId: 'Q1',
  tenantId: 'T',
  entityId: 'E1',
  file: new Blob(['x'], { type: 'image/jpeg' }),
  contentType: 'image/jpeg',
  capturedAt: null,
  state: 'FAILED',
  attempts: 3,
  error: 'offline',
  createdAt: 'x',
};

const props = {
  name: 'C-012',
  photos: [
    photo('A'),
    photo('B'),
    photo('P', { status: 'PENDING', thumbUrl: null }),
  ],
  queued: [failed],
  canUpload: true,
  onAdd: jest.fn(async () => 0),
  onOpen: jest.fn(),
  onRetry: jest.fn(),
  onRemoveQueued: jest.fn(),
};

describe('PhotoStrip (#46–#48)', () => {
  it('shows a failed upload with Retry, and opens ready photos by index', () => {
    render(<PhotoStrip {...props} />);
    expect(
      screen.getByRole('list', { name: 'strip.list' })
    ).toBeInTheDocument();
    expect(screen.getByText('queue.FAILED')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'queue.retry' }));
    expect(props.onRetry).toHaveBeenCalledWith('Q1');
    fireEvent.click(
      screen.getAllByRole('listitem', { name: 'strip.open' })[1]!
    );
    expect(props.onOpen).toHaveBeenCalledWith(1);
    expect(screen.getByText('strip.processing')).toBeInTheDocument();
  });

  it('reports rejected files and hides upload for viewers', async () => {
    const onAdd = jest.fn(async () => 1);
    const { rerender } = render(<PhotoStrip {...props} onAdd={onAdd} />);
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('photo-input'), {
      target: { files: [file] },
    });
    expect(await screen.findByText('strip.rejected')).toBeInTheDocument();
    rerender(<PhotoStrip {...props} canUpload={false} />);
    expect(
      screen.queryByRole('button', { name: 'strip.add' })
    ).not.toBeInTheDocument();
  });

  it('shows an empty state with no photos', () => {
    render(<PhotoStrip {...props} photos={[]} queued={[]} />);
    expect(screen.getByText('strip.empty')).toBeInTheDocument();
  });
});

describe('PhotoViewer (SCR-028)', () => {
  it('moves with arrow keys and labelled buttons, wrapping around', () => {
    const onIndexChange = jest.fn();
    render(
      <PhotoViewer
        photos={[photo('A'), photo('B')]}
        index={0}
        onIndexChange={onIndexChange}
      />
    );
    expect(
      screen.getByRole('dialog', { name: 'viewer.title' })
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'viewer.previous' }));
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'viewer.close' }));
    expect(onIndexChange).toHaveBeenLastCalledWith(null);
  });

  it('asks before removing a photo', () => {
    const onArchive = jest.fn();
    render(
      <PhotoViewer
        photos={[photo('A')]}
        index={0}
        onIndexChange={jest.fn()}
        onArchive={onArchive}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'viewer.archive' }));
    expect(onArchive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'viewer.confirm' }));
    expect(onArchive).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'A' })
    );
  });
});
