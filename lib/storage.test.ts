import { describe, expect, it } from "vitest";
import { mergeWarlords } from "./storage";
import type { Warlord, WarlordMap } from "./types";

/** 必須項目のみ埋めた Warlord を作る簡易ファクトリ。 */
function wl(partial: Partial<Warlord> & { name: string }): Warlord {
  return {
    type: "武特",
    branch: "騎兵",
    updatedAt: 0,
    ...partial,
  };
}

describe("mergeWarlords", () => {
  it("新規武将を追加し added を数える", () => {
    const { map, added, updated } = mergeWarlords({}, [wl({ name: "織田信長" })]);
    expect(added).toBe(1);
    expect(updated).toBe(0);
    expect(map["織田信長"]).toBeDefined();
  });

  it("既存武将は上書きし updated を数える", () => {
    const existing: WarlordMap = {
      織田信長: wl({ name: "織田信長", type: "武特", updatedAt: 100 }),
    };
    const { added, updated, map } = mergeWarlords(existing, [
      wl({ name: "織田信長", type: "知特", updatedAt: 200 }),
    ]);
    expect(added).toBe(0);
    expect(updated).toBe(1);
    expect(map["織田信長"].type).toBe("知特");
  });

  it("updatedAt は新旧の最大値を採用する", () => {
    const existing: WarlordMap = { A: wl({ name: "A", updatedAt: 300 }) };
    const { map } = mergeWarlords(existing, [wl({ name: "A", updatedAt: 100 })]);
    expect(map["A"].updatedAt).toBe(300);
  });

  it("戦闘登録で渡らない能力値・自己PRは既存値を保持する", () => {
    const existing: WarlordMap = {
      A: wl({ name: "A", power: 50, selfPr: "天下布武", updatedAt: 100 }),
    };
    const { map } = mergeWarlords(existing, [wl({ name: "A", updatedAt: 200 })]);
    expect(map["A"].power).toBe(50);
    expect(map["A"].selfPr).toBe("天下布武");
  });

  it("元の DB を破壊的に変更しない", () => {
    const existing: WarlordMap = { A: wl({ name: "A", updatedAt: 100 }) };
    mergeWarlords(existing, [wl({ name: "B", updatedAt: 100 })]);
    expect(existing["B"]).toBeUndefined();
  });
});
