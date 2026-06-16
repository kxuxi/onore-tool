import { describe, it, expect, beforeAll } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  SESSION_TTL_SECONDS,
} from "./auth";

beforeAll(() => {
  // 署名の一貫性のためテスト中の秘密鍵を固定する。
  process.env.AUTH_SECRET = "test-secret-for-vitest";
});

describe("hashPassword / verifyPassword", () => {
  it("正しいパスワードは検証に通る（round-trip）", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("間違ったパスワードは検証に通らない", () => {
    const stored = hashPassword("p@ssw0rd");
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("同じパスワードでも毎回ハッシュが異なる（salt）", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a).not.toBe(b);
    // それでも両方とも検証には通る。
    expect(verifyPassword("same", a)).toBe(true);
    expect(verifyPassword("same", b)).toBe(true);
  });

  it("壊れた形式の保存値は false を返す（例外を投げない）", () => {
    expect(verifyPassword("x", "plain-text")).toBe(false);
    expect(verifyPassword("x", "scrypt:only-two")).toBe(false);
    expect(verifyPassword("x", "bcrypt:aa:bb")).toBe(false);
    expect(verifyPassword("x", "scrypt::")).toBe(false);
  });
});

describe("createSessionToken / verifySessionToken", () => {
  const user = { id: 7, username: "admin" };

  it("発行したトークンを検証してペイロードを復元できる", () => {
    const now = 1_700_000_000_000;
    const token = createSessionToken(user, now);
    const payload = verifySessionToken(token, now);
    expect(payload).not.toBeNull();
    expect(payload?.uid).toBe(7);
    expect(payload?.username).toBe("admin");
    expect(payload?.exp).toBe(now + SESSION_TTL_SECONDS * 1000);
  });

  it("署名を改ざんしたトークンは null", () => {
    const token = createSessionToken(user);
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("本体（ペイロード）を差し替えたトークンは null", () => {
    const token = createSessionToken(user);
    const [, sig] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ uid: 999, username: "evil", exp: Date.now() + 10000 })
    ).toString("base64url");
    expect(verifySessionToken(`${forgedBody}.${sig}`)).toBeNull();
  });

  it("失効したトークンは null", () => {
    const now = 1_700_000_000_000;
    const token = createSessionToken(user, now);
    const afterExpiry = now + SESSION_TTL_SECONDS * 1000 + 1;
    expect(verifySessionToken(token, afterExpiry)).toBeNull();
  });

  it("形式が不正なトークンは null", () => {
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("no-dot")).toBeNull();
    expect(verifySessionToken(".onlysig")).toBeNull();
    expect(verifySessionToken("onlybody.")).toBeNull();
  });
});
