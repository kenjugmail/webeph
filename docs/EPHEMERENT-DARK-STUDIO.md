# Ephemerent dark studio plates

The dark homepage photography is a separate authored series, not a colour
inversion of the paper-face images. The light photographs remain unchanged.

## Provenance

| Phase | Composition source | Dark-mode outputs |
|---|---|---|
| Assemble | `assets/ephemerent-network-1600.webp` | `ephemerent-network-dark-studio-{900,1600}.{avif,jpg}` |
| Isolate | `assets/ephemerent-isolation-1536.webp` | `ephemerent-isolation-dark-studio-{900,1536}.{avif,jpg}` |
| Verify / Release | `assets/ephemerent-verification-1536.webp` | `ephemerent-verification-dark-studio-{900,1536}.{avif,jpg}` |

- Generated August 22, 2026 with the built-in GPT Image tool.
- Each light photograph was the geometry lock. The generated Assemble plate
  was the material and lighting reference for Isolate and Verify.
- Responsive files are deterministic encodes of the selected generated image:
  AVIF for the primary source and JPEG as the broad fallback.
- The former `-dark-` tone-derived files remain in the repository as a
  reversible fallback but are no longer requested by the page.

## Shared art direction

Re-photograph the exact physical pin-and-thread installation as a purpose-built
nocturnal study on deep charcoal handmade paper. Preserve composition, camera,
topology, pin positions, routes, result markers, and negative space. Use
realistic editorial museum-documentation photography, controlled warm tungsten
raking light from upper left, detailed dark midtones, graphite-black pins,
mineral-green cotton thread, muted oxidized-green markers, handmade paper tooth,
soft-edged shadows, and subtle analog grain.

Do not add or remove nodes or routes. No text, labels, logos, watermarks, glowing
circuitry, neon blue or purple, fog, fantasy, glossy 3D rendering, interface
chrome, dashboards, decorative particles, or inversion effects.

## Phase-specific invariants

- **Assemble:** dense source cluster at left, three branching paths, three green
  waypoints, and the square retained-result lattice at lower right.
- **Isolate:** one incoming route, central three-way split, three folded-paper
  shelves, independent path geometry, and three separate green endpoints.
- **Verify:** attempted paths and evidence fragments at left, selected lower
  route, one circular green decision marker, and the retained result at right.

Run `npm run plates:tone` to verify dimensions, payload size, exposure,
responsive consistency, and colour restraint without rewriting the images.

## Social preview

`assets/og-ephemerent.svg` is the deterministic 1200×630 source for the
institutional social card. It uses the Assemble plate as photography while all
brand text, rules, crop marks, and metadata remain code-authored. The rendered
`assets/og-ephemerent.png` is referenced with the `v=20260822` cache key so
social crawlers do not retain the former light-page preview.
