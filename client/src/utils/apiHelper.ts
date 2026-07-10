// Dynamic API Base URL resolution
const getApiUrl = () => {
  // Respect VITE_API_URL if defined
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Fallback to localhost:5000 for local development
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiUrl();
