# Compliance end-to-end specs

Routes: `/compliance` (documents), `/compliance/training`,
`/compliance/training/createModule`, `/compliance/training/{moduleId}`,
`/compliance/certificates`.

## What lives where

| Spec | Covers | Tests |
| --- | --- | --- |
| `compliance.cy.ts` | Documents, the training screen, certificates, session and error handling | 59 |
| `training-module.cy.ts` | Creating a module, deleting one, taking it, and the certificate that follows | 101 |
| | **Total (must stay green)** | **160** |

```bash
npx cypress run --spec "cypress/e2e/compliance/*.cy.ts"
npx cypress run --spec cypress/e2e/compliance/training-module.cy.ts
```

There is no known-defects file for this module yet.

## The module has no endpoints of its own

Everything lives on two records the rest of the app already owns:

| Thing | Where it lives |
| --- | --- |
| Training modules | `home.complianceTraining` — `GET`/`PUT /v1/home/{id}` |
| Home documents | `home.documents` — same record |
| Who has completed what | `user.completedComplianceModules` |
| Certificates | `user.documents` where `documentCategory === "certificate"` |
| Minting a certificate | `POST /v1/compliance/generate-certificate` |

So **creating or deleting a training module is a `PUT` of the whole home**, and
a spec that stubs only `GET /v1/home` will let the write escape. Files go to S3
through `/api/s3/presign-put`, and the default modules are listed with
`/api/s3/list-objects` — stub that on every training screen or the page waits on
a real bucket.

## What makes a module "complete"

`[training_id].tsx` decides from what the module actually contains:

| Module holds | Complete when |
| --- | --- |
| a video only | it has been watched past **99%** |
| a deck only | the confirmation checkbox is ticked |
| both | **both** — ticking the box alone is not enough |

Download Certificate renders only once that is satisfied. The third row is the
one worth protecting: it is asserted from both directions (video first, checkbox
first) and negatively from each half on its own.

Once complete, the page **mints the certificate automatically** — the button
only downloads what already exists. Re-opening a finished module does not issue
a second one (`hasIssuedCertificateRef` plus the check against
`completedComplianceDocumentIds`).

## Driving the video

A real `<video>` cannot be played to the end in CI; the source is a presigned S3
URL that does not resolve. The component reads `e.currentTarget.duration` and
`.currentTarget.currentTime` inside its `onLoadedMetadata` / `onTimeUpdate`
handlers, so the tests define those two properties on the element and dispatch
the native events. React's synthetic handlers fire from the native ones, so this
exercises the real `(currentTime / duration) * 100 > 99` arithmetic rather than
a mock of it — which is why "still withholds it at ninety per cent" is a
meaningful test.

```ts
Object.defineProperty(video, "duration", { value: 10, configurable: true });
Object.defineProperty(video, "currentTime", { value: 10, writable: true, configurable: true });
video.dispatchEvent(new Event("loadedmetadata"));
video.dispatchEvent(new Event("timeupdate"));
```

## The certificate stub needs a URL

`ensureCertificateUrl` only settles promptly when the create response carries
`documentUrl`. Without one it refetches the user **five times with 800 ms
sleeps** and then throws — and `Download Certificate` is
`disabled={!isCompleted || certificateLoader}` throughout, so the button a
learner has just earned sits disabled for about four seconds and then reports an
error. `stubCertificate()` returns a URL by default; the slow path is pinned
separately rather than left to surprise the next person.

The certificate itself opens in a new tab (`window.open`), it is not written to
disk — so stub `window.open` and assert it was called. What the document looks
like is out of scope, in line with the rest of the suite.

## Selector notes

**The duration control has no radio inputs.** `FormSingleRadioSelect` renders
`RadioButton`, which is styled `div`s; the chosen one carries `data-state="on"`
and the others `"off"`. `cy.get('input[type="radio"]')` finds nothing on this
form.

**Validation messages depend on whether a field has ever held a string.** An
untouched field is `undefined`, so zod answers with its own `"Required"` and the
schema's custom messages (`"Module Title is required"`) never appear on a
pristine form. Type and clear the field to see them.

**A training card** is the nearest `w-[300px]` block around the module name; the
delete control is a `rounded-[50%]` div, not a button.

**Content-type icons** are lucide SVGs distinguished by colour class:
`text-blue-500` for `.mp4`, `text-green-500` for `.ppt`/`.pptx`.

## As-built oddities pinned rather than matched silently

- **"succesfully"** is misspelled in both training popovers — "Training module
  uploaded succesfully!" and "Module deleted succesfully!".
- **Extra files are dropped in silence.** `handleFileUpload` keeps the first
  `.mp4` and the first `.ppt`/`.pptx` and discards the rest without a word. The
  "You can upload only one video and one PPT file" warning below it can never
  fire, because the same guards cap `validFiles` at two.
- **A module whose documents are all of an unsupported type vanishes entirely**
  rather than rendering empty — pinned in `compliance.cy.ts`.
- **The deck confirmation locks once complete** (`disabled={isCompleted}`), so
  it cannot be unticked to undo a completion.

## Not covered here

- The Documents section, by agreement.
- What the certificate document actually contains — only that one is requested,
  that its URL is opened, and that it reaches the certificates screen.
- The Google Docs viewer the PPT iframe points at; the tests assert the iframe
  is rendered, not that it renders slides.
