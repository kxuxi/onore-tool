import { describe, it, expect } from "vitest";
import {
  collectWarlordBattles,
  collectUnitBattles,
  opponentStats,
  matchupRanking,
  branchStats,
  winHeatmap,
  factionTimeline,
  collectFactionBattles,
  opponentFactionStats,
  factionMatchupRanking,
  unitMatchupRanking,
  userWinRates,
  unitUsageTrend,
  unitBranchLabel,
  swiRanking,
  weaponStats,
  itemStats,
  formatWinRate,
} from "./stats";
import type { BattleRecord } from "./types";

/**
 * テスト用の戦闘行を組み立てる。
 * 注目武将を「織田 信長（兵科指定可）」とし、相手・勝敗・日時を差し替える。
 */
function makeLine(opts: {
  year: number;
  time: string; // "MM/DD HH:mm"
  selfFaction: string;
  selfBranch: string;
  opponent: string;
  oppFaction: string;
  result: string; // "信長の勝利" | "<相手>の勝利" | "撤退" など
}): string {
  const { year, time, selfFaction, selfBranch, opponent, oppFaction, result } =
    opts;
  return `【1戦目】 ${year}年4月 ${time} 京都 ${selfFaction} 信長 織田家 武特 騎馬隊 ${selfBranch} 槍 鎧 V.S. ${oppFaction} ${opponent} 某家 統特 騎馬隊 騎兵 馬 旗 ${result} 12`;
}

function rec(line: string, savedAt = 0): BattleRecord {
  return { line, time: line.match(/\d+年\d+月\s+\d+\/\d+\s+\d+:\d+/)?.[0], savedAt };
}

describe("opponentStats / matchupRanking / rivalry", () => {
  const log: BattleRecord[] = [
    rec(
      makeLine({
        year: 1600,
        time: "04/10 10:00",
        selfFaction: "織田",
        selfBranch: "騎兵",
        opponent: "勝頼",
        oppFaction: "武田",
        result: "信長の勝利",
      }),
      1
    ),
    rec(
      makeLine({
        year: 1601,
        time: "04/11 10:00",
        selfFaction: "織田",
        selfBranch: "歩兵",
        opponent: "勝頼",
        oppFaction: "武田",
        result: "勝頼の勝利",
      }),
      2
    ),
    rec(
      makeLine({
        year: 1602,
        time: "04/12 10:00",
        selfFaction: "織田",
        selfBranch: "騎兵",
        opponent: "謙信",
        oppFaction: "上杉",
        result: "謙信の勝利",
      }),
      3
    ),
  ];
  const outcomes = collectWarlordBattles(log, "信長");

  it("対戦相手ごとに勝敗を集計する", () => {
    const stats = opponentStats(outcomes);
    const katsuyori = stats.find((s) => s.name === "勝頼")!;
    expect(katsuyori.battles).toBe(2);
    expect(katsuyori.wins).toBe(1);
    expect(katsuyori.losses).toBe(1);
    expect(katsuyori.winRate).toBeCloseTo(0.5);
  });

  it("相性ランキングは勝ち越し/負け越しで分け、五分は除外する", () => {
    const ranking = matchupRanking(outcomes);
    // 勝頼(1勝1敗=50%)は五分なのでどちらにも入らない。
    // 謙信(0勝1敗=0%)は負け越しなので苦手な相手。
    expect(ranking.best).toHaveLength(0);
    expect(ranking.worst.map((s) => s.name)).toEqual(["謙信"]);
  });

  it("良い相手と苦手な相手に同じ相手は出ない（重複しない）", () => {
    // 相手5人・勝率まちまちでも、良い相手(>50%)と苦手な相手(<50%)は
    // 勝率で排他的に分かれるため重複しない。
    const lines: BattleRecord[] = [];
    let n = 0;
    const add = (opp: string, selfWins: number, oppWins: number) => {
      for (let i = 0; i < selfWins; i++)
        lines.push(
          rec(
            makeLine({
              year: 1600 + n,
              time: `04/10 1${n % 10}:00`,
              selfFaction: "織田",
              selfBranch: "騎兵",
              opponent: opp,
              oppFaction: "敵",
              result: "信長の勝利",
            }),
            n++
          )
        );
      for (let i = 0; i < oppWins; i++)
        lines.push(
          rec(
            makeLine({
              year: 1600 + n,
              time: `04/10 1${n % 10}:00`,
              selfFaction: "織田",
              selfBranch: "騎兵",
              opponent: opp,
              oppFaction: "敵",
              result: `${opp}の勝利`,
            }),
            n++
          )
        );
    };
    add("Aカモ", 3, 0); // 100%
    add("B得意", 2, 1); // 約67%
    add("C五分", 1, 1); // 50%（除外）
    add("D苦手", 1, 2); // 約33%
    add("Eカモられ", 0, 3); // 0%
    const oc = collectWarlordBattles(lines, "信長");
    const r = matchupRanking(oc);
    const bestNames = r.best.map((s) => s.name);
    const worstNames = r.worst.map((s) => s.name);
    // 重複なし
    expect(bestNames.filter((x) => worstNames.includes(x))).toHaveLength(0);
    // 良い相手は勝ち越しのみ・勝率降順
    expect(bestNames).toEqual(["Aカモ", "B得意"]);
    // 苦手な相手は負け越しのみ・勝率昇順（一番苦手が先頭）
    expect(worstNames).toEqual(["Eカモられ", "D苦手"]);
    // 五分(C)はどちらにも出ない
    expect(bestNames).not.toContain("C五分");
    expect(worstNames).not.toContain("C五分");
  });
});

describe("branchStats", () => {
  it("兵科ごとに勝率を出し戦闘数の多い順に並べる", () => {
    const log: BattleRecord[] = [
      rec(
        makeLine({
          year: 1600,
          time: "04/10 10:00",
          selfFaction: "織田",
          selfBranch: "騎兵",
          opponent: "A",
          oppFaction: "X",
          result: "信長の勝利",
        }),
        1
      ),
      rec(
        makeLine({
          year: 1600,
          time: "04/11 11:00",
          selfFaction: "織田",
          selfBranch: "騎兵",
          opponent: "B",
          oppFaction: "X",
          result: "信長の勝利",
        }),
        2
      ),
      rec(
        makeLine({
          year: 1600,
          time: "04/12 12:00",
          selfFaction: "織田",
          selfBranch: "万能",
          opponent: "C",
          oppFaction: "X",
          result: "Cの勝利",
        }),
        3
      ),
    ];
    const outcomes = collectWarlordBattles(log, "信長");
    const stats = branchStats(outcomes);
    expect(stats[0].branch).toBe("騎兵"); // 2戦で最多
    expect(stats[0].winRate).toBeCloseTo(1);
    const banno = stats.find((s) => s.branch === "万能")!;
    expect(banno.winRate).toBeCloseTo(0);
  });
});

describe("winHeatmap", () => {
  it("曜日×時間帯に振り分けて勝率を計算する", () => {
    const log: BattleRecord[] = [
      rec(
        makeLine({
          year: 1600,
          time: "04/10 10:00",
          selfFaction: "織田",
          selfBranch: "騎兵",
          opponent: "A",
          oppFaction: "X",
          result: "信長の勝利",
        }),
        1
      ),
    ];
    const outcomes = collectWarlordBattles(log, "信長");
    const hm = winHeatmap(outcomes);
    expect(hm.dated).toBe(1);
    // 10時 → バケット 3（9〜12時）に 1 件入る
    const total = hm.cells.flat().reduce((s, c) => s + c.battles, 0);
    expect(total).toBe(1);
  });
});

describe("factionTimeline", () => {
  it("渡り歩いた国を時系列の区間にまとめ、出戻りを検出する", () => {
    const log: BattleRecord[] = [
      rec(
        makeLine({
          year: 1600,
          time: "04/10 10:00",
          selfFaction: "織田",
          selfBranch: "騎兵",
          opponent: "A",
          oppFaction: "X",
          result: "信長の勝利",
        }),
        1
      ),
      rec(
        makeLine({
          year: 1605,
          time: "04/11 10:00",
          selfFaction: "豊臣",
          selfBranch: "騎兵",
          opponent: "B",
          oppFaction: "X",
          result: "信長の勝利",
        }),
        2
      ),
      rec(
        makeLine({
          year: 1610,
          time: "04/12 10:00",
          selfFaction: "織田",
          selfBranch: "騎兵",
          opponent: "C",
          oppFaction: "X",
          result: "信長の勝利",
        }),
        3
      ),
    ];
    const outcomes = collectWarlordBattles(log, "信長");
    const stints = factionTimeline(outcomes);
    expect(stints.map((s) => s.faction)).toEqual(["織田", "豊臣", "織田"]);
    expect(stints[0].startYear).toBe(1600);
    expect(stints[2].returning).toBe(true); // 織田への出戻り
    expect(stints[0].returning).toBe(false);
  });

  it("実時刻(MM/DD)がゲーム内年と逆順でもゲーム内年で並べる", () => {
    // 1606年の戦闘は実時刻が遅く(12/31)、1607年は実時刻が早い(01/01)。
    // 実時刻で並べると順序が逆転するが、所属遍歴はゲーム内年で並ぶべき。
    const log: BattleRecord[] = [
      rec(
        makeLine({
          year: 1606,
          time: "12/31 23:00",
          selfFaction: "大空",
          selfBranch: "騎兵",
          opponent: "A",
          oppFaction: "X",
          result: "信長の勝利",
        }),
        1
      ),
      rec(
        makeLine({
          year: 1607,
          time: "01/01 00:00",
          selfFaction: "己鯖電機",
          selfBranch: "騎兵",
          opponent: "B",
          oppFaction: "X",
          result: "信長の勝利",
        }),
        2
      ),
    ];
    const outcomes = collectWarlordBattles(log, "信長");
    const stints = factionTimeline(outcomes);
    expect(stints.map((s) => s.faction)).toEqual(["大空", "己鯖電機"]);
    expect(stints.every((s) => !s.returning)).toBe(true);
  });
});

describe("collectFactionBattles / factionMatchupRanking", () => {
  const fw = (
    year: number,
    opp: string,
    oppFaction: string,
    result: string,
    savedAt: number
  ) =>
    rec(
      makeLine({
        year,
        time: `04/10 1${savedAt % 10}:00`,
        selfFaction: "織田",
        selfBranch: "騎兵",
        opponent: opp,
        oppFaction,
        result,
      }),
      savedAt
    );
  const log: BattleRecord[] = [
    fw(1600, "信玄", "武田", "信長の勝利", 1),
    fw(1601, "勝頼", "武田", "信長の勝利", 2),
    fw(1602, "謙信", "上杉", "謙信の勝利", 3),
    fw(1603, "景勝", "上杉", "景勝の勝利", 4),
    fw(1604, "氏康", "北条", "信長の勝利", 5),
    fw(1605, "氏政", "北条", "氏政の勝利", 6),
  ];
  const outcomes = collectFactionBattles(log, "織田");

  it("指定した国が参戦した戦闘を国視点で集める", () => {
    expect(outcomes).toHaveLength(6);
    expect(outcomes.every((o) => o.self.faction === "織田")).toBe(true);
  });

  it("対戦国ごとに勝敗を集計する", () => {
    const stats = opponentFactionStats(outcomes);
    const takeda = stats.find((s) => s.faction === "武田")!;
    expect(takeda.battles).toBe(2);
    expect(takeda.wins).toBe(2);
    expect(takeda.winRate).toBeCloseTo(1);
  });

  it("相性ランキングは勝ち越し/負け越しで分け、五分は除外する", () => {
    const r = factionMatchupRanking(outcomes);
    expect(r.best.map((s) => s.faction)).toEqual(["武田"]); // 100%
    expect(r.worst.map((s) => s.faction)).toEqual(["上杉"]); // 0%
    // 北条(1勝1敗=50%)は五分なのでどちらにも入らない
    expect(r.best.map((s) => s.faction)).not.toContain("北条");
    expect(r.worst.map((s) => s.faction)).not.toContain("北条");
  });
});

/**
 * 兵種テスト用の行ビルダー。
 * 左（注目側）の兵種名・武将名・勝敗、右（相手側）の兵種名を制御できる。
 */
function unitLine(opts: {
  year: number;
  selfName: string;
  selfUnit: string;
  selfBranch: string;
  oppUnit: string;
  result: string; // "<名前>の勝利" など
}): string {
  const { year, selfName, selfUnit, selfBranch, oppUnit, result } = opts;
  return `【1戦目】 ${year}年4月 06/15 10:00 京都 自国 ${selfName} 某家 武特 ${selfUnit} ${selfBranch} 槍 鎧 V.S. 敵国 敵将 敵家 統特 ${oppUnit} 騎兵 馬 旗 ${result} 12`;
}

describe("unitMatchupRanking / userWinRates", () => {
  const log: BattleRecord[] = [
    rec(
      unitLine({
        year: 1600,
        selfName: "信長",
        selfUnit: "ランセロ",
        selfBranch: "騎兵",
        oppUnit: "ドラグーン",
        result: "信長の勝利",
      }),
      1
    ),
    rec(
      unitLine({
        year: 1601,
        selfName: "信長",
        selfUnit: "ランセロ",
        selfBranch: "騎兵",
        oppUnit: "コサック",
        result: "敵将の勝利",
      }),
      2
    ),
    rec(
      unitLine({
        year: 1602,
        selfName: "光秀",
        selfUnit: "ランセロ",
        selfBranch: "騎兵",
        oppUnit: "ドラグーン",
        result: "光秀の勝利",
      }),
      3
    ),
  ];
  const outcomes = collectUnitBattles(log, "ランセロ");

  it("敵兵種ごとの相性を勝ち越し/負け越しで分ける", () => {
    const ranking = unitMatchupRanking(outcomes);
    // ドラグーン相手 2勝0敗(100%) → 相性の良い兵種
    expect(ranking.best[0].unit).toBe("ドラグーン");
    expect(ranking.best[0].winRate).toBeCloseTo(1);
    // コサック相手 0勝1敗(0%) → 苦手な兵種
    const cosaku = ranking.worst.find((s) => s.unit === "コサック");
    expect(cosaku?.winRate).toBeCloseTo(0);
    // 同じ兵種が良い／苦手の両方に出ない
    const bestUnits = ranking.best.map((s) => s.unit);
    const worstUnits = ranking.worst.map((s) => s.unit);
    expect(bestUnits.filter((u) => worstUnits.includes(u))).toHaveLength(0);
  });

  it("武将別の勝率を戦闘数の多い順に集計する", () => {
    const users = userWinRates(outcomes);
    expect(users[0].name).toBe("信長"); // 2戦で最多
    expect(users[0].wins).toBe(1);
    expect(users[0].losses).toBe(1);
    const mitsuhide = users.find((u) => u.name === "光秀")!;
    expect(mitsuhide.winRate).toBeCloseTo(1);
  });

  it("兵科ラベルは最多出現の兵科を返す", () => {
    expect(unitBranchLabel(outcomes)).toBe("騎兵");
  });
});

describe("unitUsageTrend", () => {
  it("ゲーム内年ごとの使用率（兵種登場数/全戦闘数）を返す", () => {
    const log: BattleRecord[] = [
      // 1600年: 2戦中1戦でランセロ登場 → 50%
      rec(
        unitLine({
          year: 1600,
          selfName: "信長",
          selfUnit: "ランセロ",
          selfBranch: "騎兵",
          oppUnit: "ドラグーン",
          result: "信長の勝利",
        }),
        1
      ),
      rec(
        unitLine({
          year: 1600,
          selfName: "秀吉",
          selfUnit: "コサック",
          selfBranch: "騎兵",
          oppUnit: "ドラグーン",
          result: "秀吉の勝利",
        }),
        2
      ),
      // 1601年: 1戦中1戦でランセロ登場 → 100%
      rec(
        unitLine({
          year: 1601,
          selfName: "信長",
          selfUnit: "ランセロ",
          selfBranch: "騎兵",
          oppUnit: "ドラグーン",
          result: "信長の勝利",
        }),
        3
      ),
    ];
    const trend = unitUsageTrend(log, "ランセロ");
    expect(trend.map((p) => p.year)).toEqual([1600, 1601]);
    expect(trend[0].rate).toBeCloseTo(0.5);
    expect(trend[1].rate).toBeCloseTo(1);
  });
});

/**
 * SWI テスト用の戦闘行。攻撃側武将名・戦目番号・戦闘時刻・勝者を指定する。
 * 同じ time を共有する行は「同一出撃」として扱われる。
 */
function swiLine(opts: {
  attacker: string;
  battleNo: number;
  time: string; // "MM/DD HH:mm"（出撃の識別子になる）
  win: boolean; // 攻撃側が勝ったか
  defender?: string;
}): string {
  const { attacker, battleNo, time, win, defender = "敵将" } = opts;
  const result = win ? `${attacker}の勝利` : `${defender}の勝利`;
  return `【${battleNo}戦目】 1600年4月 ${time} 京都 自国 ${attacker} 某家 武特 騎馬隊 騎兵 槍 鎧 V.S. 敵国 ${defender} 敵家 統特 騎馬隊 騎兵 馬 旗 ${result} 12`;
}

describe("swiRanking", () => {
  it("枚抜き枚数は1戦目からの連勝数で数える", () => {
    // 信長: 1出撃で 1戦目○ 2戦目○ 3戦目○ = 3枚抜き（防衛側は戦目ごとに異なる）
    const log: BattleRecord[] = [
      rec(swiLine({ attacker: "信長", battleNo: 1, time: "06/15 10:00", win: true, defender: "敵A" }), 1),
      rec(swiLine({ attacker: "信長", battleNo: 2, time: "06/15 10:00", win: true, defender: "敵B" }), 2),
      rec(swiLine({ attacker: "信長", battleNo: 3, time: "06/15 10:00", win: true, defender: "敵C" }), 3),
    ];
    const ranking = swiRanking(log, 1);
    expect(ranking).toHaveLength(1);
    const nobu = ranking[0];
    expect(nobu.name).toBe("信長");
    expect(nobu.sorties).toBe(1);
    expect(nobu.bestSweep).toBe(3);
    // 3枚抜き = 3 × 1.2 = 3.6、出撃1回 → SWI 3.6
    expect(nobu.swi).toBeCloseTo(3.6);
  });

  it("途中で負けるとそこで連勝が止まる（2枚抜き）", () => {
    // 1戦目○ 2戦目○ 3戦目× → 2枚抜き = 2 × 1.0 = 2.0
    const log: BattleRecord[] = [
      rec(swiLine({ attacker: "秀吉", battleNo: 1, time: "06/15 11:00", win: true, defender: "敵A" }), 1),
      rec(swiLine({ attacker: "秀吉", battleNo: 2, time: "06/15 11:00", win: true, defender: "敵B" }), 2),
      rec(swiLine({ attacker: "秀吉", battleNo: 3, time: "06/15 11:00", win: false, defender: "敵C" }), 3),
    ];
    const ranking = swiRanking(log, 1);
    expect(ranking[0].bestSweep).toBe(2);
    expect(ranking[0].swi).toBeCloseTo(2.0);
  });

  it("1戦目で負けると0枚抜き（実効値0）", () => {
    const log: BattleRecord[] = [
      rec(swiLine({ attacker: "光秀", battleNo: 1, time: "06/15 12:00", win: false }), 1),
    ];
    const ranking = swiRanking(log, 1);
    expect(ranking[0].bestSweep).toBe(0);
    expect(ranking[0].swi).toBeCloseTo(0);
  });

  it("複数出撃の実効値合計を総出兵数で割る", () => {
    // 出撃A(10:00): 3枚抜き=3.6, 出撃B(11:00): 1戦目のみ勝ち=1枚=1.0
    const log: BattleRecord[] = [
      rec(swiLine({ attacker: "家康", battleNo: 1, time: "06/15 10:00", win: true, defender: "敵A" }), 1),
      rec(swiLine({ attacker: "家康", battleNo: 2, time: "06/15 10:00", win: true, defender: "敵B" }), 2),
      rec(swiLine({ attacker: "家康", battleNo: 3, time: "06/15 10:00", win: true, defender: "敵C" }), 3),
      rec(swiLine({ attacker: "家康", battleNo: 1, time: "06/15 11:00", win: true, defender: "敵D" }), 4),
    ];
    const ranking = swiRanking(log, 1);
    // (3.6 + 1.0) / 2 = 2.3
    expect(ranking[0].sorties).toBe(2);
    expect(ranking[0].swi).toBeCloseTo(2.3);
  });

  it("重複行（同一出撃の再登録）は二重計上しない", () => {
    const a = swiLine({ attacker: "謙信", battleNo: 1, time: "06/15 13:00", win: true, defender: "敵A" });
    const b = swiLine({ attacker: "謙信", battleNo: 2, time: "06/15 13:00", win: true, defender: "敵B" });
    const log: BattleRecord[] = [
      rec(a, 1),
      rec(b, 2),
      rec(a, 3), // 重複
      rec(b, 4), // 重複
    ];
    const ranking = swiRanking(log, 1);
    expect(ranking[0].sorties).toBe(1);
    expect(ranking[0].bestSweep).toBe(2);
  });

  it("minSorties 未満の武将は除外される", () => {
    const log: BattleRecord[] = [
      rec(swiLine({ attacker: "三成", battleNo: 1, time: "06/15 14:00", win: true }), 1),
    ];
    expect(swiRanking(log, 5)).toHaveLength(0);
    expect(swiRanking(log, 1)).toHaveLength(1);
  });

  it("SWI 降順に並ぶ", () => {
    const log: BattleRecord[] = [
      // 強: 3枚抜き
      rec(swiLine({ attacker: "強将", battleNo: 1, time: "06/15 09:00", win: true, defender: "敵A" }), 1),
      rec(swiLine({ attacker: "強将", battleNo: 2, time: "06/15 09:00", win: true, defender: "敵B" }), 2),
      rec(swiLine({ attacker: "強将", battleNo: 3, time: "06/15 09:00", win: true, defender: "敵C" }), 3),
      // 弱: 1枚抜き
      rec(swiLine({ attacker: "弱将", battleNo: 1, time: "06/15 09:30", win: true, defender: "敵D" }), 4),
    ];
    const ranking = swiRanking(log, 1);
    expect(ranking.map((r) => r.name)).toEqual(["強将", "弱将"]);
  });
});

describe("weaponStats / itemStats", () => {
  // 実データのゲーム仕様に合わせ、装備1列=品物 / 装備2列=武器。
  // 攻撃側 信長: 装備1=金の腕輪(品物) 装備2=鬼丸(武器)。
  // 防衛側 勝頼: 装備1=金の兜(品物) 装備2=カルバリン砲(武器)。
  function equipLine(time: string, result: string): string {
    return `【1戦目】 1600年4月 ${time} 京都 織田 信長 織田家 武特 騎馬隊 騎兵 金の腕輪 鬼丸 V.S. 武田 勝頼 武田家 統特 騎馬隊 騎兵 金の兜 カルバリン砲 ${result} 12`;
  }
  const log: BattleRecord[] = [
    rec(equipLine("04/10 10:00", "信長の勝利"), 1),
    rec(equipLine("04/11 11:00", "信長の勝利"), 2),
  ];

  it("武器は装備2列を集計し、品物（装備1列）は含まない", () => {
    const names = weaponStats(log).map((w) => w.name);
    expect(names).toContain("鬼丸");
    expect(names).toContain("カルバリン砲");
    expect(names).not.toContain("金の腕輪");
    expect(names).not.toContain("金の兜");
  });

  it("武器の攻守・勝敗・使用武将を集計する", () => {
    const oni = weaponStats(log).find((w) => w.name === "鬼丸")!;
    expect(oni.battles).toBe(2);
    expect(oni.attackUses).toBe(2);
    expect(oni.defenseUses).toBe(0);
    expect(oni.wins).toBe(2);
    expect(oni.winRate).toBeCloseTo(1);
    expect(oni.topUsers[0]).toEqual({ name: "信長", count: 2 });
  });

  it("品物は装備1列を集計し、武器（装備2列）は含まない", () => {
    const names = itemStats(log).map((i) => i.name);
    expect(names).toContain("金の腕輪");
    expect(names).toContain("金の兜");
    expect(names).not.toContain("鬼丸");
    expect(names).not.toContain("カルバリン砲");
  });

  it("品物の防衛側使用・敗北を集計する", () => {
    const kabuto = itemStats(log).find((i) => i.name === "金の兜")!;
    expect(kabuto.battles).toBe(2);
    expect(kabuto.defenseUses).toBe(2);
    expect(kabuto.attackUses).toBe(0);
    expect(kabuto.losses).toBe(2);
    expect(kabuto.winRate).toBeCloseTo(0);
  });
});

describe("formatWinRate", () => {
  it("勝率を整数パーセントに丸める", () => {
    expect(formatWinRate(0.666, 30)).toBe("67%");
    expect(formatWinRate(0.5, 2)).toBe("50%");
    expect(formatWinRate(1, 4)).toBe("100%");
    expect(formatWinRate(0, 3)).toBe("0%");
  });

  it("決着していない（decided が 0 以下）ときは — を返す", () => {
    expect(formatWinRate(0, 0)).toBe("—");
    expect(formatWinRate(0.5, 0)).toBe("—");
    expect(formatWinRate(0.5, -1)).toBe("—");
  });
});


