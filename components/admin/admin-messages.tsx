'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Search, Filter, Eye, Trash2, Download } from 'lucide-react';

interface AdminMessagesProps {
  messages: any[];
  profiles: Record<string, any>;
  totalMessages: number;
  readMessages: number;
  conversationCount: number;
  currentPage: number;
  totalPages: number;
  conversations: string[];
  onPageChange: (page: number) => void;
  onFiltersChange: (search: string, conversationId: string) => void;
  onDeleteMessage: (messageId: string) => void;
}

export function AdminMessages({ messages, profiles, totalMessages, readMessages, conversationCount, currentPage, totalPages, conversations, onPageChange, onFiltersChange, onDeleteMessage }: AdminMessagesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterConversation, setFilterConversation] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => onFiltersChange(searchTerm, filterConversation), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm, filterConversation, onFiltersChange]);

  const handleExport = () => {
    const csv = [
      ['ID', 'Expéditeur', 'Conversation', 'Contenu', 'Lu', 'Date'].join(','),
      ...messages.map(m => [
        String(m.id ?? '').slice(0, 8),
        profiles[m.sender_id]?.full_name || 'Inconnu',
        String(m.match_id ?? 'sans-conversation').slice(0, 8),
        `"${String(m.content ?? '').replace(/"/g, '""')}"`,
        m.is_read ? 'Oui' : 'Non',
        new Date(m.created_at).toLocaleString('fr-FR'),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'messages_aras.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
              <input
                type="text"
                placeholder="Rechercher dans les messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
              />
            </div>
          </div>
          <select
            value={filterConversation}
            onChange={(e) => setFilterConversation(e.target.value)}
            className="rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
          >
            <option value="">Toutes les conversations</option>
          {conversations.map((convId) => (
              <option key={convId} value={convId}>Conversation {convId.slice(0, 8)}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-full bg-[#1a6b68] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#125552]"
          >
            <Download size={14} /> Exporter la page
          </button>
        </div>
      </div>

      {/* Messages Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
          <MessageSquare size={20} className="text-[#ec3b78]" />
          <p className="mt-2 font-display text-2xl font-semibold">{totalMessages}</p>
          <p className="text-xs font-bold uppercase text-[#9a8b82]">Total messages</p>
        </div>
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
          <Eye size={20} className="text-[#1a6b68]" />
          <p className="mt-2 font-display text-2xl font-semibold">{readMessages}</p>
          <p className="text-xs font-bold uppercase text-[#9a8b82]">Messages lus</p>
        </div>
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
          <MessageSquare size={20} className="text-[#d89b52]" />
          <p className="mt-2 font-display text-2xl font-semibold">{conversationCount}</p>
          <p className="text-xs font-bold uppercase text-[#9a8b82]">Conversations</p>
        </div>
      </div>

      {/* Messages List */}
      <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">Messages</h2>
          <p className="text-sm text-[#756960]">{totalMessages} message(s) correspondant aux filtres</p>
        </div>

        {messages.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare size={48} className="mx-auto text-[#dfd2c6]" />
            <p className="mt-4 text-sm text-[#756960]">Aucun message pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {messages.map((message) => {
              const sender = profiles[message.sender_id];
              return (
                <div key={message.id} className="rounded-xl border border-[#f3e9dc] p-4 transition hover:bg-[#f8f9fd]">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {sender && (
                          <img src={sender.avatar_urls?.[0]} alt="" className="h-8 w-8 rounded-full object-cover" />
                        )}
                        <div>
                          <p className="text-sm font-bold text-[#241c18]">
                            {sender?.full_name || 'Utilisateur inconnu'}
                          </p>
                          <p className="text-xs text-[#9a8b82]">
                            Conversation {typeof message.match_id === 'string' ? message.match_id.slice(0, 8) : 'sans identifiant'}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-[#756960]">{message.content || 'Message vide'}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-[#9a8b82]">
                        <span>{new Date(message.created_at).toLocaleString('fr-FR')}</span>
                        {message.is_read && (
                          <span className="flex items-center gap-1 text-[#1a6b68]">
                            <Eye size={12} /> Lu
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteMessage(message.id)}
                      className="ml-4 rounded-full bg-[#fae4e2] p-2 text-[#c92e63] transition hover:bg-[#f5d5d5]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {totalMessages > 0 && (
          <div className="mt-5 flex items-center justify-between border-t border-[#f3e9dc] pt-4">
            <p className="text-sm text-[#756960]">Page {currentPage} sur {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-[#dfd2c6] px-4 py-2 text-sm font-semibold text-[#756960] disabled:cursor-not-allowed disabled:opacity-40"
              >Précédent</button>
              <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-full border border-[#dfd2c6] px-4 py-2 text-sm font-semibold text-[#756960] disabled:cursor-not-allowed disabled:opacity-40"
              >Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

