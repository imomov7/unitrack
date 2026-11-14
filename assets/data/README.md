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
