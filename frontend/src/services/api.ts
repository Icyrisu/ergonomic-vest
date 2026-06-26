const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

export const api = {
  async startSession(data: { session_name: string; name: string; id: string; group: string }) {
    const response = await fetch(`${API_BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to start session');
    }
    return result;
  },

  async stopSession() {
    const response = await fetch(`${API_BASE_URL}/api/sessions/stop`, {
      method: 'POST',
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to stop session');
    }
    return result;
  },

  async getSessions() {
    const response = await fetch(`${API_BASE_URL}/api/sessions`);
    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }
    return response.json();
  },

  async getSessionData(sessionName: string) {
    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionName}/data`);
    if (!response.ok) {
      throw new Error('Failed to fetch session data');
    }
    return response.json();
  },
};
