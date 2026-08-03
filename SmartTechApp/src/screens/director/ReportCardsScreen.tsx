import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

interface ReportTypeConfig {
  key: string;
  type: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  needsClass: boolean;
  needsTerm: boolean;
  needsStudent: boolean;
  supportsTemplate: boolean;
}

const REPORT_TYPES: ReportTypeConfig[] = [
  {
    key: 'REPORT_CARD',
    type: 'REPORT_CARD',
    label: 'Report Card',
    icon: '\u{1F4C4}',
    color: '#3B82F6',
    description: 'Individual student report card with grades and comments',
    needsClass: true,
    needsTerm: true,
    needsStudent: true,
    supportsTemplate: true,
  },
  {
    key: 'CLASS_REPORT',
    type: 'CLASS_REPORT',
    label: 'Class Report',
    icon: '\u{1F4CB}',
    color: '#0D9488',
    description: 'All report cards for an entire class',
    needsClass: true,
    needsTerm: true,
    needsStudent: false,
    supportsTemplate: true,
  },
  {
    key: 'TRANSCRIPT',
    type: 'TRANSCRIPT',
    label: 'Transcript',
    icon: '\u{1F4DC}',
    color: '#8B5CF6',
    description: 'Full academic transcript across all terms',
    needsClass: false,
    needsTerm: false,
    needsStudent: true,
    supportsTemplate: true,
  },
  {
    key: 'CERTIFICATE',
    type: 'CERTIFICATE',
    label: 'Certificate',
    icon: '\u{1F3C6}',
    color: '#F59E0B',
    description: 'Achievement or merit certificate',
    needsClass: false,
    needsTerm: true,
    needsStudent: true,
    supportsTemplate: true,
  },
  {
    key: 'ATTENDANCE_REPORT',
    type: 'ATTENDANCE_REPORT',
    label: 'Attendance Report',
    icon: '\u{1F4C5}',
    color: '#10B981',
    description: 'Student or class attendance summary',
    needsClass: false,
    needsTerm: true,
    needsStudent: false,
    supportsTemplate: false,
  },
  {
    key: 'ANALYTICS_SUMMARY',
    type: 'ANALYTICS_SUMMARY',
    label: 'Analytics Summary',
    icon: '\u{1F4CA}',
    color: '#4F46E5',
    description: 'Class or school-wide analytics dashboard',
    needsClass: false,
    needsTerm: true,
    needsStudent: false,
    supportsTemplate: false,
  },
  {
    key: 'MARK_SCHEDULE',
    type: 'MARK_SCHEDULE',
    label: 'Mark Schedule',
    icon: '\u{1F4DD}',
    color: '#EA580C',
    description: 'Subject mark schedule and grading breakdown',
    needsClass: true,
    needsTerm: true,
    needsStudent: false,
    supportsTemplate: false,
  },
  {
    key: 'PERFORMANCE_REPORT',
    type: 'PERFORMANCE_REPORT',
    label: 'Performance Report',
    icon: '\u{1F4C8}',
    color: '#EC4899',
    description: 'Student performance profile with trends',
    needsClass: false,
    needsTerm: true,
    needsStudent: true,
    supportsTemplate: true,
  },
];

export const ReportCardsScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [activeTab, setActiveTab] = useState<'generate' | 'templates'>('generate');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedType, setSelectedType] = useState<string>('');
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [validation, setValidation] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [generatedFileName, setGeneratedFileName] = useState<string>('');

  const [recentReports, setRecentReports] = useState<any[]>([]);

  const activeConfig = REPORT_TYPES.find((rt) => rt.key === selectedType);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadStudents();
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedType) {
      runValidation();
    }
  }, [selectedType, selectedClassId, selectedTermId, selectedStudentId, selectedTemplateId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [classData, yearData] = await Promise.allSettled([
        apiService.getClasses(),
        apiService.getAcademicYears(),
      ]);

      if (classData.status === 'fulfilled') {
        const raw = classData.value;
        const classList = Array.isArray(raw) ? raw : raw?.data || raw?.data?.data || [];
        setClasses(classList);
      }

      if (yearData.status === 'fulfilled') {
        const raw = yearData.value;
        const years = Array.isArray(raw) ? raw : raw?.data || raw?.data?.data || [];
        const currentYear = years.find((y: any) => y.isCurrent) || years[0];

        let termList: any[] = [];
        if (currentYear) {
          try {
            const termData = await apiService.getTerms(currentYear.id);
            termList = Array.isArray(termData) ? termData : termData?.data || termData?.data?.data || [];
          } catch (termErr) {
            console.warn('Failed to load terms:', termErr);
          }
        }

        // Fallback: load all school terms if the current year has none
        if (termList.length === 0) {
          try {
            const allTermData = await apiService.getAllTerms();
            termList = Array.isArray(allTermData) ? allTermData : allTermData?.data || allTermData?.data?.data || [];
          } catch (termErr) {
            console.warn('Failed to load all terms:', termErr);
          }
        }

        // Fallback: use the dashboard's current term so termId is always populated
        if (termList.length === 0) {
          try {
            const dashboard = await apiService.getDashboard();
            const currentTerm = dashboard?.currentTerm;
            if (currentTerm?.id) {
              termList = [{ id: currentTerm.id, name: currentTerm.name, isCurrent: true }];
            }
          } catch (dashErr) {
            console.warn('Failed to load terms from dashboard:', dashErr);
          }
        }

        // Dedupe by id and sort by start date so the term selector is stable
        const seen = new Set<string>();
        termList = termList
          .filter((t: any) => {
            if (!t?.id || seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          })
          .sort((a: any, b: any) =>
            String(a.startDate || '').localeCompare(String(b.startDate || '')),
          );

        setTerms(termList);
        const currentTerm = termList.find((t: any) => t.isCurrent) || termList[0];
        if (currentTerm) {
          setSelectedTermId(currentTerm.id);
        }
      }

      loadTemplates();
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await apiService.getStudents(selectedClassId);
      const raw = data;
      const studentList = Array.isArray(raw) ? raw : raw?.data || raw?.data?.data || [];
      setStudents(studentList);
    } catch (err) {
      console.error('Failed to load students:', err);
      setStudents([]);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await apiService.getTemplates(selectedType || undefined, 'ACTIVE');
      const raw = data;
      const templateList = Array.isArray(raw) ? raw : raw?.data || raw?.data?.data || [];
      setTemplates(templateList);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setTemplates([]);
    }
  };

  const runValidation = async () => {
    if (!selectedType) return;
    setValidating(true);
    try {
      const payload: any = { type: selectedType };
      if (selectedClassId) payload.classId = selectedClassId;
      if (selectedTermId) payload.termId = selectedTermId;
      if (selectedStudentId) payload.studentId = selectedStudentId;
      if (selectedTemplateId) payload.templateId = selectedTemplateId;

      const result = await apiService.validateReportRequest(payload);
      const unwrapped = result?.data ?? result;
      setValidation(unwrapped);
    } catch (err) {
      console.error('Validation failed:', err);
      setValidation({ valid: false, errors: ['Validation request failed. Please try again.'] });
    } finally {
      setValidating(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, []);

  const handleSelectType = (typeKey: string) => {
    setSelectedType(typeKey);
    setSelectedClassId('');
    setSelectedStudentId('');
    setSelectedTemplateId('');
    setValidation(null);
    setGeneratedPdfUrl(null);
    setStudents([]);
    loadTemplatesForType(typeKey);
  };

  const loadTemplatesForType = async (typeKey: string) => {
    try {
      const data = await apiService.getTemplates(typeKey, 'ACTIVE');
      const raw = data;
      const templateList = Array.isArray(raw) ? raw : raw?.data || raw?.data?.data || [];
      setTemplates(templateList);
    } catch (err) {
      setTemplates([]);
    }
  };

  const handleGenerate = async () => {
    if (!selectedType) {
      Alert.alert('Select Report Type', 'Please choose a report type first.');
      return;
    }

    if (validation && !validation.valid) {
      Alert.alert('Cannot Generate', 'There are validation errors. Please fix them before generating.');
      return;
    }

    if (!selectedTermId && activeConfig?.needsTerm) {
      Alert.alert('Select Term', 'Please select a term.');
      return;
    }

    if (!selectedClassId && activeConfig?.needsClass) {
      Alert.alert('Select Class', 'Please select a class.');
      return;
    }

    if (!selectedStudentId && activeConfig?.needsStudent) {
      Alert.alert('Select Student', 'Please select a student.');
      return;
    }

    setGenerating(true);
    setGeneratedPdfUrl(null);

    try {
      const payload: any = { type: selectedType };
      if (selectedClassId) payload.classId = selectedClassId;
      if (selectedTermId) payload.termId = selectedTermId;
      if (selectedStudentId) payload.studentId = selectedStudentId;
      if (selectedTemplateId) payload.templateId = selectedTemplateId;

      const blob = await apiService.generateReportPdf(payload) as Blob;

      const reportEntry = {
        id: Date.now().toString(),
        type: selectedType,
        label: activeConfig?.label || selectedType,
        icon: activeConfig?.icon || '\u{1F4C4}',
        color: activeConfig?.color || colors.primary,
        timestamp: new Date().toISOString(),
        fileName: '',
      };

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const safeFileName = `${selectedType}_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
        const fileUri = FileSystem.documentDirectory + safeFileName;

        await FileSystem.writeAsStringAsync(fileUri, base64.split(',')[1], {
          encoding: FileSystem.EncodingType.Base64,
        });

        reportEntry.fileName = safeFileName;
        setGeneratedPdfUrl(fileUri);
        setGeneratedFileName(safeFileName);
        setRecentReports((prev) => [reportEntry, ...prev].slice(0, 10));

        Alert.alert(
          'Report Generated',
          `${activeConfig?.label || 'Report'} has been generated successfully.`,
          [
            {
              text: 'Share',
              onPress: async () => {
                try {
                  await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Share ${activeConfig?.label || 'Report'}`,
                  });
                } catch (shareErr: any) {
                  if (shareErr?.message !== 'User did not share') {
                    Alert.alert('Error', 'Failed to share file.');
                  }
                }
              },
            },
            {
              text: 'Download',
              onPress: async () => {
                try {
                  await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Download ${activeConfig?.label || 'Report'}`,
                  });
                } catch (shareErr: any) {
                  if (shareErr?.message !== 'User did not share') {
                    Alert.alert('Error', 'Failed to download file.');
                  }
                }
              },
            },
            { text: 'OK' },
          ]
        );
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        const msg = err?.response?.data?.message || err?.message || 'Failed to generate report.';
        Alert.alert('Generation Failed', msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadFromRecent = async (report: any) => {
    if (!report.fileName) {
      Alert.alert('Unavailable', 'This report file is no longer available. Please regenerate it.');
      return;
    }
    const fileUri = FileSystem.documentDirectory + report.fileName;
    try {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${report.label}`,
        });
      } else {
        Alert.alert('File Not Found', 'The PDF file has expired. Please regenerate the report.');
      }
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to open file.');
      }
    }
  };

  const handleUseTemplate = (template: any) => {
    setSelectedType(template.type || 'REPORT_CARD');
    setSelectedTemplateId(template.id);
    setActiveTab('generate');
  };

  const renderReportTypeCards = () => (
    <GradientCard title="Select Report Type" subtitle="Choose the type of report to generate" icon={'\u{1F4D1}'} gradient={['#EFF6FF', '#DBEAFE']} style={styles.typeCard}>
      <View style={styles.typeGrid}>
        {REPORT_TYPES.map((rt) => {
          const isActive = selectedType === rt.key;
          return (
            <TouchableOpacity
              key={rt.key}
              style={[styles.typeItem, isActive && styles.typeItemActive]}
              onPress={() => handleSelectType(rt.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.typeIconCircle, { backgroundColor: isActive ? rt.color : rt.color + '15' }]}>
                <Text style={styles.typeEmoji}>{rt.icon}</Text>
              </View>
              <Text style={[styles.typeLabel, isActive && { color: colors.white }]} numberOfLines={2}>
                {rt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedType && activeConfig && (
        <View style={styles.typeDescriptionBox}>
          <Text style={[styles.typeDescriptionText, { color: activeConfig.color }]}>
            {activeConfig.description}
          </Text>
        </View>
      )}
    </GradientCard>
  );

  const renderClassSelector = () => {
    if (!activeConfig?.needsClass) return null;
    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>CLASS *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {classes.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              style={[styles.chip, selectedClassId === cls.id && styles.chipActive]}
              onPress={() => {
                setSelectedClassId(cls.id);
                setSelectedStudentId('');
              }}
            >
              <Text style={[styles.chipText, selectedClassId === cls.id && styles.chipTextActive]}>
                {cls.name}
              </Text>
            </TouchableOpacity>
          ))}
          {classes.length === 0 && <Text style={styles.noDataText}>No classes available</Text>}
        </ScrollView>
      </View>
    );
  };

  const renderTermSelector = () => {
    if (!activeConfig?.needsTerm) return null;
    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>TERM *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {terms.map((term) => (
            <TouchableOpacity
              key={term.id}
              style={[styles.chip, selectedTermId === term.id && styles.chipActive]}
              onPress={() => setSelectedTermId(term.id)}
            >
              <Text style={[styles.chipText, selectedTermId === term.id && styles.chipTextActive]}>
                {term.name}
              </Text>
            </TouchableOpacity>
          ))}
          {terms.length === 0 && <Text style={styles.noDataText}>No terms available</Text>}
        </ScrollView>
      </View>
    );
  };

  const renderStudentSelector = () => {
    if (!activeConfig?.needsStudent) return null;
    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>STUDENT *</Text>
        {!selectedClassId && activeConfig.needsClass ? (
          <Text style={styles.hintSmall}>Select a class first to load students</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {students.map((stu) => {
              const name = stu.name || stu.studentName || `${stu.firstName || ''} ${stu.lastName || ''}`.trim() || 'Unknown';
              const stuId = stu.id || stu.studentId;
              return (
                <TouchableOpacity
                  key={stuId}
                  style={[styles.chip, selectedStudentId === stuId && styles.chipActive]}
                  onPress={() => setSelectedStudentId(stuId)}
                >
                  <Text
                    style={[styles.chipText, selectedStudentId === stuId && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {students.length === 0 && selectedClassId && (
              <Text style={styles.noDataText}>No students in this class</Text>
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderTemplateSelector = () => {
    if (!activeConfig?.supportsTemplate) return null;
    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>TEMPLATE (OPTIONAL)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <TouchableOpacity
            style={[styles.chip, selectedTemplateId === '' && styles.chipActive]}
            onPress={() => setSelectedTemplateId('')}
          >
            <Text style={[styles.chipText, selectedTemplateId === '' && styles.chipTextActive]}>
              Default
            </Text>
          </TouchableOpacity>
          {templates.map((tpl) => (
            <TouchableOpacity
              key={tpl.id}
              style={[styles.chip, selectedTemplateId === tpl.id && styles.chipActive]}
              onPress={() => setSelectedTemplateId(tpl.id)}
            >
              <Text style={[styles.chipText, selectedTemplateId === tpl.id && styles.chipTextActive]}>
                {tpl.name || 'Untitled Template'}
              </Text>
            </TouchableOpacity>
          ))}
          {templates.length === 0 && (
            <Text style={styles.noDataText}>No templates available</Text>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderValidationSection = () => {
    if (!selectedType) return null;
    if (validating) {
      return (
        <View style={styles.validationRow}>
          <ActivityIndicator size="small" color={colors.primaryLight} />
          <Text style={styles.validationText}>Validating...</Text>
        </View>
      );
    }
    if (!validation) return null;

    const hasErrors = validation.errors && validation.errors.length > 0;
    const hasWarnings = validation.warnings && validation.warnings.length > 0;
    const isValid = validation.valid === true;

    return (
      <View style={styles.validationContainer}>
        {isValid && !hasWarnings && (
          <View style={[styles.validationRow, styles.validationSuccess]}>
            <Text style={styles.validationIcon}>{'\u2705'}</Text>
            <Text style={[styles.validationText, { color: colors.success }]}>Ready to generate</Text>
          </View>
        )}
        {hasErrors && validation.errors.map((err: string, idx: number) => (
          <View key={`err-${idx}`} style={[styles.validationRow, styles.validationError]}>
            <Text style={styles.validationIcon}>{'\u274C'}</Text>
            <Text style={[styles.validationText, { color: colors.error }]}>{err}</Text>
          </View>
        ))}
        {hasWarnings && validation.warnings.map((warn: string, idx: number) => (
          <View key={`warn-${idx}`} style={[styles.validationRow, styles.validationWarning]}>
            <Text style={styles.validationIcon}>{'\u26A0\uFE0F'}</Text>
            <Text style={[styles.validationText, { color: colors.warning }]}>{warn}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderGenerateButton = () => {
    if (!selectedType) return null;
    const isDisabled = generating || (validation && !validation.valid) || validating;

    return (
      <TouchableOpacity
        style={[styles.generateButton, isDisabled && styles.generateButtonDisabled]}
        onPress={handleGenerate}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        {generating ? (
          <View style={styles.generateButtonInner}>
            <ActivityIndicator size="small" color={colors.white} />
            <Text style={styles.generateButtonText}>Generating...</Text>
          </View>
        ) : (
          <View style={styles.generateButtonInner}>
            <Text style={styles.generateButtonIcon}>{'\u26A1'}</Text>
            <Text style={styles.generateButtonText}>Generate Report</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderRecentReports = () => {
    if (recentReports.length === 0) return null;
    return (
      <WidgetCard
        title="Recent Reports"
        action={{ label: 'Clear', onPress: () => setRecentReports([]) }}
      >
        {recentReports.map((report, idx) => {
          const date = new Date(report.timestamp);
          const timeStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          return (
            <View key={report.id} style={[styles.recentRow, idx > 0 && styles.recentRowBorder]}>
              <View style={[styles.recentIconCircle, { backgroundColor: report.color + '15' }]}>
                <Text style={styles.recentEmoji}>{report.icon}</Text>
              </View>
              <View style={styles.recentInfo}>
                <Text style={styles.recentLabel} numberOfLines={1}>{report.label}</Text>
                <Text style={styles.recentTime}>{timeStr}</Text>
              </View>
              <TouchableOpacity
                style={styles.recentDownloadBtn}
                onPress={() => handleDownloadFromRecent(report)}
              >
                <Text style={styles.recentDownloadText}>{'\u2B07\uFE0F'}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </WidgetCard>
    );
  };

  const renderConfigurationSection = () => {
    if (!selectedType) return null;
    return (
      <WidgetCard title="Configuration">
        {renderClassSelector()}
        {renderTermSelector()}
        {renderStudentSelector()}
        {renderTemplateSelector()}
        {renderValidationSection()}
        {renderGenerateButton()}
      </WidgetCard>
    );
  };

  const renderTemplateItem = (template: any) => {
    const typeLabel = REPORT_TYPES.find((rt) => rt.key === template.type)?.label || template.type || 'Unknown';
    const typeConfig = REPORT_TYPES.find((rt) => rt.key === template.type);
    const typeColor = typeConfig?.color || colors.primaryLight;
    const typeIcon = typeConfig?.icon || '\u{1F4C4}';
    const isActive = selectedTemplateId === template.id;

    return (
      <TouchableOpacity
        key={template.id}
        style={[styles.templateCard, isActive && styles.templateCardActive]}
        onPress={() => handleUseTemplate(template)}
        activeOpacity={0.7}
      >
        <View style={[styles.templateTypeBadge, { backgroundColor: typeColor + '15' }]}>
          <Text style={styles.templateTypeIcon}>{typeIcon}</Text>
        </View>
        <View style={styles.templateInfo}>
          <Text style={styles.templateName} numberOfLines={1}>{template.name || 'Untitled Template'}</Text>
          <Text style={styles.templateType}>{typeLabel}</Text>
          {template.description && (
            <Text style={styles.templateDesc} numberOfLines={2}>{template.description}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.templateUseBtn}
          onPress={() => handleUseTemplate(template)}
        >
          <Text style={styles.templateUseBtnText}>Use</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderTemplatesTab = () => (
    <View>
      {templates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{1F4D1}'}</Text>
          <Text style={styles.emptyTitle}>No Templates</Text>
          <Text style={styles.emptyDesc}>No report templates are available yet. Generate reports with the default template, or create templates in the Template Builder.</Text>
          {onNavigate && (
            <TouchableOpacity
              style={styles.emptyAction}
              onPress={() => onNavigate('DirectorTemplateBuilder')}
            >
              <Text style={styles.emptyActionText}>Go to Template Builder</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View>
          <Text style={styles.templatesCountText}>
            {templates.length} template{templates.length !== 1 ? 's' : ''} available
          </Text>
          {templates.map((tpl) => renderTemplateItem(tpl))}
        </View>
      )}
    </View>
  );

  const renderGenerateTab = () => (
    <View>
      {renderReportTypeCards()}
      {renderConfigurationSection()}
      {renderRecentReports()}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderBar
          title="Report Generation Hub"
          subtitle="Generate all school reports"
          leftIcon={{ name: '\u2630', onPress: onToggleDrawer || (() => {}) }}
          rightIcon={{ name: '\u{1F514}', onPress: () => navigation.navigate('Notifications') }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Report Generation Hub"
        subtitle="Generate all school reports"
        leftIcon={{ name: '\u2630', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '\u{1F514}', onPress: () => navigation.navigate('Notifications') }}
      />

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'generate' && styles.tabActive]}
          onPress={() => setActiveTab('generate')}
        >
          <Text style={styles.tabIcon}>{'\u2699\uFE0F'}</Text>
          <Text style={[styles.tabText, activeTab === 'generate' && styles.tabTextActive]}>
            Generate
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'templates' && styles.tabActive]}
          onPress={() => setActiveTab('templates')}
        >
          <Text style={styles.tabIcon}>{'\u{1F4D1}'}</Text>
          <Text style={[styles.tabText, activeTab === 'templates' && styles.tabTextActive]}>
            My Templates
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {activeTab === 'generate' ? renderGenerateTab() : renderTemplatesTab()}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.md,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.sm,
  },

  // Tab bar
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabIcon: {
    fontSize: 14,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  tabTextActive: {
    color: colors.white,
  },

  // Report type grid
  typeCard: {
    marginBottom: spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  typeItem: {
    width: '22%',
    minWidth: 70,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.md,
  },
  typeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  typeEmoji: {
    fontSize: 20,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 13,
  },
  typeDescriptionBox: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    borderLeftWidth: 3,
  },
  typeDescriptionText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Selectors
  selectorContainer: {
    marginBottom: spacing.md,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textLight,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    letterSpacing: 0.3,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  chipTextActive: {
    color: colors.white,
  },
  noDataText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  hintSmall: {
    fontSize: 13,
    color: colors.textLight,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },

  // Validation
  validationContainer: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  validationSuccess: {
    backgroundColor: colors.successLight,
  },
  validationError: {
    backgroundColor: colors.errorLight,
  },
  validationWarning: {
    backgroundColor: colors.warningLight,
  },
  validationIcon: {
    fontSize: 14,
  },
  validationText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Generate button
  generateButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  generateButtonDisabled: {
    backgroundColor: colors.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  generateButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  generateButtonIcon: {
    fontSize: 18,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },

  // Recent reports
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  recentRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  recentIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  recentEmoji: {
    fontSize: 18,
  },
  recentInfo: {
    flex: 1,
  },
  recentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  recentTime: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  recentDownloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentDownloadText: {
    fontSize: 16,
  },

  // Template items
  templatesCountText: {
    fontSize: 13,
    color: colors.textLight,
    marginBottom: spacing.md,
    fontWeight: '500',
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  templateCardActive: {
    borderColor: colors.primaryLight,
    borderWidth: 2,
  },
  templateTypeBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  templateTypeIcon: {
    fontSize: 20,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  templateType: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  templateDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  templateUseBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
  },
  templateUseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textLight,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  emptyAction: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});
