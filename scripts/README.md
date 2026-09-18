# Bali Hotel Needs Assessment 2026 — Form generator

`create-bali-hotel-survey-forms.gs` builds the EN and JA survey forms in
Google Forms automatically, so the 28 questions never have to be pasted by hand.

## Run it

1. Open <https://script.google.com> → **New project**
2. Delete the placeholder code, paste the whole contents of
   `create-bali-hotel-survey-forms.gs`, and save
3. Select the function **`createAllForms`** in the toolbar → **Run**
4. Approve the permission prompt (Drive + Forms + Sheets on your own account).
   On a personal Gmail account Google shows an "unverified app" warning →
   *Advanced* → *Go to (project name)*. It is your own script, running only
   on your own Drive.
5. Open **Execution log** (`Ctrl+Enter`) to get the links.

Runtime: ~30 seconds. Use `createEnglishFormOnly` / `createJapaneseFormOnly`
to build just one language.

## What you get

Everything lands in a Drive folder named `Bali Hotel Needs Assessment 2026`:

| Asset | Notes |
|---|---|
| EN form | 28 questions, 6 sections, progress bar on |
| JA form | identical structure, 日本語 |
| `Form_Responses_ENGLISH` | linked response sheet |
| `Form_Responses_JAPANESE` | linked response sheet |

The log prints a shortened `forms.gle/...` link per form — that is the one to
send to hotels over WhatsApp.

## Built-in logic (beyond a plain copy-paste)

- **Q5 occupancy rate** — numeric validation, 0–100 only. Stops
  `"80%"`, `"high season 90 low 40"` and other free text from poisoning the column.
- **Q28 → contact section** — answering *Yes, definitely* or *Maybe, want more
  info* routes to the contact page; *No, not interested* submits immediately.
  Google Forms only honours page navigation on the **last** question of a
  section, so Q28 is deliberately the final item before the contact page.
- **Multi-select questions** (Q6, Q9, Q19) are checkbox items, not radio.
- **Q20** is a proper 1–5 scale item, so responses land as numbers and average
  cleanly in Sheets.
- **"Other: ___"** options (Q11, Q17, Q19) use the native *Other* field rather
  than a dead choice labelled "Other".
- **Q25** keeps the 5-module list in help text, so the question title stays
  scannable on a phone.
- Long-form pain-point questions (Q10, Q18, Q21, Q22, Q24) are paragraph
  fields — these are the highest-value answers in the survey and a one-line
  box suppresses them.

## Editing wording

All content lives in the `SURVEY` object at the top of the file, as plain data.
Change the strings there; the builder below is generic. To add a third language
(Bahasa Indonesia is the obvious next one for Bali GMs), copy the `ja` block,
translate the strings, and add a `buildForm_(SURVEY.id, folder)` call in
`createAllForms`.
