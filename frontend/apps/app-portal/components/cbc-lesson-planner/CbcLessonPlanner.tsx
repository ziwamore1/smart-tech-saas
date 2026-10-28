'use client';

import { useEffect, useState } from 'react';
import { curriculumIntelligenceApi, subjectApi, classApi, classSubjectApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Props = { onClose: () => void };

function unwrap(response: any) {
  return response?.data?.data || response?.data || response || null;
}

function List({ items }: { items?: any[] }) {
  if (!items?.length) return <span className="cbc-muted">Not specified</span>;
  return <ul className="cbc-list">{items.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.name || item.question || JSON.stringify(item)}</li>)}</ul>;
}

export function CbcLessonPlanner({ onClose }: Props) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [tree, setTree] = useState<any>(null);
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [subtopicId, setSubtopicId] = useState('');
  const [duration, setDuration] = useState(40);
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<any>(null);
  const [savedPlans, setSavedPlans] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([subjectApi.getAll(), classApi.getAll(), curriculumIntelligenceApi.getLessonPlans()])
      .then(([subjectResponse, classResponse, plansResponse]) => {
        const nextSubjects = unwrap(subjectResponse);
        const nextClasses = unwrap(classResponse);
        setSubjects(Array.isArray(nextSubjects?.data) ? nextSubjects.data : Array.isArray(nextSubjects) ? nextSubjects : []);
        setClasses(Array.isArray(nextClasses?.data) ? nextClasses.data : Array.isArray(nextClasses) ? nextClasses : []);
        const nextPlans = unwrap(plansResponse);
        setSavedPlans(Array.isArray(nextPlans?.data) ? nextPlans.data : Array.isArray(nextPlans) ? nextPlans : []);
      })
      .catch(() => setError('Unable to load subjects and classes.'))
      .finally(() => setLoadingOptions(false));
  }, []);

  useEffect(() => {
    setTree(null);
    setTopicId('');
    setSubtopicId('');
    setSubjectId('');
    if (!classId) {
      setClassSubjects([]);
      return;
    }

    classSubjectApi.getByClass(classId)
      .then(response => {
        const assigned = unwrap(response);
        setClassSubjects(Array.isArray(assigned?.data) ? assigned.data : Array.isArray(assigned) ? assigned : []);
      })
      .catch(() => {
        setClassSubjects([]);
        setError('Unable to load subjects assigned to the selected class.');
      });
  }, [classId]);

  useEffect(() => {
    setTree(null);
    setTopicId('');
    setSubtopicId('');
    if (!subjectId) return;
    curriculumIntelligenceApi.getSubjectTree(subjectId)
      .then(response => setTree(unwrap(response)))
      .catch(() => setError('Unable to load the selected subject syllabus.'));
  }, [subjectId]);

  const topics = Array.isArray(tree?.topics) ? tree.topics : Array.isArray(tree?.Topic) ? tree.Topic : [];
  const selectedTopic = topics.find((topic: any) => topic.id === topicId);
  const subtopics = selectedTopic?.subtopics || selectedTopic?.Subtopic || [];
  const availableSubjects = classId
    ? classSubjects.map(item => item.subject || item).filter((subject: any) => subject?.id)
    : subjects;

  async function generate() {
    if (!subjectId || !topicId || !classId) {
      setError('Select a subject, class, and syllabus topic first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await curriculumIntelligenceApi.generateLessonPlan({
        subjectId, topicId, subtopicId: subtopicId || undefined, classId,
        teacherId: user?.teacherId || undefined, duration, lessonDate,
        schoolId: user?.schoolId || undefined,
      });
      const generated = unwrap(response);
      setPlan(generated);
      setSavedPlans(current => [generated, ...current.filter(item => item.id !== generated?.id)]);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'The CBC lesson planner could not generate a validated plan.');
    } finally {
      setLoading(false);
    }
  }

  function selectSavedPlan(item: any) {
    setPlan(item);
    if (item.subjectId) setSubjectId(item.subjectId);
    if (item.topicId) setTopicId(item.topicId);
    setSubtopicId(item.subtopicId || '');
    if (item.classId) setClassId(item.classId);
    if (item.duration) setDuration(item.duration);
  }

  async function regenerate() {
    if (!plan?.id || !instruction.trim()) {
      setError('Describe what should change before regenerating this lesson.');
      return;
    }
    setRegenerating(true);
    setError('');
    try {
      const response = await curriculumIntelligenceApi.generateLessonPlan({
        subjectId, topicId, subtopicId: subtopicId || undefined, classId,
        teacherId: user?.teacherId || undefined, duration, lessonDate,
        schoolId: user?.schoolId || undefined, instruction: instruction.trim(), sourceLessonPlanId: plan.id,
      });
      const regenerated = unwrap(response);
      setPlan(regenerated);
      setSavedPlans(current => [regenerated, ...current.filter(item => item.id !== regenerated?.id)]);
      setInstruction('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'The lesson could not be regenerated.');
    } finally {
      setRegenerating(false);
    }
  }

  const data = plan?.planData || plan;
  const preamble = data?.preamble;
  const evaluation = data?.lessonEvaluation;

  return (
    <div className="cbc-overlay" role="dialog" aria-modal="true" aria-label="CBC AI lesson planner">
      <div className="cbc-modal">
        <div className="cbc-header">
          <div>
            <div className="cbc-kicker">CBC CURRICULUM INTELLIGENCE</div>
            <h2>Build a standards-led lesson</h2>
            <p>The AI receives the selected syllabus evidence and enrolment profile before it writes any activity.</p>
          </div>
          <button className="cbc-close" onClick={onClose} aria-label="Close planner">×</button>
        </div>

        <div className="cbc-form">
          <label>Subject<select value={subjectId} onChange={event => setSubjectId(event.target.value)} disabled={loadingOptions}>
            <option value="">Select subject</option>
            {availableSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name} {subject.code ? `(${subject.code})` : ''}</option>)}
          </select></label>
          <label>Class<select value={classId} onChange={event => setClassId(event.target.value)}>
            <option value="">Select class</option>
            {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Topic<select value={topicId} onChange={event => { setTopicId(event.target.value); setSubtopicId(''); }} disabled={!subjectId || !topics.length}>
            <option value="">Select syllabus topic</option>
            {topics.map((topic: any) => <option key={topic.id} value={topic.id}>{topic.code ? `${topic.code} · ` : ''}{topic.name}</option>)}
          </select></label>
          <label>Sub-topic<select value={subtopicId} onChange={event => setSubtopicId(event.target.value)} disabled={!topicId || !subtopics.length}>
            <option value="">All / selected topic</option>
            {subtopics.map((item: any) => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ''}{item.name}</option>)}
          </select></label>
          <label>Lesson date<input type="date" value={lessonDate} onChange={event => setLessonDate(event.target.value)} /></label>
          <label>Duration (minutes)<input type="number" min={20} max={180} value={duration} onChange={event => setDuration(Number(event.target.value) || 40)} /></label>
        </div>

        {error && <div className="cbc-error">{error}</div>}
        <div className="cbc-actions">
          <button className="cbc-secondary" onClick={onClose}>Cancel</button>
          <button className="cbc-primary" onClick={generate} disabled={loading || loadingOptions}>{loading ? 'Generating aligned plan...' : 'Generate CBC Lesson Plan'}</button>
        </div>

        {savedPlans.length > 0 && <div className="cbc-saved-plans"><div><span className="cbc-kicker">SAVED CBC PLANS</span><b>Continue or reuse a generated lesson</b></div><div className="cbc-saved-list">{savedPlans.slice(0, 6).map(item => <button key={item.id} onClick={() => selectSavedPlan(item)} className={plan?.id === item.id ? 'active' : ''}>{item.title}<small>Version {item.version || 1} · {item.topic?.name || 'CBC lesson'}</small></button>)}</div></div>}

        {plan?.id && <div className="cbc-reuse"><div><span className="cbc-kicker">REUSE / REGENERATE</span><b>Adapt this saved plan for the selected class</b><p>Describe only the change needed. The original version remains stored for reference.</p></div><textarea value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="Example: Reduce the activity difficulty for learners who need support, keep the same competency, and add a practical group activity with worked answers." /><button className="cbc-primary" onClick={regenerate} disabled={regenerating}>{regenerating ? 'Regenerating...' : 'Regenerate Version'}</button></div>}

        {data && (
          <div className="cbc-result">
            <div className="cbc-result-title"><div><span className="cbc-kicker">VALIDATED DRAFT</span><h3>{data.title}</h3></div><span className="cbc-saved">Saved to curriculum lesson plans</span></div>

            <section className="cbc-section"><h4>Lesson Preamble</h4><div className="cbc-preamble">
              {['teacher', 'date', 'form', 'time', 'subject', 'duration', 'topic', 'subTopic', 'totalEnrol', 'boys', 'girls', 'expectedStandard', 'rationale'].map(key => <div key={key}><span>{key === 'subTopic' ? 'Sub-topic' : key.replace(/[A-Z]/g, letter => ` ${letter}`).replace(/^./, letter => letter.toUpperCase())}</span><strong>{preamble?.[key] || '—'}</strong></div>)}
            </div><div className="cbc-two-col"><div><b>Resources</b><List items={preamble?.resources} /></div><div><b>References</b><List items={preamble?.references} /></div><div><b>Specific competences</b><List items={preamble?.specificCompetences} /></div><div><b>Prerequisite knowledge</b><List items={preamble?.preRequisiteKnowledge} /></div></div></section>

            <section className="cbc-section"><h4>Learning Objectives</h4><List items={data.learningObjectives} /></section>
            {data.subjectTable?.columns?.length > 0 && <section className="cbc-section"><h4>{data.subjectTable.title || 'Subject Activity Table'}</h4><div className="cbc-table-wrap"><table><thead><tr>{data.subjectTable.columns.map((column: string) => <th key={column}>{column}</th>)}</tr></thead><tbody>{(data.subjectTable.rows || []).map((row: any, index: number) => <tr key={index}>{data.subjectTable.columns.map((column: string) => <td key={column}>{row[column] || row[column.toLowerCase()] || '—'}</td>)}</tr>)}</tbody></table></div></section>}

            <section className="cbc-section"><h4>Lesson Development and Expected Solutions</h4><div className="cbc-activities">{(data.activities || []).map((activity: any, index: number) => <article key={index} className="cbc-activity"><div className="cbc-activity-head"><span>{activity.stage}</span><b>{activity.title}</b><small>{activity.timeMinutes} min</small></div><div className="cbc-activity-grid"><div><label>Teacher's activity</label><p>{activity.teacherActivity}</p></div><div><label>Pupil's activity</label><p>{activity.learnerActivity}</p></div><div><label>Task</label><p>{activity.task || '—'}</p></div><div className="cbc-solution"><label>Expected solution / response</label><p>{activity.expectedSolution}</p></div></div><div className="cbc-evidence"><b>Assessment evidence:</b> {activity.assessmentEvidence}</div></article>)}</div></section>

            <section className="cbc-section"><h4>Assessment and Homework</h4><div className="cbc-two-col"> <div><b>Assessment questions</b>{(data.assessment?.questions || []).map((item: any, index: number) => <div className="cbc-answer" key={index}><strong>{index + 1}. {item.question}</strong><span>Answer: {item.expectedAnswer} {item.marks ? `(${item.marks} marks)` : ''}</span></div>)}</div><div><b>Homework</b>{(data.homework || []).map((item: any, index: number) => <div className="cbc-answer" key={index}><strong>{index + 1}. {item.question}</strong><span>Answer: {item.expectedAnswer}</span></div>)}</div></div></section>

            <section className="cbc-section"><h4>Lesson Evaluation</h4><div className="cbc-evaluation-grid"><div className="cbc-evaluation teacher"><h5>Teacher Evaluation</h5><b>Criteria</b><List items={evaluation?.teacher?.criteria} /><b>Evidence to record</b><List items={evaluation?.teacher?.evidence} /><b>Rating guide</b><List items={evaluation?.teacher?.ratingGuide} /></div><div className="cbc-evaluation pupil"><h5>Pupil Evaluation</h5><b>Criteria</b><List items={evaluation?.pupil?.criteria} /><b>Evidence to record</b><List items={evaluation?.pupil?.evidence} /><b>Rating guide</b><List items={evaluation?.pupil?.ratingGuide} /></div></div></section>

            <section className="cbc-section"><h4>Syllabus Traceability</h4><div className="cbc-trace">{(data.syllabusTraceability || []).map((item: any, index: number) => <div key={index}><strong>{item.code || 'Source syllabus'}</strong><span>{item.source}</span><p>{item.alignment}</p></div>)}</div></section>
          </div>
        )}
      </div>
      <style jsx>{`
        .cbc-overlay{position:fixed;inset:0;background:rgba(20,27,37,.72);z-index:1000;padding:24px;overflow:auto}.cbc-modal{max-width:1180px;margin:auto;background:#f8fafc;border-radius:24px;box-shadow:0 28px 80px rgba(0,0,0,.28);overflow:hidden}.cbc-header{background:#172033;color:#fff;padding:28px 32px;display:flex;justify-content:space-between;gap:24px}.cbc-header h2{font-size:28px;margin:6px 0 4px;letter-spacing:-.03em}.cbc-header p{margin:0;color:#b9c4d6}.cbc-kicker{font-size:10px;font-weight:800;letter-spacing:.14em;color:#7dd3fc}.cbc-close{border:0;background:rgba(255,255,255,.1);color:#fff;border-radius:10px;width:38px;height:38px;font-size:26px;cursor:pointer}.cbc-form{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:22px 32px;background:#fff}.cbc-form label{font-size:12px;font-weight:800;color:#475569}.cbc-form select,.cbc-form input{display:block;width:100%;margin-top:6px;padding:11px 12px;border:1px solid #d8e0ea;border-radius:10px;background:#fff;color:#1e293b}.cbc-actions{display:flex;justify-content:flex-end;gap:10px;padding:0 32px 22px;background:#fff}.cbc-primary,.cbc-secondary{border:0;border-radius:10px;padding:12px 18px;font-weight:800;cursor:pointer}.cbc-primary{background:#0f766e;color:#fff}.cbc-primary:disabled{opacity:.55;cursor:wait}.cbc-secondary{background:#eef2f7;color:#475569}.cbc-error{margin:0 32px 18px;padding:12px 14px;border-radius:10px;background:#fff1f2;color:#be123c;font-size:13px}.cbc-result{padding:28px 32px}.cbc-result-title{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px}.cbc-result-title h3{font-size:24px;color:#172033;margin:6px 0 0}.cbc-saved{font-size:12px;color:#047857;background:#d1fae5;border-radius:999px;padding:7px 11px}.cbc-section{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-top:14px}.cbc-section h4{margin:0 0 16px;color:#172033;font-size:16px}.cbc-preamble{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.cbc-preamble div{background:#f8fafc;border-radius:10px;padding:10px}.cbc-preamble span,.cbc-activity label{display:block;text-transform:uppercase;letter-spacing:.08em;font-size:10px;color:#64748b;font-weight:800}.cbc-preamble strong{display:block;color:#1e293b;font-size:13px;margin-top:4px}.cbc-two-col{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:16px;color:#334155;font-size:13px}.cbc-list{padding-left:18px;margin:7px 0 0}.cbc-list li{margin:5px 0}.cbc-muted{color:#94a3b8;font-size:13px}.cbc-table-wrap{overflow:auto}.cbc-table-wrap table{border-collapse:collapse;width:100%;font-size:13px}.cbc-table-wrap th,.cbc-table-wrap td{border:1px solid #dbe3ec;padding:10px;text-align:left;vertical-align:top}.cbc-table-wrap th{background:#eff6ff;color:#1e3a8a}.cbc-activities{display:grid;gap:12px}.cbc-activity{border:1px solid #dbe3ec;border-radius:12px;overflow:hidden}.cbc-activity-head{display:flex;align-items:center;gap:12px;padding:11px 14px;background:#f1f5f9}.cbc-activity-head span{font-size:10px;font-weight:800;color:#0f766e;letter-spacing:.08em}.cbc-activity-head b{flex:1;color:#1e293b}.cbc-activity-head small{color:#64748b}.cbc-activity-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:16px}.cbc-activity-grid p{font-size:13px;line-height:1.55;color:#475569;margin:6px 0 0;white-space:pre-wrap}.cbc-solution{background:#f0fdf4;padding:10px;border-radius:9px}.cbc-solution p{color:#166534}.cbc-evidence{padding:11px 16px;border-top:1px solid #e2e8f0;font-size:12px;color:#475569}.cbc-answer{margin-top:10px;padding:10px;border-radius:9px;background:#f8fafc}.cbc-answer strong,.cbc-answer span{display:block;font-size:13px}.cbc-answer span{color:#166534;margin-top:5px}.cbc-evaluation-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.cbc-evaluation{padding:16px;border-radius:12px;border-top:4px solid}.cbc-evaluation.teacher{background:#fff7ed;border-color:#f97316}.cbc-evaluation.pupil{background:#eff6ff;border-color:#2563eb}.cbc-evaluation h5{margin:0 0 13px;font-size:16px;color:#172033}.cbc-evaluation b{display:block;font-size:12px;color:#475569;margin-top:10px}.cbc-trace{display:grid;gap:10px}.cbc-trace div{padding:11px;background:#f8fafc;border-radius:9px}.cbc-trace strong{color:#0f766e;margin-right:10px}.cbc-trace span{font-size:12px;color:#64748b}.cbc-trace p{margin:6px 0 0;font-size:13px;color:#475569}@media(max-width:760px){.cbc-overlay{padding:0}.cbc-modal{border-radius:0;min-height:100vh}.cbc-header,.cbc-form,.cbc-result{padding-left:18px;padding-right:18px}.cbc-form,.cbc-preamble,.cbc-two-col,.cbc-activity-grid,.cbc-evaluation-grid{grid-template-columns:1fr}.cbc-actions{padding-left:18px;padding-right:18px}.cbc-result-title{display:block}.cbc-saved{display:inline-block;margin-top:10px}}
      `}</style>
      <style jsx>{`
        .cbc-saved-plans { display:flex; align-items:center; gap:18px; padding:14px 32px; background:#f8fafc; border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; }
        .cbc-saved-plans b { display:block; color:#172033; font-size:13px; margin-top:4px; }
        .cbc-saved-list { display:flex; gap:8px; overflow:auto; }
        .cbc-saved-list button { min-width:170px; border:1px solid #dbe3ec; border-radius:10px; background:#fff; padding:9px; text-align:left; color:#334155; font-weight:700; cursor:pointer; }
        .cbc-saved-list button.active { border-color:#0f766e; box-shadow:0 0 0 2px #ccfbf1; }
        .cbc-saved-list small { display:block; color:#64748b; font-weight:400; margin-top:4px; }
        .cbc-reuse { display:grid; grid-template-columns:1.1fr 1.8fr auto; align-items:center; gap:14px; padding:16px 32px; background:#ecfeff; border-bottom:1px solid #bae6fd; }
        .cbc-reuse b { display:block; color:#164e63; font-size:13px; margin-top:4px; }.cbc-reuse p { margin:6px 0 0; color:#0e7490; font-size:12px; line-height:1.4; }.cbc-reuse textarea { min-height:68px; resize:vertical; border:1px solid #a5f3fc; border-radius:10px; padding:10px; font:inherit; font-size:13px; }
        @media (max-width:760px) { .cbc-saved-plans { display:block; padding-left:18px; padding-right:18px; } .cbc-saved-list { margin-top:10px; } }
        @media (max-width:760px) { .cbc-reuse { grid-template-columns:1fr; padding-left:18px; padding-right:18px; } }
      `}</style>
    </div>
  );
}
