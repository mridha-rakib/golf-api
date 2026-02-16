import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_BASE?.trim() || "http://localhost:3000/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
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
