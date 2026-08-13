import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Button } from "./components/button";

test("renders children", () => {
  render(<Button type="button">Save</Button>);

  const button = screen.getByRole("button", { name: "Save" });
  expect(button.getAttribute("data-slot")).toBe("button");
  expect(button.getAttribute("type")).toBe("button");
});
