# Bundled fonts

Embedded into print PDFs (KDP and IngramSpark require every font to be
embedded). All are licensed under the SIL Open Font License 1.1, which allows
bundling and embedding. They are unmodified; the licence for each family is
in its folder.

| Folder | Family | Source |
|---|---|---|
| `eb-garamond/` | EB Garamond (Regular, Italic, Bold, Bold Italic) | https://github.com/octaviopardo/EBGaramond12 |
| `source-serif-4/` | Source Serif 4 (Regular, It, Bold, BoldIt). "Source" is a Reserved Font Name of Adobe, so these files must not be modified under that name | https://github.com/adobe-fonts/source-serif |
| `crimson-pro/` | Crimson Pro (Regular, Italic, Bold, Bold Italic) | https://github.com/Fonthausen/CrimsonPro |

Coverage notes: EB Garamond covers Latin, Latin Extended, Greek, Cyrillic and the
❦ fleuron. Source Serif 4 covers Latin, Greek and Cyrillic. Crimson Pro covers
Latin and Latin Extended only. The exporter warns when a book uses a character
the chosen template's font doesn't have.
