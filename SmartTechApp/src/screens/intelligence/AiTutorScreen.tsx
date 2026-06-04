import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Message {
  id?: string;
  role: 'user' | 'tutor' | 'system';
  content: string;
  createdAt?: string;
}

interface Session {
  id: string;
  subjectId?: string;
  topic?: string;
  status: string;
  createdAt: string;
  lastActive: string;
  lastMessage?: string;
}

type Screen = 'sessions' | 'chat';

export const AiTutorScreen: React.FC = () => {
  const { user } = useAuthStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const [screen, setScreen] = useState<Screen>('sessions');

  const userRole = user?.roles?.[0]?.toLowerCase().replace(' ', '_') || 'student';
  const sourceScreen = (route.params as any)?.sourceScreen || 'ai_tutor';

  const buildContext = (overrides?: { subject?: string; topic?: string }) => ({
    role: userRole,
    screen: sourceScreen,
    subject: overrides?.subject,
    topic: overrides?.topic,
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

  const loadSessions = async () => {
    try {
      const res = await apiService.getAiTutorSessions();
      setSessions(res.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const startNewSession = async (topic?: string, subjectId?: string) => {
    setShowTopicModal(false);
    setTopicInput('');
    setLoading(true);
    try {
      const res = await apiService.startAiTutorSession({
        topic,
        subjectId,
        context: buildContext({ subject: subjectId, topic }),
      });
      const session: Session = {
        id: res.sessionId,
        topic,
        subjectId,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      setActiveSession(session);
      setMessages([{ role: 'tutor', content: res.message, createdAt: new Date().toISOString() }]);
      setScreen('chat');
    } catch (err) {
      Alert.alert('Error', 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const openSession = async (session: Session) => {
    setLoading(true);
    setActiveSession(session);
    try {
      const res = await apiService.getAiTutorHistory(session.id);
      if (res.messages) {
        const msgs: Message[] = res.messages.map((m: any) => ({
          id: m.id,
          role: m.role === 'student' ? 'user' : m.role,
          content: m.content,
          createdAt: m.createdAt,
        }));
        setMessages(msgs);
      } else {
        setMessages([]);
      }
      setScreen('chat');
    } catch (err) {
      Alert.alert('Error', 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSession || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question, createdAt: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await apiService.sendAiTutorMessage(
        activeSession.id,
        question,
        buildContext({
          subject: activeSession.subjectId,
          topic: activeSession.topic,
        }),
      );
      const reply = res?.response || res?.data?.response || "I'll help you with that!";
      setMessages(prev => [...prev, { role: 'tutor', content: reply, createdAt: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'tutor', content: "I'm having trouble connecting. Please try again.", createdAt: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    Alert.alert(
      'End Session',
      'Are you sure you want to end this tutoring session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.endAiTutorSession(activeSession.id);
              setActiveSession(null);
              setMessages([]);
              setScreen('sessions');
              await loadSessions();
            } catch (err) {
              Alert.alert('Error', 'Failed to end session');
            }
          },
        },
      ]
    );
  };

  const deleteSession = async (sessionId: string) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.endAiTutorSession(sessionId);
              await loadSessions();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  const renderSessionsScreen = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>AI Tutor</Text>
          <Text style={styles.headerSub}>Your personalized learning assistant</Text>
        </View>
        <TouchableOpacity style={styles.newSessionBtn} onPress={() => setShowTopicModal(true)}>
          <Text style={styles.newSessionIcon}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.sessionList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        contentContainerStyle={sessions.length === 0 ? styles.emptyContainer : undefined}
      >
        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyText}>Start a new tutoring session to begin learning</Text>
            <TouchableOpacity style={styles.startBtn} onPress={() => setShowTopicModal(true)}>
              <Text style={styles.startBtnText}>Start New Session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sessions.map((session) => (
            <TouchableOpacity key={session.id} style={styles.sessionCard} onPress={() => openSession(session)} onLongPress={() => deleteSession(session.id)}>
              <View style={styles.sessionIcon}>
                <Text style={styles.sessionIconText}>{session.topic ? '📚' : '🤖'}</Text>
              </View>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionTopic}>{session.topic || 'General Tutoring'}</Text>
                <Text style={styles.sessionMeta}>
                  {session.subjectId ? `${session.subjectId} • ` : ''}
                  {new Date(session.lastActive).toLocaleDateString()} {new Date(session.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {session.lastMessage && (
                  <Text style={styles.sessionLastMsg} numberOfLines={1}>{session.lastMessage}</Text>
                )}
              </View>
              <View style={[styles.statusBadge, session.status === 'active' ? styles.statusActive : styles.statusCompleted]}>
                <Text style={styles.statusText}>{session.status === 'active' ? 'Active' : 'Done'}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {showTopicModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Tutoring Session</Text>
            <Text style={styles.modalSub}>What would you like to learn about?</Text>
            <TextInput
              style={styles.topicInput}
              placeholder="e.g., Algebra, Photosynthesis, Essay Writing..."
              placeholderTextColor={colors.textMuted}
              value={topicInput}
              onChangeText={setTopicInput}
              autoFocus
            />
            <Text style={styles.modalHint}>
              Role: {userRole.replace('_', ' ')} | Context-aware AI will personalize responses based on your profile and performance.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowTopicModal(false); setTopicInput(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalStartBtn} onPress={() => startNewSession(topicInput || undefined)}>
                <Text style={styles.modalStartText}>{loading ? 'Starting...' : 'Start'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const renderChatScreen = () => (
    <View style={styles.container}>
      <View style={styles.chatHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { setScreen('sessions'); setActiveSession(null); setMessages([]); }}>
          <Text style={styles.backText}>← Sessions</Text>
        </TouchableOpacity>
        <View style={styles.chatHeaderCenter}>
          <Text style={styles.chatTitle}>{activeSession?.topic || 'AI Tutor'}</Text>
          <Text style={styles.chatSub}>Online</Text>
        </View>
        <TouchableOpacity style={styles.endBtn} onPress={endSession}>
          <Text style={styles.endText}>End</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg, i) => (
            <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.tutorBubble]}>
              {msg.role === 'tutor' && <Text style={styles.bubbleSender}>AI Tutor</Text>}
              <Text style={[styles.bubbleText, msg.role === 'user' && { color: colors.white }]}>{msg.content}</Text>
              {msg.createdAt && (
                <Text style={[styles.bubbleTime, msg.role === 'user' && { color: 'rgba(255,255,255,0.6)' }]}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          ))}
          {loading && (
            <View style={[styles.bubble, styles.tutorBubble]}>
              <Text style={styles.typingText}>AI Tutor is typing...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity style={[styles.sendButton, (!input.trim() || loading) && styles.sendDisabled]} onPress={handleSend} disabled={!input.trim() || loading}>
            <Text style={styles.sendText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {screen === 'sessions' ? renderSessionsScreen() : renderChatScreen()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  newSessionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', ...shadows.md },
  newSessionIcon: { fontSize: 24, color: colors.white, fontWeight: '700' },

  sessionList: { flex: 1 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginHorizontal: spacing.md, marginVertical: spacing.xs / 2, backgroundColor: colors.white, borderRadius: borderRadius.lg, ...shadows.sm },
  sessionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.infoLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  sessionIconText: { fontSize: 20 },
  sessionInfo: { flex: 1 },
  sessionTopic: { fontSize: 15, fontWeight: '600', color: colors.text },
  sessionMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  sessionLastMsg: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm },
  statusActive: { backgroundColor: colors.successLight },
  statusCompleted: { backgroundColor: colors.border },
  statusText: { fontSize: 10, fontWeight: '600', color: colors.text },

  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginBottom: spacing.lg },
  startBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.lg, ...shadows.md },
  startBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { backgroundColor: colors.white, borderRadius: borderRadius.xxl, padding: spacing.xl, width: '85%', ...shadows.lg },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  modalSub: { fontSize: 14, color: colors.textLight, marginBottom: spacing.lg },
  topicInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  modalHint: { fontSize: 11, color: colors.textLight, marginBottom: spacing.lg, fontStyle: 'italic' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  modalCancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  modalCancelText: { fontSize: 15, color: colors.textLight, fontWeight: '600' },
  modalStartBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.lg },
  modalStartText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { paddingVertical: spacing.sm },
  backText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  chatHeaderCenter: { alignItems: 'center' },
  chatTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  chatSub: { fontSize: 12, color: colors.success, fontWeight: '500' },
  endBtn: { backgroundColor: colors.errorLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  endText: { fontSize: 13, color: colors.error, fontWeight: '600' },

  chatContent: { padding: spacing.md, paddingBottom: spacing.lg },
  bubble: { maxWidth: '85%', padding: spacing.md, borderRadius: 16, marginBottom: spacing.sm },
  userBubble: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  tutorBubble: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleSender: { fontSize: 11, fontWeight: '600', color: colors.primary, marginBottom: 4 },
  bubbleText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  bubbleTime: { fontSize: 10, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  typingText: { fontSize: 13, color: colors.textLight, fontStyle: 'italic' },

  inputRow: { flexDirection: 'row', padding: spacing.sm, paddingBottom: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.sm, fontSize: 15, color: colors.text, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', ...shadows.md },
  sendDisabled: { opacity: 0.5 },
  sendText: { fontSize: 18, color: colors.white },
});
