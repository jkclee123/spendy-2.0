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

const filenames = ["spendy-api.shortcut", "spendy-messages.shortcut", "spendy-octopus.shortcut"];

afterEach(cleanup);

describe("iOS shortcut downloads", () => {
  it.each(["en", "zh-HK"])("offers the same three files in %s", async (language) => {
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
    links.forEach((link, index) => {
      expect(link.getAttribute("href")).toBe(`/shortcuts/${filenames[index]}`);
      expect(link.getAttribute("download")).toBe(filenames[index]);
      expect(link.textContent).toBeTruthy();
    });
    expect(screen.getByText(/apiToken/)).toBeTruthy();
    expect(links[0].querySelector("img")).toBeNull();
    ["messages", "octopus"].forEach((shortcut, index) => {
      const icon = links[index + 1].querySelector("img");
      expect(icon?.getAttribute("src")).toBe(`/icons/${shortcut}.png`);
      expect(icon?.getAttribute("alt")).toBe("");
    });
  });

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
});
