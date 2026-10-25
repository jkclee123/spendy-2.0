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

const filenames = ["spendy-shortcut-en.shortcut", "spendy-shortcut-zh.shortcut"];

afterEach(cleanup);

describe("iOS shortcut downloads", () => {
  it.each(["en", "zh-HK"])("offers the localized shortcut in %s", async (language) => {
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
    expect(links).toHaveLength(1);
    const filename = filenames[language === "zh-HK" ? 1 : 0];
    expect(links[0].getAttribute("href")).toBe(`/shortcuts/${filename}`);
    expect(links[0].getAttribute("download")).toBe(filename);
    const messages = language === "zh-HK" ? zhHK : en;
    expect(links[0].textContent).toBe(messages.settings.iosShortcut.downloadButton);
  });

  it("ships only the two signed localized shortcut files", () => {
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
});
