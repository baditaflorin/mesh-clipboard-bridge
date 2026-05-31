import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer assertion for the advertised core action:
 * "Share text and snippets between your own phones and laptops."
 *
 * Peer A types a snippet and sends it to the mesh; peer B's list must show
 * the EXACT snippet text. This fails against any local-only stub (a snippet
 * that lands in React useState instead of the Yjs `clip` array never reaches
 * peer B) and passes only when the write goes through the shared CRDT doc.
 */
test("snippet typed on peer A appears verbatim on peer B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Wait for both peers to reach a connected (non-"Connecting…") state.
    await expect(a.locator(".clip-send textarea")).toBeVisible();
    await expect(b.locator(".clip-send textarea")).toBeVisible();

    const snippet = `ssh-key-2fa-${Math.random().toString(36).slice(2, 10)}`;

    await a.locator(".clip-send textarea").fill(snippet);
    await a.getByRole("button", { name: /send to mesh/i }).click();

    // The advertised result: B (the OTHER device) sees the exact snippet.
    await expect(b.locator(".clip-entry-text", { hasText: snippet })).toBeVisible();
    await expect(b.locator(".clip-entry-text", { hasText: snippet })).toHaveText(snippet);

    // The "one-click copy" UX: B exposes a copy control on the received entry,
    // and the snippet value is present/selectable for copy on B.
    const entryOnB = b.locator(".clip-entry", { hasText: snippet });
    await expect(entryOnB.getByRole("button", { name: /copy/i })).toBeVisible();
  } finally {
    await cleanup();
  }
});

test("multiple snippets preserve order on the receiving peer", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await expect(a.locator(".clip-send textarea")).toBeVisible();
    await expect(b.locator(".clip-send textarea")).toBeVisible();

    const tag = Math.random().toString(36).slice(2, 8);
    const snippets = [`first-${tag}`, `second-${tag}`, `third-${tag}`];

    for (const s of snippets) {
      await a.locator(".clip-send textarea").fill(s);
      await a.getByRole("button", { name: /send to mesh/i }).click();
      await expect(b.locator(".clip-entry-text", { hasText: s })).toBeVisible();
    }

    // The list renders newest-first; assert the most-recent snippet is the
    // first entry on B and the oldest is last — order is preserved across the
    // mesh (a single shared Y.Array, not three independent local pushes).
    const textsOnB = await b.locator(".clip-entry-text").allTextContents();
    const relevant = textsOnB.filter((t) => t.endsWith(tag));
    expect(relevant).toEqual([`third-${tag}`, `second-${tag}`, `first-${tag}`]);
  } finally {
    await cleanup();
  }
});
