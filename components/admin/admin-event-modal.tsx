'use client';

import { useState } from 'react';
import { X, Calendar, MapPin, Users, DollarSign, Image as ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AdminEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (eventData: any) => void;
  editEvent?: any;
}

export function AdminEventModal({ isOpen, onClose, onSubmit, editEvent }: AdminEventModalProps) {
  const [formData, setFormData] = useState({
    title: editEvent?.title || '',
    description: editEvent?.description || '',
    date: editEvent?.date || '',
    location: editEvent?.location || '',
    city: editEvent?.city || 'Dakar',
    price: editEvent?.price || '',
    total_places: editEvent?.total_places || '100',
    image_url: editEvent?.image_url || '',
  });
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(editEvent?.image_url || '');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      alert('Seuls les fichiers JPEG, JPG et PNG sont autorisés');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('L\'image ne doit pas dépasser 5MB');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `events/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      setImagePreview(publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Erreur lors de l\'upload de l\'image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      price: formData.price ? parseInt(formData.price) : null,
      total_places: parseInt(formData.total_places),
      remaining_places: parseInt(formData.total_places),
    });
    onClose();
    // Reset form
    setFormData({
      title: '',
      description: '',
      date: '',
      location: '',
      city: 'Dakar',
      price: '',
      total_places: '100',
      image_url: '',
    });
    setImagePreview('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-2xl">{editEvent ? 'Modifier l\'événement' : 'Créer un événement'}</h3>
          <button onClick={onClose} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-[#625852] mb-2">Titre *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Titre de l'événement"
              className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#625852] mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description de l'événement"
              rows={3}
              className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-extrabold text-[#625852] mb-2">Date *</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] pl-10 pr-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#625852] mb-2">Lieu *</label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                  placeholder="Lieu de l'événement"
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] pl-10 pr-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#625852] mb-2">Ville</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Ville"
              className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-extrabold text-[#625852] mb-2">Prix (FCFA)</label>
              <div className="relative">
                <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="Laisser vide pour gratuit"
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] pl-10 pr-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#625852] mb-2">Nombre de places *</label>
              <div className="relative">
                <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                <input
                  type="number"
                  value={formData.total_places}
                  onChange={(e) => setFormData({ ...formData, total_places: e.target.value })}
                  required
                  min="1"
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] pl-10 pr-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#625852] mb-2">Image de l'événement</label>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                  id="event-image-upload"
                />
                <label
                  htmlFor="event-image-upload"
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#dfd2c6] bg-[#fbf8f2] px-4 py-6 text-sm cursor-pointer hover:border-[#ec3b78] transition"
                >
                  <Upload size={18} className="text-[#9a8b82]" />
                  <span className="text-[#756960]">
                    {uploading ? 'Upload en cours...' : 'Cliquez pour uploader une image (JPEG, PNG)'}
                  </span>
                </label>
              </div>
              {imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="h-32 w-full rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, image_url: '' });
                      setImagePreview('');
                    }}
                    className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-[#f3e9dc] px-6 py-3 text-sm font-extrabold text-[#756960] transition hover:bg-[#e7cfc0]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 rounded-full bg-[#ec3b78] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:opacity-50"
            >
              {uploading ? 'Upload en cours...' : (editEvent ? 'Modifier' : 'Créer') + ' l\'événement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

