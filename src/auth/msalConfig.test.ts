import { describe, expect, it } from "vitest";
import { apiScope, msalConfig } from "./msalConfig";

describe("msalConfig", () => {
  it("arma la authority con el tenant id", () => {
    expect(msalConfig.auth.authority).toBe(
      "https://login.microsoftonline.com/17af3ac8-4b4c-4703-b52f-2f902d63af82"
    );
  });

  it("usa el clientId del App Registration", () => {
    expect(msalConfig.auth.clientId).toBe("2095b6bc-db66-4b95-97ad-7c569800a4c9");
  });

  it("expone el scope de la API", () => {
    expect(apiScope).toBe("api://2095b6bc-db66-4b95-97ad-7c569800a4c9/access_as_user");
  });
});
