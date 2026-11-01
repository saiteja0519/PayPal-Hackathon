import React, { useState, useEffect, useRef } from 'react';
import { aiAPI } from '../services/api';
import { Card } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import {
  Bot,
  Send,
  Sparkles,
  ShieldCheck,
  Cpu,
  Loader2,
  Receipt,
  User,
  Wrench,
  Info,
} from 'lucide-react';

interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools_executed?: string[];
}

export const AIAssistantPage: React.FC = () => {
  const { business } = useAuth();
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am your **PayPilot AI Financial Advisor**. I have secure, read-only access to your business database and financial ledgers.\n\nYou can ask me to summarize cash flow, list overdue accounts, find upcoming due dates, check specific customer balances, or prepare email payment reminders.\n\nHow can I assist your business today?`,
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [providerInfo, setProviderInfo] = useState<string>('Deterministic Financial Engine');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageToSend?: string) => {
    const text = messageToSend || input.trim();
    if (!text || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatItem = { id: userMsgId, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiAPI.chat({
        message: text,
        conversation_id: conversationId,
      });

      setConversationId(res.data.conversation_id);
      if (res.data.provider) {
        setProviderInfo(
          res.data.provider === 'deterministic'
            ? 'Deterministic Financial Engine (Audited DB Calculations)'
            : `LLM Tool Orchestrator (${res.data.provider})`
        );
      }

      const assistantMsg: ChatItem = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.data.reply,
        tools_executed: res.data.tools_executed,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an issue executing your financial request. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    'Show me all overdue invoices',
    'Summarize my outstanding payments and cash flow',
    'Show invoices due in the next seven days',
    'Which customers owe more than $2,000?',
    'Draft a payment reminder for my overdue invoice',
  ];

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-4">
      {/* Header & Security Capsule */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <span>PayPilot AI Financial Assistant</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic, audited database calculations combined with natural language workflows.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50/80 border border-indigo-200/80 text-indigo-800 text-xs">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-medium text-[11px]">{providerInfo}</span>
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Messages Feed */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div key={m.id} className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[80%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Tool Call Chips */}
                  {m.tools_executed && m.tools_executed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {m.tools_executed.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-mono border border-slate-200"
                        >
                          <Wrench className="w-3 h-3 text-indigo-500" />
                          <span>tool: {t}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-none'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                    U
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Querying financial ledger & executing tools...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold uppercase text-slate-400 shrink-0">Try:</span>
          {samplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-[11px] text-slate-600 font-medium whitespace-nowrap shadow-xs transition-colors shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask about overdue balances, invoices, or drafting customer reminders..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm text-slate-900 bg-white"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
