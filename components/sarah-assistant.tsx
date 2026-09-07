'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { X, SendHorizonal } from 'lucide-react';

type ChatItem = {
  role: 'user' | 'assistant';
  content: string;
};

export function SarahAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatItem[]>([
    { role: 'assistant', content: 'Bonjour, je suis Sarah. Je peux vous aider sur ARAS, les profils, les messages, les tarifs ou l’inscription.' },
  ]);

  const history = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages]
  );

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/sarah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: history.slice(-6),
        }),
      });

      const data = (await response.json()) as { answer?: string; error?: string; warning?: string };

      if (!response.ok) {
        setError(data.error || 'Sarah rencontre un souci temporaire.');
        return;
      }

      if (data.warning) {
        setError(data.warning);
      } else {
        setError('');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer || 'Je vous écoute.' }]);
    } catch {
      setError('Impossible de joindre Sarah pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-extrabold text-white shadow-2xl shadow-black/20"
      >
        <span className="relative h-5 w-5 overflow-hidden rounded-full bg-white/20">
          <Image src="/aras-logo.jpeg" alt="ARAS" fill className="object-cover" />
        </span>
        Sarah
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-4 sm:items-end sm:justify-end">
          <div className="flex h-[78vh] w-full max-w-[380px] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#f1e6da] px-5 py-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">ARAS Assistant</p>
                <h3 className="mt-1 font-display text-2xl text-[#24171b]">Sarah</h3>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full bg-[#f6efe6] p-2 text-[#756960]">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'assistant'
                      ? 'bg-[#fbf8f2] text-[#4f4138]'
                      : 'ml-auto bg-[#1a6b68] text-white'
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {loading && (
                <div className="max-w-[85%] rounded-3xl bg-[#fbf8f2] px-4 py-3 text-sm text-[#756960]">
                  Sarah réfléchit…
                </div>
              )}
              {error && (
                <div className="rounded-2xl bg-[#fbe8ec] px-4 py-3 text-sm font-bold text-[#b32d58]">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-[#f1e6da] p-4">
              <div className="flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={2}
                  placeholder="Écrivez votre message..."
                  className="min-h-[54px] flex-1 resize-none rounded-[20px] border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#1a6b68]"
                />
                <button
                  onClick={() => void sendMessage()}
                  className="flex h-[54px] w-[54px] items-center justify-center rounded-[18px] bg-[#ec3b78] text-white"
                >
                  <SendHorizonal size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
