'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { galleryApi } from '@/lib/api';

interface GalleryEvent {
  id: string;
  title: string;
  description?: string;
  eventDate?: string;
  photos?: { id: string; url: string; caption?: string }[];
  createdAt: string;
}

export default function GalleryPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [events, setEvents] = useState<GalleryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<GalleryEvent | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadEvents();
    }
  }, [isAuthenticated]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await galleryApi.getAll();
      setEvents(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newEvent.title.trim()) return;
    
    try {
      const response = await galleryApi.create(newEvent);
      setEvents([response.data, ...events]);
      setShowAddModal(false);
      setNewEvent({ title: '', description: '', eventDate: new Date().toISOString().split('T')[0] });
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event? All photos will be removed.')) return;
    
    try {
      await galleryApi.delete(id);
      setEvents(events.filter(e => e.id !== id));
      if (selectedEvent?.id === id) {
        setSelectedEvent(null);
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const handlePhotoUpload = async (eventId: string, files: FileList) => {
    try {
      setUploading(true);
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('photo', file);
        await galleryApi.uploadPhoto(eventId, formData);
      }
      await loadEvents();
    } catch (error) {
      console.error('Failed to upload photos:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (eventId: string, photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    try {
      await galleryApi.deletePhoto(eventId, photoId);
      await loadEvents();
    } catch (error) {
      console.error('Failed to delete photo:', error);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-6">
      <style>{`
        .event-card { transition: all 0.3s ease; }
        .event-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
      `}</style>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <i className="fa fa-images text-white"></i>
            </div>
            Photo Gallery
          </h1>
          <p className="text-gray-500 mt-1 ml-13">Capture and share school events and memorable moments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
        >
          <i className="fa fa-plus"></i> New Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <i className="fa fa-calendar text-purple-500"></i>
            Events
          </h2>
          
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
                <p className="text-gray-500 mb-4">No events yet. Create your first event!</p>
              </div>
            ) : (
              events.map(event => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`event-card p-4 rounded-xl cursor-pointer border-2 transition-all ${
                    selectedEvent?.id === event.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-100 bg-white hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{event.title}</h3>
                      {event.eventDate && (
                        <p className="text-sm text-gray-500">
                          <i className="fa fa-calendar-alt mr-1"></i>
                          {new Date(event.eventDate).toLocaleDateString()}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {event.photos?.length || 0} photos
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <i className="fa fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedEvent ? (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-md border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedEvent.title}</h2>
                    {selectedEvent.description && (
                      <p className="text-gray-500 mt-1">{selectedEvent.description}</p>
                    )}
                  </div>
                  <label className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg cursor-pointer hover:from-green-600 hover:to-green-700 font-medium">
                    <i className="fa fa-upload mr-2"></i>
                    {uploading ? 'Uploading...' : 'Add Photos'}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files && handlePhotoUpload(selectedEvent.id, e.target.files)}
                      disabled={uploading}
                    />
                  </label>
                </div>

                {selectedEvent.photos && selectedEvent.photos.length > 0 ? (
                  <div className="photo-grid">
                    {selectedEvent.photos.map(photo => (
                      <div key={photo.id} className="relative group">
                        <div 
                          onClick={() => setViewingPhoto(photo.url)}
                          className="aspect-square rounded-xl overflow-hidden cursor-pointer"
                        >
                          <img 
                            src={photo.url} 
                            alt={photo.caption || selectedEvent.title}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          />
                        </div>
                        <button
                          onClick={() => handleDeletePhoto(selectedEvent.id, photo.id)}
                          className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <i className="fa fa-trash text-xs"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <i className="fa fa-image text-gray-400 text-2xl"></i>
                    </div>
                    <p className="text-gray-500">No photos yet</p>
                    <p className="text-sm text-gray-400">Click "Add Photos" to upload</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-md border p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="fa fa-images text-gray-400 text-3xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select an Event</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Choose an event from the list to view its photos, or create a new event to start capturing memories.
              </p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create New Event</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fa fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Sports Day 2024"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Date</label>
                <input
                  type="date"
                  value={newEvent.eventDate}
                  onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newEvent.title.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 font-semibold disabled:opacity-50"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <button 
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30"
            onClick={() => setViewingPhoto(null)}
          >
            <i className="fa fa-times text-xl"></i>
          </button>
          <img 
            src={viewingPhoto} 
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}