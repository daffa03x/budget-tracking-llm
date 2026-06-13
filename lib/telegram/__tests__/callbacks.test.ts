// lib/telegram/__tests__/callbacks.test.ts
import { describe, it, expect } from "vitest";
import { encodeCallback, decodeCallback, type Callback } from "../callbacks";

describe("callback codec", () => {
  const cases: Callback[] = [
    { kind: "save" },
    { kind: "cancel" },
    { kind: "catMenu" },
    { kind: "catPick", id: "cl0123456789abcdefghijklmn" },
    { kind: "pktMenu" },
    { kind: "pktPick", id: "cl0123456789abcdefghijklmn" },
    { kind: "amt" },
    { kind: "back" },
  ];

  it("round-trips every callback and stays within 64 bytes", () => {
    for (const cb of cases) {
      const data = encodeCallback(cb);
      expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(64);
      expect(decodeCallback(data)).toEqual(cb);
    }
  });

  it("returns null for unknown data", () => {
    expect(decodeCallback("bogus")).toBeNull();
    expect(decodeCallback("")).toBeNull();
  });
});
