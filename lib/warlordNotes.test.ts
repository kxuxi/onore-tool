import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWarlordNote, setWarlordNote } from "./warlordNotes";

/** Map で backing したシンプルな localStorage モック。 */
function makeStorageMock(setItem?: (key: string, value: string) => void) {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem:
      setItem ??
      ((k: string, v: string) => {
        store.set(k, v);
      }),
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("warlordNotes", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: makeStorageMock() });
  });

  it("保存したコメントを取得できる（round-trip）", () => {
    setWarlordNote("織田信長", "強い");
    expect(getWarlordNote("織田信長")).toBe("強い");
  });

  it("空文字を保存するとコメントを削除する", () => {
    setWarlordNote("徳川家康", "メモ");
    setWarlordNote("徳川家康", "");
    expect(getWarlordNote("徳川家康")).toBe("");
  });

  it("名前・本文の前後空白を trim する", () => {
    setWarlordNote("  上杉謙信  ", "  毘沙門  ");
    expect(getWarlordNote("上杉謙信")).toBe("毘沙門");
  });

  it("空白だけの名前は無視する", () => {
    setWarlordNote("   ", "x");
    expect(getWarlordNote("   ")).toBe("");
  });

  it("未保存の武将は空文字を返す", () => {
    expect(getWarlordNote("武田信玄")).toBe("");
  });

  it("localStorage への書き込みが例外を投げても落ちない", () => {
    vi.stubGlobal("window", {
      localStorage: makeStorageMock(() => {
        throw new Error("QuotaExceededError");
      }),
    });
    expect(() => setWarlordNote("毛利元就", "メモ")).not.toThrow();
  });
});
