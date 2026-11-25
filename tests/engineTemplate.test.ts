import { describe, expect, it } from "vitest";
import { fillString, fillTemplate, referencedSteps } from "@/lib/engine/template";

const scope = {
  trigger: { kota: "Bandung" },
  riset: { ringkasan: "tiga temuan", jumlah: 3, items: [{ judul: "A" }, { judul: "B" }] },
};

describe("template workflow", () => {
  it("mengembalikan tipe aslinya kalau seluruh string cuma satu placeholder", () => {
    expect(fillString("{{riset.jumlah}}", scope)).toBe(3);
    expect(fillString("{{riset}}", scope)).toEqual(scope.riset);
  });

  it("menyisipkan nilai ke dalam teks", () => {
    expect(fillString("Cuaca di {{trigger.kota}}: {{riset.ringkasan}}", scope)).toBe(
      "Cuaca di Bandung: tiga temuan"
    );
  });

  it("bisa menelusuri array dengan indeks", () => {
    expect(fillString("{{riset.items.1.judul}}", scope)).toBe("B");
  });

  it("memakai nilai default kalau field kosong", () => {
    expect(fillString("{{riset.penulis | Anonim}}", scope)).toBe("Anonim");
  });

  it("placeholder yang tidak ketemu jadi string kosong, bukan teks mentah", () => {
    expect(fillString("nilai: {{riset.ngawur}}", scope)).toBe("nilai: ");
  });

  it("mengisi seluruh struktur tanpa mengubah input aslinya", () => {
    const input = { body: { kota: "{{trigger.kota}}" }, tags: ["{{riset.jumlah}}"] };
    const out = fillTemplate(input, scope);
    expect(out).toEqual({ body: { kota: "Bandung" }, tags: [3] });
    expect(input.body.kota).toBe("{{trigger.kota}}");
  });

  it("mendaftar step yang dirujuk sebuah input", () => {
    expect(referencedSteps({ a: "{{riset.ringkasan}}", b: ["{{trigger.kota}}"] }).sort()).toEqual([
      "riset",
      "trigger",
    ]);
  });
});
