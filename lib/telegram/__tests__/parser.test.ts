// lib/telegram/__tests__/parser.test.ts
import { describe, it, expect } from "vitest";
import { parseMessage, formatRupiah } from "../parser";

describe("parseMessage — expense keywords", () => {
  it("pengeluaran + category + rb amount", () => {
    expect(parseMessage("pengeluaran makan siang 50rb")).toEqual({
      type: "expense",
      amount: 50000,
      category: "Makan Siang",
      pocketName: null,
    });
  });

  it("beli keyword", () => {
    expect(parseMessage("beli kopi 25k")).toEqual({
      type: "expense",
      amount: 25000,
      category: "Kopi",
      pocketName: null,
    });
  });

  it("bayar with dot-separated amount", () => {
    expect(parseMessage("bayar listrik 500.000")).toEqual({
      type: "expense",
      amount: 500000,
      category: "Listrik",
      pocketName: null,
    });
  });

  it("plain number no suffix", () => {
    expect(parseMessage("pengeluaran bensin 80000")).toEqual({
      type: "expense",
      amount: 80000,
      category: "Bensin",
      pocketName: null,
    });
  });
});

describe("parseMessage — income keywords", () => {
  it("masuk gaji jt amount", () => {
    expect(parseMessage("masuk gaji 5jt")).toEqual({
      type: "income",
      amount: 5000000,
      category: "Gaji",
      pocketName: null,
    });
  });

  it("pemasukan with decimal jt", () => {
    expect(parseMessage("pemasukan freelance 2.5jt")).toEqual({
      type: "income",
      amount: 2500000,
      category: "Freelance",
      pocketName: null,
    });
  });
});

describe("parseMessage — pocket detection", () => {
  it("extracts pocket after 'dari'", () => {
    expect(parseMessage("pengeluaran makan 50rb dari BCA")).toEqual({
      type: "expense",
      amount: 50000,
      category: "Makan",
      pocketName: "BCA",
    });
  });

  it("extracts pocket after 'ke'", () => {
    expect(parseMessage("pengeluaran transfer 200rb ke Mandiri")).toEqual({
      type: "expense",
      amount: 200000,
      category: "Transfer",
      pocketName: "Mandiri",
    });
  });
});

describe("parseMessage — null cases", () => {
  it("returns null for plain question", () => {
    expect(parseMessage("halo apa kabar")).toBeNull();
  });

  it("returns null for message without amount", () => {
    expect(parseMessage("pengeluaran makan")).toBeNull();
  });

  it("returns null for keyword with no category", () => {
    expect(parseMessage("beli 50rb")).toBeNull();
  });
});

describe("formatRupiah", () => {
  it("formats 50000 as Rp50.000", () => {
    expect(formatRupiah(50000)).toBe("Rp50.000");
  });

  it("formats 5000000 as Rp5.000.000", () => {
    expect(formatRupiah(5000000)).toBe("Rp5.000.000");
  });
});
