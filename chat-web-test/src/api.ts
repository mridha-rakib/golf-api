import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
});

export const normalizeToken = (token: string) =>
  token.trim().replace(/^Bearer\s+/i, "");

export const setToken = (token: string) => {
  const raw = normalizeToken(token);
  if (raw) {
    api.defaults.headers.common.Authorization = `Bearer ${raw}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
  return raw;
};
