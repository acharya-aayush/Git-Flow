import { useEffect, useRef } from 'react';
import { isDashboardPrUpdateEvent, toPRStreamEvent } from '@gitflow/shared';
import { useGitFlowStore } from './store';

export function useWebsocket(url: string) {
  const setConnectionStatus = useGitFlowStore((state) => state.setConnectionStatus);
  const setConnectionError = useGitFlowStore((state) => state.setConnectionError);
  const incrementReconnectAttempts = useGitFlowStore((state) => state.incrementReconnectAttempts);
  const resetReconnectAttempts = useGitFlowStore((state) => state.resetReconnectAttempts);
  const setLastMessageAt = useGitFlowStore((state) => state.setLastMessageAt);
  const addWsLog = useGitFlowStore((state) => state.addWsLog);
  const addLivePR = useGitFlowStore((state) => state.addLivePR);
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
          if (!isDashboardPrUpdateEvent(data)) {
            addWsLog('ignored non PR_UPDATE message');
            return;
          }

          addWsLog(`message received: ${data.type}`);
          addLivePR(toPRStreamEvent(data));
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
  ]);
}
