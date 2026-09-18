import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import App from "./App";
import { msalConfig } from "./auth/msalConfig";

describe("App", () => {
  let pca: PublicClientApplication;

  beforeAll(async () => {
    pca = new PublicClientApplication(msalConfig);
    await pca.initialize();
  });

  it("muestra el prompt de login cuando no hay sesion iniciada", async () => {
    render(
      <MsalProvider instance={pca}>
        <App />
      </MsalProvider>
    );
    expect(await screen.findByRole("button", { name: /Iniciar sesión/i })).toBeTruthy();
  });
});
