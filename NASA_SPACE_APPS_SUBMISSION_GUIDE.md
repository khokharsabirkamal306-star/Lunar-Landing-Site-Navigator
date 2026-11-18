# LUNA NAV — NASA Space Apps Submission Guide

> **Project:** LUNA NAV — 3D Lunar Landing Site & Ephemeris Navigator  
> **Challenge fit:** Lunar exploration, mission planning, and the use of open lunar science data  
> **Primary focus:** Comparing illustrative lunar South Pole landing-site candidates by modeled illumination, Earth visibility, and terrain criteria  
> **Repository:** [Lunar-Landing-Site-Navigator](https://github.com/khokharsabirkamal306-star/Lunar-Landing-Site-Navigator)

Use this as a project-specific draft for a Space Apps submission. Confirm the selected challenge, team details, and the current submission requirements in the official portal before submitting. The text below describes the current code, not a flight-certified landing analysis.

## Important scope and accuracy notes

- The app calculates an **analytical lunar ephemeris locally**. It does not currently fetch live data from NASA, JPL, or another service.
- The six candidate locations and their site parameters are hard-coded project inputs. Their terrain and horizon values are illustrative, not a verified survey or authoritative DEM.
- The local 12 × 12 km terrain view is procedurally generated for visualization; it is not rendered from LRO/LOLA elevation tiles.
- The displayed scores are relative, configurable comparisons based on the app's documented formulas. They are not validated mission-safety probabilities or landing recommendations.
- NASA/JPL data portals are cited in the app as sources for future verification and data integration. Do not describe those datasets as currently ingested.
- The project does not currently implement Gemini/AI features, an API backend, email alerts, or a mobile PWA.

---

## 1. Submission form draft

### Project title

**LUNA NAV: 3D Lunar Landing Site & Ephemeris Navigator**

### Short summary

LUNA NAV is an interactive 3D concept tool for exploring candidate landing regions near the lunar South Pole. It calculates approximate Sun and Earth geometry for a chosen date, then compares six sample sites using illumination, Earth line-of-sight, and terrain-slope criteria. A 3D lunar globe, local crater-relief view, time controls, and comparison table make the trade-offs visible. The current prototype uses analytical calculations and illustrative site/terrain inputs; it is a visualization and exploration aid, not a flight-certified navigation or landing system.

### Detailed project description

#### The problem

Planning a lunar South Pole mission involves balancing several conditions that vary by location and time. A site may receive useful sunlight for power while having a poor view of Earth for communications, or its surrounding terrain may be too steep for a safe landing or traverse. Polar illumination is especially sensitive to local topography and the low angle of the Sun.

LUNA NAV presents these factors together so that students, educators, and early mission-design teams can explore how location, date, and mission priorities affect a preliminary site comparison.

#### What the prototype does

- Displays an interactive 3D lunar South Pole globe with six selectable, hard-coded candidate locations.
- Computes approximate solar and Earth directions for a selected UTC date and time using an analytical lunar ephemeris in a Mean Earth / Polar Axis coordinate frame.
- Estimates local Sun and Earth elevation and azimuth, including configurable site horizon masks and an elevation-based horizon adjustment.
- Shows a generated 12 × 12 km local terrain visualization with an optional slope-grade color map.
- Plots a 30-day solar and Earth horizon profile for the selected site.
- Ranks and compares the sample sites by a configurable composite index, or sorts by Sun elevation, Earth elevation, slope, or altitude.
- Lets users adjust the observation date, time, slope limit, and mission weighting (balanced, solar power, communications, or terrain).

#### How it works

1. **Set the epoch:** Choose an observation date and UTC hour, or use the time scrubber and playback controls to explore a span around the selected date.
2. **Calculate geometry:** The client-side ephemeris estimates sub-solar and sub-Earth coordinates, accounting for lunar axial tilt and optical libration.
3. **Evaluate sites:** The app converts Sun and Earth directions into local elevation and azimuth at each sample location, then applies site horizon and terrain inputs.
4. **Compare trade-offs:** Solar, communications, and terrain scores are combined using the selected mission-priority weights. A comparison table shows the resulting scores and status labels.
5. **Inspect visually:** The globe and local terrain scene show site locations, direction vectors, generated relief, and slope grades.

#### Why this fits a space-apps challenge

LUNA NAV turns lunar geometry and site-selection trade-offs into an explorable interface. It is designed to help users reason about how illumination, communications visibility, and terrain can interact at the lunar South Pole. Its current implementation is a prototype: integrating verified elevation models and authoritative ephemeris data would be necessary before using it for operational planning.

### NASA and open-science data references

These are relevant authoritative resources surfaced by the project for validation and future integration. The current app does **not** download or ingest these datasets.

1. **NASA/JPL Horizons System** — ephemerides and solar-system object data: [ssd.jpl.nasa.gov/horizons](https://ssd.jpl.nasa.gov/horizons/)
2. **NASA Planetary Data System Geosciences Node (PGDA)** — planetary geodesy products, including lunar datasets: [pgda.gsfc.nasa.gov](https://pgda.gsfc.nasa.gov/)
3. **Lunar Reconnaissance Orbiter Camera (LROC) QuickMap** — lunar imagery and exploration layers: [quickmap.lroc.asu.edu](https://quickmap.lroc.asu.edu/)
4. **NASA PDS Geosciences Node LOLA data** — consult the archive for the relevant Lunar Orbiter Laser Altimeter products, metadata, versions, and citation requirements before using a DEM.

When integrating a dataset, cite the specific product, version, DOI or archive record, access date, and applicable license/usage terms—not only the portal landing page.

### Technologies used

- React 19 and TypeScript
- Vite
- Three.js and WebGL for interactive 3D views
- Tailwind CSS 4 for styling
- Lucide React for interface icons
- Client-side analytical ephemeris, site scoring, and SVG chart rendering

### Team, demo, and links

Fill these in with confirmed information:

- **Team name:** `[Add team name]`
- **Team members and roles:** `[Add names and roles]`
- **Challenge title / category:** `[Confirm from the official challenge page]`
- **Live demo:** `[Add a public, tested URL or write "Not deployed"]`
- **Demo video:** `[Add a public link or write "Not recorded"]`
- **Contact:** `[Add preferred contact information]`

---

## 2. Seven-slide presentation outline

Use this as an adaptable outline; check the current challenge portal for presentation format, length, and file limits.

### Slide 1 — LUNA NAV

- **Title:** LUNA NAV: 3D Lunar Landing Site & Ephemeris Navigator
- **Subtitle:** Exploring illumination, Earth visibility, and terrain trade-offs at the lunar South Pole
- **Show:** Project name, team, challenge, repository, and one clear screenshot of the globe.
- **Avoid:** Calling the prototype an operational landing-navigation system.

### Slide 2 — Why the lunar South Pole?

- Explain the planning challenge: sunlight, communication visibility, and local terrain all matter, and each can change with location and time.
- Introduce the need to examine these factors together.
- Use a simple diagram of a low-angle Sun, a crater rim, a landing site, and an Earth sightline.

### Slide 3 — The LUNA NAV approach

- Show the workflow: choose date and site → calculate approximate geometry → compare mission criteria → inspect the 3D views.
- Explain the audience and intended use: interactive education and preliminary exploration.
- State the prototype limitations clearly.

### Slide 4 — What the user can explore

- Show the 3D South Pole globe and the six selectable sample sites.
- Demonstrate UTC date/time controls, time scrubbing, playback, and map-layer toggles.
- Show the local generated crater-relief view and optional slope-grade coloring.

### Slide 5 — From geometry to comparison

- Explain the locally calculated Sun and Earth directions and site-level elevation angles.
- Show the 30-day profile and comparison table.
- Explain that the composite score uses configurable weights for solar power, communications, and terrain; it is a relative prototype metric, not a probability or safety certification.

### Slide 6 — Data provenance and limitations

- Distinguish current implementation (analytical ephemeris and hard-coded illustrative site inputs) from linked reference archives (JPL Horizons, PDS Geosciences/LOLA, and LROC QuickMap).
- Show how validation could add a cited elevation product and compare calculations against authoritative ephemerides.
- Be explicit that current terrain is procedural and no live NASA data feed is connected.

### Slide 7 — Next steps

- Validate geometry against JPL Horizons over a documented set of epochs.
- Replace illustrative terrain and site parameters with cited, versioned lunar elevation data.
- Document coordinate frames, uncertainty, resolution, and scoring assumptions.
- Add reproducible tests and accessibility/performance checks, then invite educators and lunar-science users to evaluate the interface.

---

## 3. Demo video scripts

Record the current app, and describe only behavior that is present in the submitted build. Replace bracketed notes with actual screen actions and confirmed team details.

### A. 30-second pitch

> **[0:00–0:07 — Show the South Pole globe]**  
> “Choosing a lunar South Pole site means balancing sunlight, communication with Earth, and difficult crater terrain.”
>
> **[0:07–0:19 — Change the date and select a candidate]**  
> “LUNA NAV is an interactive prototype that calculates approximate Sun and Earth geometry for a selected time and compares six sample landing-site candidates.”
>
> **[0:19–0:30 — Show the terrain view and comparison table]**  
> “Explore the trade-offs in a 3D globe, a local terrain visualization, and a 30-day horizon profile. The current model is illustrative; our next step is validating it with cited NASA and JPL data.”

### B. Two-minute walkthrough

- **Scene 1 [0:00–0:20] — Introduce the problem**  
  *Visual:* Show the globe centered on the lunar South Pole.  
  *Voiceover:* “Lunar South Pole site planning has to consider more than a point on a map. Sunlight, Earth visibility, and nearby terrain each affect a mission, and their geometry changes over time. LUNA NAV brings these trade-offs into one interactive view.”

- **Scene 2 [0:20–0:45] — Explore candidate locations**  
  *Visual:* Select several site markers and show their coordinates and telemetry.  
  *Voiceover:* “The prototype includes six sample candidate locations. Select a site to inspect its modeled Sun and Earth elevation, mean-slope input, and current suitability label. These site values are illustrative inputs, not a survey of certified landing zones.”

- **Scene 3 [0:45–1:10] — Change the observation time**  
  *Visual:* Change the date, scrub the time offset, and play the simulation.  
  *Voiceover:* “The app calculates an approximate lunar ephemeris locally for the chosen UTC time. Scrubbing through the timeline updates the solar and Earth directions so users can see how the geometry changes.”

- **Scene 4 [1:10–1:35] — Inspect terrain and compare**  
  *Visual:* Open Site Analyzer, switch to slope colors, show the 30-day chart and comparison table.  
  *Voiceover:* “The analyzer pairs the geometry with a generated local crater-relief view and a 30-day horizon profile. The comparison table combines solar, communications, and terrain scores using selectable mission priorities.”

- **Scene 5 [1:35–2:00] — Be transparent about next steps**  
  *Visual:* Show the Methodology panel and the linked data archives.  
  *Voiceover:* “This is an exploration prototype, not a flight-certified tool. Its current terrain is procedural, and it does not yet ingest NASA data. Our next steps are to validate the ephemeris against JPL Horizons and integrate cited LRO/LOLA elevation products. LUNA NAV makes the trade-offs visible—and gives us a foundation to make the analysis more data-grounded.”

---

## 4. Local run and submission checks

### Run the project

Prerequisite: Node.js and npm.

```bash
npm install
npm run dev
```

The Vite development server uses port `3000` by default. No API key is required by the current application.

### Before submitting

- Confirm the official challenge title and portal requirements.
- Add the actual team name, member details, public demo URL, and video URL.
- Build the submitted revision with `npm run build`.
- Check the deployed app in a current desktop browser and test the date controls, site selection, 3D views, analyzer, and comparison table.
- Include a visible limitations/data-provenance statement in the final pitch.
- Verify every data citation against the exact product used; do not imply portal links are already integrated datasets.
