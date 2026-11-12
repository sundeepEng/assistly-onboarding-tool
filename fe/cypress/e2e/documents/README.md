# Documents & E-Sign end-to-end specs

The DocuSeal integration has two app-owned contracts; the widget itself is
a third-party iframe and deliberately out of scope.

## What lives where

| Spec | Covers | Tests |
| --- | --- | --- |
| `e-sign.cy.ts` | `POST /v1/docuseal/builder-token` from the document card (name, presigned documentUrls, externalId JSON, roles — Bearer-authorized), `<docuseal-builder>` mounting, and the error state; `POST /v1/docuseal/create-submission` from EMAR (pdfBase64 + signerEmail), `<docuseal-form data-src=.../s/{slug}>`, and the prepare-failure popover | 6 |

As-built notes:

- `@docuseal/react` renders `<docuseal-form>`/`<docuseal-builder>` custom
  elements carrying the slug/token as `data-*` attributes — the shell is
  assertable without the CDN script ever loading.
- The builder presigns through `POST /api/s3/presign-get` (the Next API
  route), not `/v1/s3-pre-signed-url` — both exist and are not
  interchangeable.
- Care Report e-sign shares the create-submission contract with EMAR —
  the pin covers the shape of both.

Run it:

```bash
npx cypress run --spec cypress/e2e/documents/e-sign.cy.ts
```

The IHC e-sign *gate* (envelope-complete requirement) lives in
`home-types/in-home-care/inhome-care.cy.ts` §9 — the same doc name flips the button between
home types.
