import { describe, it, expect } from "vitest";
import {
  splitBattleSegments,
  extractBattleUrl,
  parseBattleCard,
  parseBattleLine,
  normalizeDisplayToken,
  isSpecialToken,
  battleKey,
} from "./parser";

// スペース区切りでも parser は [\s\u3000]+ で分割するためタブ無しで再現できる。
const LINE_PLAIN =
  "【1戦目】 1583年4月 04/10 10:23 京都 織田 信長 織田家 武特 騎馬隊 騎兵 槍 鎧 V.S. 武田 勝頼 武田家 統特 騎馬隊 騎兵 馬 旗 信長の勝利 12";

describe("splitBattleSegments", () => {
  it("【N戦目】マーカーで複数戦に分割する", () => {
    const segs = splitBattleSegments("【1戦目】あ 【2戦目】い【3戦目】う");
    expect(segs).toHaveLength(3);
    expect(segs[0].startsWith("【1戦目】")).toBe(true);
    expect(segs[2].startsWith("【3戦目】")).toBe(true);
  });

  it("空文字は空配列を返す", () => {
    expect(splitBattleSegments("   ")).toEqual([]);
  });
});

describe("extractBattleUrl", () => {
  it("マークダウンリンクから URL を取り出す", () => {
    const { line, url } = extractBattleUrl(
      "【1戦目】[織田 V.S. 武田](https://example.com/b/1)勝利"
    );
    expect(url).toBe("https://example.com/b/1");
    expect(line).not.toContain("](");
    expect(line).toContain("織田");
  });

  it("リンクが無ければ行をそのまま返す", () => {
    const { line, url } = extractBattleUrl(LINE_PLAIN);
    expect(url).toBeUndefined();
    expect(line).toBe(LINE_PLAIN);
  });
});

describe("parseBattleCard", () => {
  it("基本フィールドと勝者（攻撃側）を解析する", () => {
    const card = parseBattleCard(LINE_PLAIN);
    expect(card).not.toBeNull();
    expect(card!.battleNo).toBe("1戦目");
    expect(card!.place).toBe("京都");
    expect(card!.battleAt).toBe("1583年4月 04/10 10:23");
    expect(card!.turns).toBe("12");
    expect(card!.left.faction).toBe("織田");
    expect(card!.left.name).toBe("信長");
    expect(card!.right.faction).toBe("武田");
    expect(card!.right.name).toBe("勝頼");
    expect(card!.winner).toBe("left");
  });

  it("防衛側の勝利を判定する", () => {
    const line = LINE_PLAIN.replace("信長の勝利", "勝頼の勝利");
    expect(parseBattleCard(line)!.winner).toBe("right");
  });

  it("撤退・引分を判定する", () => {
    expect(parseBattleCard(LINE_PLAIN.replace("信長の勝利", "撤退"))!.winner).toBe(
      "retreat"
    );
    expect(parseBattleCard(LINE_PLAIN.replace("信長の勝利", "引分"))!.winner).toBe(
      "draw"
    );
  });

  it("【N戦目】で始まらない行は null", () => {
    expect(parseBattleCard("ただのテキスト")).toBeNull();
  });
});

describe("parseBattleLine の兵種正規化", () => {
  const withUnit = (unit: string) =>
    LINE_PLAIN.replace("武特 騎馬隊 騎兵", `武特 ${unit} 騎兵`);

  it("オリジナル兵(...) は括弧内を採用する", () => {
    const w = parseBattleLine(withUnit("オリジナル兵(ドラグーン)"));
    expect(w[0].unit).toBe("ドラグーン");
  });

  it("全角括弧のオリジナル兵にも対応する", () => {
    const w = parseBattleLine(withUnit("オリジナル兵（重騎兵）"));
    expect(w[0].unit).toBe("重騎兵");
  });

  it("* 始まりで括弧があれば括弧内を採用する", () => {
    const w = parseBattleLine(withUnit("*ノクスミーティア(カノン砲)"));
    expect(w[0].unit).toBe("カノン砲");
  });

  it("* 始まりで括弧が無ければ保存値は * マーカーを保持する", () => {
    // 保存用 normalizeUnit は特殊兵種マーカー(*)を残す（isSpecialToken 判定・
    // 表示時の normalizeDisplayToken で * を除去する役割分担のため）。
    const w = parseBattleLine(withUnit("*ノクスミーティア"));
    expect(w[0].unit).toBe("*ノクスミーティア");
  });
});

describe("normalizeDisplayToken", () => {
  it("* 始まり + 括弧は括弧内を採用", () => {
    expect(normalizeDisplayToken("*ノクスミーティア(カノン砲)")).toBe("カノン砲");
  });
  it("オリジナル兵（全角）は括弧内を採用", () => {
    expect(normalizeDisplayToken("オリジナル兵（ドラグーン）")).toBe("ドラグーン");
  });
  it("* 始まりで括弧無しは * を除去", () => {
    expect(normalizeDisplayToken("*ノクスミーティア")).toBe("ノクスミーティア");
  });
  it("通常トークンはそのまま", () => {
    expect(normalizeDisplayToken("騎馬隊")).toBe("騎馬隊");
  });
});

describe("isSpecialToken", () => {
  it("* 始まりは true", () => {
    expect(isSpecialToken("*特殊")).toBe(true);
  });
  it("通常は false", () => {
    expect(isSpecialToken("騎馬隊")).toBe(false);
  });
});

describe("battleKey の重複排除", () => {
  it("ターン数の違いは同じキーになる", () => {
    const a = battleKey(LINE_PLAIN); // 12 ターン
    const b = battleKey(LINE_PLAIN.replace(" 12", " 8")); // 8 ターン
    expect(a).toBe(b);
  });

  it("URL・ターン表記が違うマークダウン形式でも同一戦闘なら同じキー", () => {
    const markdown =
      "【1戦目】1583年4月04/10 10:23京都[織田 信長 織田家 武特 騎馬隊 騎兵 槍 鎧 V.S. 武田 勝頼 武田家 統特 騎馬隊 騎兵 馬 旗](https://example.com/b/1)信長の勝利8ターンで終了";
    expect(battleKey(markdown)).toBe(battleKey(LINE_PLAIN));
  });

  it("勝敗が違えば別キーになる", () => {
    const a = battleKey(LINE_PLAIN);
    const d = battleKey(LINE_PLAIN.replace("信長の勝利", "勝頼の勝利"));
    expect(a).not.toBe(d);
  });
});
