# ACADELY

ACADELY is a browser-only student productivity workspace built with HTML, CSS, and vanilla JavaScript. No build tools or paid services are required.

## Features

- Assignments, courses, assessments, weekly classes, and exams.
- Configurable university and semester details, grade boundaries, GPA scale, and daily study availability.
- What-if grade predictions with required-average and impossible-target explanations.
- Semester overview based on entered data, with course grades, deadlines, completion, workload, and weekly completed study sessions.
- A transparent study planner that ranks pending work by priority and days to deadline. Students can save suggestions and edit, complete, or delete sessions.
- Monthly, weekly, and daily academic calendar views with automatic assignment, exam, timetable, and semester-date entries, plus editable personal events.
- A local student profile with initials and optional student details, kept separate from the public creator contact on the About page.
- An About ACADELY page covering the product, mission, vision, student problems, creator contact, and browser-edition version.
- A beginner-friendly first-course setup flow, a useful dashboard, and mobile navigation with an accessible expanded state.
- GPA entry by either a final course grade or individual weighted assessments. Partial course results and GPAs are identified as estimates.
- Safe JSON import validation and JSON export.

Student profile and custom calendar event data use the existing `unitrack-data-v1` LocalStorage record. Calendar assignments, exams, classes, and semester dates are derived from their existing records, so they are not duplicated. Student profile information is local-only and is not verified or synced between visitors. The creator name and contact shown on About ACADELY are public site information.

## Run locally

Open `index.html` in a current browser. ACADELY saves information in that browser's LocalStorage. It does not synchronize or back up data to the cloud. Export a JSON copy from Settings if you want to move your data to another browser.

## Main files

- `index.html` defines the persistent navigation shell.
- `css/style.css` contains the dark theme and responsive component styles.
- `js/app.js` contains the LocalStorage model, calculations, page rendering, validation, and interactions.
- `sources/` is synced project reference material and must remain unchanged.

## Calculation notes

Assessment grades are calculated as `sum(weight × score ÷ maximum) ÷ sum(weight)`. What-if predictions treat entered assessment weights as completed course weight and assume a hypothetical score applies to all remaining weight. GPA uses `sum(course GPA points × course credits) ÷ sum(graded course credits)`; courses can use one final course grade or assessment tracking. A GPA based on incomplete assessment weights is labelled an estimate. Built-in grade points scale with the configured maximum GPA until a student customizes the boundaries. The study planner is a rule-based deadline sorter, not an AI system.

## Run the calculation tests

On a current Node.js installation, run `node --test tests/grade-math.test.js` from the project folder. The tests cover grade weights, target predictions, credit-weighted GPA, partial grades, configurable GPA scales, decimal credits, and invalid inputs.

## Concepts to explore

This project uses semantic HTML, CSS Grid and Flexbox, responsive media queries, browser storage, event delegation, validation, and weighted-average calculations. `render()` updates the visible page from saved data; `save()` persists the data and refreshes that view.
