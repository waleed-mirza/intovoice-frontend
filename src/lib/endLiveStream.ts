import Cookies from "js-cookie";

const getBackendUrl = () =>
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_BACKEND_PROD
    : process.env.NEXT_PUBLIC_BACKEND_DEV;

const getAuthToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token") || Cookies.get("auth_token") || null;
};

/** Fire-and-forget end call that survives tab close (keepalive fetch). */
export function endLiveStreamKeepalive(liveStreamId: string) {
  if (typeof window === "undefined") return;

  const baseURL = getBackendUrl();
  if (!baseURL) return;

  const token = getAuthToken();

  fetch(`${baseURL}/voice/live/${liveStreamId}/end`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    keepalive: true,
  }).catch(() => undefined);
}
