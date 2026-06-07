# Ephemerent + Orrery

Two-page site. **Ephemerent.html** is the minimal, abstract company page (emergent
particle field) and links to **Orrery.html**, the single-page product site for the
agentic code editor. Closed source; runs on your machine with local or cloud models.
Central metaphor: a clockwork solar system where parallel agents orbit a goal.

## Structure
```
Ephemerent.html          Company page: abstract emergent field, statement, Orrery product card
Orrery.html              Product page (one page): hero orrery, parallel agents,
                         buddy + tutor dial, 3D review, models, capabilities, architecture, CTA
assets/
  orrery.css             Design system — tokens, type, buttons, nav, footer
  components.css          Styles for the swarm / buddy / review components
  ephemerent.js          Abstract emergent particle field (flow-field motes)
  orrery-bg.js           Hero orrery canvas (sun + orbiting agent-planets)
  swarm.js               Parallel-agent diagram (split → attempts → pick winner → merge)
  buddy.js               Buddy avatar with reactive states + narration
  review.js              WebGL before→after shader review with drag-to-compare
```

## Design tokens
Fonts: Space Grotesk (display), Hanken Grotesk (body), IBM Plex Mono (mono).
Palette: steel-blue #3d7fb8 / teal #2dd4bf / brass #e0a544 on near-black — an
"instrument" scheme, no purple. Primary buttons are warm cream. See `assets/orrery.css`.
Corners use a moderate radius (`--r-sm 5 / --r 9 / --r-lg 14`) — crisp but not blocky.

## Notes
- One page, no build step — open `Orrery.html` directly. Nav links scroll to sections.
- CTA links (Get started / Request access) are placeholders.
- Closed source: messaging emphasises local models and privacy (code never leaves the machine).
- Animations gate on visibility with timeout fallbacks; the buddy's color/shape changes are
  instant by design so they render correctly in any context.
```
