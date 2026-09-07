'use client';

import { Users, ShieldCheck, MessageCircle, Calendar, AlertTriangle, Heart, TrendingUp, Clock, Eye } from 'lucide-react';

interface AdminDashboardProps {
  stats: {
    users: number;
    profiles: number;
    conversations: number;
    events: number;
    reports: number;
    likes: number;
    matches: number;
    messages: number;
    views: number;
  };
  recentActivity: any[];
}

export function AdminDashboard({ stats, recentActivity }: AdminDashboardProps) {
  const statCards = [
    { label: 'Utilisateurs', value: stats.users, icon: Users, color: '#ec3b78', change: '+12%' },
    { label: 'Profils vérifiés', value: stats.profiles, icon: ShieldCheck, color: '#1a6b68', change: '+8%' },
    { label: 'Conversations', value: stats.conversations, icon: MessageCircle, color: '#d89b52', change: '+15%' },
    { label: 'Matches', value: stats.matches, icon: Heart, color: '#ec3b78', change: '+20%' },
    { label: 'Événements', value: stats.events, icon: Calendar, color: '#1a6b68', change: '+5%' },
    { label: 'Signalements', value: stats.reports, icon: AlertTriangle, color: '#c92e63', change: '-3%' },
    { label: 'Likes', value: stats.likes, icon: Heart, color: '#ec3b78', change: '+25%' },
    { label: 'Messages', value: stats.messages, icon: MessageCircle, color: '#1a6b68', change: '+18%' },
    { label: 'Vues profils', value: stats.views, icon: Eye, color: '#ec3b78', change: '+22%' },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <div key={stat.label} className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(83,46,32,.05)] transition hover:shadow-[0_12px_40px_rgba(83,46,32,.08)]">
            <div className="flex items-center justify-between">
              <stat.icon size={20} className="text-[#756960]" style={{ color: stat.color }} />
              <span className={`text-xs font-extrabold ${stat.change.startsWith('+') ? 'text-[#1a6b68]' : 'text-[#c92e63]'}`}>
                {stat.change}
              </span>
            </div>
            <p className="mt-4 font-display text-3xl font-semibold">{stat.value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#9a8b82]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
        <h2 className="mb-4 font-display text-2xl">Activité récente</h2>
        {recentActivity.length === 0 ? (
          <div className="py-8 text-center">
            <Clock size={40} className="mx-auto text-[#dfd2c6]" />
            <p className="mt-4 text-sm text-[#756960]">Aucune activité récente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.slice(0, 10).map((activity, index) => (
              <div key={index} className="flex items-center gap-4 rounded-xl border border-[#f3e9dc] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fae4e2]">
                  <TrendingUp size={18} className="text-[#ec3b78]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#241c18]">{activity.type}</p>
                  <p className="text-xs text-[#9a8b82]">{activity.description}</p>
                </div>
                <p className="text-xs text-[#756960]">{new Date(activity.created_at).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

