import { useMsal } from "@azure/msal-react";

// UPN del usuario logueado (ej. rlopez@pontyn.com.uy), o null si no hay sesion.
export function useUsuarioActual(): string | null {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];
  return account?.username ?? null;
}
