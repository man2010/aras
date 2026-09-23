'use client';

import { useState } from 'react';
import { Calendar, Plus, Edit, Trash2, MapPin, Users, DollarSign, CheckCircle, XCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminEventModal } from './admin-event-modal';

interface AdminEventsProps {
  events: any[];
  participants: Record<string, any[]>;
  loadError?: string;
  onCreateEvent: (eventData: any) => void;
  onEditEvent: (eventId: string, eventData: any) => void;
  onDeleteEvent: (eventId: string) => void;
  onToggleStatus: (eventId: string, currentStatus: boolean) => void;
}

export function AdminEvents({ events, participants, loadError, onCreateEvent, onEditEvent, onDeleteEvent, onToggleStatus }: AdminEventsProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'past'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [participantsEventId, setParticipantsEventId] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [eventPage, setEventPage] = useState(1);
  const [participantPage, setParticipantPage] = useState(1);

  const now = new Date();
  const filtered = events.filter((e) => {
    const eventDate = new Date(e.date);
    const matchesStatus = filterStatus === 'all' ||
                        (filterStatus === 'upcoming' && eventDate >= now) ||
                        (filterStatus === 'past' && eventDate < now);
    return matchesStatus;
  });
  const pageSize = 3;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const filteredEvents = filtered.slice((eventPage - 1) * pageSize, eventPage * pageSize);
  const selectedEvent = events.find((event) => event.id === participantsEventId);
  const eventParticipants = participantsEventId ? participants[participantsEventId] ?? [] : [];
  const participantPageSize = 10;
  const participantPageCount = Math.max(1, Math.ceil(eventParticipants.length / participantPageSize));
  const pageParticipants = eventParticipants.slice((participantPage - 1) * participantPageSize, participantPage * participantPageSize);

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
      eventData.remaining_places = Math.max(0, Number(eventData.total_places) - (participants[editingEvent.id]?.length ?? 0));
      onEditEvent(editingEvent.id, eventData);
      setEditingEvent(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {loadError && <p role="status" className="rounded-2xl border border-[#f4d7a5] bg-[#fff8e9] px-4 py-3 text-sm font-semibold text-[#8c5d12]">{loadError}</p>}
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
            onChange={(e) => { setFilterStatus(e.target.value as 'all' | 'upcoming' | 'past'); setEventPage(1); }}
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
                    {event.remaining_places ?? event.total_places} places restantes
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#756960]">
                    <DollarSign size={14} />
                    {event.price ? `${event.price} FCFA` : 'Gratuit'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#756960]">
                    <Users size={14} /> {participants[event.id]?.length ?? 0} participant(s) · {participants[event.id]?.filter((entry) => entry.status === 'confirmed').length ?? 0} confirmé(s)
                  </div>
                </div>

                <button type="button" onClick={() => { setParticipantsEventId(event.id); setParticipantPage(1); }} className="mt-4 w-full rounded-xl border border-[#dfd2c6] px-4 py-2.5 text-sm font-bold text-[#1a6b68] transition hover:bg-[#e5f0ed]">
                  Voir les inscrits ({participants[event.id]?.length ?? 0})
                </button>

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

        {filtered.length === 0 && (
          <div className="rounded-[26px] bg-white p-12 text-center shadow-[0_8px_30pxrgba(83,46,32,.05)]">
            <Calendar size={48} className="mx-auto text-[#dfd2c6]" />
            <p className="mt-4 text-sm text-[#756960]">Aucun événement pour le moment.</p>
          </div>
        )}
        {pageCount > 1 && <div className="mt-5 flex items-center justify-between rounded-[20px] bg-white px-4 py-3"><p className="text-xs font-semibold text-[#756960]">Page {eventPage} sur {pageCount} · {filtered.length} événement(s)</p><div className="flex gap-2"><button type="button" disabled={eventPage === 1} onClick={() => setEventPage((page) => Math.max(1, page - 1))} className="rounded-full bg-[#f3e9dc] px-4 py-2 text-xs font-bold disabled:opacity-50">Précédent</button><button type="button" disabled={eventPage === pageCount} onClick={() => setEventPage((page) => Math.min(pageCount, page + 1))} className="rounded-full bg-[#ec3b78] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Suivant</button></div></div>}
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`Participants à ${selectedEvent.title}`}>
          <section className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,.3)]">
            <header className="flex items-center justify-between gap-4 border-b border-[#f3e9dc] p-5 sm:p-6"><div><p className="text-xs font-extrabold uppercase tracking-widest text-[#ec3b78]">Inscriptions à l’événement</p><h2 className="mt-1 font-display text-2xl">{selectedEvent.title}</h2><p className="mt-1 text-sm text-[#756960]">{eventParticipants.length} participant(s) · page {participantPage} sur {participantPageCount}</p></div><button type="button" onClick={() => setParticipantsEventId(null)} aria-label="Fermer" className="rounded-full bg-[#f3e9dc] p-2"><X size={18} /></button></header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {eventParticipants.length === 0 ? <p className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-sm text-[#756960]">Aucune inscription enregistrée.</p> : <div className="space-y-2">{pageParticipants.map((entry) => (
                <button key={`${selectedEvent.id}-${entry.user_id}`} type="button" onClick={() => entry.profile && setSelectedParticipant(entry.profile)} disabled={!entry.profile} className="flex w-full items-center gap-3 rounded-2xl border border-[#f0e6dc] p-3 text-left transition hover:bg-[#fbf8f2] disabled:opacity-60 sm:gap-4 sm:p-4">
                  <img src={entry.profile?.photo_url || '/images/default-avatar.png'} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#241c18]">{entry.profile?.display_name || 'Profil indisponible'}</span><span className="block truncate text-xs text-[#756960]">{entry.profile ? `${entry.profile.age} ans · ${entry.profile.city}` : 'Utilisateur sans profil relié'}</span></span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${entry.status === 'confirmed' ? 'bg-[#e5f0ed] text-[#1a6b68]' : 'bg-[#fff3d9] text-[#8c5d12]'}`}>{entry.status === 'confirmed' ? 'Confirmé' : entry.status === 'payment_pending' ? 'En attente paiement' : entry.status}</span>
                </button>
              ))}</div>}
            </div>
            {participantPageCount > 1 && <footer className="flex items-center justify-between border-t border-[#f3e9dc] p-4"><button type="button" disabled={participantPage === 1} onClick={() => setParticipantPage((page) => Math.max(1, page - 1))} className="inline-flex items-center gap-1 rounded-full bg-[#f3e9dc] px-4 py-2 text-sm font-bold disabled:opacity-40"><ChevronLeft size={16} /> Précédent</button><span className="text-xs text-[#756960]">{(participantPage - 1) * participantPageSize + 1}–{Math.min(participantPage * participantPageSize, eventParticipants.length)} sur {eventParticipants.length}</span><button type="button" disabled={participantPage === participantPageCount} onClick={() => setParticipantPage((page) => Math.min(participantPageCount, page + 1))} className="inline-flex items-center gap-1 rounded-full bg-[#ec3b78] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Suivant <ChevronRight size={16} /></button></footer>}
          </section>
        </div>
      )}

      <AdminEventModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingEvent(null); }}
        onSubmit={editingEvent ? handleEditSubmit : handleCreateEvent}
        editEvent={editingEvent}
      />
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`Profil de ${selectedParticipant.display_name}`}>
          <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,.3)]">
            <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-4"><img src={selectedParticipant.photo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" /><div><h2 className="font-display text-2xl">{selectedParticipant.display_name}</h2><p className="text-sm text-[#756960]">{selectedParticipant.age} ans · {selectedParticipant.city}</p></div></div><button onClick={() => setSelectedParticipant(null)} aria-label="Fermer" className="rounded-full bg-[#f3e9dc] p-2"><X size={18} /></button></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[#fbf8f2] p-4"><p className="text-[11px] font-extrabold uppercase text-[#9a8b82]">Profession</p><p className="mt-1 text-sm font-semibold">{selectedParticipant.profession || 'Non renseignée'}</p></div><div className="rounded-2xl bg-[#fbf8f2] p-4"><p className="text-[11px] font-extrabold uppercase text-[#9a8b82]">Zone</p><p className="mt-1 text-sm font-semibold">{selectedParticipant.zone || selectedParticipant.city || 'Non renseignée'}</p></div><div className="rounded-2xl bg-[#fbf8f2] p-4"><p className="text-[11px] font-extrabold uppercase text-[#9a8b82]">Genre</p><p className="mt-1 text-sm font-semibold">{selectedParticipant.gender || 'Non renseigné'}</p></div><div className="rounded-2xl bg-[#fbf8f2] p-4"><p className="text-[11px] font-extrabold uppercase text-[#9a8b82]">Statut</p><p className="mt-1 text-sm font-semibold">{selectedParticipant.is_verified ? 'Vérifié' : 'Non vérifié'}{selectedParticipant.is_premium ? ' · Premium' : ''}</p></div></div>
            <div className="mt-3 rounded-2xl bg-[#fbf8f2] p-4"><p className="text-[11px] font-extrabold uppercase text-[#9a8b82]">À propos</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{selectedParticipant.bio || 'Aucune biographie renseignée.'}</p></div>
            {selectedParticipant.interests?.length > 0 && <div className="mt-3 rounded-2xl bg-[#fbf8f2] p-4"><p className="text-[11px] font-extrabold uppercase text-[#9a8b82]">Centres d’intérêt</p><p className="mt-1 text-sm">{selectedParticipant.interests.join(' · ')}</p></div>}
            {selectedParticipant.avatar_urls?.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2">{selectedParticipant.avatar_urls.filter(Boolean).map((url: string, index: number) => <img key={`${url}-${index}`} src={url} alt={`Photo ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" />)}</div>}
          </section>
        </div>

      )}
    </>
  );
}

