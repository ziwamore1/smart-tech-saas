# SMART TECH — All-in-One School Management Platform

### *Empowering Zambia's Schools with Intelligence, Integrity & Innovation*

---

> **Registered with PACRA and ZRA | Fully Compliant | Built for Zambia**

---

## What is Smart Tech?

Smart Tech is a **cloud-based, AI-powered School Management System** built for Zambian educational institutions — from Early Childhood (ECE) through Primary, Secondary, College, and University. It is a complete operating system for your school: academic management, results processing, report generation, communications, financial management, and document authentication — all in one secure platform.

Whether you are a Director managing multiple campuses, a Head Teacher overseeing daily operations, a teacher entering grades, or a parent checking your child's report — **Smart Tech connects everyone, in real time, on one platform.**

---

## Competence Based Curriculum (CBC) Support

Smart Tech is **fully aligned with Zambia's Competence Based Curriculum** and provides end-to-end support for schools transitioning to or already implementing CBC:

### Curriculum Intelligence Engine
- **Topics → Subtopics → Competencies → Learning Outcomes** mapped to **Elements of Construct** and **Bloom's Taxonomy**
- Curriculum versioning, subject grouping, education levels, and conversion rules
- **PDF Curriculum Import** — upload and parse official curriculum documents directly
- Performance categories using **CBC banding** (One–Five, Excellent–Fail with score ranges and colour coding)
- Subject conversion rules for Grade 7 standardisation (e.g., English x2.5, Integrated Science x3.0)
- **Grade 7 ECZ** support with SP1/SP2/MOCK mock exam integration, Division 1–4 classification, best-4-subjects aggregation

### School-Based Assessment (SBA)
- SBA task management tied to Elements of Construct and competencies
- Weighted component configuration per class, subject, and term
- Teachers can track competencies against individual learners

### Grade 7 National Examination Support
- SP1, SP2, Mock Exam, and End-of-Term exam types
- Automatic score standardisation per ECZ national scale
- **Automatic Division and Progression Classification**

---

## Multi-Grading System Support

Smart Tech is the **only platform in Zambia** that natively supports multiple concurrent grading systems within a single school:

### Built-In Grading Scales
| Grading System | Description |
|---|---|
| **ECZ Zambia (Points)** | Grades 1–9 point scale (lower = better), nationally standardised |
| **ECZ Competency Based** | Forms 1–4, One–Five competency banding |
| **ECZ Grade 7** | Composite exam policy, Division 1–4, best-4 aggregation |
| **GPA 4.0** | Standard international Grade Point Average |
| **Standard Percentage** | 0–100% with configurable grade boundaries |
| **Primary Default** | Designed for Zambian primary schools |
| **Primary Lower (CBC)** | Competency-based, Grades 1–4 levels |
| **Primary Upper** | Grades 5–6 performance banding |
| **Custom Grading** | Schools define their own grade boundaries, labels, and points |

### How It Works
- **Each class and subject can have its own grading scale** — a school can use CBC banding for lower primary and ECZ points for upper primary simultaneously
- The **Grading Engine** automatically resolves the correct scale: *class-level override → school default → system default → legacy policy*
- Quality and Quantity bands computed in parallel for analysis
- **Automatic Grade Boundary Validation** — system rejects invalid configurations
- **Pass thresholds** configurable by level: 35% for primary, 50% for secondary

---

## Results Workflow — Secure, Audited, Tamper-Proof

Smart Tech implements a **5-stage, role-gated results workflow** that ensures data integrity at every step:

```
┌─────────┐    ┌────────────┐    ┌──────────┐    ┌───────────┐    ┌─────────┐
│  DRAFT  │ →  │ SUBMITTED  │ →  │ VERIFIED │ →  │ PUBLISHED │ →  │ LOCKED  │
└─────────┘    └────────────┘    └──────────┘    └───────────┘    └─────────┘
                                        ↑                                    │
                                        │          UNLOCK                     │
                                        └────────────────────────────────────┘
```

### Stage Details

| Stage | Who Can Act | What Happens |
|---|---|---|
| **Draft** | Class Teacher, Subject Teacher | Results are being entered. Bulk upload via Excel or manual entry. |
| **Submitted** | Class Teacher | Results submitted for review. Audit trail created. |
| **Verified** | HOD, Class Teacher, Deputy | Grading engine recalculates all grades, points, and rankings. Computed Results locked. |
| **Published** | Director only | Results made visible to parents and students. Auto-SMS and push notifications sent. |
| **Locked** | Director only | Results frozen. No further edits permitted. Can be unlocked back to Published. |

### Key Features
- **Audit trail** at every stage — who changed what, when
- **Bulk Excel upload** with validation preview and error reporting
- **Weighted component aggregation** from assessment results (CAT, Mid-Term, Final, etc.)
- **Real-time recalculation** of grades, points, and rankings on verification
- **Auto-notification** — parents and students receive SMS/push alerts on publication
- **Multi-class and multi-subject support** — process entire schools in parallel
- **Moderation dashboard** — see pending submissions and verifications across all classes
- **Locked sheets view** — confirm and manage locked result sheets

---

## Assessment Engine — Weighted Scoring Made Simple

A powerful, configurable assessment framework that handles any grading structure:

- **Assessment Definitions**: Create custom types (CAT, Mid-Term, Final Exam, Project, Assignment, Practical, etc.) with categories and weight distributions
- **Term Assessment Configuration**: Configure which assessments apply per class, subject, and term with custom weights
- **Weighted Computation**: Automatic aggregation of component scores into final weighted percentage
- **Grade Auto-Assignment**: Final percentage instantly mapped to grade via the active grading system
- **Bulk Score Entry**: Enter scores for entire classes in spreadsheet-like interface
- **Assessment Oversight**: Administrators see completion rates across all teachers and subjects
- **Half-mark and negative marking** support per assessment type
- **Auto-revert protection**: When all assessments are removed, system auto-reverts to 100% End-of-Term or Mid-Term

---

## Report Generation — Professional, Branded, Authenticated

Smart Tech generates **10 types of professional reports**, each with customisable templates and embedded authentication:

### Report Types

| Report | Description |
|---|---|
| **Individual Report Card** | Per-student with subject grades, class average, rank, charts, and teacher remarks |
| **Class Report Card (Bulk)** | All students in one PDF for the class teacher |
| **Academic Transcript** | Full multi-term academic history |
| **Achievement / Merit Certificate** | Student achievement recognition |
| **Mark Schedule** | Subject-by-subject mark table for the class |
| **Rankings Report** | Ranked performance with class distribution |
| **Results Analysis** | Quality and Quantity analysis with grade distributions |
| **Performance Report** | Detailed student performance profile with trends |
| **Analytics Summary** | School-wide performance analytics |
| **Attendance Report** | Student and class attendance summaries |

### Template Builder
- **Drag-and-drop report template designer** with 20+ components:
  - School Logo, Student Photo, Results Table, Rankings Table
  - Performance Charts, Analytics Summary
  - **AI-Generated Narrative Reports**
  - Strengths, Weaknesses, and Recommendations
  - Teacher Remarks, Head Teacher Remarks
  - Promotion Status, Digital Signature, QR Code
- **Template Marketplace** — download pre-built professional templates
- **Personalisation Engine** — branding presets, colour themes, custom fonts
- **Signatory Management** — configure authorised signatories per report type
- **Template Versioning** — publish, rollback, and archive templates

### Certificate Designer
- **Fabric.js Canvas** — drag-and-drop certificate builder
- 6 border styles, 7 certificate types
- Embedded QR code and PDF rendering
- **Instant PDF download** with school branding

---

## Document Authentication — Digital Stamps, QR Verification & Cryptographic Signatures

Smart Tech provides **three layers of document authentication**, ensuring every issued document is verifiable, tamper-proof, and legally defensible:

### Layer 1: Digital Stamp Engine
- **Custom stamp designer** — circular, rectangular, or oval stamp templates
- Layered SVG rendering: school name, motto, emblem, serial number, date, verification marker
- **Stamp effects**: ink opacity, texture, emboss, noise, watermark
- **Stamp assets** — upload school emblems, logos, coats of arms
- Stamp templates with **versioning, approval workflows, and rollbacks**

### Layer 2: QR Code Verification
- Every published document receives a **unique serial number and QR code**
- **Public verification portal** at `yourdomain.com/v/{code}` — anyone can scan and verify
- **No login required** — public page displays:
  - Document type
  - Issuing institution
  - Serial number
  - Date and time of issuance
  - Verification status: **Valid, Superseded, Expired, or Revoked**
- **Minimal data exposure** — no confidential student information in verification pages
- Status colour-coded: Green (Valid), Amber (Superseded), Grey (Expired), Red (Revoked)

### Layer 3: Cryptographic Digital Signatures
- **Ed25519 digital signatures** — industry-standard cryptographic signing
- Private keys **encrypted at rest (AES-256-GCM)**
- **SHA-256 document hashing** — each document receives a unique cryptographic fingerprint
- **Institutional X.509 certificates** (RSA 2048-bit, Country: Zambia)
- **PDF cryptographic signing** — embedded read-only verification tokens
- **Key lifecycle management**: Generate → Activate → Rotate → Revoke
- **Full audit trail** of every signature operation
- **Ministry Gateway submission** — verified documents can be submitted to government systems

### Document Lifecycle
```
Issue Document → Stamp Applied → QR Generated → PDF Signed → Published → Verifiable Online
```
- **Revoke** compromised or incorrect documents
- **Supersede** — issue corrected versions while marking originals as superseded
- **Approval workflows** — multi-step approval chains per document type

---

## Communication Platform — Multi-Channel Cloud

A unified communication hub reaching parents and students across every channel:

### Channels Supported
| Channel | Providers |
|---|---|
| **SMS** | Beem, Twilio, Africa's Talking, Infobip, Zamtel, MTN, Airtel |
| **Email** | Zoho, SendGrid, Amazon SES, Mailgun |
| **WhatsApp** | Beem, Meta Business Cloud API, Twilio |
| **Push Notifications** | Firebase Cloud Messaging, Expo Push |
| **In-App** | Database-backed real-time notifications |

### Features
- **Multi-provider cascade fallback** — if one provider fails, automatically routes to the next
- **Template Library** with variable interpolation (`{{student_name}}`, `{{term}}`)
- **Bulk and scheduled messaging**
- **Results SMS** — auto-send results to parents on publication
- **Credit Wallet** — pay-per-SMS with usage tracking and invoices
- **Delivery Tracking** — see exactly which messages were delivered or failed
- **Audit Log** — complete communication history

---

## Academic Management Suite

### Student & Staff Management
- Student admissions, enrolment, profiles with photos
- Staff records, positions, teaching assignments
- Multi-school management — one account, multiple campuses

### Class Management
- Class creation and assignment to class teachers
- Subject allocation to teachers with workload tracking
- Class rosters and class-teacher views

### Homework
- Assign homework by class and subject
- Students submit via web or mobile app
- Parents can view pending and completed homework
- Due-date tracking and completion status

### Attendance
- Daily attendance marking (web and mobile)
- Per-student attendance history
- Attendance statistics and reports
- Excused/sick status tracking

### Library & Media
- Digital library management
- Media gallery for school photos and documents
- Notice board for school-wide announcements

### Lesson Plans
- Curriculum-aligned lesson planning
- Week auto-fill based on term calendar
- Teacher workload visibility

---

## Analytics & Intelligence

### Built-In Analytics
- **Performance Trends** — term-over-term tracking
- **Subject Performance** — compare across subjects
- **Grade Distribution** — visual breakdown of grades
- **Gender Performance** — male vs female analysis
- **Teacher Performance** — assessment completion and results quality
- **Pass Rate Analysis** — school-wide and per-class

### AI-Powered Intelligence
- **AI Tutor** — OpenAI-powered chat tutor with subject context and file attachment support
- **Adaptive Testing** — dynamically adjusts question difficulty based on student performance
- **Benchmarking** — school performance vs national averages
- **Predictive Analysis** — forecast student outcomes
- **Diagnostic Analysis** — identify root causes of performance gaps
- **Correlation Analysis** — discover relationships between variables
- **Exam Quality Analysis** — detect grade inflation, compare exam difficulty
- **Narrative Report Generation** — AI writes student progress narratives
- **Learning Style Analysis** — identify how each student learns best

---

## Portals — Role-Based Access for Everyone

| Portal | Users | Features |
|---|---|---|
| **Director Dashboard** | School Directors/Principals | Full system access, analytics, approvals, publishing |
| **Teacher Dashboard** | Subject & Class Teachers | Grade entry, attendance, homework, lesson plans |
| **HOD Dashboard** | Heads of Department | Department oversight, assessment approval, results verification |
| **Parent Portal** | Parents/Guardians | Child results, report cards, homework, attendance, analytics |
| **Student Portal** | Students | Own results, subjects, report cards, online exams, homework |
| **Accountant Portal** | Finance Staff | Fee management, payments, financial reports |
| **Secretary Portal** | Admin Staff | School administration, member management |
| **Mobile App** | All Users | iOS & Android — results, attendance, notifications, exams |

### Roles Supported
Director, Deputy Director, Head Teacher, Deputy Head, HOD, Class Teacher, Subject Teacher, Accountant, Secretary, Registrar, Parent, Student — each with granular permissions.

---

## Online Payments & Fee Management

- **Fee structure** creation and management
- **Payment tracking** with receipt generation
- **Online payment gateway** supporting:
  - Credit/Debit Card
  - **MTN Mobile Money**
  - **Airtel Money**
  - **Zamtel Kwacha**
- Real-time payment confirmation
- Outstanding balance alerts to parents

---

## Online Examinations

- **Question bank** management with topics and difficulty levels
- **Exam creation** from templates or custom setup
- **Online exam taking** — students log in and complete exams in-browser
- **Auto-grading** for objective questions
- **Adaptive testing** — difficulty adjusts per student
- **Exam quality analysis** post-examination

---

## Mobile App

Available on **iOS and Android** via React Native (Expo):
- Student results and report cards
- Attendance tracking
- Homework viewing and submission
- Push notifications for results and announcements
- Timetable view (when available)
- Parent multi-child switching

---

## Subscription Plans

| Plan | Students | Teachers | Classes | Price (ZMW) |
|---|---|---|---|---|
| **Basic** | 100 | 20 | 10 | Affordable starter |
| **Standard** | 500 | 100 | 30 | Most popular |
| **Premium** | Unlimited | Unlimited | Unlimited | Full access |

- Upgrade or downgrade anytime
- **Trial period** available for new schools
- Premium features gated automatically: AI Analytics, WhatsApp, Custom Reports, Enhanced Report Cards

---

## Why Choose Smart Tech?

| Feature | Smart Tech | Traditional Systems |
|---|---|---|
| CBC Competency Tracking | Native support | Manual spreadsheets |
| Multi-Grading (Simultaneous) | Automatic | Not possible |
| Results Workflow (5 stages) | Built-in with audit trail | None or basic |
| Digital Stamp + QR Verification | Included | Separate expensive system |
| Cryptographic PDF Signatures | Built-in | Not available |
| AI Tutor & Adaptive Testing | Included | Not available |
| Multi-Channel SMS/WhatsApp | Built-in with fallback | Basic SMS only |
| Online Payments | MTN/Airtel/Zamtel | Manual collection |
| Mobile App | Included | Separate development |
| Report Template Builder | Drag-and-drop designer | Static templates |
| Public Document Verification | QR code + serial number | Not possible |
| ECZ Grade 7 National Alignment | Automatic | Manual calculation |

---

## Get Started Today

### For Schools
- Visit: **www.smarttechsaas.com**
- Register your school online
- Choose a plan that fits your needs
- Start managing your school in minutes

### Contact
- **Email**: info@smarttechsaas.com
- **Phone**: Contact us via our website
- **Website**: www.smarttechsaas.com

---

### Registered & Compliant
- **PACRA** — Registered with the Patents and Companies Registration Agency of Zambia
- **ZRA** — Compliant with the Zambia Revenue Authority
- **ECZ** — Aligned with Examinations Council of Zambia grading standards
- **Data Security** — AES-256-GCM encryption, JWT authentication, role-based access control, tenant isolation

---

*Smart Tech — Because every school deserves world-class technology.*

*Built in Zambia. Built for Zambia. Built for Africa.*

---
