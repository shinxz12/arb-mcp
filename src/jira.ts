import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const { JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN } = process.env;

let jiraClient: AxiosInstance | null = null;

if (JIRA_BASE_URL && JIRA_USER_EMAIL && JIRA_API_TOKEN) {
  const token = Buffer.from(`${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  jiraClient = axios.create({
    // Using API v2 for simpler plain text / wiki markup format instead of ADF
    baseURL: `${JIRA_BASE_URL}/rest/api/2`,
    headers: {
      'Authorization': `Basic ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

const getClient = () => {
  if (!jiraClient) {
    throw new Error("Jira client not initialized. Check your environment variables (JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN).");
  }
  return jiraClient;
};

export const getIssue = async (issueKey: string) => {
  const client = getClient();
  const response = await client.get(`/issue/${issueKey}`);
  return response.data;
};

export const getComments = async (issueKey: string) => {
  const client = getClient();
  const response = await client.get(`/issue/${issueKey}/comment`);
  return response.data.comments;
};

export const addComment = async (issueKey: string, body: string) => {
  const client = getClient();
  const response = await client.post(`/issue/${issueKey}/comment`, { body });
  return response.data;
};

export const updateDescription = async (issueKey: string, description: string) => {
  const client = getClient();
  const response = await client.put(`/issue/${issueKey}`, {
    fields: { description }
  });
  return response.data;
};
