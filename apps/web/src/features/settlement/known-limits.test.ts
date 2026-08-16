import { expect, test } from "bun:test";
import { forbiddenCopy } from "./clip";
import { LIMITS } from "./known-limits";

test("the four known stubs are all present", () => {
  expect(LIMITS.map((limit) => limit.id)).toEqual(["seal", "token", "keys", "proving"]);
});

test("every limit is a short claim, not an essay", () => {
  for (const limit of LIMITS) {
    expect(limit.title.length).toBeGreaterThan(10);
    expect(limit.what.length).toBeGreaterThan(20);
    expect(limit.what.length).toBeLessThan(140);
    expect(limit.real.length).toBeGreaterThan(20);
    expect(limit.real.length).toBeLessThan(140);
  }
});

test("the seal limit names the attack and points at the tested fix", () => {
  const seal = LIMITS.find((limit) => limit.id === "seal");
  expect(seal?.what).toMatch(/guesses/i);
  expect(seal?.real).toContain("policy_commitment");
  expect(seal?.real).toContain("crates/policy");
  // The reason it is not simply fixed has to be stated, or it reads as an oversight.
  expect(seal?.real).toMatch(/vkey/i);
});

test("the token limit admits the proof is not bound to the asset that moves", () => {
  const token = LIMITS.find((limit) => limit.id === "token");
  expect(token?.what).toContain("0x3333");
  expect(token?.what).toMatch(/not bound/i);
});

test("the keys limit still claims the isolation the clip does enforce", () => {
  const keys = LIMITS.find((limit) => limit.id === "keys");
  expect(keys?.what).toMatch(/one machine/i);
  expect(keys?.real).toContain("146");
  expect(keys?.real).toMatch(/decode error/i);
});

test("the proving limit separates precomputed proving from live verification", () => {
  const proving = LIMITS.find((limit) => limit.id === "proving");
  expect(proving?.what).toMatch(/does not prove/i);
  expect(proving?.real).toMatch(/540k gas/i);
});

test("no limit leaks a clause, a reason enum, or old-rails words", () => {
  const rendered = JSON.stringify(LIMITS);
  expect(forbiddenCopy(rendered)).toEqual([]);
  expect(rendered).not.toMatch(/max_amount|accepts_cross_border/i);
});

test("README carries the same four limits, so page and repo cannot drift", async () => {
  const readme = await Bun.file(new URL("../../../../../README.md", import.meta.url)).text();
  for (const limit of LIMITS) {
    expect(readme).toContain(limit.title);
  }
});
