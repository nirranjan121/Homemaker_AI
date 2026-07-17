# homecraft-mcp

MCP server (NitroStack) that turns a 2D floor plan into an interactive 3D shell,
with material editing and a rough cost estimate — each tool call renders live
in a single Three.js widget.

## What this is

A **scoped MVP shell**, not the full "AI-powered digital twin" platform. Three
tools, one widget:

| Tool | Does | Status |
|---|---|---|
| `generate_3d_shell` | Extracts rooms/walls from a floor plan image, builds a basic extruded 3D shell | Room extraction is **stubbed** (`houseplan.vision.ts`) — returns a fixed 3-room layout so the rest of the pipeline is demoable before segmentation is built |
| `edit_material` | Changes wall color / floor material from a target+value (no geometry change) | Deterministic path works now; wiring free-text commands through an LLM to pick `target`/`value` is the next step |
| `estimate_cost` | Area × regional rate band → cost range | City resolution is a **stub string-match** (`houseplan.rates.ts`) — swap for Google Maps Geocoding API or a live web-search rate lookup |

Deliberately **not** built: MEP layer visualization, geometry-changing NLP
edits ("make the kitchen bigger"), multi-user persistence, real BOQ. These are
roadmap items, not MVP scope — see the earlier scoping discussion.

## Project structure

```
homecraft/
├── src/
│   ├── index.ts                      # bootstraps the MCP app
│   ├── app.module.ts                 # root module
│   └── modules/houseplan/
│       ├── houseplan.module.ts
│       ├── houseplan.tools.ts        # the 3 @Tool definitions
│       ├── houseplan.state.ts        # in-memory single-session house model
│       ├── houseplan.vision.ts       # STUB: floor plan -> RoomShape[]
│       └── houseplan.rates.ts        # STUB: city -> rate band lookup
├── src/widgets/app/house-3d-viewer/
│   └── page.tsx                      # Three.js widget, reused by all 3 tools
├── package.json
├── tsconfig.json
└── .env.example
```

## Running it

```bash
npx @nitrostack/cli init .        # if you want the CLI to (re)scaffold configs
npm install
cp .env.example .env              # fill in GOOGLE_MAPS_API_KEY etc. when ready
npm run dev
```

Open in NitroStudio (or `npm run dev` + your MCP client of choice) and call
`generate_3d_shell` with a base64 floor plan image first — `edit_material` and
`estimate_cost` both read the model it stores, so they'll error with a clear
message ("No house model yet...") if called first.

## Real next steps, in priority order

1. Replace `extractRoomsFromPlanImage` with a real segmentation pipeline
   (start with an OpenCV heuristic: line detection → closed contours → room
   polygons; upgrade to a trained model like CubiCasa5K-based segmentation
   later).
2. Replace `resolveCityTier`'s string match with the Google Maps Geocoding
   API.
3. Replace the static `RATE_TABLE_INR_PER_SQFT` with a live web-search call
   at request time ("construction cost per sq ft `<city>` 2026") so rates
   stay current instead of hardcoded.
4. Move `HouseplanState` from in-memory to Supabase/Firebase once this needs
   to support more than one concurrent session.
