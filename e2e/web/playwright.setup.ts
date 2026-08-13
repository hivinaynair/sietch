import { defineNetworkFixture, type NetworkFixture } from "@msw/playwright";
import { test as testBase } from "@playwright/test";
import { handlers } from "@repo/mocks/handlers";
import type { AnyHandler } from "msw";

type Fixtures = {
  handlers: AnyHandler[];
  network: NetworkFixture;
};

export const test = testBase.extend<Fixtures>({
  handlers: [handlers, { option: true }],
  network: [
    async ({ context, handlers: networkHandlers }, use) => {
      const network = defineNetworkFixture({
        context,
        handlers: networkHandlers,
        onUnhandledRequest: "bypass",
      });

      await network.enable();
      await use(network);
      await network.disable();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
