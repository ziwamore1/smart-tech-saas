'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { intelligenceApi, classApi } from '@/lib/api';
import RadarChart from '@/components/charts-echarts/RadarChart';
import ComparisonChart from '@/components/charts-echarts/ComparisonChart';

const VARK_QUESTIONS = [
  { id: 'q1', text: 'When learning a new topic, I prefer to:', visual: 'Watch a video or diagram', aural: 'Listen to an explanation', readWrite: 'Read a textbook or article', kinesthetic: 'Try it hands-on' },
  { id: 'q2', text: 'To remember directions, I usually:', visual: 'Look at a map', aural: 'Listen to verbal instructions', readWrite: 'Write down the steps', kinesthetic: 'Walk the route myself' },
  { id: 'q3', text: 'In class, I learn best when:', visual: 'The teacher uses charts/diagrams', aural: 'We have group discussions', readWrite: 'I take detailed notes', kinesthetic: 'I do practical activities' },
  { id: 'q4', text: 'When studying for a test, I:', visual: 'Use color-coded notes', aural: 'Record and replay explanations', readWrite: 'Rewrite my notes', kinesthetic: 'Use flashcards and move around' },
  { id: 'q5', text: 'I prefer instructions that are:', visual: 'Illustrated with pictures', aural: 'Explained verbally', readWrite: 'Written in a manual', kinesthetic: 'Shown through a demo' },
  { id: 'q6', text: 'When using new software, I:', visual: 'Watch a tutorial video', aural: 'Ask someone to explain it', readWrite: 'Read the documentation', kinesthetic: 'Click around to explore' },
  { id: 'q7', text: 'I am most comfortable when:', visual: 'I can see the big picture', aural: 'I can discuss ideas', readWrite: 'I can read detailed info', kinesthetic: 'I can move and interact' },
  { id: 'q8', text: 'To concentrate, I prefer:', visual: 'A tidy, organized space', aural: 'Quiet or background music', readWrite: 'Having reference materials', kinesthetic: 'Taking frequent breaks' },
];

export default function LearningStylePage() {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [scores, setScores] = useState({ visual: 0, aural: 0, readWrite: 0, kinesthetic: 0 });
  const [assessmentComplete, setAssessmentComplete] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      const d = res.data?.data || res.data?.classes || res.data?.result || res.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['learning-style', selectedStudent],
    queryFn: () => intelligenceApi.getLearningStyleProfile(selectedStudent).then(r => r.data?.data || r.data),
    enabled: !!selectedStudent,
  });

  const { data: classDistribution, isLoading: classDistLoading } = useQuery({
    queryKey: ['class-style-dist', selectedClass],
    queryFn: () => intelligenceApi.getClassStyleDistribution(selectedClass).then(r => r.data?.data || r.data),
    enabled: !!selectedClass,
  });

  const submitAssessment = useMutation({
    mutationFn: () => intelligenceApi.assessLearningStyle(
      selectedStudent, scores.visual, scores.aural, scores.readWrite, scores.kinesthetic,
    ),
    onSuccess: () => setAssessmentComplete(true),
  });

  const handleAnswer = (dimension: keyof typeof scores) => {
    setScores(prev => ({ ...prev, [dimension]: prev[dimension] + 1 }));
    if (currentQuestion < VARK_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      submitAssessment.mutate();
    }
  };

  const total = scores.visual + scores.aural + scores.readWrite + scores.kinesthetic;
  const dominantStyle = total > 0 ? Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] : null;

  const radarIndicators = [
    { name: 'Visual', max: VARK_QUESTIONS.length },
    { name: 'Aural', max: VARK_QUESTIONS.length },
    { name: 'Read/Write', max: VARK_QUESTIONS.length },
    { name: 'Kinesthetic', max: VARK_QUESTIONS.length },
  ];

  const studentRadarSeries = total > 0 ? [{
    name: selectedStudent ? 'Your Score' : 'Student',
    value: [scores.visual, scores.aural, scores.readWrite, scores.kinesthetic],
  }] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Learning Style Analysis</h1>
        <p className="text-gray-600 mt-1">VARK-based learning style assessment and class distribution</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
            <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select Student</option>
              {(classes || []).flatMap((cls: any) =>
                cls.students?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({cls.name})</option>
                )) || []
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class Distribution</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select Class</option>
              {(classes || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!assessmentComplete && selectedStudent && currentQuestion < VARK_QUESTIONS.length && (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-500">Question {currentQuestion + 1} of {VARK_QUESTIONS.length}</span>
            <span className="text-sm text-gray-400">{Math.round((currentQuestion / VARK_QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
            <div className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all"
              style={{ width: `${(currentQuestion / VARK_QUESTIONS.length) * 100}%` }}
            />
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-6">{VARK_QUESTIONS[currentQuestion].text}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['visual', 'aural', 'readWrite', 'kinesthetic'] as const).map((dim) => (
              <button
                key={dim}
                onClick={() => handleAnswer(dim)}
                className="p-4 rounded-xl border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    dim === 'visual' ? 'bg-blue-500' :
                    dim === 'aural' ? 'bg-green-500' :
                    dim === 'readWrite' ? 'bg-purple-500' : 'bg-amber-500'
                  }`} />
                  <span className="font-medium text-gray-900 capitalize">
                    {dim === 'readWrite' ? 'Read/Write' : dim}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {VARK_QUESTIONS[currentQuestion][dim]}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {radarIndicators && studentRadarSeries.length > 0 && (
            <RadarChart
              indicators={radarIndicators}
              series={studentRadarSeries}
              title="Student Learning Style Profile"
              loading={profileLoading}
            />
          )}

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">VARK Dimension Scores</h3>
            <div className="space-y-4">
              {([
                { key: 'visual', label: 'Visual', color: 'bg-blue-500', text: 'bg-blue-50 text-blue-700' },
                { key: 'aural', label: 'Aural', color: 'bg-green-500', text: 'bg-green-50 text-green-700' },
                { key: 'readWrite', label: 'Read/Write', color: 'bg-purple-500', text: 'bg-purple-50 text-purple-700' },
                { key: 'kinesthetic', label: 'Kinesthetic', color: 'bg-amber-500', text: 'bg-amber-50 text-amber-700' },
              ] as const).map(({ key, label, color, text }) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{label}</span>
                    <span className="font-semibold">{profile[key] ?? scores[key]}/{VARK_QUESTIONS.length}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className={`h-3 rounded-full ${color} transition-all`}
                      style={{ width: `${((profile[key] ?? scores[key]) / VARK_QUESTIONS.length) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-lg bg-orange-50 border border-orange-200">
              <p className="text-sm font-medium text-orange-800">
                <i className="fa fa-lightbulb mr-2"></i>
                Dominant Style: <strong className="capitalize">{dominantStyle === 'readWrite' ? 'Read/Write' : dominantStyle}</strong>
              </p>
              <p className="text-xs text-orange-600 mt-1">
                {dominantStyle === 'visual' ? 'Prefers images, diagrams, and visual representations.' :
                 dominantStyle === 'aural' ? 'Prefers listening, discussions, and verbal explanations.' :
                 dominantStyle === 'readWrite' ? 'Prefers reading texts, writing notes, and lists.' :
                 dominantStyle === 'kinesthetic' ? 'Prefers hands-on activities and real-world examples.' :
                 'Complete the assessment to determine learning style.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {classDistribution && (
        <ComparisonChart
          categories={['Visual', 'Aural', 'Read/Write', 'Kinesthetic']}
          groups={[{
            name: 'Class Distribution',
            values: [
              classDistribution.visual || 0,
              classDistribution.aural || 0,
              classDistribution.readWrite || 0,
              classDistribution.kinesthetic || 0,
            ],
            color: '#8b5cf6',
          }]}
          title="Class Learning Style Distribution"
          loading={classDistLoading}
        />
      )}

      {!profile && !selectedStudent && !assessmentComplete && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          <i className="fa fa-brain text-5xl text-gray-300 mb-4"></i>
          <p className="text-lg">Select a student and complete the VARK assessment</p>
          <p className="text-sm mt-2">Discover your preferred learning style</p>
        </div>
      )}
    </div>
  );
}
