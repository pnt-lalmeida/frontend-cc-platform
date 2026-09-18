import { useMsal } from "@azure/msal-react";
import { apiScope } from "./msalConfig";

export function useAccessToken() {
  const { instance, accounts } = useMsal();

  return async function getAccessToken(): Promise<string> {
    const account = accounts[0];
    if (!account) {
      throw new Error("No hay una cuenta autenticada");
    }
    const result = await instance.acquireTokenSilent({ scopes: [apiScope], account });
    return result.accessToken;
  };
}
