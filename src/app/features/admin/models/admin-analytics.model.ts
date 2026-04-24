export interface AnalyticsGeneralSummary {
  totalPolicies: number;
  activePolicies: number;
  totalInstances: number;
  inProgressInstances: number;
  completedInstances: number;
  rejectedInstances: number;
  pendingTasks: number;
  completedTasks: number;
  averageResolutionTimeHours: number | null;
  hasEnoughResolutionTimeData: boolean;
}

export interface AnalyticsAverageByPolicy {
  policyId: string;
  policyName: string;
  averageHours: number;
  completedInstances: number;
}

export interface AnalyticsAverageByNode {
  nodeId: string;
  nodeName: string;
  averageHours: number;
  completedTasks: number;
}

export interface AnalyticsAverageByDepartment {
  departmentId: string;
  departmentName: string;
  averageHours: number;
  completedTasks: number;
}

export interface AnalyticsAverageByOfficial {
  officialId: string;
  officialName: string;
  averageHours: number;
  completedTasks: number;
}

export interface AnalyticsActivitySpeed {
  nodeId: string;
  nodeName: string;
  averageHours: number;
}

export interface AnalyticsAttentionTimesSummary {
  averageByPolicy: AnalyticsAverageByPolicy[];
  averageByNode: AnalyticsAverageByNode[];
  averageByDepartment: AnalyticsAverageByDepartment[];
  averageByOfficial: AnalyticsAverageByOfficial[];
  slowestActivity: AnalyticsActivitySpeed | null;
  fastestActivity: AnalyticsActivitySpeed | null;
  hasEnoughData: boolean;
}

export interface AnalyticsPendingByOfficial {
  officialId: string;
  officialName: string;
  pendingTasks: number;
  oldestTaskAgeHours: number | null;
}

export interface AnalyticsPendingByDepartment {
  departmentId: string;
  departmentName: string;
  pendingTasks: number;
  oldestTaskAgeHours: number | null;
}

export interface AnalyticsPendingByPolicy {
  policyId: string;
  policyName: string;
  pendingTasks: number;
  oldestTaskAgeHours: number | null;
}

export interface AnalyticsPendingByNode {
  nodeId: string;
  nodeName: string;
  pendingTasks: number;
  oldestTaskAgeHours: number | null;
}

export interface AnalyticsOldestPendingTask {
  taskId: string;
  policyName: string;
  nodeName: string;
  assignedToName: string | null;
  departmentName: string | null;
  ageHours: number;
  createdAt: string;
}

export interface AnalyticsTaskAccumulationSummary {
  pendingByOfficial: AnalyticsPendingByOfficial[];
  pendingByDepartment: AnalyticsPendingByDepartment[];
  pendingByPolicy: AnalyticsPendingByPolicy[];
  pendingByNode: AnalyticsPendingByNode[];
  oldestPendingTasks: AnalyticsOldestPendingTask[];
}

export interface AdminAnalyticsDashboardSummary {
  general: AnalyticsGeneralSummary;
  attentionTimes: AnalyticsAttentionTimesSummary;
  taskAccumulation: AnalyticsTaskAccumulationSummary;
}

export interface BottleneckItem {
  type: string;
  name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: string;
  impact: string;
  recommendation: string;
}

export interface BottlenecksResponse {
  summary: string;
  bottlenecks: BottleneckItem[];
  source: string;
  available: boolean;
}

export interface TaskRecommendationItem {
  fromOfficial: string;
  toOfficial: string;
  reason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedImpact: string;
}

export interface TaskRedistributionResponse {
  summary: string;
  recommendations: TaskRecommendationItem[];
  source: string;
  available: boolean;
}
