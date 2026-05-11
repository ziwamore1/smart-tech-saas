import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components';
import { colors, spacing } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';

interface Message {
  role: 'user' | 'tutor';
  content: string;
}

export const AiTutorScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'tutor', content: "Hi! I'm your AI tutor. Ask me anything about your studies!" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    if (!input.trim() || !user?.id || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const res = await apiService.askTutor(user.id, question);
      const data = res?.data || res;
      const reply = data?.response || data?.answer || data?.message || "I'll help you with that!";
      setMessages(prev => [...prev, { role: 'tutor', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'tutor', content: "I'm having trouble connecting. Please try again." }]);
    }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Tutor</Text>
        <Text style={styles.headerSub}>Ask anything about your studies</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((msg, i) => (
            <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.tutorBubble]}>
              <Text style={[styles.bubbleText, msg.role === 'user' && { color: colors.white }]}>{msg.content}</Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.bubble, styles.tutorBubble]}>
              <Text style={{ color: colors.textLight }}>Thinking...</Text>
            </View>
          )}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question..."
            placeholderTextColor={colors.textLight}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={!input.trim() || loading}>
            <Text style={[styles.sendText, (!input.trim() || loading) && { opacity: 0.5 }]}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  chatContent: { padding: spacing.md, paddingBottom: spacing.lg },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: 16, marginBottom: spacing.sm },
  userBubble: { backgroundColor: colors.secondary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  tutorBubble: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  inputRow: { flexDirection: 'row', padding: spacing.sm, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.text },
  sendButton: { justifyContent: 'center', paddingHorizontal: spacing.md },
  sendText: { color: colors.secondary, fontWeight: '700', fontSize: 16 },
});
