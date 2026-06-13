import axios from "axios";
import Cookies from "js-cookie";

const baseURL =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_BACKEND_PROD
    : process.env.NEXT_PUBLIC_BACKEND_DEV;

const isServer = typeof window === "undefined";
const frontendOrigin =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_FRONTEND_URL || "https://into.blog"
    : process.env.NEXT_PUBLIC_FRONTEND_URL_DEV || "http://localhost:3000";

if (!baseURL) {
  console.error(
    "Backend URL not configured. Check NEXT_PUBLIC_BACKEND_PROD or NEXT_PUBLIC_BACKEND_DEV."
  );
}

const Api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    ...(isServer && frontendOrigin ? { Origin: frontendOrigin } : {}),
  },
  withCredentials: true,
  timeout: 30000,
});

Api.interceptors.request.use(
  (config) => {
    if (!config.headers["Authorization"]) {
      const localToken =
        typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const cookieToken = Cookies.get("auth_token");
      const token = localToken || cookieToken;
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

Api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      const isLoginPath = currentPath.startsWith("/auth/login");
      const isPublicPath =
        currentPath === "/" ||
        currentPath.startsWith("/explore") ||
        currentPath === "/tapes" ||
        (currentPath.startsWith("/tapes/") &&
          !currentPath.startsWith("/tapes/upload")) ||
        currentPath.startsWith("/category") ||
        currentPath.startsWith("/station") ||
        currentPath.startsWith("/user/") ||
        currentPath.startsWith("/post");
      const isVerifyEndpoint = error.config?.url?.includes("/auth/verify");

      if (!isVerifyEndpoint && !isLoginPath && !isPublicPath) {
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(error);
  }
);

export default Api;
