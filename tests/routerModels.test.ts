import { describe, expect, it } from "vitest";
import { routerModel } from "../src/lib/routerModels";

describe("nama model ClassAI Router", () => {
  it("alias lama yang dibalas 404 diubah ke ID katalog", () => {
    expect(routerModel("claude-opus-5.0")).toBe("claude-opus-5");
    expect(routerModel("claude-sonnet-5.0")).toBe("claude-sonnet-5");
    expect(routerModel("claude-sonnet-4.5")).toBe("claude-haiku-4.5");
    expect(routerModel("qwen-max")).toBe("qwen3.8-max");
    expect(routerModel("qwen-plus")).toBe("qwen3.7-plus");
  });
  it("ID yang sudah benar tidak diubah", () => {
    for (const id of ["claude-opus-5.5", "deepseek-v4.1-flash", "nemotron-3.5-lightning:free", "gpt-6-luna"]) expect(routerModel(id)).toBe(id);
  });
});
