import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, type TableColumn } from "./Table";

interface Row {
  id: number;
  nombre: string;
  monto: number;
}

const rows: Row[] = [
  { id: 1, nombre: "Beta", monto: 100 },
  { id: 2, nombre: "Alfa", monto: 50 },
];

const columns: TableColumn<Row>[] = [
  { key: "nombre", header: "Nombre", render: (r) => r.nombre, sortValue: (r) => r.nombre },
  { key: "monto", header: "Monto", render: (r) => String(r.monto), sortValue: (r) => r.monto },
];

describe("Table", () => {
  it("ordena ascendente al hacer click en un header, y descendente en el segundo click", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />);

    fireEvent.click(screen.getByText("Nombre"));
    let dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows[0].textContent).toContain("Alfa");

    fireEvent.click(screen.getByText("Nombre"));
    dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows[0].textContent).toContain("Beta");
  });

  it("una columna sin sortValue no reordena al hacer click", () => {
    const columnsSinOrden: TableColumn<Row>[] = [
      { key: "nombre", header: "Nombre", render: (r) => r.nombre },
    ];
    render(<Table columns={columnsSinOrden} rows={rows} rowKey={(r) => r.id} />);

    fireEvent.click(screen.getByText("Nombre"));
    const dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows[0].textContent).toContain("Beta");
  });
});
