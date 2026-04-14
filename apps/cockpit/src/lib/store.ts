import { create } from 'zustand';
import type { PRStreamEvent } from '@gitflow/shared';

type InitialData = Partial<{
  livePRs: PRStreamEvent[];
  doraMetrics: Record<string, unknown>;
}>;

interface GitFlowState {
  livePRs: PRStreamEvent[];
  doraMetrics: Record<string, unknown>;
  isConnected: boolean;
  connectionError: string | null;
  reconnectAttempts: number;
  lastMessageAt: string | null;
  wsLogs: string[];
  setConnectionStatus: (status: boolean) => void;
  setConnectionError: (error: string | null) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  setLastMessageAt: (timestamp: string) => void;
  addWsLog: (message: string) => void;
  addLivePR: (pr: PRStreamEvent) => void;
  setInitialData: (data: InitialData) => void;
}

export const useGitFlowStore = create<GitFlowState>((set) => ({
  livePRs: [],
  doraMetrics: {},
  isConnected: false,
  connectionError: null,
  reconnectAttempts: 0,
  lastMessageAt: null,
  wsLogs: [],
  setConnectionStatus: (status) => set({ isConnected: status }),
  setConnectionError: (error) => set({ connectionError: error }),
  incrementReconnectAttempts: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
  setLastMessageAt: (timestamp) => set({ lastMessageAt: timestamp }),
  addWsLog: (message) =>
    set((state) => {
      const nextLogs = [`${new Date().toLocaleTimeString()} - ${message}`, ...state.wsLogs].slice(0, 20);
      return { wsLogs: nextLogs };
    }),
  addLivePR: (pr) => set((state) => {
    const updated = [pr, ...state.livePRs].slice(0, 50);
    return { livePRs: updated };
  }),
  setInitialData: (data) => set((state) => ({ ...state, ...data })),
}));
