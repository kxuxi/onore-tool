import { describe, it, expect } from "vitest";
import { parseWarlordStats, hasWarlordStats } from "./warlordStats";

/** タブ区切りの 1 行を組み立てる。 */
function row(fields: (string | number)[]): string {
  return fields.join("\t");
}

/**
 * 実際のランキング表の 16 列順:
 * [0]順位 [1]自己PR [2]名前 [3]武力 [4]知力 [5]統率力 [6]政治力 [7]計略(pt)
 * [8]資金 [9]兵糧 [10]年齢 [11]勝率(%) [12]仕官月数 [13]自己PR(再掲) [14]階級 [15]国名
 */
function realRow(o: {
  rank: number;
  pr: string;
  name: string;
  power: number;
  intelligence: number;
  leadership: number;
  politics: number;
  strategy: string;
  faction: string;
}): string {
  return row([
    o.rank,
    o.pr,
    o.name,
    o.power,
    o.intelligence,
    o.leadership,
    o.politics,
    o.strategy,
    4100000, // 資金
    2420000, // 兵糧
    57, // 年齢
    "39.3%", // 勝率
    986, // 仕官月数
    o.pr, // 自己PR(再掲)
    "元帥(49101)", // 階級
    o.faction, // 国名
  ]);
}

const HEADER = row([
  "順位",
  "自己PR",
  "名前",
  "武力",
  "知力",
  "統率力",
  "政治力",
  "計略",
  "資金",
  "兵糧",
  "年齢",
  "勝率",
  "仕官月数",
  "自己PR",
  "階級",
  "国名",
]);

describe("parseWarlordStats（実16列・自己PRが名前の前）", () => {
  it("名前列を構造から特定し、能力値・自己PR・国名を取り込む", () => {
    const text = [
      HEADER,
      realRow({
        rank: 1,
        pr: "そうした環境でうまく立ち回ることができず",
        name: "ゾンビタバコ",
        power: 213,
        intelligence: 101,
        leadership: 102,
        politics: 210,
        strategy: "102.5pt",
        faction: "水式王国2",
      }),
    ].join("\n");

    const { stats, parsed, skipped } = parseWarlordStats(text);
    expect(parsed).toBe(1);
    expect(skipped).toBe(0);
    expect(stats[0]).toMatchObject({
      name: "ゾンビタバコ",
      power: 213,
      intelligence: 101,
      leadership: 102,
      politics: 210,
      strategy: 102.5,
      selfPr: "そうした環境でうまく立ち回ることができず",
      faction: "水式王国2",
    });
  });

  it("名前に絵文字・記号が含まれても正しく取り込む", () => {
    const text = realRow({
      rank: 3,
      pr: "サルだったかもしれねぇ🐒",
      name: "あああぽい🐵",
      power: 65,
      intelligence: 22,
      leadership: 38,
      politics: 286,
      strategy: "85pt",
      faction: "サルの修行寺R",
    });
    const { stats } = parseWarlordStats(text);
    expect(stats[0].name).toBe("あああぽい🐵");
    expect(stats[0].politics).toBe(286);
    expect(stats[0].strategy).toBe(85);
  });

  it("計略の小数(.5)や整数を正しく解釈し、pt/% を取り除く", () => {
    const text = realRow({
      rank: 5,
      pr: "",
      name: "謙信",
      power: 300,
      intelligence: 120,
      leadership: 280,
      politics: 80,
      strategy: "327pt",
      faction: "中立",
    });
    const { stats } = parseWarlordStats(text);
    expect(stats[0].strategy).toBe(327);
    expect(stats[0].power).toBe(300);
  });

  it("自己PR(再掲列)が無い14列でも名前直前の自己PRを使う", () => {
    // 14 列: [0]順位 [1]自己PR [2]名前 [3-6]能力 [7]計略 [8]資金 [9]兵糧 [10]年齢 [11]勝率 [12]階級 [13]国名
    const text = row([
      2,
      "けつなあな確定の民です",
      "ケツイ",
      180,
      90,
      95,
      270,
      "89.5pt",
      5000000,
      100000,
      40,
      "55%",
      "大将(123)",
      "けつなあな確定",
    ]);
    const { stats, parsed } = parseWarlordStats(text);
    expect(parsed).toBe(1);
    expect(stats[0]).toMatchObject({
      name: "ケツイ",
      politics: 270,
      strategy: 89.5,
      faction: "けつなあな確定",
      selfPr: "けつなあな確定の民です",
    });
  });

  it("タブが無い（連結された）行は分割できないためスキップする", () => {
    const text = "1ゾンビタバコ213101102210102.5pt410000032000057";
    const { parsed, skipped } = parseWarlordStats(text);
    expect(parsed).toBe(0);
    expect(skipped).toBe(1);
  });

  it("ヘッダー行はスキップ件数に数えず無視する", () => {
    const { parsed, skipped } = parseWarlordStats(HEADER);
    expect(parsed).toBe(0);
    expect(skipped).toBe(0);
  });

  it("複数行（ヘッダー＋データ）をまとめて取り込む", () => {
    const text = [
      HEADER,
      realRow({ rank: 1, pr: "PR1", name: "A", power: 10, intelligence: 11, leadership: 12, politics: 13, strategy: "14pt", faction: "国X" }),
      realRow({ rank: 2, pr: "PR2", name: "B", power: 20, intelligence: 21, leadership: 22, politics: 23, strategy: "24.5pt", faction: "国Y" }),
    ].join("\n");
    const { stats, parsed } = parseWarlordStats(text);
    expect(parsed).toBe(2);
    expect(stats.map((s) => s.name)).toEqual(["A", "B"]);
    expect(stats[1].strategy).toBe(24.5);
  });

  it("同名は後勝ち（最新の貼り付けを優先）", () => {
    const text = [
      realRow({ rank: 1, pr: "旧", name: "A", power: 10, intelligence: 10, leadership: 10, politics: 10, strategy: "10pt", faction: "国" }),
      realRow({ rank: 2, pr: "新", name: "A", power: 99, intelligence: 99, leadership: 99, politics: 99, strategy: "99pt", faction: "国" }),
    ].join("\n");
    const { stats, parsed } = parseWarlordStats(text);
    expect(parsed).toBe(1);
    expect(stats[0].power).toBe(99);
    expect(stats[0].selfPr).toBe("新");
  });
});

describe("hasWarlordStats", () => {
  it("能力値か自己PRがあれば true", () => {
    expect(hasWarlordStats(undefined)).toBe(false);
    expect(
      hasWarlordStats({ name: "x", type: "", branch: "", updatedAt: 0 })
    ).toBe(false);
    expect(
      hasWarlordStats({
        name: "x",
        type: "",
        branch: "",
        updatedAt: 0,
        power: 100,
      })
    ).toBe(true);
    expect(
      hasWarlordStats({
        name: "x",
        type: "",
        branch: "",
        updatedAt: 0,
        selfPr: "hello",
      })
    ).toBe(true);
  });
});
