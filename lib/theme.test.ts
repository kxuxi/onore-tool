import { describe, it, expect } from "vitest";
import { resolveTheme, THEME_DAY_START, THEME_DAY_END } from "./theme";

/** 指定した「時」のローカル時刻を作る（分以下は 0）。 */
function at(hour: number): Date {
  return new Date(2026, 0, 1, hour, 0, 0);
}

describe("resolveTheme", () => {
  it("手動でライト/ダークを選んだ場合は時刻に関係なくその値を返す", () => {
    expect(resolveTheme("light", at(23))).toBe("light");
    expect(resolveTheme("dark", at(10))).toBe("dark");
  });

  it("自動: 昼（6:00〜18:00）はライト", () => {
    expect(resolveTheme("auto", at(6))).toBe("light");
    expect(resolveTheme("auto", at(10))).toBe("light");
    expect(resolveTheme("auto", at(17))).toBe("light");
  });

  it("自動: 夜（18:00〜翌6:00）はダーク", () => {
    expect(resolveTheme("auto", at(18))).toBe("dark");
    expect(resolveTheme("auto", at(23))).toBe("dark");
    expect(resolveTheme("auto", at(0))).toBe("dark");
    expect(resolveTheme("auto", at(5))).toBe("dark");
  });

  it("境界: 開始時刻はライト、終了時刻はダーク", () => {
    expect(resolveTheme("auto", at(THEME_DAY_START))).toBe("light");
    expect(resolveTheme("auto", at(THEME_DAY_END))).toBe("dark");
  });
});
