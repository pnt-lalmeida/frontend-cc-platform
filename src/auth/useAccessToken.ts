import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { useCallback } from "react";
import { apiScope } from "./msalConfig";

export function useAccessToken() {
  const { instance, accounts } = useMsal();

  return useCallback(async function getAccessToken(): Promise<string> {
    const account = instance.getActiveAccount() ?? accounts[0];
    if (!account) {
      throw new Error("No hay una cuenta autenticada");
    }
    try {
      const result = await instance.acquireTokenSilent({ scopes: [apiScope], account });
      return result.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const result = await instance.acquireTokenPopup({ scopes: [apiScope], account });
        return result.accessToken;
      }
      throw error;
    }
  }, [instance, accounts]);
}
