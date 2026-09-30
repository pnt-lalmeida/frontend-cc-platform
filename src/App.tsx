import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./auth/RequireAuth";
import { Cliente360Page } from "./routes/Cliente360Page";
import { BandejaPage } from "./routes/BandejaPage";
import { RutaInicial, RutaMiDia } from "./routes/midia/rutas";

export default function App() {
  return (
    <BrowserRouter>
      <RequireAuth>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<RutaInicial />} />
            <Route path="mi-dia" element={<RutaMiDia />} />
            <Route path="cliente-360" element={<Cliente360Page />} />
            <Route path="bandeja" element={<BandejaPage />} />
          </Route>
        </Routes>
      </RequireAuth>
    </BrowserRouter>
  );
}
