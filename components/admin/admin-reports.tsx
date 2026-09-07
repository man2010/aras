'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Filter, Clock, User } from 'lucide-react';

interface AdminReportsProps {
  reports: any[];
  profiles: Record<string, any>;
  onResolveReport: (reportId: string) => void;
  onDismissReport: (reportId: string) => void;
}

export function AdminReports({ reports, profiles, onResolveReport, onDismissReport }: AdminReportsProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredReports = reports.filter((r) => {
    const matchesStatus = filterStatus === 'all' ||
                        (filterStatus === 'pending' && !r.resolved) ||
                        (filterStatus === 'resolved' && r.resolved);
    const matchesType = filterType === 'all' || r.type === filterType;
    return matchesStatus && matchesType;
  });

  const reportTypes = Array.from(new Set(reports.map((r) => r.type).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
        <div className="flex flex-wrap gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'resolved')}
            className="rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="resolved">Résolus</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
          >
            <option value="all">Tous les types</option>
            {reportTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reports List */}
      <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">Signalements</h2>
          <p className="text-sm text-[#756960]">{filteredReports.length} signalement(s)</p>
        </div>

        {filteredReports.length === 0 ? (
          <div className="py-12 text-center">
            <AlertTriangle size={48} className="mx-auto text-[#dfd2c6]" />
            <p className="mt-4 text-sm text-[#756960]">Aucun signalement pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const reporter = profiles[report.reporter_id];
              const reported = profiles[report.reported_id];
              
              return (
                <div key={report.id} className={`rounded-xl border p-4 ${report.resolved ? 'border-[#1a6b68] bg-[#e5f0ed]' : 'border-[#fae4e2] bg-white'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="rounded-full bg-[#fae4e2] px-3 py-1 text-xs font-extrabold text-[#c92e63]">
                          {report.type || 'Autre'}
                        </span>
                        {report.resolved && (
                          <span className="flex items-center gap-1 text-xs font-bold text-[#1a6b68]">
                            <CheckCircle size={14} /> Résolu
                          </span>
                        )}
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2 mt-4">
                        <div>
                          <p className="text-xs font-extrabold uppercase text-[#625852] mb-1">Signaleur</p>
                          {reporter ? (
                            <div className="flex items-center gap-2">
                              <img src={reporter.avatar_urls?.[0]} alt="" className="h-8 w-8 rounded-full object-cover" />
                              <div>
                                <p className="text-sm font-bold text-[#241c18]">{reporter.full_name}</p>
                                <p className="text-xs text-[#9a8b82]">{reporter.city}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-[#9a8b82]">Utilisateur inconnu</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-extrabold uppercase text-[#625852] mb-1">Signalé</p>
                          {reported ? (
                            <div className="flex items-center gap-2">
                              <img src={reported.avatar_urls?.[0]} alt="" className="h-8 w-8 rounded-full object-cover" />
                              <div>
                                <p className="text-sm font-bold text-[#241c18]">{reported.full_name}</p>
                                <p className="text-xs text-[#9a8b82]">{reported.city}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-[#9a8b82]">Utilisateur inconnu</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs font-extrabold uppercase text-[#625852] mb-1">Raison</p>
                        <p className="text-sm text-[#756960]">{report.reason || 'Raison non spécifiée'}</p>
                      </div>

                      {report.description && (
                        <div className="mt-4">
                          <p className="text-xs font-extrabold uppercase text-[#625852] mb-1">Description</p>
                          <p className="text-sm text-[#756960]">{report.description}</p>
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-2 text-xs text-[#9a8b82]">
                        <Clock size={12} />
                        {new Date(report.created_at).toLocaleString('fr-FR')}
                      </div>
                    </div>

                    {!report.resolved && (
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => onResolveReport(report.id)}
                          className="rounded-full bg-[#e5f0ed] px-3 py-1.5 text-xs font-extrabold text-[#1a6b68] transition hover:bg-[#d0e8e5]"
                        >
                          <CheckCircle size={14} />
                        </button>
                        <button
                          onClick={() => onDismissReport(report.id)}
                          className="rounded-full bg-[#fae4e2] px-3 py-1.5 text-xs font-extrabold text-[#c92e63] transition hover:bg-[#f5d5d5]"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

