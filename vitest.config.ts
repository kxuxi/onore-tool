import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 純粋関数のテストが中心のため node 環境で実行する。
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
