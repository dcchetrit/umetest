'use client';

import { useState, useEffect } from 'react';
import { FirestoreService } from '@ume/shared';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';

export default function Dashboard() {
  const { user } = useAuth();
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [stats, setStats] = useState({
    totalGuests: 0,
    rsvpAccepted: 0,
    rsvpPending: 0,
    rsvpDeclined: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalBudget: 0,
    spentBudget: 0
  });
  const [loading, setLoading] = useState(true);

  if (!user) {
    return <div>Please log in to view your dashboard</div>;
  }
  
  const coupleId = user.uid;

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load guests and calculate RSVP stats
      const guests = await FirestoreService.getGuests(coupleId);
      const rsvpStats = guests.reduce((acc, guest) => {
        acc[guest.rsvp.status] = (acc[guest.rsvp.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Load tasks
      const tasks = await FirestoreService.getTasks(coupleId);
      const completedTasks = tasks.filter(task => task.status === 'completed').length;

      // Load budget items
      const budgetItems = await FirestoreService.getBudgetItems(coupleId);
      const budgetStats = budgetItems.reduce((acc, item) => {
        acc.total += item.plannedAmount;
        acc.spent += item.actualAmount || 0;
        return acc;
      }, { total: 0, spent: 0 });

      setStats({
        totalGuests: guests.length,
        rsvpAccepted: rsvpStats.accepted || 0,
        rsvpPending: rsvpStats.pending || 0,
        rsvpDeclined: rsvpStats.declined || 0,
        totalTasks: tasks.length,
        completedTasks,
        totalBudget: budgetStats.total,
        spentBudget: budgetStats.spent
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const StatCard = ({ title, value, subtitle, color }: { 
    title: string; 
    value: string | number; 
    subtitle?: string; 
    color: string;
  }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title={t('stats.total_guests')}
            value={stats.totalGuests}
            color="text-blue-600"
          />
          <StatCard
            title={t('stats.rsvp_responses')}
            value={`${stats.rsvpAccepted}/${stats.totalGuests}`}
            subtitle={`${t('stats.pending', { count: stats.rsvpPending })}, ${t('stats.declined', { count: stats.rsvpDeclined })}`}
            color="text-green-600"
          />
          <StatCard
            title={t('stats.tasks_completed')}
            value={`${stats.completedTasks}/${stats.totalTasks}`}
            subtitle={t('stats.complete', { percent: ((stats.completedTasks / stats.totalTasks) * 100 || 0).toFixed(0) })}
            color="text-purple-600"
          />
          <StatCard
            title={t('stats.budget_used')}
            value={`$${stats.spentBudget.toLocaleString()}`}
            subtitle={t('stats.of_planned', { total: stats.totalBudget.toLocaleString() })}
            color="text-yellow-600"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">{t('recent_activity.title')}</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">{t('recent_activity.rsvp_yes', { names: 'John & Jane', event: 'ceremony' })}</span>
                  <span className="text-xs text-gray-500 ml-auto">{t('recent_activity.time_ago.hours', { count: 2 })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">{t('recent_activity.updated_seating', { table: 'Table 5' })}</span>
                  <span className="text-xs text-gray-500 ml-auto">{t('recent_activity.time_ago.days', { count: 1 })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">{t('recent_activity.completed_task', { task: 'Book photographer' })}</span>
                  <span className="text-xs text-gray-500 ml-auto">{t('recent_activity.time_ago.days_plural', { count: 3 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Tasks */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">{t('upcoming_tasks.title')}</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Finalize catering menu</span>
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded ml-auto">{t('upcoming_tasks.due_in.days', { count: 2 })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Send invitations to extended family</span>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-auto">{t('upcoming_tasks.due_in.weeks', { count: 1 })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Final dress fitting</span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded ml-auto">{t('upcoming_tasks.due_in.weeks_plural', { count: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}