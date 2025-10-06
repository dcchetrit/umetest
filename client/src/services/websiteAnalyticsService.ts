import { db } from '@ume/shared';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc,
  query, 
  where, 
  orderBy,
  limit,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';

export interface WebsiteVisitor {
  id: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  country?: string;
  city?: string;
  device: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  firstVisit: Date;
  lastVisit: Date;
  totalSessions: number;
  totalPageViews: number;
  totalTimeSpent: number; // in seconds
  isGuest: boolean;
  guestId?: string;
}

export interface PageView {
  id: string;
  visitorId: string;
  sessionId: string;
  coupleId: string;
  page: string;
  title: string;
  url: string;
  timestamp: Date;
  timeOnPage: number; // in seconds
  exitPage: boolean;
  source?: 'direct' | 'social' | 'email' | 'qr' | 'search' | 'referral';
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface UserInteraction {
  id: string;
  visitorId: string;
  sessionId: string;
  coupleId: string;
  type: 'click' | 'form_submit' | 'rsvp' | 'photo_view' | 'gift_view' | 'download' | 'share';
  element: string;
  page: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface WebsiteAnalytics {
  totalVisitors: number;
  uniqueVisitors: number;
  totalPageViews: number;
  averageTimeOnSite: number;
  bounceRate: number;
  topPages: Array<{
    page: string;
    views: number;
    averageTimeOnPage: number;
  }>;
  trafficSources: Array<{
    source: string;
    visitors: number;
    percentage: number;
  }>;
  deviceBreakdown: Array<{
    device: string;
    visitors: number;
    percentage: number;
  }>;
  geographicData: Array<{
    location: string;
    visitors: number;
    percentage: number;
  }>;
  rsvpConversionRate: number;
  popularFeatures: Array<{
    feature: string;
    interactions: number;
    uniqueUsers: number;
  }>;
  peakVisitTimes: Array<{
    hour: number;
    visitors: number;
  }>;
  guestEngagement: {
    totalGuestVisitors: number;
    averageGuestSessions: number;
    guestPageViews: number;
    rsvpCompletionRate: number;
  };
}

export interface EngagementInsights {
  overallEngagement: 'low' | 'medium' | 'high';
  topPerformingPages: string[];
  improvementAreas: string[];
  recommendations: string[];
  conversionFunnelAnalysis: {
    landingPageViews: number;
    detailPageViews: number;
    rsvpPageViews: number;
    rsvpSubmissions: number;
    conversionRate: number;
  };
  guestBehaviorPatterns: {
    averageSessionDuration: number;
    pagesPerSession: number;
    returnVisitorRate: number;
    mobileVsDesktop: {
      mobile: number;
      desktop: number;
    };
  };
}

export class WebsiteAnalyticsService {
  constructor(private coupleId: string) {}

  // Track a page view
  async trackPageView(
    visitorId: string,
    sessionId: string,
    page: string,
    title: string,
    url: string,
    timeOnPage: number = 0,
    source?: string,
    utmData?: { source?: string; medium?: string; campaign?: string }
  ): Promise<void> {
    try {
      const pageView: Omit<PageView, 'id'> = {
        visitorId,
        sessionId,
        coupleId: this.coupleId,
        page,
        title,
        url,
        timestamp: new Date(),
        timeOnPage,
        exitPage: false,
        source: this.categorizeSource(source),
        utmSource: utmData?.source,
        utmMedium: utmData?.medium,
        utmCampaign: utmData?.campaign
      };
      
      await addDoc(collection(db, 'couples', this.coupleId, 'websitePageViews'), pageView);
      
      // Update visitor stats
      await this.updateVisitorStats(visitorId, sessionId);
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  }

  // Track user interactions
  async trackInteraction(
    visitorId: string,
    sessionId: string,
    type: UserInteraction['type'],
    element: string,
    page: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const interaction: Omit<UserInteraction, 'id'> = {
        visitorId,
        sessionId,
        coupleId: this.coupleId,
        type,
        element,
        page,
        timestamp: new Date(),
        metadata
      };
      
      await addDoc(collection(db, 'couples', this.coupleId, 'websiteInteractions'), interaction);
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }

  // Get comprehensive website analytics
  async getWebsiteAnalytics(period: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<WebsiteAnalytics> {
    try {
      const periodStart = this.getPeriodStart(period);
      
      const [pageViews, interactions, visitors] = await Promise.all([
        this.getPageViews(periodStart),
        this.getInteractions(periodStart),
        this.getVisitors(periodStart)
      ]);
      
      // Calculate basic metrics
      const totalVisitors = visitors.length;
      const uniqueVisitors = new Set(visitors.map(v => v.id)).size;
      const totalPageViews = pageViews.length;
      const averageTimeOnSite = visitors.length > 0 
        ? visitors.reduce((sum, v) => sum + v.totalTimeSpent, 0) / visitors.length
        : 0;
      
      // Calculate bounce rate (single page sessions)
      const singlePageSessions = this.calculateBounceRate(pageViews);
      const totalSessions = new Set(pageViews.map(pv => pv.sessionId)).size;
      const bounceRate = totalSessions > 0 ? (singlePageSessions / totalSessions) * 100 : 0;
      
      // Top pages
      const topPages = this.calculateTopPages(pageViews);
      
      // Traffic sources
      const trafficSources = this.calculateTrafficSources(pageViews);
      
      // Device breakdown
      const deviceBreakdown = this.calculateDeviceBreakdown(visitors);
      
      // Geographic data (mock implementation - would need actual geo data)
      const geographicData = this.calculateGeographicData(visitors);
      
      // RSVP conversion rate
      const rsvpConversionRate = this.calculateRSVPConversion(pageViews, interactions);
      
      // Popular features
      const popularFeatures = this.calculatePopularFeatures(interactions);
      
      // Peak visit times
      const peakVisitTimes = this.calculatePeakTimes(pageViews);
      
      // Guest engagement
      const guestEngagement = this.calculateGuestEngagement(visitors, pageViews, interactions);
      
      return {
        totalVisitors,
        uniqueVisitors,
        totalPageViews,
        averageTimeOnSite: Math.round(averageTimeOnSite),
        bounceRate: Math.round(bounceRate),
        topPages,
        trafficSources,
        deviceBreakdown,
        geographicData,
        rsvpConversionRate,
        popularFeatures,
        peakVisitTimes,
        guestEngagement
      };
    } catch (error) {
      console.error('Error getting website analytics:', error);
      return this.getEmptyAnalytics();
    }
  }

  // Get engagement insights and recommendations
  async getEngagementInsights(): Promise<EngagementInsights> {
    try {
      const analytics = await this.getWebsiteAnalytics('month');
      
      // Determine overall engagement level
      let overallEngagement: 'low' | 'medium' | 'high' = 'medium';
      if (analytics.averageTimeOnSite > 180 && analytics.bounceRate < 40) {
        overallEngagement = 'high';
      } else if (analytics.averageTimeOnSite < 60 || analytics.bounceRate > 70) {
        overallEngagement = 'low';
      }
      
      // Top performing pages
      const topPerformingPages = analytics.topPages
        .slice(0, 3)
        .map(page => page.page);
      
      // Identify improvement areas
      const improvementAreas: string[] = [];
      if (analytics.bounceRate > 60) improvementAreas.push('High bounce rate - improve landing page engagement');
      if (analytics.averageTimeOnSite < 120) improvementAreas.push('Low time on site - add more engaging content');
      if (analytics.rsvpConversionRate < 30) improvementAreas.push('Low RSVP conversion - simplify RSVP process');
      if (analytics.guestEngagement.rsvpCompletionRate < 50) improvementAreas.push('Many guests not completing RSVP');
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(analytics, overallEngagement);
      
      // Conversion funnel analysis
      const conversionFunnelAnalysis = this.analyzeConversionFunnel(analytics);
      
      // Guest behavior patterns
      const guestBehaviorPatterns = this.analyzeGuestBehavior(analytics);
      
      return {
        overallEngagement,
        topPerformingPages,
        improvementAreas,
        recommendations,
        conversionFunnelAnalysis,
        guestBehaviorPatterns
      };
    } catch (error) {
      console.error('Error getting engagement insights:', error);
      return {
        overallEngagement: 'low',
        topPerformingPages: [],
        improvementAreas: [],
        recommendations: [],
        conversionFunnelAnalysis: {
          landingPageViews: 0,
          detailPageViews: 0,
          rsvpPageViews: 0,
          rsvpSubmissions: 0,
          conversionRate: 0
        },
        guestBehaviorPatterns: {
          averageSessionDuration: 0,
          pagesPerSession: 0,
          returnVisitorRate: 0,
          mobileVsDesktop: { mobile: 0, desktop: 0 }
        }
      };
    }
  }

  // Private helper methods
  private categorizeSource(source?: string): PageView['source'] {
    if (!source) return 'direct';
    
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes('facebook') || lowerSource.includes('instagram') || lowerSource.includes('twitter')) return 'social';
    if (lowerSource.includes('email') || lowerSource.includes('gmail')) return 'email';
    if (lowerSource.includes('qr')) return 'qr';
    if (lowerSource.includes('google') || lowerSource.includes('search')) return 'search';
    
    return 'referral';
  }

  private getPeriodStart(period: 'week' | 'month' | 'quarter' | 'year'): Date {
    const now = new Date();
    const start = new Date(now);
    
    switch (period) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return start;
  }

  private async getPageViews(since: Date): Promise<PageView[]> {
    const pageViewsQuery = query(
      collection(db, 'couples', this.coupleId, 'websitePageViews'),
      where('timestamp', '>=', since),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(pageViewsQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    })) as PageView[];
  }

  private async getInteractions(since: Date): Promise<UserInteraction[]> {
    const interactionsQuery = query(
      collection(db, 'couples', this.coupleId, 'websiteInteractions'),
      where('timestamp', '>=', since),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(interactionsQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    })) as UserInteraction[];
  }

  private async getVisitors(since: Date): Promise<WebsiteVisitor[]> {
    const visitorsQuery = query(
      collection(db, 'couples', this.coupleId, 'websiteVisitors'),
      where('lastVisit', '>=', since)
    );
    const snapshot = await getDocs(visitorsQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      firstVisit: doc.data().firstVisit?.toDate() || new Date(),
      lastVisit: doc.data().lastVisit?.toDate() || new Date()
    })) as WebsiteVisitor[];
  }

  private async updateVisitorStats(visitorId: string, sessionId: string): Promise<void> {
    try {
      const visitorRef = doc(db, 'couples', this.coupleId, 'websiteVisitors', visitorId);
      const visitorDoc = await getDoc(visitorRef);
      
      if (visitorDoc.exists()) {
        await updateDoc(visitorRef, {
          lastVisit: new Date(),
          totalPageViews: visitorDoc.data().totalPageViews + 1
        });
      }
    } catch (error) {
      console.error('Error updating visitor stats:', error);
    }
  }

  private calculateBounceRate(pageViews: PageView[]): number {
    const sessionPageCounts = new Map<string, number>();
    
    pageViews.forEach(pv => {
      sessionPageCounts.set(pv.sessionId, (sessionPageCounts.get(pv.sessionId) || 0) + 1);
    });
    
    return Array.from(sessionPageCounts.values()).filter(count => count === 1).length;
  }

  private calculateTopPages(pageViews: PageView[]): Array<{page: string; views: number; averageTimeOnPage: number}> {
    const pageStats = new Map<string, {views: number; totalTime: number}>();
    
    pageViews.forEach(pv => {
      const current = pageStats.get(pv.page) || {views: 0, totalTime: 0};
      pageStats.set(pv.page, {
        views: current.views + 1,
        totalTime: current.totalTime + pv.timeOnPage
      });
    });
    
    return Array.from(pageStats.entries())
      .map(([page, stats]) => ({
        page,
        views: stats.views,
        averageTimeOnPage: Math.round(stats.totalTime / stats.views)
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  private calculateTrafficSources(pageViews: PageView[]): Array<{source: string; visitors: number; percentage: number}> {
    const sourceCounts = new Map<string, Set<string>>();
    
    pageViews.forEach(pv => {
      const source = pv.source || 'direct';
      if (!sourceCounts.has(source)) sourceCounts.set(source, new Set());
      sourceCounts.get(source)!.add(pv.visitorId);
    });
    
    const totalVisitors = new Set(pageViews.map(pv => pv.visitorId)).size;
    
    return Array.from(sourceCounts.entries())
      .map(([source, visitors]) => ({
        source,
        visitors: visitors.size,
        percentage: Math.round((visitors.size / totalVisitors) * 100)
      }))
      .sort((a, b) => b.visitors - a.visitors);
  }

  private calculateDeviceBreakdown(visitors: WebsiteVisitor[]): Array<{device: string; visitors: number; percentage: number}> {
    const deviceCounts = new Map<string, number>();
    
    visitors.forEach(v => {
      deviceCounts.set(v.device, (deviceCounts.get(v.device) || 0) + 1);
    });
    
    const total = visitors.length;
    
    return Array.from(deviceCounts.entries())
      .map(([device, count]) => ({
        device,
        visitors: count,
        percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.visitors - a.visitors);
  }

  private calculateGeographicData(visitors: WebsiteVisitor[]): Array<{location: string; visitors: number; percentage: number}> {
    // Mock implementation - would use actual geographic data
    const locations = ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany'];
    const total = visitors.length;
    
    return locations.map((location, index) => {
      const count = Math.floor(total * (0.5 / (index + 1))); // Mock distribution
      return {
        location,
        visitors: count,
        percentage: Math.round((count / total) * 100)
      };
    }).filter(item => item.visitors > 0);
  }

  private calculateRSVPConversion(pageViews: PageView[], interactions: UserInteraction[]): number {
    const rsvpPageViews = pageViews.filter(pv => pv.page.includes('rsvp')).length;
    const rsvpSubmissions = interactions.filter(i => i.type === 'rsvp').length;
    
    return rsvpPageViews > 0 ? Math.round((rsvpSubmissions / rsvpPageViews) * 100) : 0;
  }

  private calculatePopularFeatures(interactions: UserInteraction[]): Array<{feature: string; interactions: number; uniqueUsers: number}> {
    const featureStats = new Map<string, {interactions: number; users: Set<string>}>();
    
    interactions.forEach(i => {
      const feature = i.type;
      const current = featureStats.get(feature) || {interactions: 0, users: new Set()};
      featureStats.set(feature, {
        interactions: current.interactions + 1,
        users: current.users.add(i.visitorId)
      });
    });
    
    return Array.from(featureStats.entries())
      .map(([feature, stats]) => ({
        feature,
        interactions: stats.interactions,
        uniqueUsers: stats.users.size
      }))
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 5);
  }

  private calculatePeakTimes(pageViews: PageView[]): Array<{hour: number; visitors: number}> {
    const hourCounts = new Map<number, Set<string>>();
    
    pageViews.forEach(pv => {
      const hour = pv.timestamp.getHours();
      if (!hourCounts.has(hour)) hourCounts.set(hour, new Set());
      hourCounts.get(hour)!.add(pv.visitorId);
    });
    
    return Array.from(hourCounts.entries())
      .map(([hour, visitors]) => ({hour, visitors: visitors.size}))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 6);
  }

  private calculateGuestEngagement(visitors: WebsiteVisitor[], pageViews: PageView[], interactions: UserInteraction[]): WebsiteAnalytics['guestEngagement'] {
    const guestVisitors = visitors.filter(v => v.isGuest);
    const guestPageViews = pageViews.filter(pv => 
      guestVisitors.some(gv => gv.id === pv.visitorId)
    );
    
    const totalGuestVisitors = guestVisitors.length;
    const averageGuestSessions = totalGuestVisitors > 0 
      ? guestVisitors.reduce((sum, gv) => sum + gv.totalSessions, 0) / totalGuestVisitors 
      : 0;
    
    const rsvpInteractions = interactions.filter(i => i.type === 'rsvp');
    const rsvpCompletionRate = totalGuestVisitors > 0 
      ? (rsvpInteractions.length / totalGuestVisitors) * 100 
      : 0;
    
    return {
      totalGuestVisitors,
      averageGuestSessions: Math.round(averageGuestSessions * 10) / 10,
      guestPageViews: guestPageViews.length,
      rsvpCompletionRate: Math.round(rsvpCompletionRate)
    };
  }

  private generateRecommendations(analytics: WebsiteAnalytics, engagement: 'low' | 'medium' | 'high'): string[] {
    const recommendations: string[] = [];
    
    if (engagement === 'low') {
      recommendations.push('Add more engaging content like photo galleries or videos');
      recommendations.push('Simplify navigation to help guests find information quickly');
    }
    
    if (analytics.bounceRate > 60) {
      recommendations.push('Improve your homepage with clear navigation and compelling content');
    }
    
    if (analytics.rsvpConversionRate < 40) {
      recommendations.push('Make the RSVP process more prominent and user-friendly');
    }
    
    if (analytics.deviceBreakdown.find(d => d.device === 'mobile')?.percentage! > 60) {
      recommendations.push('Optimize the mobile experience for better engagement');
    }
    
    if (analytics.guestEngagement.rsvpCompletionRate < 50) {
      recommendations.push('Send RSVP reminders to guests who visited but didn\'t respond');
    }
    
    return recommendations;
  }

  private analyzeConversionFunnel(analytics: WebsiteAnalytics): EngagementInsights['conversionFunnelAnalysis'] {
    const landingPageViews = analytics.topPages.find(p => p.page === 'home')?.views || 0;
    const detailPageViews = analytics.topPages.filter(p => !['home', 'rsvp'].includes(p.page))
      .reduce((sum, p) => sum + p.views, 0);
    const rsvpPageViews = analytics.topPages.find(p => p.page === 'rsvp')?.views || 0;
    const rsvpSubmissions = Math.round(rsvpPageViews * (analytics.rsvpConversionRate / 100));
    
    return {
      landingPageViews,
      detailPageViews,
      rsvpPageViews,
      rsvpSubmissions,
      conversionRate: analytics.rsvpConversionRate
    };
  }

  private analyzeGuestBehavior(analytics: WebsiteAnalytics): EngagementInsights['guestBehaviorPatterns'] {
    const averageSessionDuration = analytics.averageTimeOnSite;
    const pagesPerSession = analytics.totalPageViews / Math.max(analytics.uniqueVisitors, 1);
    const returnVisitorRate = Math.max(0, (analytics.totalVisitors - analytics.uniqueVisitors) / analytics.totalVisitors * 100);
    
    const mobilePercentage = analytics.deviceBreakdown.find(d => d.device === 'mobile')?.percentage || 0;
    const desktopPercentage = analytics.deviceBreakdown.find(d => d.device === 'desktop')?.percentage || 0;
    
    return {
      averageSessionDuration,
      pagesPerSession: Math.round(pagesPerSession * 10) / 10,
      returnVisitorRate: Math.round(returnVisitorRate),
      mobileVsDesktop: {
        mobile: mobilePercentage,
        desktop: desktopPercentage
      }
    };
  }

  private getEmptyAnalytics(): WebsiteAnalytics {
    return {
      totalVisitors: 0,
      uniqueVisitors: 0,
      totalPageViews: 0,
      averageTimeOnSite: 0,
      bounceRate: 0,
      topPages: [],
      trafficSources: [],
      deviceBreakdown: [],
      geographicData: [],
      rsvpConversionRate: 0,
      popularFeatures: [],
      peakVisitTimes: [],
      guestEngagement: {
        totalGuestVisitors: 0,
        averageGuestSessions: 0,
        guestPageViews: 0,
        rsvpCompletionRate: 0
      }
    };
  }

  // Real-time listener for analytics updates
  subscribeToAnalytics(callback: (analytics: WebsiteAnalytics) => void): () => void {
    const unsubscribes: (() => void)[] = [];
    
    // Listen to page views changes
    const pageViewsUnsubscribe = onSnapshot(
      collection(db, 'couples', this.coupleId, 'websitePageViews'),
      () => {
        this.getWebsiteAnalytics('month').then(callback);
      }
    );
    unsubscribes.push(pageViewsUnsubscribe);
    
    // Listen to interactions changes
    const interactionsUnsubscribe = onSnapshot(
      collection(db, 'couples', this.coupleId, 'websiteInteractions'),
      () => {
        this.getWebsiteAnalytics('month').then(callback);
      }
    );
    unsubscribes.push(interactionsUnsubscribe);
    
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }
}

// Factory function for creating service instances
export function createWebsiteAnalyticsService(coupleId: string): WebsiteAnalyticsService {
  return new WebsiteAnalyticsService(coupleId);
}

// Utility functions for tracking
export async function trackWebsitePageView(
  coupleId: string,
  visitorId: string,
  sessionId: string,
  page: string,
  title: string,
  url: string,
  timeOnPage?: number
): Promise<void> {
  const service = createWebsiteAnalyticsService(coupleId);
  await service.trackPageView(visitorId, sessionId, page, title, url, timeOnPage);
}

export async function trackWebsiteInteraction(
  coupleId: string,
  visitorId: string,
  sessionId: string,
  type: UserInteraction['type'],
  element: string,
  page: string,
  metadata?: Record<string, any>
): Promise<void> {
  const service = createWebsiteAnalyticsService(coupleId);
  await service.trackInteraction(visitorId, sessionId, type, element, page, metadata);
}