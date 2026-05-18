// Helper to get the API base URL from the axios config
import { api } from "../custom_library/api";

export function getApiBaseUrl() {
  // Remove trailing slash if present
  return api.defaults.baseURL?.replace(/\/$/, "") || "";
}
