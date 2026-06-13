// lib/telegram/callbacks.ts
export type Callback =
  | { kind: "save" }
  | { kind: "cancel" }
  | { kind: "catMenu" }
  | { kind: "catPick"; id: string }
  | { kind: "pktMenu" }
  | { kind: "pktPick"; id: string }
  | { kind: "amt" }
  | { kind: "back" };

export function encodeCallback(cb: Callback): string {
  switch (cb.kind) {
    case "save": return "save";
    case "cancel": return "cancel";
    case "catMenu": return "cat";
    case "catPick": return `cat:${cb.id}`;
    case "pktMenu": return "pkt";
    case "pktPick": return `pkt:${cb.id}`;
    case "amt": return "amt";
    case "back": return "back";
  }
}

export function decodeCallback(data: string): Callback | null {
  const sep = data.indexOf(":");
  const prefix = sep === -1 ? data : data.slice(0, sep);
  const arg = sep === -1 ? "" : data.slice(sep + 1);

  switch (prefix) {
    case "save": return { kind: "save" };
    case "cancel": return { kind: "cancel" };
    case "cat": return arg ? { kind: "catPick", id: arg } : { kind: "catMenu" };
    case "pkt": return arg ? { kind: "pktPick", id: arg } : { kind: "pktMenu" };
    case "amt": return { kind: "amt" };
    case "back": return { kind: "back" };
    default: return null;
  }
}
