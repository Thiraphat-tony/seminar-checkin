'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabaseBrowser';
import './chat.css';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayContent: string;
  formData?: Record<string, string>;
};

export default function ChatClient() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthed && !isInitialized) {
      initializeChat();
      setIsInitialized(true);
    }
  }, [isAuthed, isInitialized]);

  const checkAuth = async () => {
    try {
      const supabase = getBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setIsAuthed(true);
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/login');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = async () => {
    try {
      const settingsRes = await fetch('/api/event-settings');
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setAiEnabled(settings.aiAssistantEnabled !== false);
        if (!settings.aiAssistantEnabled) {
          setMessages([
            {
              id: '0',
              role: 'assistant',
              content: 'ขออภัยครับ AI Form Assistant ปิดการใช้งานอยู่ในขณะนี้',
              displayContent: 'ขออภัยครับ AI Form Assistant ปิดการใช้งานอยู่ในขณะนี้',
            },
          ]);
          return;
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'สวัสดีครับ ผมอยากลงทะเบียนสัมมนาครับ' }],
        }),
      });

      if (!response.ok) throw new Error('Failed to initialize chat');

      const text = await response.text();
      const messageContent = extractMessage(text);
      const { assistantMessage, formData } = parseResponse(messageContent);

      setMessages([
        {
          id: '0',
          role: 'assistant',
          content: assistantMessage,
          displayContent: assistantMessage,
          formData,
        },
      ]);
    } catch (error) {
      console.error('Chat initialization error:', error);
      setMessages([
        {
          id: '0',
          role: 'assistant',
          content: 'ขอโทษครับ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
          displayContent: 'ขอโทษครับ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
        },
      ]);
    }
  };

  const parseResponse = (text: string) => {
    const formdataMatch = text.match(/\[FORMDATA:(.*?)\]/);
    let formData = undefined;

    if (formdataMatch) {
      try {
        formData = JSON.parse(formdataMatch[1]);
      } catch (e) {
        console.error('Failed to parse formdata:', e);
      }
    }

    const displayContent = text
      .replace(/\[FORMDATA:.*?\]/g, '')
      .replace(/\n\s*\n/g, '\n')
      .replace(/\n+$/, '')
      .trim();

    return { assistantMessage: displayContent, formData };
  };

  const extractMessage = (apiResponse: string) => {
    try {
      const parsed = JSON.parse(apiResponse);
      let message = parsed.message || '';

      // Handle double-encoded JSON from AI
      if (typeof message === 'string' && message.startsWith('{')) {
        try {
          const doubleParsed = JSON.parse(message);
          message = doubleParsed.message || message;
        } catch (e) {
          // Not double-encoded, use original
        }
      }

      return message;
    } catch (e) {
      console.error('Failed to parse API response:', e);
      return apiResponse;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      displayContent: userMessage,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.concat(userMsg).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const text = await response.text();
      const messageContent = extractMessage(text);
      const { assistantMessage, formData } = parseResponse(messageContent);

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantMessage,
        displayContent: assistantMessage,
        formData,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'ขอโทษครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        displayContent: 'ขอโทษครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (isAuthed === null) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h1>🧠 AI Form Assistant</h1>
          <p>ลงทะเบียนสัมมนาผู้พิพากษาสมทบ</p>
        </div>
        <div className="chat-messages" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p>กำลังตรวจสอบสิทธิ์...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>🧠 AI Form Assistant</h1>
        <p>ลงทะเบียนสัมมนาผู้พิพากษาสมทบ</p>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message--${msg.role}`}>
            {msg.role === 'assistant' && <span className="chat-icon">🤖</span>}
            {msg.role === 'user' && <span className="chat-icon">👤</span>}
            <div className="chat-bubble">{msg.displayContent}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-message chat-message--assistant">
            <span className="chat-icon">🤖</span>
            <div className="chat-bubble chat-bubble--loading">
              <span className="loading-dot"></span>
              <span className="loading-dot"></span>
              <span className="loading-dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          className="chat-input"
          placeholder={aiEnabled ? 'พิมพ์ข้อความของคุณ...' : 'AI Assistant ปิดการใช้งานอยู่'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || !aiEnabled}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={loading || !input.trim() || !aiEnabled}
        >
          {loading ? '⏳' : '📤'}
        </button>
      </form>
    </div>
  );
}
