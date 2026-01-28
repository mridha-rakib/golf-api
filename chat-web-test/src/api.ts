import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
});

export const setToken = (token: string) => {
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
};
