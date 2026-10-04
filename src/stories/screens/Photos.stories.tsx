import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { tokens } from '../../../design-system';
import { PhotoStrip } from '../../features/media/components/PhotoStrip';
import { PhotoViewer } from '../../features/media/components/PhotoViewer';
import type { QueuedUpload } from '../../features/media/uploadQueue';
import type { Media } from '../../lib/api';

// Inline SVG placeholders stand in for presigned thumbnail URLs.
const svg = (label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="100%" height="100%" fill="${tokens.colors.brand[100]}"/><text x="50%" y="50%" font-size="48" text-anchor="middle" fill="${tokens.colors.brand[800]}">${label}</text></svg>`
  )}`;

const photo = (id: string, extra: Partial<Media> = {}): Media => ({
  id,
  entityId: 'E1',
  targetType: 'TREE',
  category: 'TREE_PROFILE',
  contentType: 'image/jpeg',
  status: 'READY',
  thumbUrl: svg(id),
  capturedAt: '2026-09-01T07:30:00+05:30',
  version: 2,
  ...extra,
});

const queued = (state: QueuedUpload['state']): QueuedUpload => ({
  mediaId: `Q-${state}`,
  tenantId: 'T',
  entityId: 'E1',
  file: new Blob(['x'], { type: 'image/jpeg' }),
  contentType: 'image/jpeg',
  capturedAt: null,
  state,
  attempts: state === 'FAILED' ? 3 : 1,
  createdAt: 'x',
});

const meta = {
  title: 'Screens/SCR-028 Photos',
  component: PhotoStrip,
  parameters: {
    docs: {
      description: {
        component:
          'Photos attached to a record. The record is saved first; photos upload in the background from a durable queue. **Waiting / Uploading / Upload failed + Retry** are always visible, and a retry never duplicates a photo. Lists show thumbnails only; tapping one opens the full-screen viewer (swipe, ←/→, labelled buttons).',
      },
    },
  },
  args: {
    name: 'C-012',
    photos: [photo('Photo 1'), photo('Photo 2'), photo('Photo 3')],
    queued: [],
    canUpload: true,
    onAdd: async () => 0,
    onOpen: () => undefined,
    onRetry: () => undefined,
    onRemoveQueued: () => undefined,
  },
} satisfies Meta<typeof PhotoStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Strip: Story = {};
export const UploadingAndFailed: Story = {
  args: { queued: [queued('UPLOADING'), queued('FAILED')] },
};
export const Empty: Story = { args: { photos: [] } };
export const ViewOnly: Story = { args: { canUpload: false } };
export const DarkMode: Story = { globals: { theme: 'dark' } };

function ViewerDemo() {
  const photos = [
    photo('Photo 1', { caption: 'North row after rain' }),
    photo('Photo 2'),
    photo('Photo 3'),
  ];
  const [index, setIndex] = useState<number | null>(0);
  return (
    <PhotoViewer
      photos={photos}
      index={index ?? 0}
      onIndexChange={i => setIndex(i ?? 0)}
      onArchive={() => undefined}
    />
  );
}

export const Viewer: Story = { render: () => <ViewerDemo /> };
