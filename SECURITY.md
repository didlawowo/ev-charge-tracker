# Security Policy

## Reporting a Vulnerability

Please report vulnerabilities via
[GitHub Security Advisories](https://github.com/didlawowo/ev-charge-tracker/security/advisories/new)
for this repository. Do not open a public issue for security reports.

We aim to acknowledge reports within 72 hours.

## Scope and threat model

EV Finder is a **client-side only** application: there is no backend, no user
account and no server-side storage. The build produces static assets that are
served as-is.

Consequences worth knowing before reporting:

- `VITE_*` environment variables (including `VITE_OPENCHARGE_API_KEY`) are
  **inlined into the JavaScript bundle** at build time and are therefore public
  by design. Exposing such a key is not a vulnerability; OpenChargeMap keys are
  free and can be rotated at will.
- The application stores data locally in the browser (last computed trip,
  cached API responses and map tiles). There is no remote persistence.
- Third-party endpoints called directly from the browser: OpenChargeMap, OSRM,
  Photon (Komoot) and OpenStreetMap tiles.

Reports that are in scope include: XSS or injection through third-party API
data, service-worker cache poisoning, sensitive data leakage into the bundle,
and supply-chain issues in the build.

## Supported versions

Only the latest published version is supported. There are no LTS branches.
