import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

test("renders children", () => {
  render(
    <Button appName="web" className="primary">
      Save
    </Button>,
  );

  const button = screen.getByRole("button", { name: "Save" });
  expect(button).toHaveClass("primary");
  expect(button).toHaveAttribute("type", "button");
});

test("alerts with the app name on click", () => {
  const alert = mock(() => {});
  globalThis.alert = alert;

  render(<Button appName="web">Save</Button>);
  screen.getByRole("button", { name: "Save" }).click();

  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledWith("Hello from your web app!");
});
