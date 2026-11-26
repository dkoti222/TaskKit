import { render, screen } from '@testing-library/react-native';

import { useRealtime } from '@/realtime/socket';
import { RealtimeBanner } from './realtime-banner';

// The socket module pulls in NetInfo, the API client and more; the banner only needs its store.
jest.mock('@/realtime/socket', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  return {
    useRealtime: create(() => ({ status: 'connected', online: true, showReconnecting: false })),
    retryNow: jest.fn(),
  };
});

describe('RealtimeBanner (screen 30)', () => {
  it('shows nothing while connected', async () => {
    useRealtime.setState({ online: true, showReconnecting: false });
    await render(<RealtimeBanner />);
    expect(screen.queryByText(/offline/i)).toBeNull();
    expect(screen.queryByText(/Reconnecting/)).toBeNull();
  });

  it('shows the offline bar with Retry when there is no network', async () => {
    useRealtime.setState({ online: false });
    await render(<RealtimeBanner />);
    expect(screen.getByText(/You.re offline. Showing saved data./)).toBeTruthy();
    expect(screen.getByLabelText('Retry')).toBeTruthy();
  });

  it('shows "Reconnecting…" when online but the live connection is down', async () => {
    useRealtime.setState({ online: true, showReconnecting: true });
    await render(<RealtimeBanner />);
    expect(screen.getByText(/Reconnecting/)).toBeTruthy();
  });
});
