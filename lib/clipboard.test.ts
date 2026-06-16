import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("copyText", () => {
  it("navigator.clipboard が使える場合は writeText でコピーして true を返す", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("clipboard が無い場合は execCommand にフォールバックする", async () => {
    vi.stubGlobal("navigator", {});
    const ta = { style: {} as Record<string, string>, value: "", select: vi.fn() };
    const execCommand = vi.fn().mockReturnValue(true);
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(ta),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      execCommand,
    });

    await expect(copyText("コピー本文")).resolves.toBe(true);
    expect(ta.value).toBe("コピー本文");
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("clipboard も execCommand も失敗した場合は false を返す", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    vi.stubGlobal("document", {
      createElement: () => {
        throw new Error("no dom");
      },
    });

    await expect(copyText("x")).resolves.toBe(false);
  });
});
