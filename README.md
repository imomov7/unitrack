# UniTrack

UniTrack is a browser-only student productivity workspace built with HTML, CSS, and vanilla JavaScript. No build tools or paid services are required.

## Features

- Assignments, courses, assessments, weekly classes, and exams.
- Configurable university and semester details, grade boundaries, GPA scale, and daily study availability.
- What-if grade predictions with required-average and impossible-target explanations.
- Semester overview based on entered data, with course grades, deadlines, completion, workload, and weekly completed study sessions.
- A transparent study planner that ranks pending work by priority and days to deadline. Students can save suggestions and edit, complete, or delete sessions.
- JSON export and import.

## Run locally

Open `index.html` in a current browser. UniTrack saves information in that browser's LocalStorage. It does not synchronize or back up data to the cloud. Export a JSON copy from Settings if you want to move your data to another browser.

## Main files

- `index.html` defines the persistent navigation shell.
- `css/style.css` contains the dark theme and responsive component styles.
- `js/app.js` contains the LocalStorage model, calculations, page rendering, validation, and interactions.
- `sources/` is synced project reference material and must remain unchanged.

## Calculation notes

Assessment grades are calculated as `sum(weight × score ÷ maximum) ÷ sum(weight)`. What-if predictions treat entered assessment weights as completed course weight and assume a hypothetical score applies to all remaining weight. GPA uses credit-weighted configured grade points for courses with at least one assessment. The study planner is a rule-based deadline sorter, not an AI system.

## Concepts to explore

This project uses semantic HTML, CSS Grid and Flexbox, responsive media queries, browser storage, event delegation, validation, and weighted-average calculations. `render()` updates the visible page from saved data; `save()` persists the data and refreshes that view.
