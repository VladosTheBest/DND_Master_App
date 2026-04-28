import { createApiClient } from "@shadow-edge/api-client";

const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    return configured;
  }

  return "";
};

export const api = createApiClient(resolveApiBaseUrl());
