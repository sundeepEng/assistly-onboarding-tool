/**
 * Compliance training helpers — utils/complianceUtil.tsx
 *
 * `transformS3ModulesToStructured` is what turns the raw S3 listing of the
 * default training folder into module objects the Training screen can render
 * beside the home's own uploads. `extFromUrl` sits underneath it.
 */

import { extFromUrl, transformS3ModulesToStructured } from "../../../utils/complianceUtil";
import { ComplianceTrainingAllowedTypes, defaultTrainingFolder } from "../../../utils/constants";
import { clearAuthSession, setAuthSession, TEST_USER_ID } from "../../test-utils/auth";

// ─── extFromUrl ──────────────────────────────────────────────────────────────

describe("extFromUrl", () => {
  describe("absolute URLs", () => {
    it("returns the extension from a path", () => {
      expect(extFromUrl("https://bucket.s3.amazonaws.com/a/b/training.mp4")).toBe(".mp4");
    });

    it("lower-cases the extension", () => {
      expect(extFromUrl("https://bucket.s3.amazonaws.com/a/DECK.PPTX")).toBe(".pptx");
    });

    it("ignores the query string", () => {
      expect(
        extFromUrl("https://bucket.s3.amazonaws.com/a/training.mp4?X-Amz-Signature=abc")
      ).toBe(".mp4");
    });

    it("ignores the fragment", () => {
      expect(extFromUrl("https://bucket.s3.amazonaws.com/a/training.mp4#t=30")).toBe(".mp4");
    });

    it("returns an empty string when the path has no extension", () => {
      expect(extFromUrl("https://bucket.s3.amazonaws.com/a/training")).toBe("");
    });
  });

  describe("bare paths — the URL constructor throws and the fallback runs", () => {
    it("returns the extension from a relative path", () => {
      expect(extFromUrl("folder/training.mp4")).toBe(".mp4");
    });

    it("returns the extension from a bare filename", () => {
      expect(extFromUrl("training.pptx")).toBe(".pptx");
    });

    it("strips a query string before looking for the dot", () => {
      expect(extFromUrl("training.mp4?v=2")).toBe(".mp4");
    });

    it("returns an empty string when there is no dot at all", () => {
      expect(extFromUrl("training")).toBe("");
    });

    it("returns an empty string for an empty input", () => {
      expect(extFromUrl("")).toBe("");
    });
  });

  /**
   * Pinned: the helper takes the *last* dot in the whole pathname, not the last
   * path segment. A dotted directory name therefore swallows the rest of the
   * path into the "extension".
   */
  it("mis-reads the extension when a directory name contains a dot", () => {
    expect(extFromUrl("https://bucket.s3.amazonaws.com/v1.2/training")).toBe(".2/training");
  });

  it("handles a dotted directory correctly when the file also has an extension", () => {
    expect(extFromUrl("https://bucket.s3.amazonaws.com/v1.2/training.mp4")).toBe(".mp4");
  });

  it("treats a dotfile as all-extension", () => {
    expect(extFromUrl("https://bucket.s3.amazonaws.com/a/.gitignore")).toBe(".gitignore");
  });
});

// ─── transformS3ModulesToStructured ──────────────────────────────────────────

/**
 * The shape the function body actually reads.
 *
 * Its declared parameter type is `Record<string, { video?, ppt? }>` — one level
 * deeper than the value it is given. `compliance-training.tsx` maps over
 * `Object.entries(modules)` and passes each *value* straight in, so the real
 * argument is a single `{ video?, ppt? }`. The cast below keeps the tests
 * expressing the true shape without touching the app's annotation.
 */
type S3Module = { video?: string; ppt?: string };

const transform = (moduleId: string, module: S3Module) =>
  transformS3ModulesToStructured(moduleId, module as any);

describe("transformS3ModulesToStructured", () => {
  const videoOnly: S3Module = { video: "s3://bucket/Default/Fire Safety_video.mp4" };
  const pptOnly: S3Module = { ppt: "s3://bucket/Default/Fire Safety_deck.pptx" };

  it("derives the module name by stripping the trailing _segment", () => {
    expect(transform("fire-safety", videoOnly).moduleName).toBe("Fire Safety");
  });

  it("carries the module id through unchanged", () => {
    expect(transform("fire-safety", videoOnly).moduleId).toBe("fire-safety");
  });

  it("marks the module as a default one", () => {
    expect(transform("fire-safety", videoOnly).moduleType).toBe("default");
  });

  it("leaves the description empty — S3 carries no metadata", () => {
    expect(transform("fire-safety", videoOnly).moduleDescription).toBe("");
  });

  describe("documents", () => {
    it("emits one document for a video-only module", () => {
      const { documents } = transform("fire-safety", videoOnly);
      expect(documents).toHaveLength(1);
      expect(documents[0]).toMatchObject({
        documentId: "Fire Safety_video",
        documentName: "Fire Safety_video",
        documentType: ".mp4",
        documentUrl: videoOnly.video,
      });
    });

    it("emits one document for a ppt-only module", () => {
      const { documents } = transform("fire-safety", pptOnly);
      expect(documents).toHaveLength(1);
      expect(documents[0]).toMatchObject({
        documentId: "Fire Safety_ppt",
        documentType: ".pptx",
        documentUrl: pptOnly.ppt,
      });
    });

    it("emits both documents when the module has a video and a deck", () => {
      const { documents } = transform("fire-safety", {
        video: videoOnly.video,
        ppt: pptOnly.ppt,
      });
      expect(documents.map((d: any) => d.documentType)).toEqual([".mp4", ".pptx"]);
    });

    it("emits no documents for an empty module", () => {
      expect(transform("empty", {}).documents).toEqual([]);
    });

    /**
     * Pinned: the document type is hardcoded. `extFromUrl("")` is called with an
     * empty string — not the document URL — so it always returns "" and the
     * `|| ".mp4"` / `|| ".pptx"` fallback always wins. A `.ppt` deck is therefore
     * labelled `.pptx`, and a `.mov` video is labelled `.mp4`.
     */
    it("labels a .ppt deck as .pptx — the extension is never read from the URL", () => {
      const { documents } = transform("fire-safety", {
        ppt: "s3://bucket/Default/Fire Safety_deck.ppt",
      });
      expect(documents[0].documentType).toBe(".pptx");
    });

    it("labels a .mov video as .mp4", () => {
      const { documents } = transform("fire-safety", {
        video: "s3://bucket/Default/Fire Safety_clip.mov",
      });
      expect(documents[0].documentType).toBe(".mp4");
    });

    /** Whatever type it assigns must survive the Training screen's own filter. */
    it("only ever assigns types the Training screen accepts", () => {
      [videoOnly, pptOnly].forEach((module) => {
        transform("m", module).documents.forEach((doc: any) => {
          expect(ComplianceTrainingAllowedTypes).toContain(doc.documentType);
        });
      });
    });
  });

  describe("module name derivation", () => {
    it("prefers the video filename when both are present", () => {
      expect(
        transform("m", {
          video: "s3://bucket/From Video_clip.mp4",
          ppt: "s3://bucket/From Deck_slides.pptx",
        }).moduleName
      ).toBe("From Video");
    });

    it("uses only the last path segment", () => {
      expect(
        transform("m", { video: "s3://a/b/c/Hand Hygiene_video.mp4" })
          .moduleName
      ).toBe("Hand Hygiene");
    });

    /**
     * Pinned: the name is the filename minus its final `_segment`, so a file
     * without an underscore loses its extension-bearing tail only — a file named
     * `training.mp4` keeps the extension in the module name.
     */
    it("keeps the extension when the filename has no underscore", () => {
      expect(
        transform("m", { video: "s3://bucket/training.mp4" }).moduleName
      ).toBe("training.mp4");
    });

    it("strips only the final segment when there are several underscores", () => {
      expect(
        transform("m", { video: "s3://bucket/Fire_Safety_Basics_video.mp4" })
          .moduleName
      ).toBe("Fire_Safety_Basics");
    });
  });

  describe("timestamps", () => {
    it("stamps createdAt and modifiedAt with the same ISO instant", () => {
      const module = transform("m", videoOnly);
      expect(module.createdAt).toBe(module.modifiedAt);
      expect(module.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("stamps each document with the same instant as the module", () => {
      const module = transform("m", videoOnly);
      expect(module.documents[0].documentCreatedAt).toBe(module.createdAt);
    });

    /**
     * The Training screen sorts by `createdAt` descending. Default modules are
     * stamped at render time, so they always sort above the home's own uploads —
     * which is why the screen concatenates them ahead of the sorted list rather
     * than relying on the sort.
     */
    it("stamps a fresh timestamp on every call", async () => {
      const first = transform("m", videoOnly).createdAt;
      await new Promise((r) => setTimeout(r, 5));
      const second = transform("m", videoOnly).createdAt;
      expect(new Date(second).getTime()).toBeGreaterThanOrEqual(new Date(first).getTime());
    });
  });

  describe("createdByUserId", () => {
    /**
     * Pinned: `utils/complianceUtil.tsx` calls `getUserIdFromToken()` once, at
     * module scope, so the value is whatever the cookie held the first time the
     * module was imported — not the signed-in user at call time. Under jest no
     * session exists at import, so it is null; signing in afterwards does not
     * change it.
     */
    afterEach(() => clearAuthSession());

    it("is null when no session existed at import time", () => {
      setAuthSession("PCHO");
      const module = transform("m", videoOnly);
      expect(module.createdByUserId).toBeNull();
      expect(module.documents[0].documentCreatedByUserId).toBeNull();
    });

    it("is captured at import, so a session set beforehand is picked up", () => {
      jest.isolateModules(() => {
        setAuthSession("PCHO");
        // Required *after* the cookie exists, so module scope sees it.
        const {
          transformS3ModulesToStructured: freshTransform,
        } = require("../../../utils/complianceUtil");
        expect(freshTransform("m", videoOnly).createdByUserId).toBe(TEST_USER_ID);
      });
    });

    it("does not re-read the cookie between calls", () => {
      jest.isolateModules(() => {
        setAuthSession("PCHO");
        const {
          transformS3ModulesToStructured: freshTransform,
        } = require("../../../utils/complianceUtil");
        expect(freshTransform("m", videoOnly).createdByUserId).toBe(TEST_USER_ID);

        clearAuthSession();
        expect(freshTransform("m", videoOnly).createdByUserId).toBe(TEST_USER_ID);
      });
    });
  });

  it("reads the default modules out of the folder the Training screen lists", () => {
    // Guards the constant the S3 listing is keyed on.
    expect(defaultTrainingFolder).toBe("Default_Compliance_Training_Videos");
  });
});
