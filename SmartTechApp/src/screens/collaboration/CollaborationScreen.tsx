import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

const extra = Constants.expoConfig?.extra || {};
const API_BASE_URL = extra.apiBaseUrl || 'https://api.smarttechsaas.com/api/v1';
const SOCKET_URL = API_BASE_URL.replace('/api/v1', '');

interface Editor {
  id: string;
  name: string;
  color: string;
}

interface Session {
  id: string;
  templateName: string;
  editors: Editor[];
  lastActivity: string;
  status: 'active' | 'idle';
}

interface ActivityItem {
  id: string;
  user: string;
  action: string;
  time: string;
}

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  time: string;
}

export function CollaborationScreen({ navigation }: any) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatInputRef = useRef<TextInput>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-collaboration', { room: 'global' });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('session-update', (data: Session[]) => {
      setSessions(data);
    });

    socket.on('activity', (data: ActivityItem) => {
      setActivityFeed(prev => [data, ...prev].slice(0, 20));
    });

    socket.on('chat-message', (data: ChatMessage) => {
      setChatMessages(prev => [...prev, data]);
    });

    socket.on('editor-joined', (data: { sessionId: string; editor: Editor }) => {
      setSessions(prev => prev.map(s =>
        s.id === data.sessionId
          ? { ...s, editors: [...s.editors, data.editor] }
          : s
      ));
    });

    socket.on('editor-left', (data: { sessionId: string; editorId: string }) => {
      setSessions(prev => prev.map(s =>
        s.id === data.sessionId
          ? { ...s, editors: s.editors.filter(e => e.id !== data.editorId) }
          : s
      ));
    });

    socket.on('cursor-update', (data: { sessionId: string; editorId: string; position: { line: number; col: number } }) => {
      // Could render live cursors on editor canvas
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSendMessage = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      user: 'You',
      text: chatInput.trim(),
      time: 'Just now',
    };
    socketRef.current.emit('chat-message', { ...newMsg, sessionId: currentSessionId });
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
  };

  const handleStartNewSession = () => {
    if (socketRef.current) {
      socketRef.current.emit('create-session', { templateName: 'New Collaborative Session' });
    }
    navigation.navigate('DocumentEditor');
  };

  const joinSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    if (socketRef.current) {
      socketRef.current.emit('join-session', { sessionId });
    }
  };

  const toggleSession = (id: string) => {
    setExpandedSession(prev => (prev === id ? null : id));
    joinSession(id);
  };

  const renderSession = (session: Session) => {
    const isExpanded = expandedSession === session.id;
    const onlineCount = session.editors.length;

    return (
      <TouchableOpacity
        key={session.id}
        style={styles.sessionCard}
        onPress={() => toggleSession(session.id)}
        activeOpacity={0.8}
      >
        <View style={styles.sessionHeader}>
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionName}>{session.templateName}</Text>
            <View style={styles.sessionMeta}>
              <View style={[styles.statusDot, { backgroundColor: session.status === 'active' ? colors.success : colors.textLight }]} />
              <Text style={styles.statusText}>{session.status === 'active' ? 'Active' : 'Idle'}</Text>
              <Text style={styles.metaSeparator}>|</Text>
              <Text style={styles.editorCount}>{onlineCount} editor{onlineCount !== 1 ? 's' : ''}</Text>
              <Text style={styles.metaSeparator}>|</Text>
              <Text style={styles.lastActivity}>{session.lastActivity}</Text>
            </View>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
        </View>

        <View style={styles.presenceRow}>
          {session.editors.map((editor) => (
            <View key={editor.id} style={styles.presenceItem}>
              <View style={[styles.presenceDot, { backgroundColor: editor.color }]}>
                <Text style={styles.presenceInitial}>
                  {editor.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.presenceName}>{editor.name}</Text>
            </View>
          ))}
        </View>

        {isExpanded && (
          <View style={styles.expandedSection}>
            <Text style={styles.expandedTitle}>Active Editors</Text>
            {session.editors.map((editor) => (
              <View key={editor.id} style={styles.editorRow}>
                <View style={[styles.editorDot, { backgroundColor: editor.color }]} />
                <Text style={styles.editorName}>{editor.name}</Text>
                <Text style={styles.editorStatus}>• online</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Collaboration</Text>
            <View style={[styles.connectionDot, { backgroundColor: connected ? colors.success : colors.error }]} />
          </View>
          <TouchableOpacity style={styles.newSessionBtn} onPress={handleStartNewSession}>
            <Text style={styles.newSessionBtnText}>+ New Session</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          {sessions.length === 0 ? (
            <Text style={styles.emptyText}>No active sessions. Start one to collaborate!</Text>
          ) : (
            sessions.map(renderSession)
          )}

          <Text style={styles.sectionTitle}>Activity Feed</Text>
          <View style={styles.activityFeed}>
            {activityFeed.length === 0 ? (
              <Text style={styles.emptyActivity}>No recent activity</Text>
            ) : (
              activityFeed.map((item) => (
                <View key={item.id} style={styles.activityItem}>
                  <View style={styles.activityDot} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityUser}>{item.user}</Text> {item.action}
                    </Text>
                    <Text style={styles.activityTime}>{item.time}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {chatVisible && (
          <View style={styles.chatPanel}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Chat</Text>
              <TouchableOpacity onPress={() => setChatVisible(false)}>
                <Text style={styles.chatClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={chatMessages}
              keyExtractor={(item) => item.id}
              style={styles.chatList}
              contentContainerStyle={styles.chatListContent}
              renderItem={({ item }) => (
                <View style={[styles.chatBubble, item.user === 'You' ? styles.chatBubbleOwn : styles.chatBubbleOther]}>
                  <Text style={styles.chatBubbleUser}>{item.user}</Text>
                  <Text style={styles.chatBubbleText}>{item.text}</Text>
                  <Text style={styles.chatBubbleTime}>{item.time}</Text>
                </View>
              )}
            />
            <View style={styles.chatInputRow}>
              <TextInput
                ref={chatInputRef}
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Type a message..."
                placeholderTextColor={colors.textLight}
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!chatVisible && (
          <TouchableOpacity style={styles.chatFab} onPress={() => setChatVisible(true)}>
            <Text style={styles.chatFabIcon}>💬</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  connectionDot: { width: 8, height: 8, borderRadius: 4, marginLeft: spacing.sm },
  title: { ...typography.h1 },
  newSessionBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  newSessionBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText: { ...typography.bodySmall, textAlign: 'center', padding: spacing.xl, color: colors.textLight },
  emptyActivity: { ...typography.bodySmall, textAlign: 'center', padding: spacing.md, color: colors.textLight },
  sessionCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionInfo: { flex: 1 },
  sessionName: { ...typography.body, fontWeight: '600' },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  statusText: { ...typography.caption, fontSize: 12, fontWeight: '500' },
  metaSeparator: { ...typography.caption, marginHorizontal: spacing.xs, color: colors.border },
  editorCount: { ...typography.caption, fontSize: 12 },
  lastActivity: { ...typography.caption, fontSize: 12 },
  expandIcon: { fontSize: 12, color: colors.textLight, marginLeft: spacing.sm },
  presenceRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' },
  presenceItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  presenceDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  presenceInitial: { color: colors.white, fontSize: 11, fontWeight: '700' },
  presenceName: { ...typography.caption, fontSize: 12, fontWeight: '500' },
  expandedSection: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  expandedTitle: { ...typography.bodySmall, fontWeight: '600', marginBottom: spacing.xs },
  editorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  editorDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  editorName: { ...typography.bodySmall, fontWeight: '500' },
  editorStatus: { ...typography.caption, color: colors.success, marginLeft: spacing.xs },
  activityFeed: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  activityItem: { flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6, marginRight: spacing.sm },
  activityContent: { flex: 1 },
  activityText: { ...typography.bodySmall },
  activityUser: { fontWeight: '700', color: colors.text },
  activityTime: { ...typography.caption, marginTop: 2 },
  chatPanel: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxHeight: 350,
    ...shadows.lg,
  },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  chatTitle: { ...typography.body, fontWeight: '600' },
  chatClose: { fontSize: 18, color: colors.textLight, padding: spacing.xs },
  chatList: { maxHeight: 200 },
  chatListContent: { padding: spacing.sm },
  chatBubble: { padding: spacing.sm, borderRadius: borderRadius.md, marginBottom: spacing.xs, maxWidth: '80%' },
  chatBubbleOwn: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  chatBubbleOther: { backgroundColor: colors.background, alignSelf: 'flex-start' },
  chatBubbleUser: { fontSize: 11, fontWeight: '600', color: colors.textLight, marginBottom: 2 },
  chatBubbleText: { fontSize: 14, color: colors.text },
  chatBubbleTime: { fontSize: 10, color: colors.textLight, marginTop: 2, alignSelf: 'flex-end' },
  chatInputRow: { flexDirection: 'row', padding: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  chatInput: { flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.text },
  sendBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, justifyContent: 'center' },
  sendBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  chatFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  chatFabIcon: { fontSize: 24 },
});
