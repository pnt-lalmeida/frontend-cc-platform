import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from "@azure/msal-react";
import type { ReactNode } from "react";
import { apiScope } from "./msalConfig";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { instance } = useMsal();

  function login() {
    instance.loginPopup({ scopes: [apiScope] }).catch((error) => {
      console.error("Error en el login", error);
    });
  }

  return (
    <>
      <AuthenticatedTemplate>{children}</AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <div style={{ padding: 40 }}>
          <p>Necesitás iniciar sesión con tu cuenta de Pontyn.</p>
          <button onClick={login}>Iniciar sesión</button>
        </div>
      </UnauthenticatedTemplate>
    </>
  );
}
