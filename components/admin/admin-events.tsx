'use client';

import { useState } from 'react';
import { Calendar, Plus, Edit, Trash2, MapPin, Users, Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { AdminEventModal } from './admin-event-modal';

interface AdminEventsProps {
  events: any[];
  onCreateEvent: (eventData: any) => void;
  onEditEvent: (eventId: string, eventData: any) => void;
  onDeleteEvent: (eventId: string) => void;
  onToggleStatus: (eventId: string, currentStatus: boolean) => void;
}

export function AdminEvents({ events, onCreateEvent, onEditEvent, onDeleteEvent, onToggleStatus }: AdminEventsProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'past'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  const now = new Date();
  const filteredEvents = events.filter((e) => {
    const eventDate = new Date(e.date);
    const matchesStatus = filterStatus === 'all' ||
                        (filterStatus === 'upcoming' && eventDate >= now) ||
                        (filterStatus === 'past' && eventDate < now);
    return matchesStatus;
  });

  const handleCreateEvent = (eventData: any) => {
    onCreateEvent(eventData);
  };

  const handleEditEvent = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setEditingEvent(event);
      setShowModal(true);
    }
  };

  const handleEditSubmit = (eventData: any) => {
    if (editingEvent) {
      onEditEvent(editingEvent.id, eventData);
      setEditingEvent(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Gestion des événements</h2>
          <button
            onClick={() => { setEditingEvent(null); setShowModal(true); }}
            className="flex items-center gap-2 rounded-full bg-[#ec3b78] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#c92e63]"
          >
            <Plus size={16} /> Créer un événement
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'upcoming' | 'past')}
            className="rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
          >
            <option value="all">Tous les événements</option>
            <option value="upcoming">À venir</option>
            <option value="past">Passés</option>
          </select>
        </div>

        {/* Events Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <div key={event.id} className="rounded-[22px] bg-white overflow-hidden shadow-[0_8px_30pxrgba(83,46,32,.05)] transition hover:shadow-[0_12px_40pxrgba(83,46,32,.08)]">
              <div className="relative h-40">
                <img src={event.image_url || 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=1200'} alt={event.title} className="h-full w-full object-cover" />
                <div className="absolute top-3 right-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${new Date(event.date) >= now ? 'bg-[#1a6b68] text-white' : 'bg-[#9a8b82] text-white'}`}>
                    {new Date(event.date) >= now ? 'À venir' : 'Passé'}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg font-semibold">{event.title}</h3>
                <p className="mt-2 text-sm text-[#756960] line-clamp-2">{event.description || 'Pas de description'}</p>
                
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[#756960]">
                    <Calendar size={14} />
                    {new Date(event.date).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#756960]">
                    <MapPin size={14} />
                    {event.location}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#756960]">
                    <Users size={14} />
                    {event.remaining_places || event.total_places} places
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#756960]">
                    <DollarSign size={14} />
                    {event.price ? `${event.price} FCFA` : 'Gratuit'}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleEditEvent(event.id)}
                    className="flex-1 rounded-full bg-[#e5f0ed] px-3 py-2 text-xs font-extrabold text-[#1a6b68] transition hover:bg-[#d0e8e5]"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => onToggleStatus(event.id, event.is_active !== false)}
                    className="flex-1 rounded-full bg-[#e5f0ed] px-3 py-2 text-xs font-extrabold text-[#1a6b68] transition hover:bg-[#d0e8e5]"
                  >
                    {event.is_active !== false ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  </button>
                  <button
                    onClick={() => onDeleteEvent(event.id)}
                    className="flex-1 rounded-full bg-[#fae4e2] px-3 py-2 text-xs font-extrabold text-[#c92e63] transition hover:bg-[#f5d5d5]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="rounded-[26px] bg-white p-12 text-center shadow-[0_8px_30pxrgba(83,46,32,.05)]">
            <Calendar size={48} className="mx-auto text-[#dfd2c6]" />
            <p className="mt-4 text-sm text-[#756960]">Aucun événement pour le moment.</p>
          </div>
        )}
      </div>

      <AdminEventModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingEvent(null); }}
        onSubmit={editingEvent ? handleEditSubmit : handleCreateEvent}
        editEvent={editingEvent}
      />
    </>
  );
}

