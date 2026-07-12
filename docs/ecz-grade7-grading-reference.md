# ECZ Grade 7 Composite Examination — Grading Reference

## Overview

The Grade 7 Composite Examination is administered at the end of the 7-year primary cycle.
It is used for **certification** and **selection** to Grade 8.
Scores are **standardised** to a 50–150 scale per subject so that all subjects carry equal weight.

---

## Per-Subject Performance Categories (One–Five)

These are applied to the standardised score (50–150) and also exposed in the school settings
grading system as percentage equivalents.

| Category | % Range | Std Score Range | Remark | Points (aggregate) |
|----------|---------|-----------------|--------|-------------------|
| One      | 75–100  | 112–150         | Excellent | 1 (best) |
| Two      | 60–74   | 90–111          | Very Good | 2 |
| Three    | 50–59   | 75–89           | Good      | 3 |
| Four     | 25–49   | 40–74           | Satisfactory | 4 |
| Five     | 0–24    | 0–39            | Fail      | 5 (worst) |

**Point system:** lower = better. The aggregate is the sum of category points across the
best 4 subjects, so a lower total produces a higher Division.

---

## Certificate Classification (Divisions 1–4)

Classification is based on the **best 4 subjects** (max 600 standardised points).

| Division | Aggregate (best 4) | % Equivalent | Description |
|----------|--------------------|--------------|-------------|
| 1        | 460–600            | ≥77%         | Distinction |
| 2        | 422–459            | 70–76%       | Merit |
| 3        | 398–421            | 66–69%       | Credit |
| 4        | 0–397              | ≤65%         | Pass (fail under non-automatic progression) |

From 2023, **non-automatic progression** means only Divisions 1–3 qualify for selection to
Form 1. Division 4 is a fail.

---

## Per-Subject Division Cutoffs (Standardised 50–150)

Used by the ECZ when reporting subject-level results on certificates.

| Division | Std Score Range | % Equivalent |
|----------|-----------------|--------------|
| 1        | 115–150         | 77–100% |
| 2        | 105–114         | 70–76% |
| 3        | 99–104          | 66–69% |
| 4        | 50–98           | 33–65% |

---

## Standardisation Formula

Raw marks are converted to a standardised score with min 50, max 150.

```
standardised = (rawScore / rawMax) × 100 + 50     ← clamped to [50, 150]
```

### Subject Conversion Multipliers

These are stored in `SubjectConversionRule` records (see `seed-g7-rules.ts`).

| Subject                 | Raw Max | Std Max | Multiplier |
|-------------------------|---------|---------|------------|
| English                 | 60      | 150     | ×2.5 |
| Mathematics             | 60      | 150     | ×2.5 |
| Integrated Science      | 50      | 150     | ×3.0 |
| Social Studies          | 60      | 150     | ×2.5 |
| Creative & Technology   | 60      | 150     | ×2.5 |
| Zambian Language        | 50      | 150     | ×3.0 |
| Special Paper 1         | 50      | 150     | ×3.0 |
| Special Paper 2         | 50      | 150     | ×3.0 |

---

## Grading System in School Settings

The school settings page exposes the **ECZ Grade 7 Grading System** with the **One–Five**
performance categories using percentage ranges (0–100%) for classroom continuous assessment.
This is separate from the actual ECZ examination standardisation pipeline.

**Files that define the scales:**

| File | Constant |
|------|----------|
| `backend/prisma/seed-grading.ts` | `grade7EczScales` |
| `backend/prisma/seed-g7-rules.ts` | `GRADE7_ECZ_SCALES` |
| `backend/src/grading-system/grading-system.service.ts` | `grade7EczScales` |

---

## Composite Score (Selection)

Used for **selection** to From 1 (not certification).

```
Composite = best4Subjects + Sp1 + Sp2
Maximum = 600 + 150 + 150 = 900
```

Special Paper 1 & 2 are aptitude tests (verbal & non-verbal reasoning). They contribute to
selection but **not** to the certificate.

---

## Key Differences from Primary Grading System

| Aspect | Primary | ECZ Grade 7 |
|--------|---------|-------------|
| Grade labels | A, B, C, D, E, F | One, Two, Three, Four, Five |
| Number of levels | 6 | 5 |
| Pass threshold | ≥40% (E) | ≥50% (Three) |
| Point direction | higher = better (A=5, F=0) | lower = better (One=1, Five=5) |
| Aggregation | per-subject only | best 4 subjects + Sp1 + Sp2 |

---

## Data Sources

- [ECZ 2023 Annual Report](https://www.exams-council.org.zm/wp-content/uploads/2025/03/2023-ECZ-Annual-Report_Online.pdf)
- [2023 JSSL Examination Report](https://www.exams-council.org.zm/wp-content/uploads/2024/05/2023-JUNIOR-SECONDARY-SCHOOL-EXAMINATION-REPORT.pdf)
- [2016 ECZ Annual Report](https://www.exams-council.org.zm/wp-content/uploads/2024/05/2016-ECZ-Annual-Report-1.pdf)
- `backend/prisma/seed-g7-rules.ts` — conversion rules, division rules, performance categories
