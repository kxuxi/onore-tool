import { describe, expect, it } from "vitest";
import {
  splitGoodAgainst,
  parseReqStats,
  composeReqStats,
  parseCost,
  composeCost,
  parseYears,
  composeYears,
} from "./unitTypeForm";

describe("splitGoodAgainst", () => {
  it("半角・全角コロン区切りを分解し空要素を除く", () => {
    expect(splitGoodAgainst("弓兵:壁:")).toEqual(["弓兵", "壁"]);
    expect(splitGoodAgainst("騎兵：歩兵")).toEqual(["騎兵", "歩兵"]);
    expect(splitGoodAgainst("")).toEqual([]);
  });
});

describe("parseReqStats / composeReqStats", () => {
  it("'武力:40' を分解できる", () => {
    expect(parseReqStats("武力:40")).toEqual({ stat: "武力", num: "40" });
  });

  it("区切りが無ければ数値は空", () => {
    expect(parseReqStats("統率")).toEqual({ stat: "統率", num: "" });
  });

  it("再構成は round-trip する", () => {
    expect(composeReqStats("武力", "40")).toBe("武力:40");
  });

  it("ステータス名が空なら空文字を返す", () => {
    expect(composeReqStats("", "40")).toBe("");
  });
});

describe("parseCost / composeCost", () => {
  it("'金:600' を通貨と金額に分解できる", () => {
    expect(parseCost("金:600")).toEqual({ currency: "金", amount: "600" });
  });

  it("区切りが無ければ既定通貨（金）として金額のみ扱う", () => {
    expect(parseCost("600")).toEqual({ currency: "金", amount: "600" });
  });

  it("再構成は round-trip する", () => {
    expect(composeCost("米", "300")).toBe("米:300");
  });

  it("金額が空なら空文字を返す", () => {
    expect(composeCost("金", "")).toBe("");
  });
});

describe("parseYears / composeYears", () => {
  it("'36年' から数値を取り出す", () => {
    expect(parseYears("36年")).toBe("36");
  });

  it("数値が無ければ空文字", () => {
    expect(parseYears("年")).toBe("");
  });

  it("再構成は round-trip する", () => {
    expect(composeYears("36")).toBe("36年");
    expect(composeYears("")).toBe("");
  });
});
