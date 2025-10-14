import { db } from '@ume/shared';
import { collection, getDocs, query, doc, getDoc, onSnapshot, orderBy, limit } from 'firebase/firestore';

export interface DashboardStats {
  guests: {
    total: number;
    rsvpResponded: number;
    rsvpAccepted: number;
    rsvpDeclined: number;
    rsvpPending: number;
    responseRate: number;
    lastRSVPUpdate: Date | null;
    expectedAttendance: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    completionRate: number;
    highPriorityPending: number;
    completedThisWeek: number;
    averageCompletionTime: number; // days
  };
  budget: {
    totalForecast: number;
    totalAllocated: number;
    totalSpent: number;
    remainingFunds: number;
    budgetHealth: 'healthy' | 'warning' | 'critical';
    spendingRate: number;
    monthlySpending: number;
    projectedOverrun: number;
    categoriesOverBudget: number;
  };
  events: {
    total: number;
    published: number;
    draft: number;
    attendeesAssigned: number;
    venuesConfirmed: number;
  };
  seating: {
    totalSeats: number;
    assignedSeats: number;
    availableSeats: number;
    completionRate: number;
    tablesArranged: number;
    guestConflicts: number;
  };
  website: {
    isPublished: boolean;
    lastUpdated: Date | null;
    pagesComplete: number;
    totalPages: number;
    visitorCount: number;
    rsvpConversionRate: number;
  };
  vendors: {
    totalVendors: number;
    confirmedVendors: number;
    pendingContracts: number;
    paymentsOverdue: number;
    averageRating: number;
  };
  timeline: {
    totalMilestones: number;
    completedMilestones: number;
    upcomingDeadlines: number;
    criticalPath: string[];
  };
  alerts: Alert[];
  trends: {
    weeklyProgress: number;
    monthlyProgress: number;
    daysUntilWedding: number;
    planningVelocity: number;
    budgetTrend: 'improving' | 'stable' | 'concerning';
  };
  realTimeSync: {
    lastUpdated: Date;
    syncStatus: 'active' | 'stale' | 'error';
    activeSyncModules: string[];
  };
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actionRequired: boolean;
  priority: 'low' | 'medium' | 'high';
  category: 'guests' | 'tasks' | 'budget' | 'seating' | 'website' | 'general';
}

// Core stats fetching functions
async function getGuestStats(coupleId: string) {
  try {
    const guestsQuery = query(collection(db, 'couples', coupleId, 'guests'));
    const guestsSnapshot = await getDocs(guestsQuery);
    
    let total = 0;
    let rsvpAccepted = 0;
    let rsvpDeclined = 0;
    let rsvpPending = 0;
    let expectedAttendance = 0;
    let lastRSVPUpdate: Date | null = null;
    
    guestsSnapshot.forEach((doc) => {
      const guest = doc.data();
      total++;
      
      const rsvpStatus = guest.rsvp?.status?.toLowerCase();
      const guestCount = guest.partySize || 1;
      
      if (rsvpStatus === 'accepted' || rsvpStatus === 'confirmé') {
        rsvpAccepted++;
        expectedAttendance += guestCount;
      } else if (rsvpStatus === 'declined' || rsvpStatus === 'refusé') {
        rsvpDeclined++;
      } else {
        rsvpPending++;
        // Assume 75% acceptance rate for pending RSVPs
        expectedAttendance += Math.round(guestCount * 0.75);
      }
      
      // Track last RSVP update
      if (guest.rsvp?.respondedAt) {
        const respondedAt = guest.rsvp.respondedAt.toDate ? guest.rsvp.respondedAt.toDate() : new Date(guest.rsvp.respondedAt);
        if (!lastRSVPUpdate || respondedAt > lastRSVPUpdate) {
          lastRSVPUpdate = respondedAt;
        }
      }
    });
    
    const rsvpResponded = rsvpAccepted + rsvpDeclined;
    const responseRate = total > 0 ? (rsvpResponded / total) * 100 : 0;
    
    return {
      total,
      rsvpResponded,
      rsvpAccepted,
      rsvpDeclined,
      rsvpPending,
      responseRate: Math.round(responseRate),
      lastRSVPUpdate,
      expectedAttendance
    };
  } catch (error) {
    console.error('Error fetching guest stats:', error);
    return {
      total: 0,
      rsvpResponded: 0,
      rsvpAccepted: 0,
      rsvpDeclined: 0,
      rsvpPending: 0,
      responseRate: 0,
      lastRSVPUpdate: null,
      expectedAttendance: 0
    };
  }
}

async function getTaskStats(coupleId: string) {
  try {
    const tasksQuery = query(collection(db, 'couples', coupleId, 'tasks'));
    const tasksSnapshot = await getDocs(tasksQuery);
    
    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let overdue = 0;
    let highPriorityPending = 0;
    let completedThisWeek = 0;
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const completionTimes: number[] = [];
    
    tasksSnapshot.forEach((doc) => {
      const task = doc.data();
      total++;
      
      if (task.status === 'completed') {
        completed++;
        
        // Check if completed this week
        const completedAt = task.updatedAt ? (task.updatedAt.toDate ? task.updatedAt.toDate() : new Date(task.updatedAt)) : null;
        if (completedAt && completedAt >= oneWeekAgo) {
          completedThisWeek++;
        }
        
        // Calculate completion time
        const createdAt = task.createdAt ? (task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt)) : null;
        if (createdAt && completedAt) {
          const completionTime = (completedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          completionTimes.push(completionTime);
        }
      } else if (task.status === 'in_progress') {
        inProgress++;
        
        if (task.priority === 'high') {
          highPriorityPending++;
        }
      } else {
        // not-started tasks
        if (task.priority === 'high') {
          highPriorityPending++;
        }
      }
      
      // Check for overdue tasks
      if (task.dueDate && task.status !== 'completed') {
        const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
        if (dueDate < now) {
          overdue++;
        }
      }
    });
    
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    const averageCompletionTime = completionTimes.length > 0 
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
      : 0;
    
    return {
      total,
      completed,
      inProgress,
      overdue,
      completionRate: Math.round(completionRate),
      highPriorityPending,
      completedThisWeek,
      averageCompletionTime
    };
  } catch (error) {
    console.error('Error fetching task stats:', error);
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      completionRate: 0,
      highPriorityPending: 0,
      completedThisWeek: 0,
      averageCompletionTime: 0
    };
  }
}

async function getBudgetStats(coupleId: string) {
  try {
    // Get budget data from existing budget service and payment reminder stats
    const { createBudgetTasksService } = await import('./budgetTasksService');
    const { getBudgetSummary } = await import('./budgetService');
    const budgetTasksService = createBudgetTasksService(coupleId);
    
    // Get correct budget calculations from budget service
    const budgetSummary = await getBudgetSummary(coupleId);
    
    // Use correct calculations:
    // - totalSpent = sum of payments made (from categoryExpenses.totalPaid)
    // - totalAllocated = sum of ALL payments (made + due + overdue) from totalAllocated
    // - remainingFunds = available funds - total spent
    const totalForecast = budgetSummary.totalAllocated; // This is the forecasted amount
    const totalAllocated = budgetSummary.totalAllocated; // Sum of ALL payments (made + due + overdue)
    const totalSpent = budgetSummary.totalSpent;         // Sum of payments made
    
    // Get payment reminder stats for better budget health calculation
    const paymentStats = await budgetTasksService.getPaymentReminderStats();
    
    const remainingFunds = budgetSummary.remainingFunds; // Available funds - total spent
    const spendingRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    
    let budgetHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (spendingRate > 90 || paymentStats.overduePayments > 0) budgetHealth = 'critical';
    else if (spendingRate > 75 || paymentStats.upcomingPayments > 3) budgetHealth = 'warning';
    
    // Get forecast baseline insights
    const { createForecastBudgetService } = await import('./forecastBudgetService');
    const forecastService = createForecastBudgetService(coupleId);
    const forecastInsights = await forecastService.getForecastBudgetInsights();

    // Get benchmark insights
    let benchmarkInsights = null;
    try {
      const { createBenchmarkBudgetService } = await import('./benchmarkBudgetService');
      const benchmarkService = createBenchmarkBudgetService(coupleId);
      benchmarkInsights = await benchmarkService.getBenchmarkInsights();
    } catch (benchmarkError) {
      console.warn('Benchmark service not available:', benchmarkError);
    }

    return {
      totalForecast,
      totalAllocated,
      totalSpent,
      remainingFunds,
      budgetHealth,
      spendingRate: Math.round(spendingRate),
      monthlySpending: 0, // Could be calculated if needed
      projectedOverrun: Math.max(0, totalSpent - totalAllocated),
      categoriesOverBudget: 0, // Would need to calculate from category data
      paymentReminders: paymentStats,
      forecastBaseline: forecastInsights,
      benchmarkInsights
    };
  } catch (error) {
    console.error('Error fetching budget stats:', error);
    return {
      totalForecast: 0,
      totalAllocated: 0,
      totalSpent: 0,
      remainingFunds: 0,
      budgetHealth: 'healthy' as const,
      spendingRate: 0,
      monthlySpending: 0,
      projectedOverrun: 0,
      categoriesOverBudget: 0,
      paymentReminders: {
        totalReminders: 0,
        upcomingPayments: 0,
        overduePayments: 0,
        completedPayments: 0,
        totalAmountDue: 0
      },
      forecastBaseline: {
        totalForecastAmount: 0,
        totalBudgetAllocated: 0,
        totalSpent: 0,
        forecastAccuracy: 0,
        topVariances: [],
        recommendedActions: []
      },
      benchmarkInsights: null
    };
  }
}

async function getEventStats(coupleId: string) {
  try {
    const coupleDoc = await getDoc(doc(db, 'couples', coupleId));
    const coupleData = coupleDoc.exists() ? coupleDoc.data() : {};
    
    const events = coupleData.events || [];
    const total = events.length;
    const published = events.filter((event: any) => event.showOnWebsite).length;
    const draft = total - published;
    
    return {
      total,
      published,
      draft
    };
  } catch (error) {
    console.error('Error fetching event stats:', error);
    return {
      total: 0,
      published: 0,
      draft: 0
    };
  }
}

async function getSeatingStats(coupleId: string) {
  try {
    // Use the RSVP-Seating service for more accurate stats
    const { createRSVPSeatingService } = await import('./rsvpSeatingService');
    const rsvpSeatingService = createRSVPSeatingService(coupleId);
    return await rsvpSeatingService.getSeatingStats();
  } catch (error) {
    console.error('Error fetching seating stats:', error);
    return {
      totalSeats: 0,
      assignedSeats: 0,
      availableSeats: 0,
      completionRate: 0
    };
  }
}

async function getWebsiteStats(coupleId: string) {
  try {
    const coupleDoc = await getDoc(doc(db, 'couples', coupleId));
    const coupleData = coupleDoc.exists() ? coupleDoc.data() : {};
    
    const websiteSettings = coupleData.websiteSettings || {};
    const isPublished = websiteSettings.published || false;
    const lastUpdated = websiteSettings.lastUpdated ? websiteSettings.lastUpdated.toDate() : null;
    
    // Calculate pages complete based on required sections
    const requiredPages = ['events', 'story', 'rsvp', 'accommodations'];
    let pagesComplete = 0;
    
    if (coupleData.events?.length > 0) pagesComplete++;
    if (websiteSettings.story?.content) pagesComplete++;
    if (websiteSettings.rsvp?.enabled) pagesComplete++;
    if (websiteSettings.accommodations?.length > 0) pagesComplete++;

    // Get real website analytics
    let analytics = null;
    let engagement = null;
    try {
      const { createWebsiteAnalyticsService } = await import('./websiteAnalyticsService');
      const analyticsService = createWebsiteAnalyticsService(coupleId);
      [analytics, engagement] = await Promise.all([
        analyticsService.getWebsiteAnalytics('month'),
        analyticsService.getEngagementInsights()
      ]);
    } catch (analyticsError) {
      console.warn('Website analytics service not available:', analyticsError);
    }

    // Use analytics data if available
    const visitors = analytics?.totalVisitors || 0;
    const pageViews = analytics?.totalPageViews || 0;
    const avgTimeOnSite = analytics?.averageTimeOnSite || 0;
    const bounceRate = analytics?.bounceRate || 0;
    const rsvpConversion = analytics?.rsvpConversionRate || 0;
    
    return {
      isPublished,
      lastUpdated,
      pagesComplete,
      totalPages: requiredPages.length,
      visitors,
      pageViews,
      avgTimeOnSite,
      bounceRate,
      rsvpConversion,
      analytics,
      engagement,
      topPages: analytics?.topPages?.slice(0, 5) || [],
      trafficSources: analytics?.trafficSources || [],
      guestEngagement: analytics?.guestEngagement || {
        totalGuestVisitors: 0,
        averageGuestSessions: 0,
        guestPageViews: 0,
        rsvpCompletionRate: 0
      }
    };
  } catch (error) {
    console.error('Error fetching website stats:', error);
    return {
      isPublished: false,
      lastUpdated: null,
      pagesComplete: 0,
      totalPages: 4,
      visitors: 0,
      pageViews: 0,
      avgTimeOnSite: 0,
      bounceRate: 0,
      rsvpConversion: 0,
      analytics: null,
      engagement: null,
      topPages: [],
      trafficSources: [],
      guestEngagement: {
        totalGuestVisitors: 0,
        averageGuestSessions: 0,
        guestPageViews: 0,
        rsvpCompletionRate: 0
      }
    };
  }
}

function generateSmartAlerts(stats: any): Alert[] {
  const alerts: Alert[] = [];
  
  // RSVP response rate alerts
  if (stats.guests.responseRate < 50 && stats.trends.daysUntilWedding < 30) {
    alerts.push({
      id: 'low-rsvp-response',
      type: 'warning',
      title: 'Low RSVP Response Rate',
      message: `Only ${stats.guests.responseRate}% of guests have responded. Consider sending reminders.`,
      actionRequired: true,
      priority: 'high',
      category: 'guests'
    });
  }
  
  // Budget alerts
  if (stats.budget.budgetHealth === 'critical') {
    alerts.push({
      id: 'budget-critical',
      type: 'error',
      title: 'Budget Alert',
      message: `You've spent ${stats.budget.spendingRate}% of your budget. Review expenses immediately.`,
      actionRequired: true,
      priority: 'high',
      category: 'budget'
    });
  }
  
  // Payment reminder alerts
  if (stats.budget.paymentReminders?.overduePayments > 0) {
    alerts.push({
      id: 'overdue-payments',
      type: 'error',
      title: 'Overdue Payments',
      message: `You have ${stats.budget.paymentReminders.overduePayments} overdue payments totaling $${stats.budget.paymentReminders.totalAmountDue.toLocaleString()}.`,
      actionRequired: true,
      priority: 'high',
      category: 'budget'
    });
  } else if (stats.budget.paymentReminders?.upcomingPayments > 0) {
    alerts.push({
      id: 'upcoming-payments',
      type: 'warning',
      title: 'Upcoming Payments',
      message: `You have ${stats.budget.paymentReminders.upcomingPayments} upcoming payments due soon.`,
      actionRequired: false,
      priority: 'medium',
      category: 'budget'
    });
  }
  
  // Overdue tasks
  if (stats.tasks.overdue > 0) {
    alerts.push({
      id: 'overdue-tasks',
      type: 'warning',
      title: 'Overdue Tasks',
      message: `You have ${stats.tasks.overdue} overdue tasks. Review your timeline.`,
      actionRequired: true,
      priority: 'medium',
      category: 'tasks'
    });
  }
  
  // Website not published
  if (!stats.website.isPublished && stats.trends.daysUntilWedding < 60) {
    alerts.push({
      id: 'website-not-published',
      type: 'info',
      title: 'Website Not Published',
      message: 'Your wedding website is ready but not published. Share it with guests!',
      actionRequired: false,
      priority: 'medium',
      category: 'website'
    });
  }

  // Website analytics alerts
  if (stats.website.analytics && stats.website.isPublished) {
    if (stats.website.bounceRate > 70) {
      alerts.push({
        id: 'high-bounce-rate',
        type: 'warning',
        title: 'High Website Bounce Rate',
        message: `Your website has a ${stats.website.bounceRate}% bounce rate. Consider improving the content and navigation.`,
        actionRequired: false,
        priority: 'medium',
        category: 'website'
      });
    }

    if (stats.website.rsvpConversion < 30 && stats.website.visitors > 10) {
      alerts.push({
        id: 'low-rsvp-conversion',
        type: 'warning',
        title: 'Low RSVP Conversion Rate',
        message: `Only ${stats.website.rsvpConversion}% of website visitors are completing RSVP. Simplify the process.`,
        actionRequired: true,
        priority: 'medium',
        category: 'website'
      });
    }

    if (stats.website.engagement?.overallEngagement === 'low') {
      alerts.push({
        id: 'low-website-engagement',
        type: 'info',
        title: 'Low Website Engagement',
        message: 'Guest engagement with your website is low. Consider adding more interactive content.',
        actionRequired: false,
        priority: 'low',
        category: 'website'
      });
    }
  }
  
  // Forecast baseline alerts
  if (stats.budget.forecastBaseline?.forecastAccuracy < 70) {
    alerts.push({
      id: 'forecast-variance-high',
      type: 'warning',
      title: 'Budget Deviating from Forecast',
      message: `Your spending is ${100 - stats.budget.forecastBaseline.forecastAccuracy}% different from forecast. Consider reviewing your budget.`,
      actionRequired: true,
      priority: 'medium',
      category: 'budget'
    });
  }

  // Benchmark alerts
  if (stats.budget.benchmarkInsights?.riskLevel === 'high') {
    alerts.push({
      id: 'budget-benchmark-high-risk',
      type: 'warning',
      title: 'Budget Above Market Rates',
      message: `Your budget significantly exceeds market rates in ${stats.budget.benchmarkInsights.overBudgetCategories} categories.`,
      actionRequired: true,
      priority: 'high',
      category: 'budget'
    });
  }

  if (stats.budget.benchmarkInsights?.topConcerns?.length > 0) {
    const topConcern = stats.budget.benchmarkInsights.topConcerns[0];
    alerts.push({
      id: 'budget-benchmark-concern',
      type: 'info',
      title: `${topConcern.categoryName} Budget Alert`,
      message: `Your ${topConcern.categoryName} budget is ${Math.abs(topConcern.variancePercentage)}% ${topConcern.variance > 0 ? 'above' : 'below'} market rates.`,
      actionRequired: false,
      priority: 'medium',
      category: 'budget'
    });
  }

  if (stats.budget.forecastBaseline?.topVariances?.length > 0) {
    const topVariance = stats.budget.forecastBaseline.topVariances[0];
    if (Math.abs(topVariance.variancePercentage) > 25) {
      alerts.push({
        id: 'category-over-forecast',
        type: 'warning',
        title: `${topVariance.categoryName} Over Forecast`,
        message: `${topVariance.categoryName} is ${Math.abs(topVariance.variancePercentage)}% ${topVariance.variance > 0 ? 'over' : 'under'} forecast.`,
        actionRequired: false,
        priority: 'medium',
        category: 'budget'
      });
    }
  }

  // Success alerts
  if (stats.guests.responseRate > 80) {
    alerts.push({
      id: 'great-rsvp-rate',
      type: 'success',
      title: 'Great RSVP Response!',
      message: `${stats.guests.responseRate}% of your guests have responded. Excellent!`,
      actionRequired: false,
      priority: 'low',
      category: 'guests'
    });
  }

  if (stats.budget.forecastBaseline?.forecastAccuracy > 90) {
    alerts.push({
      id: 'excellent-forecast-accuracy',
      type: 'success',
      title: 'Excellent Budget Planning!',
      message: `Your spending is ${stats.budget.forecastBaseline.forecastAccuracy}% aligned with your forecast. Great job!`,
      actionRequired: false,
      priority: 'low',
      category: 'budget'
    });
  }

  // Vendor alerts
  if (stats.vendors?.paymentsPending > 0) {
    alerts.push({
      id: 'vendor-payments-due',
      type: 'warning',
      title: 'Vendor Payments Due',
      message: `${stats.vendors.paymentsPending} vendor payments are due soon.`,
      actionRequired: true,
      priority: 'medium',
      category: 'vendors'
    });
  }

  if (stats.vendors?.contractsExpiringSoon > 0) {
    alerts.push({
      id: 'contracts-expiring',
      type: 'info',
      title: 'Contracts Expiring',
      message: `${stats.vendors.contractsExpiringSoon} vendor contracts expire soon. Consider renewals.`,
      actionRequired: false,
      priority: 'medium',
      category: 'vendors'
    });
  }

  // Timeline alerts
  if (stats.timeline?.upcomingDeadlines > 2) {
    alerts.push({
      id: 'multiple-deadlines',
      type: 'warning',
      title: 'Multiple Deadlines Approaching',
      message: `${stats.timeline.upcomingDeadlines} critical tasks are due within the next week.`,
      actionRequired: true,
      priority: 'high',
      category: 'timeline'
    });
  }

  if (stats.timeline?.criticalPath?.length > 0) {
    alerts.push({
      id: 'critical-path-tasks',
      type: 'info',
      title: 'Critical Path Tasks Pending',
      message: `Focus on: ${stats.timeline.criticalPath.slice(0, 2).join(', ')}${stats.timeline.criticalPath.length > 2 ? ` and ${stats.timeline.criticalPath.length - 2} more` : ''}.`,
      actionRequired: false,
      priority: 'medium',
      category: 'timeline'
    });
  }

  // Real-time sync alerts
  if (stats.realTimeSync?.overallStatus === 'error') {
    alerts.push({
      id: 'sync-error',
      type: 'error',
      title: 'Data Sync Error',
      message: 'Some modules failed to sync. Data may be outdated. Please refresh.',
      actionRequired: true,
      priority: 'high',
      category: 'system'
    });
  }
  
  return alerts;
}

async function getVendorStats(coupleId: string) {
  try {
    // Get vendor budget integration data
    let vendorIntegrationStats = null;
    try {
      const { createBudgetVendorIntegrationService } = await import('./budgetVendorIntegrationService');
      const integrationService = createBudgetVendorIntegrationService(coupleId);
      vendorIntegrationStats = await integrationService.getVendorBudgetInsights();
    } catch (importError) {
      console.warn('Vendor integration service not available:', importError);
    }
    
    // Get vendors from budget categories (expenses) as fallback
    const budgetCategoriesQuery = query(collection(db, 'couples', coupleId, 'budgetCategories'));
    const budgetSnapshot = await getDocs(budgetCategoriesQuery);
    
    let totalVendors = vendorIntegrationStats?.totalVendors || 0;
    let confirmedVendors = 0;
    let pendingContracts = 0;
    let paymentsOverdue = 0;
    let paymentsPending = 0;
    let contractsExpiringSoon = 0;
    const ratings: number[] = [];
    const now = new Date();
    
    // If we don't have integration data, fall back to budget categories
    if (!vendorIntegrationStats) {
      budgetSnapshot.forEach((doc) => {
        const categoryData = doc.data();
        const expenses = categoryData.expenses || [];
        
        expenses.forEach((expense: any) => {
          if (expense.vendorName) {
            totalVendors++;
            
            if (expense.paymentStatus === 'paid') {
              confirmedVendors++;
            } else if (expense.paymentStatus === 'overdue') {
              paymentsOverdue++;
            } else if (expense.paymentStatus === 'due') {
              paymentsPending++;
            }
            
            if (expense.paymentDueDate) {
              const dueDate = expense.paymentDueDate.toDate ? expense.paymentDueDate.toDate() : new Date(expense.paymentDueDate);
              if (dueDate < now && expense.paymentStatus !== 'paid') {
                pendingContracts++;
              }
            }
            
            if (expense.rating && expense.rating > 0) {
              ratings.push(expense.rating);
            }
          }
        });
      });
    } else {
      // Use integration stats
      confirmedVendors = Math.floor(totalVendors * 0.7); // Mock: 70% confirmed
      paymentsPending = vendorIntegrationStats.topOverbudgetVendors.length;
      contractsExpiringSoon = Math.floor(totalVendors * 0.1); // Mock: 10% expiring soon
      paymentsOverdue = Math.floor(paymentsPending * 0.3); // Mock: 30% of pending are overdue
    }
    
    const averageRating = ratings.length > 0 
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 4.2; // Default rating
    
    return {
      totalVendors,
      confirmedVendors,
      pendingContracts,
      paymentsOverdue,
      paymentsPending,
      contractsExpiringSoon,
      averageRating,
      budgetVariance: vendorIntegrationStats?.variance || 0,
      overBudgetVendors: vendorIntegrationStats?.topOverbudgetVendors?.length || 0
    };
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    return {
      totalVendors: 0,
      confirmedVendors: 0,
      pendingContracts: 0,
      paymentsOverdue: 0,
      paymentsPending: 0,
      contractsExpiringSoon: 0,
      averageRating: 0,
      budgetVariance: 0,
      overBudgetVendors: 0
    };
  }
}

async function getTimelineStats(coupleId: string) {
  try {
    const tasksQuery = query(collection(db, 'couples', coupleId, 'tasks'));
    const tasksSnapshot = await getDocs(tasksQuery);
    
    let totalMilestones = 0;
    let completedMilestones = 0;
    let upcomingDeadlines = 0;
    const criticalPath: string[] = [];
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    tasksSnapshot.forEach((doc) => {
      const task = doc.data();
      
      if (task.priority === 'high') {
        totalMilestones++;
        
        if (task.status === 'completed') {
          completedMilestones++;
        } else {
          criticalPath.push(task.title || 'Untitled Task');
        }
        
        if (task.dueDate) {
          const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
          if (dueDate <= nextWeek && task.status !== 'completed') {
            upcomingDeadlines++;
          }
        }
      }
    });
    
    return {
      totalMilestones,
      completedMilestones,
      upcomingDeadlines,
      criticalPath: criticalPath.slice(0, 5) // Top 5 critical tasks
    };
  } catch (error) {
    console.error('Error fetching timeline stats:', error);
    return {
      totalMilestones: 0,
      completedMilestones: 0,
      upcomingDeadlines: 0,
      criticalPath: []
    };
  }
}

async function calculateTrends(coupleId: string, allStats: any) {
  try {
    // Get wedding date
    const coupleDoc = await getDoc(doc(db, 'couples', coupleId));
    const coupleData = coupleDoc.exists() ? coupleDoc.data() : {};
    const weddingDate = coupleData?.weddingDate?.toDate ? coupleData.weddingDate.toDate() : null;
    
    const now = new Date();
    const daysUntilWedding = weddingDate 
      ? Math.ceil((weddingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 365; // Default to 1 year if no date set
    
    // Calculate planning velocity (tasks completed per week)
    const planningVelocity = allStats.tasks?.completedThisWeek || 0;
    
    // Calculate budget trend
    let budgetTrend: 'improving' | 'stable' | 'concerning' = 'stable';
    if (allStats.budget?.forecastBaseline?.forecastAccuracy) {
      const accuracy = allStats.budget.forecastBaseline.forecastAccuracy;
      if (accuracy > 85) budgetTrend = 'improving';
      else if (accuracy < 70) budgetTrend = 'concerning';
    }
    
    // Calculate overall progress
    const taskProgress = allStats.tasks?.completionRate || 0;
    const budgetProgress = allStats.budget?.spendingRate || 0;
    const guestProgress = allStats.guests?.responseRate || 0;
    const overallProgress = Math.round((taskProgress + Math.min(budgetProgress, 100) + guestProgress) / 3);
    
    return {
      weeklyProgress: planningVelocity,
      monthlyProgress: overallProgress,
      daysUntilWedding,
      planningVelocity,
      budgetTrend
    };
  } catch (error) {
    console.error('Error calculating trends:', error);
    return {
      weeklyProgress: 0,
      monthlyProgress: 0,
      daysUntilWedding: 365,
      planningVelocity: 0,
      budgetTrend: 'stable' as const
    };
  }
}

// Function to get real-time sync status across all modules
async function getRealTimeSyncStatus(coupleId: string) {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    // Check last sync times for each module
    const [guestsLastSync, tasksLastSync, budgetLastSync, vendorsLastSync] = await Promise.all([
      getLastCollectionUpdate(coupleId, 'guests'),
      getLastCollectionUpdate(coupleId, 'tasks'),
      getLastCollectionUpdate(coupleId, 'budget'),
      getLastCollectionUpdate(coupleId, 'vendors')
    ]);
    
    return {
      lastSyncAt: now,
      moduleSyncStatus: {
        guests: guestsLastSync > fiveMinutesAgo ? 'synced' : 'pending',
        tasks: tasksLastSync > fiveMinutesAgo ? 'synced' : 'pending',
        budget: budgetLastSync > fiveMinutesAgo ? 'synced' : 'pending',
        vendors: vendorsLastSync > fiveMinutesAgo ? 'synced' : 'pending'
      },
      overallStatus: 'synced' as 'synced' | 'syncing' | 'error'
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return {
      lastSyncAt: new Date(),
      moduleSyncStatus: {
        guests: 'error' as const,
        tasks: 'error' as const,
        budget: 'error' as const,
        vendors: 'error' as const
      },
      overallStatus: 'error' as const
    };
  }
}

async function getLastCollectionUpdate(coupleId: string, collectionName: string): Promise<Date> {
  try {
    const collectionQuery = query(
      collection(db, 'couples', coupleId, collectionName),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(collectionQuery);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      return data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date());
    }
    
    return new Date(0); // Return epoch if no documents found
  } catch (error) {
    console.error(`Error getting last update for ${collectionName}:`, error);
    return new Date(0);
  }
}

// Main function to get comprehensive dashboard stats
export async function getDashboardStats(coupleId: string): Promise<DashboardStats> {
  try {
    // Fetch all stats in parallel for better performance
    const [guests, tasks, budget, events, seating, website, vendors, timeline, realTimeSync] = await Promise.all([
      getGuestStats(coupleId),
      getTaskStats(coupleId),
      getBudgetStats(coupleId),
      getEventStats(coupleId),
      getSeatingStats(coupleId),
      getWebsiteStats(coupleId),
      getVendorStats(coupleId),
      getTimelineStats(coupleId),
      getRealTimeSyncStatus(coupleId)
    ]);
    
    // Calculate trends with all available data
    const allStatsForTrends = { guests, tasks, budget, events, seating, website, vendors, timeline };
    const trends = await calculateTrends(coupleId, allStatsForTrends);
    
    // Combine all stats
    const allStats = {
      guests,
      tasks,
      budget,
      events,
      seating,
      website,
      vendors,
      timeline,
      trends,
      realTimeSync
    };
    
    // Generate smart alerts based on all data
    const alerts = generateSmartAlerts(allStats);
    
    return {
      ...allStats,
      alerts
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

// Real-time listener for dashboard stats
export function subscribeToStats(coupleId: string, callback: (stats: DashboardStats) => void) {
  const unsubscribes: (() => void)[] = [];
  
  // Listen to guests collection changes
  const guestsUnsubscribe = onSnapshot(
    collection(db, 'couples', coupleId, 'guests'),
    () => {
      getDashboardStats(coupleId).then(callback);
    }
  );
  unsubscribes.push(guestsUnsubscribe);
  
  // Listen to tasks collection changes
  const tasksUnsubscribe = onSnapshot(
    collection(db, 'couples', coupleId, 'tasks'),
    () => {
      getDashboardStats(coupleId).then(callback);
    }
  );
  unsubscribes.push(tasksUnsubscribe);
  
  // Listen to budget collections changes
  const budgetUnsubscribe = onSnapshot(
    collection(db, 'couples', coupleId, 'budget'),
    () => {
      getDashboardStats(coupleId).then(callback);
    }
  );
  unsubscribes.push(budgetUnsubscribe);
  
  // Listen to vendors collection changes
  const vendorsUnsubscribe = onSnapshot(
    collection(db, 'couples', coupleId, 'vendors'),
    () => {
      getDashboardStats(coupleId).then(callback);
    }
  );
  unsubscribes.push(vendorsUnsubscribe);
  
  // Listen to budget allocations changes (forecast integration)
  const allocationsUnsubscribe = onSnapshot(
    collection(db, 'couples', coupleId, 'budgetAllocations'),
    () => {
      getDashboardStats(coupleId).then(callback);
    }
  );
  unsubscribes.push(allocationsUnsubscribe);
  
  // Listen to couple document changes (events, website, etc.)
  const coupleUnsubscribe = onSnapshot(
    doc(db, 'couples', coupleId),
    () => {
      getDashboardStats(coupleId).then(callback);
    }
  );
  unsubscribes.push(coupleUnsubscribe);

  // Listen to website analytics changes
  try {
    const websitePageViewsUnsubscribe = onSnapshot(
      collection(db, 'couples', coupleId, 'websitePageViews'),
      () => {
        getDashboardStats(coupleId).then(callback);
      }
    );
    unsubscribes.push(websitePageViewsUnsubscribe);

    const websiteInteractionsUnsubscribe = onSnapshot(
      collection(db, 'couples', coupleId, 'websiteInteractions'),
      () => {
        getDashboardStats(coupleId).then(callback);
      }
    );
    unsubscribes.push(websiteInteractionsUnsubscribe);
  } catch (analyticsError) {
    console.warn('Website analytics real-time updates not available:', analyticsError);
  }
  
  // Return cleanup function
  return () => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  };
}