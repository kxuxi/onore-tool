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

describe("mergeWarlords のプロフィール採用（在ゲーム年月での新旧判定）", () => {
  it("在ゲームで新しい戦闘のプロフィールを採用する（守備でも反映）", () => {
    // 旧: 在ゲーム 1700年、実時刻 06/18（遅い MM/DD）
    const existing: WarlordMap = {
      A: wl({
        name: "A",
        type: "武特",
        branch: "鉄砲",
        unit: "鉄砲隊",
        battleAt: "1700年1月 06/18 12:00",
        updatedAt: 100,
      }),
    };
    // 新: 在ゲーム 1705年だが実時刻 05/10（早い MM/DD）。
    // 実時刻だけで比べると旧より「古い」と誤判定されるが、在ゲーム年月では新しい。
    const { map } = mergeWarlords(existing, [
      wl({
        name: "A",
        type: "統特",
        branch: "騎兵",
        unit: "騎馬隊",
        battleAt: "1705年1月 05/10 09:00",
        updatedAt: 200,
      }),
    ]);
    expect(map["A"].unit).toBe("騎馬隊");
    expect(map["A"].branch).toBe("騎兵");
    expect(map["A"].battleAt).toBe("1705年1月 05/10 09:00");
  });

  it("在ゲームで古い戦闘を後から登録しても新しいプロフィールを上書きしない", () => {
    // 既存は在ゲーム 1705年（新しい）
    const existing: WarlordMap = {
      A: wl({
        name: "A",
        branch: "騎兵",
        unit: "騎馬隊",
        battleAt: "1705年1月 05/10 09:00",
        updatedAt: 100,
      }),
    };
    // 在ゲーム 1700年（古い）を後から再登録（実時刻 06/18 は遅いが在ゲームは古い）
    const { map } = mergeWarlords(existing, [
      wl({
        name: "A",
        branch: "鉄砲",
        unit: "鉄砲隊",
        battleAt: "1700年1月 06/18 12:00",
        updatedAt: 200,
      }),
    ]);
    expect(map["A"].unit).toBe("騎馬隊");
    expect(map["A"].branch).toBe("騎兵");
    expect(map["A"].battleAt).toBe("1705年1月 05/10 09:00");
  });

  it("同じ在ゲーム年月なら実時刻が新しい方を採用する", () => {
    const existing: WarlordMap = {
      A: wl({
        name: "A",
        unit: "鉄砲隊",
        battleAt: "1700年5月 06/15 09:00",
        updatedAt: 100,
      }),
    };
    const { map } = mergeWarlords(existing, [
      wl({
        name: "A",
        unit: "騎馬隊",
        battleAt: "1700年5月 06/15 10:00",
        updatedAt: 200,
      }),
    ]);
    expect(map["A"].unit).toBe("騎馬隊");
  });

  it("在ゲーム年月が取れない場合は実時刻で判定する", () => {
    const existing: WarlordMap = {
      A: wl({
        name: "A",
        unit: "鉄砲隊",
        battleAt: "06/15 09:00",
        updatedAt: 100,
      }),
    };
    const { map } = mergeWarlords(existing, [
      wl({
        name: "A",
        unit: "騎馬隊",
        battleAt: "06/15 10:00",
        updatedAt: 200,
      }),
    ]);
    expect(map["A"].unit).toBe("騎馬隊");
  });
});
