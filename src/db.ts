import axios from 'axios';

const API_BASE_URL = process.env.MAILBOX_API_URL || 'http://localhost:8000';
const API_KEY = process.env.MAILBOX_API_KEY;

if (!API_KEY) {
  console.error("Missing MAILBOX_API_KEY in environment.");
  process.exit(1);
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

export const getUsers = async (role?: string) => {
  const response = await apiClient.get('/users', { params: { role } });
  return response.data;
};

export const startConversation = async (title: string, tickets: string[], participants: string[], initialMessage: string) => {
  const response = await apiClient.post('/conversations', {
    title,
    tickets,
    participants,
    initial_message: initialMessage
  });
  return response.data; // returns { conversation_id, routed }
};

export const getMyConversations = async () => {
  const response = await apiClient.get('/conversations');
  return response.data;
};

export const getConversationHistory = async (convId: number) => {
  const response = await apiClient.get(`/conversations/${convId}/messages`);
  return response.data;
};

export const sendMessage = async (convId: number, content: string) => {
  const response = await apiClient.post(`/conversations/${convId}/messages`, { content });
  return response.data;
};

export const resolveConversation = async (convId: number) => {
  const response = await apiClient.post(`/conversations/${convId}/resolve`);
  return response.data;
};

// ==========================================
// WORKFLOW FEATURES
// ==========================================

export const searchConversations = async (q: string) => {
  const response = await apiClient.get('/conversations/search', { params: { q } });
  return response.data;
};

export const updatePriority = async (convId: number, priority: string) => {
  const response = await apiClient.put(`/conversations/${convId}/priority`, { priority });
  return response.data;
};

export const updateStatus = async (status: string, delegateTo?: string) => {
  const response = await apiClient.put('/users/status', { status, delegate_to: delegateTo });
  return response.data;
};

export const addParticipant = async (convId: number, username: string) => {
  const response = await apiClient.post(`/conversations/${convId}/participants`, { username });
  return response.data;
};
