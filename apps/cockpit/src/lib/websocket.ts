import { useEffect, useRef } from 'react';
import {
  isDashboardPrUpdateEvent,
  isDashboardRepoActivityEvent,
  toPRStreamEvent,
  toRepoActivityEvent,
} from '@gitflow/shared';
import { useGitFlowStore } from './store';

export function useWebsocket(url: string) {
  const setConnectionStatus = useGitFlowStore((state) => state.setConnectionStatus);
  const setConnectionError = useGitFlowStore((state) => state.setConnectionError);
  const incrementReconnectAttempts = useGitFlowStore((state) => state.incrementReconnectAttempts);
  const resetReconnectAttempts = useGitFlowStore((state) => state.resetReconnectAttempts);
  const setLastMessageAt = useGitFlowStore((state) => state.setLastMessageAt);
  const addWsLog = useGitFlowStore((state) => state.addWsLog);
  const addLivePR = useGitFlowStore((state) => state.addLivePR);
  const addLiveActivity = useGitFlowStore((state) => state.addLiveActivity);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      addWsLog(`connecting to ${url}`);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        addWsLog('connected');
        setConnectionStatus(true);
        setConnectionError(null);
        resetReconnectAttempts();
      };

      ws.onmessage = (event) => {
        try {
          const data: unknown = JSON.parse(event.data as string);
          setLastMessageAt(new Date().toISOString());

          if (isDashboardRepoActivityEvent(data)) {
            addWsLog(`message received: ${data.type}`);
            addLiveActivity(toRepoActivityEvent(data));
            return;
          }

          if (isDashboardPrUpdateEvent(data)) {
            addWsLog(`message received: ${data.type}`);
            addLivePR(toPRStreamEvent(data));
            addLiveActivity({
              id: `live-${data.payload.repo}-pull_request-${data.action}-${data.timestamp}`,
              repo: data.payload.repo,
              kind: data.action.includes('review') ? 'pull_request_review' : 'pull_request',
              action: data.action,
              timestamp: data.timestamp,
              number: data.payload.number,
              state: data.payload.state,
              source: 'live',
            });
            return;
          }

          addWsLog('ignored unknown message type');
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown parse error';
          addWsLog(`parse error: ${msg}`);
        }
      };

      ws.onclose = () => {
        addWsLog('disconnected, retrying in 5s');
        setConnectionStatus(false);
        incrementReconnectAttempts();
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        const errMessage = 'websocket error encountered';
        addWsLog(errMessage);
        setConnectionError(errMessage);
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [
    url,
    setConnectionStatus,
    setConnectionError,
    incrementReconnectAttempts,
    resetReconnectAttempts,
    setLastMessageAt,
    addWsLog,
    addLivePR,
    addLiveActivity,
  ]);
}
