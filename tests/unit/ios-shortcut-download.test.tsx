// @vitest-environment jsdom

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { IosShortcutDownload } from "@/components/settings/IosShortcutDownload";
import en from "../../messages/en.json";
import zhHK from "../../messages/zh-HK.json";

const shortcuts = [
  { id: "api", name: "Spendy API" },
  { id: "wallet", name: "Spendy Wallet" },
  { id: "messages", name: "Spendy Messages" },
] as const;
const filenames = shortcuts.map(({ id }) => `spendy-${id}.shortcut`).sort();

afterEach(cleanup);

describe("iOS shortcut downloads", () => {
  it.each(["en", "zh-HK"])(
    "offers the same three shortcuts with localized labels in %s",
    async (language) => {
      const i18n = createInstance();
      await i18n.init({
        lng: language,
        resources: {
          en: { settings: en.settings },
          "zh-HK": { settings: zhHK.settings },
        },
      });

      render(
        <I18nextProvider i18n={i18n}>
          <IosShortcutDownload />
        </I18nextProvider>
      );

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(3);
      const messages = language === "zh-HK" ? zhHK : en;
      shortcuts.forEach(({ id, name }, index) => {
        expect(links[index].getAttribute("href")).toBe(`/shortcuts/spendy-${id}.shortcut`);
        expect(links[index].getAttribute("download")).toBe(`${name}.shortcut`);
        expect(links[index].textContent).toBe(messages.settings.iosShortcut[id].downloadButton);
        expect(screen.getByText(messages.settings.iosShortcut[id].description)).toBeTruthy();
      });
      expect(screen.getByText(messages.settings.iosShortcut.description)).toBeTruthy();
      expect(links[0].querySelector("img")).toBeNull();
      ["wallet", "messages"].forEach((id, index) => {
        const icon = links[index + 1].querySelector("img");
        expect(icon?.getAttribute("src")).toBe(`/icons/${id}.png`);
        expect(icon?.getAttribute("alt")).toBe("");
        expect(icon?.getAttribute("width")).toBe("24");
        expect(icon?.getAttribute("height")).toBe("24");
      });
    }
  );

  it("ships only the three signed shortcut files", () => {
    const directory = join(process.cwd(), "public/shortcuts");
    expect(
      readdirSync(directory)
        .filter((name) => name.endsWith(".shortcut"))
        .sort()
    ).toEqual(filenames);
    filenames.forEach((filename) => {
      const file = readFileSync(join(directory, filename));
      expect(file.subarray(0, 4).toString()).toBe("AEA1");
      expect(file.length).toBeGreaterThan(0);
    });
  });

  it.each(["wallet", "messages"])("ships the %s app icon locally", (id) => {
    const file = readFileSync(join(process.cwd(), "public/icons", `${id}.png`));
    expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
});
