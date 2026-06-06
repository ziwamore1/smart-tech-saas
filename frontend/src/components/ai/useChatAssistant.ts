import { useState, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  intent: string;
}

interface UseChatAssistantOptions {
  timetableId: string;
  apiBaseUrl?: string;
}

export function useChatAssistant(options: UseChatAssistantOptions) {
  const { timetableId, apiBaseUrl = '/api' } = options;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`${apiBaseUrl}/timetable/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          timetableId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response?.explanation || data.message || 'Done!',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setLastResponse(data.response);

      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }

      return data;
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [timetableId, apiBaseUrl]);

  const applySuggestion = useCallback(async (intent: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/timetable/ai/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent,
          timetableId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply suggestion');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response?.explanation || 'Applied successfully!',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setLastResponse(data.response);

      return data;
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Failed to apply suggestion. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [timetableId, apiBaseUrl]);

  const fetchSuggestions = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/timetable/ai/suggestions?timetableId=${timetableId}`);
      
      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      
      return data.suggestions;
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      return [];
    }
  }, [timetableId, apiBaseUrl]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastResponse(null);
  }, []);

  return {
    messages,
    suggestions,
    isLoading,
    lastResponse,
    sendMessage,
    applySuggestion,
    fetchSuggestions,
    clearMessages,
  };
}

export default useChatAssistant;
