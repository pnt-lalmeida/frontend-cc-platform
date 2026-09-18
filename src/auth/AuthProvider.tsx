import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { useEffect, useState, type ReactNode } from "react";
import { msalConfig } from "./msalConfig";

const msalInstance = new PublicClientApplication(msalConfig);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    msalInstance.initialize().then(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
