import { useState, useCallback } from 'react';
import { api } from '../services/api';

export function useSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSessionData = useCallback(async (sessionName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSessionData(sessionName);
      setSessionData(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sessions,
    sessionData,
    isLoading,
    error,
    fetchSessions,
    fetchSessionData
  };
}
