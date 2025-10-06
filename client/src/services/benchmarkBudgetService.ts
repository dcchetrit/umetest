import { db } from '@ume/shared';
import { 
  collection, 
  doc,
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';

export interface MarketRateBenchmark {
  categoryId: string;
  categoryName: string;
  averageRate: number;
  lowRange: number;
  highRange: number;
  sampleSize: number;
  region: string;
  lastUpdated: Date;
  currency: string;
}

export interface BudgetBenchmarkAnalysis {
  categoryId: string;
  categoryName: string;
  userBudget: number;
  marketAverage: number;
  marketLowRange: number;
  marketHighRange: number;
  variance: number;
  variancePercentage: number;
  status: 'well_below' | 'below' | 'within_range' | 'above' | 'well_above';
  recommendation: string;
  confidenceLevel: 'low' | 'medium' | 'high';
}

export interface BenchmarkAlert {
  id: string;
  categoryId: string;
  categoryName: string;
  alertType: 'budget_too_low' | 'budget_too_high' | 'market_rate_changed' | 'insufficient_data';
  message: string;
  recommendation: string;
  severity: 'info' | 'warning' | 'critical';
  userBudget: number;
  marketAverage: number;
  createdAt: Date;
  acknowledged: boolean;
}

// Default market rate benchmarks (these would typically come from an API or database)
const DEFAULT_MARKET_RATES: Record<string, Omit<MarketRateBenchmark, 'categoryId' | 'lastUpdated'>> = {
  'Venue & Ceremony': {
    categoryName: 'Venue & Ceremony',
    averageRate: 12000,
    lowRange: 8000,
    highRange: 20000,
    sampleSize: 1500,
    region: 'US',
    currency: 'USD'
  },
  'Catering & Drinks': {
    categoryName: 'Catering & Drinks',
    averageRate: 8500,
    lowRange: 5000,
    highRange: 15000,
    sampleSize: 1200,
    region: 'US',
    currency: 'USD'
  },
  'Photographer & Videographer': {
    categoryName: 'Photographer & Videographer',
    averageRate: 3500,
    lowRange: 2000,
    highRange: 6000,
    sampleSize: 800,
    region: 'US',
    currency: 'USD'
  },
  'Music / Entertainment': {
    categoryName: 'Music / Entertainment',
    averageRate: 1800,
    lowRange: 1000,
    highRange: 3500,
    sampleSize: 600,
    region: 'US',
    currency: 'USD'
  },
  'Flowers & Decoration': {
    categoryName: 'Flowers & Decoration',
    averageRate: 2200,
    lowRange: 1200,
    highRange: 4000,
    sampleSize: 700,
    region: 'US',
    currency: 'USD'
  },
  'Bride & Groom Attire': {
    categoryName: 'Bride & Groom Attire',
    averageRate: 2800,
    lowRange: 1500,
    highRange: 5000,
    sampleSize: 500,
    region: 'US',
    currency: 'USD'
  },
  'Hair & Makeup': {
    categoryName: 'Hair & Makeup',
    averageRate: 800,
    lowRange: 400,
    highRange: 1500,
    sampleSize: 400,
    region: 'US',
    currency: 'USD'
  },
  'Invitations & Stationery': {
    categoryName: 'Invitations & Stationery',
    averageRate: 600,
    lowRange: 300,
    highRange: 1200,
    sampleSize: 350,
    region: 'US',
    currency: 'USD'
  },
  'Transportation': {
    categoryName: 'Transportation',
    averageRate: 800,
    lowRange: 400,
    highRange: 1500,
    sampleSize: 300,
    region: 'US',
    currency: 'USD'
  },
  'Guest Accommodation': {
    categoryName: 'Guest Accommodation',
    averageRate: 3000,
    lowRange: 1500,
    highRange: 6000,
    sampleSize: 250,
    region: 'US',
    currency: 'USD'
  },
  'Wedding Planner': {
    categoryName: 'Wedding Planner',
    averageRate: 4000,
    lowRange: 2000,
    highRange: 8000,
    sampleSize: 400,
    region: 'US',
    currency: 'USD'
  },
  'Miscellaneous / Contingency': {
    categoryName: 'Miscellaneous / Contingency',
    averageRate: 2000,
    lowRange: 1000,
    highRange: 4000,
    sampleSize: 800,
    region: 'US',
    currency: 'USD'
  }
};

export class BenchmarkBudgetService {
  constructor(private coupleId: string) {}

  // Get market rate benchmarks for all categories
  async getMarketRateBenchmarks(): Promise<MarketRateBenchmark[]> {
    try {
      const benchmarks: MarketRateBenchmark[] = [];
      
      for (const [categoryKey, benchmark] of Object.entries(DEFAULT_MARKET_RATES)) {
        const categoryId = categoryKey.toLowerCase().replace(/\s+/g, '-');
        benchmarks.push({
          categoryId,
          ...benchmark,
          lastUpdated: new Date()
        });
      }
      
      return benchmarks;
    } catch (error) {
      console.error('Error fetching market rate benchmarks:', error);
      return [];
    }
  }

  // Analyze user's budget against market benchmarks
  async analyzeBudgetBenchmarks(): Promise<BudgetBenchmarkAnalysis[]> {
    try {
      const [benchmarks, budgetAllocations] = await Promise.all([
        this.getMarketRateBenchmarks(),
        this.getBudgetAllocations()
      ]);
      
      const analyses: BudgetBenchmarkAnalysis[] = [];
      
      for (const benchmark of benchmarks) {
        const allocation = budgetAllocations.find(a => 
          a.categoryId === benchmark.categoryId || 
          a.categoryName === benchmark.categoryName
        );
        
        if (allocation) {
          const analysis = this.analyzeCategoryBenchmark(allocation.plannedAmount, benchmark);
          analyses.push({
            categoryId: benchmark.categoryId,
            categoryName: benchmark.categoryName,
            userBudget: allocation.plannedAmount,
            ...analysis
          });
        }
      }
      
      return analyses.sort((a, b) => Math.abs(b.variancePercentage) - Math.abs(a.variancePercentage));
    } catch (error) {
      console.error('Error analyzing budget benchmarks:', error);
      return [];
    }
  }

  // Generate benchmark alerts for budget deviations
  async generateBenchmarkAlerts(): Promise<BenchmarkAlert[]> {
    try {
      const analyses = await this.analyzeBudgetBenchmarks();
      const alerts: BenchmarkAlert[] = [];
      
      for (const analysis of analyses) {
        const alert = this.createAlertFromAnalysis(analysis);
        if (alert) {
          alerts.push(alert);
        }
      }
      
      return alerts;
    } catch (error) {
      console.error('Error generating benchmark alerts:', error);
      return [];
    }
  }

  // Get benchmark insights and recommendations
  async getBenchmarkInsights(): Promise<{
    totalCategories: number;
    categoriesAnalyzed: number;
    overBudgetCategories: number;
    underBudgetCategories: number;
    withinRangeCategories: number;
    totalBudgetVariance: number;
    riskLevel: 'low' | 'medium' | 'high';
    topConcerns: BudgetBenchmarkAnalysis[];
    recommendations: string[];
  }> {
    try {
      const analyses = await this.analyzeBudgetBenchmarks();
      
      const totalCategories = Object.keys(DEFAULT_MARKET_RATES).length;
      const categoriesAnalyzed = analyses.length;
      const overBudgetCategories = analyses.filter(a => a.status === 'above' || a.status === 'well_above').length;
      const underBudgetCategories = analyses.filter(a => a.status === 'below' || a.status === 'well_below').length;
      const withinRangeCategories = analyses.filter(a => a.status === 'within_range').length;
      
      const totalBudgetVariance = analyses.reduce((sum, a) => sum + Math.abs(a.variance), 0);
      
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (overBudgetCategories > categoriesAnalyzed * 0.4) riskLevel = 'high';
      else if (overBudgetCategories > categoriesAnalyzed * 0.2) riskLevel = 'medium';
      
      const topConcerns = analyses
        .filter(a => Math.abs(a.variancePercentage) > 30)
        .slice(0, 3);
      
      const recommendations: string[] = [];
      
      if (overBudgetCategories > 0) {
        recommendations.push(`Consider reducing budgets for ${overBudgetCategories} over-budget categories to align with market rates.`);
      }
      
      if (underBudgetCategories > categoriesAnalyzed * 0.3) {
        recommendations.push(`You may be under-budgeting in ${underBudgetCategories} categories. Consider realistic market expectations.`);
      }
      
      if (riskLevel === 'high') {
        recommendations.push('Your overall budget significantly exceeds market rates. Consider prioritizing essential categories.');
      }
      
      if (topConcerns.length > 0) {
        recommendations.push(`Focus on ${topConcerns[0].categoryName} - it's ${Math.abs(topConcerns[0].variancePercentage)}% ${topConcerns[0].variance > 0 ? 'above' : 'below'} market rates.`);
      }
      
      return {
        totalCategories,
        categoriesAnalyzed,
        overBudgetCategories,
        underBudgetCategories,
        withinRangeCategories,
        totalBudgetVariance,
        riskLevel,
        topConcerns,
        recommendations
      };
    } catch (error) {
      console.error('Error getting benchmark insights:', error);
      return {
        totalCategories: 0,
        categoriesAnalyzed: 0,
        overBudgetCategories: 0,
        underBudgetCategories: 0,
        withinRangeCategories: 0,
        totalBudgetVariance: 0,
        riskLevel: 'low',
        topConcerns: [],
        recommendations: []
      };
    }
  }

  // Private helper methods
  private analyzeCategoryBenchmark(userBudget: number, benchmark: MarketRateBenchmark): Omit<BudgetBenchmarkAnalysis, 'categoryId' | 'categoryName' | 'userBudget'> {
    const variance = userBudget - benchmark.averageRate;
    const variancePercentage = benchmark.averageRate > 0 ? (variance / benchmark.averageRate) * 100 : 0;
    
    let status: BudgetBenchmarkAnalysis['status'] = 'within_range';
    let recommendation = '';
    let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
    
    // Determine confidence level based on sample size
    if (benchmark.sampleSize < 200) confidenceLevel = 'low';
    else if (benchmark.sampleSize > 800) confidenceLevel = 'high';
    
    // Determine status and recommendation
    if (variancePercentage > 50) {
      status = 'well_above';
      recommendation = `Your budget is significantly above market rates. Consider reducing by $${Math.round(variance * 0.7)} to align with market expectations.`;
    } else if (variancePercentage > 20) {
      status = 'above';
      recommendation = `Your budget is above market rates. Consider reducing by $${Math.round(variance * 0.5)} or ensure you're getting premium value.`;
    } else if (variancePercentage < -50) {
      status = 'well_below';
      recommendation = `Your budget may be unrealistically low. Consider increasing by $${Math.round(Math.abs(variance) * 0.7)} for realistic expectations.`;
    } else if (variancePercentage < -20) {
      status = 'below';
      recommendation = `Your budget is below market rates. Consider if this aligns with your quality expectations or increase by $${Math.round(Math.abs(variance) * 0.5)}.`;
    } else {
      recommendation = 'Your budget is well-aligned with market rates. Great planning!';
    }
    
    return {
      marketAverage: benchmark.averageRate,
      marketLowRange: benchmark.lowRange,
      marketHighRange: benchmark.highRange,
      variance: Math.round(variance),
      variancePercentage: Math.round(variancePercentage),
      status,
      recommendation,
      confidenceLevel
    };
  }

  private createAlertFromAnalysis(analysis: BudgetBenchmarkAnalysis): BenchmarkAlert | null {
    if (Math.abs(analysis.variancePercentage) < 30) {
      return null; // Only create alerts for significant deviations
    }
    
    let alertType: BenchmarkAlert['alertType'];
    let severity: BenchmarkAlert['severity'];
    let message: string;
    
    if (analysis.variancePercentage > 50) {
      alertType = 'budget_too_high';
      severity = 'critical';
      message = `Your ${analysis.categoryName} budget is ${analysis.variancePercentage}% above market rates ($${analysis.userBudget.toLocaleString()} vs $${analysis.marketAverage.toLocaleString()} average).`;
    } else if (analysis.variancePercentage > 30) {
      alertType = 'budget_too_high';
      severity = 'warning';
      message = `Your ${analysis.categoryName} budget is ${analysis.variancePercentage}% above market rates.`;
    } else if (analysis.variancePercentage < -50) {
      alertType = 'budget_too_low';
      severity = 'warning';
      message = `Your ${analysis.categoryName} budget may be too low (${Math.abs(analysis.variancePercentage)}% below market rates).`;
    } else {
      alertType = 'budget_too_low';
      severity = 'info';
      message = `Your ${analysis.categoryName} budget is below market average.`;
    }
    
    return {
      id: `benchmark-alert-${analysis.categoryId}-${Date.now()}`,
      categoryId: analysis.categoryId,
      categoryName: analysis.categoryName,
      alertType,
      message,
      recommendation: analysis.recommendation,
      severity,
      userBudget: analysis.userBudget,
      marketAverage: analysis.marketAverage,
      createdAt: new Date(),
      acknowledged: false
    };
  }

  private async getBudgetAllocations(): Promise<Array<{categoryId: string; categoryName: string; plannedAmount: number}>> {
    try {
      const allocationsQuery = query(collection(db, 'couples', this.coupleId, 'budgetAllocations'));
      const snapshot = await getDocs(allocationsQuery);
      
      return snapshot.docs.map(doc => ({
        categoryId: doc.data().categoryId || '',
        categoryName: doc.data().categoryName || '',
        plannedAmount: doc.data().plannedAmount || 0
      }));
    } catch (error) {
      console.error('Error fetching budget allocations:', error);
      return [];
    }
  }

  // Real-time listener for benchmark analysis
  subscribeToBenchmarkAnalysis(callback: (insights: any) => void): () => void {
    const unsubscribes: (() => void)[] = [];
    
    // Listen to budget allocations changes
    const allocationsUnsubscribe = onSnapshot(
      collection(db, 'couples', this.coupleId, 'budgetAllocations'),
      () => {
        this.getBenchmarkInsights().then(callback);
      }
    );
    unsubscribes.push(allocationsUnsubscribe);
    
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }
}

// Factory function for creating service instances
export function createBenchmarkBudgetService(coupleId: string): BenchmarkBudgetService {
  return new BenchmarkBudgetService(coupleId);
}

// Utility functions
export async function analyzeBudgetAgainstMarketRates(coupleId: string): Promise<BudgetBenchmarkAnalysis[]> {
  const service = createBenchmarkBudgetService(coupleId);
  return await service.analyzeBudgetBenchmarks();
}

export async function getBenchmarkAlerts(coupleId: string): Promise<BenchmarkAlert[]> {
  const service = createBenchmarkBudgetService(coupleId);
  return await service.generateBenchmarkAlerts();
}