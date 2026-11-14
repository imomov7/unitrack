# Academic data sources

The university directory is a compact copy of Hipo's MIT-licensed `world_universities_and_domains.json`, retrieved 2026-11-14:
https://github.com/Hipo/university-domains-list

`universities.js` exports `window.ACADELY_UNIVERSITIES`, an array of name, country, website, and domains. Duplicate name/country pairs were removed. The included license retains attribution. This community directory is a discovery aid, not an accreditation or identity verification service. Campuses are entered by students because this source does not supply a reliable campus list.

`course-catalogues.js` exports `window.ACADELY_CATALOGUES`. Each group has `universityNames`, `source`, `edition`, and `courses`. Add verified university groups here to expand coverage. Each course needs code, name, and credits; descriptions and prerequisite text are optional and must have official support.

The initial sample contains three RIT courses checked in the official 2025–2026 undergraduate catalogue, retrieved 2026-11-14:
https://www.rit.edu/marketing/sites/rit.edu.marketing/files/docs/pdfs/Undergraduate_Catalog.pdf

The sample does not claim complete coverage, current section availability, degree applicability, or credit equivalency across campuses. Catalogue information does not automatically become a degree requirement. Recommendations use the student's explicit degree list and their confirmation that its prerequisite list was checked. Completion is explicitly recorded using the university's passing rules. No assumed passing percentage or GPA is imposed.

## Major suggestions

`majors.js` contains 73 curated study-field labels and codes from the official US NCES CIP 2020 directory, retrieved 2026-11-14: https://nces.ed.gov/ipeds/cipcode/browse.aspx?y=56 . Common search aliases are included. These are general suggestions, not verified programs offered by the student's university. Students can enter any major manually.

## Automation update (1.5.0)

The directory was audited and one case-insensitive duplicate merged: **10,253 entries in 201 countries**. It is a community-maintained directory, not a complete or accredited registry. `scripts/refresh-universities.py` refreshes the Hipo source and deduplicates name/country pairs, retaining merged domains. Existing manual university values remain untouched.

`course-catalogues.js` now holds **250 factual course records**: 20 RIT records (the 2026–2027 Computing and Information Technologies curriculum, plus the previously sourced BIOL-101) and 230 fixed-unit undergraduate MIT EECS and mathematics subjects. These are partial catalogues, not every university or subject. Variable-credit and zero-credit rows were excluded. No descriptions or prerequisite rules are synthesized.

Official sources, retrieved 2026-11-14:
- RIT program and curriculum: https://www.rit.edu/study/information-technology-bs
- RIT curriculum endpoint: https://www.rit.edu/programs-api/courseleaf/proxy-api.php?url=/programs/information-technology-bs/index.xml&section=curriculum&removeheader=true
- MIT EECS: https://catalog.mit.edu/subjects/6/
- MIT mathematics: https://catalog.mit.edu/subjects/18/

MIT units are the sum of the three published workload components, as explained at https://catalog.mit.edu/subjects/ . These units are **not converted to US semester credits**. Each course displays its source unit. Confirm your syllabus and use a consistent credit system for GPA. Run `python3 scripts/refresh-catalogues.py` to regenerate, then review and test before publishing. This maintenance command requires network access; the running app searches the bundled offline snapshot.

Major suggestions now contain 73 NCES general fields plus 57 source-linked university entries (56 undergraduate MIT degree-chart links and the RIT CIT BS). These are not a complete institutional program directory. Source: https://catalog.mit.edu/degree-charts/ and the RIT program page above. The RIT page states CIT will be retitled Information Technology effective Fall 2027; the existing student's major is never silently renamed. University-specific entries appear only for the selected university, alongside common study fields and manual entry.

Semester date suggestions use https://www.rit.edu/calendar (2026–2027 Rochester calendar): Fall 2026, Spring 2027 and full Summer 2027, from the first class day through final exams. They require an explicit Use suggested dates action and remain editable. Unknown/non-Rochester campuses and other years receive no guessed dates. Breaks are not excluded automatically; use existing occurrence cancellation for individual dates.

### Targeted catalogue correction (2026-11-14)
RIT’s official curriculum endpoint linked from the Information Technology BS page confirms MATH-131 **Discrete Mathematics** (4 semester credits), COMM-142 **Introduction to Technical Communication** (3), and MATH-161 **Applied Calculus** (4). Parenthesized general-education / WI annotations and footnotes are curriculum metadata, not part of these titles. The importer now extracts the complete title cell and excludes those annotations for these three verified records. All other records, codes and credits are unchanged.

University search indexes directory names, derived initials (excluding connecting words), and the leading label of listed institutional domains, for example RIT / MIT. These are search aids, not additional official names or accreditation claims. Suggestions are deduplicated by name and country. Manual entries remain supported and unchanged.
