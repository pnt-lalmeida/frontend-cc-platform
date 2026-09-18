import type { Configuration } from "@azure/msal-browser";

const TENANT_ID = import.meta.env.VITE_ENTRA_TENANT_ID ?? "17af3ac8-4b4c-4703-b52f-2f902d63af82";
const CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID ?? "2095b6bc-db66-4b95-97ad-7c569800a4c9";

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: typeof window !== "undefined" ? window.location.origin : undefined,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const apiScope =
  (import.meta.env.VITE_API_SCOPE as string) ?? "api://2095b6bc-db66-4b95-97ad-7c569800a4c9/access_as_user";
