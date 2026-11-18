"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FilePlus2,
  FlaskConical,
  KeyRound,
  LayoutTemplate,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  classApi,
  examAuthoringApi,
  getApiErrorMessage,
  subjectApi,
  termApi,
} from "@/lib/api";

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? [];

const defaultBlueprint = {
  totalMarks: 100,
  durationMinutes: 150,
  sections: [
    {
      code: "A",
      id: "section-a",
      title: "Section A",
      totalMarks: 80,
      itemCount: 4,
      answerRule: "ALL",
      responseType: "STRUCTURED",
      taskPattern: "MULTI_TASK",
      markingMethod: "ANALYTIC",
      candidateAnswerSpace: "LINED",
      questionTypes: ["STRUCTURED"],
    },
    {
      code: "B",
      id: "section-b",
      title: "Section B",
      totalMarks: 20,
      itemCount: 2,
      answerRule: "ONE",
      responseType: "ESSAY",
      taskPattern: "MULTI_TASK",
      markingMethod: "ANALYTIC",
      candidateAnswerSpace: "LINED",
      questionTypes: ["STRUCTURED", "ESSAY"],
    },
  ],
};

export default function AiExaminorPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [providers, setProviders] = useState<any>(null);
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [examinations, setExaminations] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [curriculumOptions, setCurriculumOptions] = useState<any>(null);
  const [selectedTopicNames, setSelectedTopicNames] = useState<string[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<any>(null);
  const [activeVersion, setActiveVersion] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [blueprintForm, setBlueprintForm] = useState({
    name: "ECZ CBC Examination Blueprint",
    subjectId: "",
  description: "",
    structure: defaultBlueprint,
  });
  const [generationForm, setGenerationForm] = useState({
    classId: "",
    termId: "",
    title: "CBC Examination Paper",
    startsAt: "",
    endsAt: "",
  });
  const selectedSubjectId = selectedBlueprint?.subjectId || selectedBlueprint?.subject?.id || "";
  const blueprintStructure = blueprintForm.structure;
  const sectionMarks = blueprintStructure.sections.reduce((sum, section) => sum + Number(section.totalMarks || 0), 0);

  const updateSection = (index: number, patch: Record<string, any>) => {
    setBlueprintForm(current => ({
      ...current,
      structure: {
        ...current.structure,
        ...(() => {
          const sections = current.structure.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section);
          return { sections, totalMarks: sections.reduce((sum, section) => sum + Number(section.totalMarks || 0), 0) };
        })(),
      },
    }));
  };

  const addSection = () => {
    setBlueprintForm(current => {
      const index = current.structure.sections.length;
      const code = String.fromCharCode(65 + index);
      return {
        ...current,
        structure: {
          ...current.structure,
          sections: [...current.structure.sections, { id: `section-${code.toLowerCase()}`, code, title: `Section ${code}`, totalMarks: 10, itemCount: 2, answerRule: "ALL", responseType: "STRUCTURED", taskPattern: "MULTI_TASK", markingMethod: "ANALYTIC", candidateAnswerSpace: "LINED", questionTypes: ["STRUCTURED"] }],
          totalMarks: current.structure.totalMarks + 10,
        },
      };
    });
  };

  const removeSection = (index: number) => {
    setBlueprintForm(current => {
      const sections = current.structure.sections.filter((_, sectionIndex) => sectionIndex !== index);
      return { ...current, structure: { ...current.structure, sections, totalMarks: sections.reduce((sum, section) => sum + Number(section.totalMarks || 0), 0) } };
    });
  };

  useEffect(() => {
    if (!selectedSubjectId || !generationForm.classId) {
      setCurriculumOptions(null);
      setSelectedTopicNames([]);
      return;
    }
    let active = true;
    examAuthoringApi.getCurriculumOptions(selectedSubjectId, generationForm.classId)
      .then(response => {
        if (!active) return;
        const data = unwrap(response);
        setCurriculumOptions(data);
        setSelectedTopicNames((data.topics || []).map((topic: any) => topic.name));
      })
      .catch(() => { if (active) setCurriculumOptions(null); });
    return () => { active = false; };
  }, [selectedSubjectId, generationForm.classId]);

  const load = async () => {
    setError("");
    try {
      const dash = await examAuthoringApi.dashboard();
      const providerResponse = await examAuthoringApi.providers();
      const blueprintResponse = await examAuthoringApi.listBlueprints();
      const examinationResponse = await examAuthoringApi.listExaminations({
        limit: 10,
      });
      const subjectResponse = await subjectApi.getAll();
      const classResponse = await classApi.getAll();
      const termResponse = await termApi.getAll();
      setDashboard(unwrap(dash));
      setProviders(unwrap(providerResponse));
      setBlueprints(unwrap(blueprintResponse));
      setExaminations(unwrap(examinationResponse)?.items || []);
      setSubjects(unwrap(subjectResponse));
      setClasses(unwrap(classResponse));
      setTerms(unwrap(termResponse));
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Unable to load AI-EXAMINOR workspace."),
      );
    }
  };

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  const createBlueprint = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await examAuthoringApi.createBlueprint({
        ...blueprintForm,
        structure: { ...blueprintStructure, totalMarks: sectionMarks },
      });
      setMessage(
        "Blueprint created as a draft. Approve it before generating a stored examination.",
      );
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Blueprint could not be created."));
    } finally {
      setBusy(false);
    }
  };

  const approveBlueprint = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await examAuthoringApi.approveBlueprint(id);
      setMessage("Blueprint approved for generation.");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Blueprint could not be approved."));
    } finally {
      setBusy(false);
    }
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedBlueprint)
      return setError("Select an approved blueprint first.");
    if (curriculumOptions?.topics?.length && !selectedTopicNames.length)
      return setError("Select at least one syllabus topic for this examination.");
    setBusy(true);
    setError("");
    setMessage("AI-EXAMINOR is generating and storing a reviewable draft...");
    try {
      const response = await examAuthoringApi.generate({
        ...generationForm,
        blueprintId: selectedBlueprint.id,
        includeTopics: selectedTopicNames,
      });
      const exam = unwrap(response);
      setActiveVersion(exam?.versions?.[0] || null);
      setMessage(
        `Draft created: ${exam?.title || "examination"}. Validate it before moderation.`,
      );
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Examination generation failed."));
    } finally {
      setBusy(false);
    }
  };

  const validateVersion = async () => {
    if (!activeVersion) return;
    setBusy(true);
    setError("");
    try {
      await examAuthoringApi.validateVersion(activeVersion.id);
      setMessage("Validation completed. Review findings before moderation.");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Validation failed."));
    } finally {
      setBusy(false);
    }
  };

  const submitVersion = async () => {
    if (!activeVersion) return;
    setBusy(true);
    setError("");
    try {
      await examAuthoringApi.submitForModeration(activeVersion.id);
      setMessage("Examination submitted for moderation.");
      await load();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "The examination could not be submitted."),
      );
    } finally {
      setBusy(false);
    }
  };

  const regenerateDraftVersion = async (versionId: string) => {
    if (
      !window.confirm(
        "Regenerate this complete draft? This replaces its questions, marking scheme and exports for this version.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await examAuthoringApi.regenerateVersion(versionId);
      setMessage(
        "Draft regenerated and validated. Review the updated findings before moderation.",
      );
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "The draft could not be regenerated."));
    } finally {
      setBusy(false);
    }
  };

  const canRegenerate = (version: any) =>
    Boolean(version?.id) &&
    !["APPROVED", "PUBLISHED", "MODERATION"].includes(version?.status);

  if (isLoading || !isAuthenticated)
    return (
      <div className="min-h-screen bg-[#f5f7fb] p-8 text-slate-500">
        Loading AI-EXAMINOR...
      </div>
    );
  const totals = dashboard?.totals || {};
  const statCards = [
    [
      "Examinations",
      totals.totalExams,
      "All stored papers",
      BookOpen,
      "text-blue-600 bg-blue-50",
    ],
    [
      "Approved",
      totals.approvedExams,
      "Approved or published",
      CheckCircle2,
      "text-emerald-600 bg-emerald-50",
    ],
    [
      "Drafts",
      totals.draftExams,
      "Needs authoring work",
      FilePlus2,
      "text-violet-600 bg-violet-50",
    ],
    [
      "Moderation",
      totals.moderationExams,
      "Awaiting decision",
      ShieldCheck,
      "text-amber-600 bg-amber-50",
    ],
    [
      "Marking keys",
      totals.markingKeys,
      "Persisted schemes",
      KeyRound,
      "text-rose-600 bg-rose-50",
    ],
    [
      "Subjects",
      totals.subjects,
      "Supported subjects",
      BookOpen,
      "text-cyan-600 bg-cyan-50",
    ],
    [
      "Versions",
      totals.versions,
      "Immutable snapshots",
      LayoutTemplate,
      "text-slate-600 bg-slate-100",
    ],
    [
      "Validation findings",
      totals.outstandingFindings,
      "Unresolved errors",
      AlertTriangle,
      "text-orange-600 bg-orange-50",
    ],
  ];

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">
              <Sparkles size={15} /> Examination production centre
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              AI-EXAMINOR
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Author, validate, moderate and preserve CBC examination papers
              independently of AI provider availability.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:border-indigo-300"
          >
            <RefreshCw size={16} /> Refresh workspace
          </button>
        </header>

        {message && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}
        <div
          className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${providers?.generationAvailable ? "border-indigo-200 bg-indigo-50 text-indigo-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
        >
          <Sparkles size={16} />
          {providers?.generationAvailable
            ? `AI generation available via ${providers.providers?.[0]?.name || "configured provider"}.`
            : "AI generation is unavailable until an administrator configures an AI provider. Stored examinations and manual authoring remain available."}
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8">
          {statCards.map(([label, value, hint, Icon, color]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div
                className={`mb-5 flex h-9 w-9 items-center justify-center rounded-xl ${color}`}
              >
                <Icon size={17} />
              </div>
              <div className="text-2xl font-semibold">{value ?? 0}</div>
              <div className="mt-1 text-sm font-medium text-slate-700">
                {label}
              </div>
              <div className="mt-1 text-xs text-slate-400">{hint}</div>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Blueprint library</h2>
                <p className="mt-1 text-sm text-slate-500">
                  A complete examination must use an approved structure.
                </p>
              </div>
              <LayoutTemplate className="text-indigo-500" size={20} />
            </div>
            <div className="space-y-3">
              {blueprints.length ? (
                blueprints.map((blueprint) => (
                  <div
                    key={blueprint.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium">{blueprint.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {blueprint.subject?.name || "Subject"} ·{" "}
                        {blueprint.structure?.totalMarks || 0} marks ·{" "}
                        {blueprint.structure?.durationMinutes || 0} minutes
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${blueprint.isApproved ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}
                      >
                        {blueprint.isApproved ? "Approved" : "Draft"}
                      </span>
                      {blueprint.isApproved ? (
                        <button
                          onClick={() => setSelectedBlueprint(blueprint)}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Use blueprint
                        </button>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() => approveBlueprint(blueprint.id)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No blueprints yet. Create the first approved structure below.
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={createBlueprint}
            className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-sm"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-indigo-500/20 p-2 text-indigo-300">
                <FlaskConical size={19} />
              </div>
              <div>
                <h2 className="font-semibold">Create blueprint</h2>
                <p className="text-xs text-slate-400">
                  Starts with the Mathematics I pilot structure.
                </p>
              </div>
            </div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Blueprint name
              <input
                required
                value={blueprintForm.name}
                onChange={(e) =>
                  setBlueprintForm({ ...blueprintForm, name: e.target.value })
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none ring-indigo-400 focus:ring-2"
              />
            </label>
            <label className="mb-5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Subject
              <select
                required
                value={blueprintForm.subjectId}
                onChange={(e) =>
                  setBlueprintForm({
                    ...blueprintForm,
                    subjectId: e.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none ring-indigo-400 focus:ring-2"
              >
                <option value="" className="text-slate-900">
                  Select subject
                </option>
                {subjects.map((subject) => (
                  <option
                    key={subject.id}
                    value={subject.id}
                    className="text-slate-900"
                  >
                    {subject.name}{subject.code ? ` (${subject.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="mb-5 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total marks<input type="number" min="1" value={sectionMarks} readOnly className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duration (minutes)<input type="number" min="1" value={blueprintStructure.durationMinutes} onChange={e => setBlueprintForm(current => ({ ...current, structure: { ...current.structure, durationMinutes: Number(e.target.value) } }))} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white" /></label>
            </div>
            <div className="mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sections</div>
                  <div className={`text-xs ${sectionMarks === Number(blueprintStructure.totalMarks) ? "text-emerald-300" : "text-amber-300"}`}>
                    {sectionMarks} of {blueprintStructure.totalMarks} marks allocated
                  </div>
                </div>
                <button type="button" onClick={addSection} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">Add section</button>
              </div>
              {blueprintStructure.sections.map((section, index) => (
                <div key={section.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="grid gap-2 sm:grid-cols-[70px_1fr_90px_80px]">
                    <label className="text-[10px] uppercase tracking-wide text-slate-400">Code<input value={section.code} onChange={e => updateSection(index, { code: e.target.value })} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-sm text-white" /></label>
                    <label className="text-[10px] uppercase tracking-wide text-slate-400">Title<input value={section.title} onChange={e => updateSection(index, { title: e.target.value })} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-sm text-white" /></label>
                    <label className="text-[10px] uppercase tracking-wide text-slate-400">Marks<input type="number" min="1" value={section.totalMarks} onChange={e => updateSection(index, { totalMarks: Number(e.target.value) })} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-sm text-white" /></label>
                    <label className="text-[10px] uppercase tracking-wide text-slate-400">Items<input type="number" min="1" value={section.itemCount} onChange={e => updateSection(index, { itemCount: Number(e.target.value) })} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-sm text-white" /></label>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-6">
                    <select value={section.answerRule} onChange={e => updateSection(index, { answerRule: e.target.value })} className="rounded-lg bg-white/10 px-2 py-2 text-xs text-white"><option value="ALL" className="text-slate-900">Answer all</option><option value="ONE" className="text-slate-900">Answer one</option><option value="ANY" className="text-slate-900">Answer required number</option></select>
                    <select value={section.responseType} onChange={e => updateSection(index, { responseType: e.target.value, questionTypes: e.target.value === "MULTIPLE_CHOICE" ? ["MULTIPLE_CHOICE"] : section.questionTypes })} className="rounded-lg bg-white/10 px-2 py-2 text-xs text-white"><option value="STRUCTURED" className="text-slate-900">Structured</option><option value="ESSAY" className="text-slate-900">Essay</option><option value="OBJECTIVE" className="text-slate-900">Objective</option><option value="MULTIPLE_CHOICE" className="text-slate-900">Multiple Choice</option><option value="PRACTICAL" className="text-slate-900">Practical</option><option value="DRAWING" className="text-slate-900">Drawing</option></select>
                    <select value={section.taskPattern} onChange={e => updateSection(index, { taskPattern: e.target.value })} className="rounded-lg bg-white/10 px-2 py-2 text-xs text-white"><option value="MULTI_TASK" className="text-slate-900">Multiple tasks</option><option value="SINGLE_TASK" className="text-slate-900">Single task</option></select>
                    <select value={section.markingMethod} onChange={e => updateSection(index, { markingMethod: e.target.value })} className="rounded-lg bg-white/10 px-2 py-2 text-xs text-white"><option value="ANALYTIC" className="text-slate-900">Analytic marking</option><option value="HOLISTIC" className="text-slate-900">Holistic marking</option><option value="OBJECTIVE_KEY" className="text-slate-900">Objective key</option></select>
                    <select value={section.candidateAnswerSpace} onChange={e => updateSection(index, { candidateAnswerSpace: e.target.value })} className="rounded-lg bg-white/10 px-2 py-2 text-xs text-white"><option value="LINED" className="text-slate-900">Lined answer</option><option value="GRID" className="text-slate-900">Grid answer</option><option value="DIAGRAM" className="text-slate-900">Diagram space</option><option value="NONE" className="text-slate-900">No answer space</option></select>
                    <button type="button" disabled={blueprintStructure.sections.length <= 1} onClick={() => removeSection(index)} className="rounded-lg border border-red-300/20 px-2 py-2 text-xs font-semibold text-red-200 disabled:opacity-40">Remove section</button>
                  </div>
                </div>
              ))}
            </div>
            <button
              disabled={busy}
              className="w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold hover:bg-indigo-400 disabled:opacity-50"
            >
              {busy ? "Working..." : "Create draft blueprint"}
            </button>
          </form>
          {selectedBlueprint && generationForm.classId && (
            <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-indigo-950">Syllabus coverage for selected class</h3>
                  <p className="mt-1 text-xs text-indigo-700">
                    {curriculumOptions?.class?.name || "Selected class"} · {curriculumOptions?.subject?.name || selectedBlueprint.subject?.name || "Subject"}{curriculumOptions?.subject?.code ? ` (${curriculumOptions.subject.code})` : ""} · Form {curriculumOptions?.class?.formNumber || "not detected"}
                  </p>
                </div>
                <span className="text-xs font-medium text-indigo-700">Select topics to assess</span>
              </div>
              {curriculumOptions?.topics?.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {curriculumOptions.topics.map((topic: any) => {
                    const selected = selectedTopicNames.includes(topic.name);
                    return (
                      <label key={topic.name} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs ${selected ? "border-indigo-400 bg-white" : "border-indigo-100 bg-indigo-50"}`}>
                        <input type="checkbox" checked={selected} onChange={() => setSelectedTopicNames(current => selected ? current.filter(name => name !== topic.name) : [...current, topic.name])} className="mr-2" />
                        <strong>{topic.code ? `${topic.code} · ` : ""}{topic.name}</strong>
                        {topic.subtopics?.length ? <span className="mt-1 block pl-5 text-indigo-700">{topic.subtopics.map((item: any) => item.name).join(" · ")}</span> : null}
                        {topic.competencies?.length ? <span className="mt-1 block pl-5 text-slate-500">Competence: {topic.competencies.slice(0, 2).map((item: any) => item.name).join("; ")}</span> : null}
                        {topic.expectedStandards?.length ? <span className="mt-1 block pl-5 text-slate-500">Standard: {topic.expectedStandards[0]}</span> : null}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-700">{curriculumOptions?.source || "Select a subject and class to load the form-specific syllabus topics."}</p>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Examination Bank</h2>
              <p className="mt-1 text-sm text-slate-500">
                Retrieve stored papers and versions without calling an AI
                provider.
              </p>
            </div>
            <BookOpen className="text-indigo-500" size={20} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="pb-3">Examination</th>
                  <th className="pb-3">Subject</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Questions</th>
                  <th className="pb-3">Versions</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {examinations.length ? (
                  examinations.map((exam) => (
                    <tr key={exam.id} className="border-b border-slate-50">
                      <td className="py-3 font-medium">{exam.title}</td>
                      <td className="py-3 text-slate-500">
                        {exam.subject?.name || "—"}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                          {exam.authoringStatus}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">
                        {exam._count?.questions || 0}
                      </td>
                      <td className="py-3 text-slate-500">
                        {exam._count?.versions || 0}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={
                              exam.versions?.[0]?.id
                                ? `/dashboard/ai-examinor/validation/${exam.versions[0].id}`
                                : "/dashboard/exams"
                            }
                            className="font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Open
                          </Link>
                          {canRegenerate(exam.versions?.[0]) && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                regenerateDraftVersion(exam.versions[0].id)
                              }
                              className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:text-amber-800 disabled:opacity-50"
                            >
                              <RefreshCw size={13} /> Regenerate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No stored examinations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Generation studio</h2>
              <p className="mt-1 text-sm text-slate-500">
                AI generation produces a persisted draft, marking scheme and
                version record. Validation remains a separate step.
              </p>
            </div>
            <Sparkles className="text-indigo-500" size={20} />
          </div>
          <form
            onSubmit={generate}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"
          >
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:col-span-2">
              Approved blueprint
              <select
                required
                value={selectedBlueprint?.id || ""}
                onChange={(e) =>
                  setSelectedBlueprint(
                    blueprints.find((item) => item.id === e.target.value),
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal normal-case text-slate-800"
              >
                <option value="">Select approved blueprint</option>
                {blueprints
                  .filter((item) => item.isApproved)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.subject?.name}{item.subject?.code ? ` (${item.subject.code})` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Class
              <select
                required
                value={generationForm.classId}
                onChange={(e) =>
                  setGenerationForm({
                    ...generationForm,
                    classId: e.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal normal-case text-slate-800"
              >
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Term
              <select
                required
                value={generationForm.termId}
                onChange={(e) =>
                  setGenerationForm({
                    ...generationForm,
                    termId: e.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal normal-case text-slate-800"
              >
                <option value="">Select term</option>
                {terms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy}
              aria-busy={busy}
              className="self-end inline-flex min-w-[150px] items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-wait disabled:bg-indigo-700 disabled:opacity-100"
            >
              {busy ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Sparkles className="mr-2" size={15} />}
              {busy ? "Generating..." : "Generate draft"}
            </button>
          </form>
        </section>

        {activeVersion && (
          <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-auto">
                <div className="text-sm font-semibold text-indigo-950">
                  Stored version {activeVersion.version} is ready for review
                </div>
                <div className="mt-1 text-xs text-indigo-700">
                  Run deterministic validation before submitting it to
                  moderation.
                </div>
              </div>
              <button
                disabled={busy}
                onClick={validateVersion}
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm"
              >
                Run validation
              </button>
              <button
                disabled={busy}
                onClick={submitVersion}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Submit moderation
              </button>
            </div>
          </section>
        )}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Recent generated papers</h2>
            <div className="mt-4 space-y-3">
              {dashboard?.recentVersions?.length ? (
                dashboard.recentVersions.map((item: any) => (
                  <Link
                    href={`/dashboard/ai-examinor/validation/${item.id}`}
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3 hover:bg-indigo-50"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {item.exam?.title || "Examination"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Version {item.version} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-slate-400" />
                  </Link>
                ))
              ) : (
                <p className="py-6 text-sm text-slate-500">
                  Generated papers will appear here after the first approved
                  blueprint is used.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6">
            <h2 className="font-semibold text-indigo-950">Production modes</h2>
            <div className="mt-4 space-y-3 text-sm text-indigo-900">
              <div>
                <strong>AI Generation:</strong> requires an available provider
                and approved blueprint.
              </div>
              <div>
                <strong>Examination Bank:</strong> stored versions, marking keys
                and assets remain available without AI.
              </div>
              <div>
                <strong>Manual Authoring:</strong> existing exam editor remains
                available for teacher-created papers.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
