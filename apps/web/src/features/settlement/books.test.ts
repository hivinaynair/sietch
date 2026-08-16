import { expect, test } from "bun:test";
import { booksFor, booksLabel } from "./books";
import { forbiddenCopy } from "./clip";

test("before settle the share sits on the desk, not on Paul’s books", () => {
  expect(booksFor("idle")).toEqual({ deskShares: 1, paulShares: 0 });
  expect(booksFor("pending")).toEqual({ deskShares: 1, paulShares: 0 });
  expect(booksFor("published")).toEqual({ deskShares: 1, paulShares: 0 });
});

test("after settle the desk is empty and Paul’s institution holds the share", () => {
  expect(booksFor("settled")).toEqual({ deskShares: 0, paulShares: 1 });
});

test("live balances win over the phase story", () => {
  expect(booksFor("idle", { deskShares: 0, paulShares: 1 })).toEqual({
    deskShares: 0,
    paulShares: 1,
  });
});

test("labels name books, not a customer wallet", () => {
  expect(booksLabel("outbound", 1)).toBe("1 share on the desk");
  expect(booksLabel("inbound", 0)).toBe("0 shares on the books");
  expect(booksLabel("inbound", 1)).toBe("1 share on the books");
  expect(forbiddenCopy(`${booksLabel("outbound", 1)} ${booksLabel("inbound", 1)}`)).toEqual([]);
});
