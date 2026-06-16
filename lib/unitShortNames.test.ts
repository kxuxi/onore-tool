import { describe, expect, it } from "vitest";
import { shortUnit } from "./unitShortNames";

describe("shortUnit", () => {
  it("前方一致する最長の短縮名を返す", () => {
    expect(shortUnit("マハウト象兵")).toBe("マハウト");
    expect(shortUnit("カノン砲")).toBe("カノン");
    expect(shortUnit("剛弓僧兵")).toBe("剛弓");
  });

  it("一覧にそのまま載っている名前はそのまま返す", () => {
    expect(shortUnit("鉄砲僧兵")).toBe("鉄砲僧兵");
  });

  it("一致が無ければ元の文字列を返す（安全側）", () => {
    expect(shortUnit("未知の兵種")).toBe("未知の兵種");
  });

  it("前後の空白を無視して判定する", () => {
    expect(shortUnit("  マハウト象兵 ")).toBe("マハウト");
  });

  it("空文字はそのまま返す", () => {
    expect(shortUnit("")).toBe("");
  });
});
