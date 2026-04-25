export interface SimulationRunRequest {
  instances: number;
  scenarioName: string;
  baseNodeDurationHours: number;
  variabilityPercent: number;
  includeAiAnalysis: boolean;
  randomSeed?: number | null;
}

export interface AiAnalysisResponse {
  summary?: string | null;
  conclusion?: string | null;
  recommendations?: string[];
  warnings?: string[];
  source?: string | null;
  available?: boolean | null;
  rawText?: string | null;
}

export interface NodeSimulationStats {
  nodeId?: string | null;
  nodeName: string;
  nodeType?: string | null;
  averageDurationHours?: number | null;
  totalEstimatedTimeHours?: number | null;
  totalExecutions?: number | null;
  loadPercentage?: number | null;
  waitingTimeHours?: number | null;
  bottleneck?: boolean;
}

export interface DecisionSimulationStats {
  nodeId?: string | null;
  nodeName: string;
  decisionName?: string | null;
  optionLabel: string;
  takenCount?: number | null;
  takenPercentage?: number | null;
  totalDecisions?: number | null;
}

export interface SimulationResult {
  id: string;
  policyId?: string | null;
  policyName?: string | null;
  scenarioName: string;
  status?: string | null;
  createdAt?: string | null;
  summary?: string | null;
  averageEstimatedTimeHours?: number | null;
  totalSimulatedInstances?: number | null;
  maxLoadNodeName?: string | null;
  maxLoadPercentage?: number | null;
  bottlenecks: string[];
  nodeStats: NodeSimulationStats[];
  decisionStats: DecisionSimulationStats[];
  warnings: string[];
  aiAnalysis?: AiAnalysisResponse | null;
}

export interface SimulationRunResponse {
  simulationId?: string | null;
  policyId?: string | null;
  policyName?: string | null;
  instances?: number | null;
  createdAt?: string | null;
  status?: string | null;
  message?: string | null;
  result?: SimulationResult | null;
}

export interface SimulationRunApiResponse {
  simulationId?: string | null;
  policyId?: string | null;
  policyName?: string | null;
  instances?: number | null;
  baseNodeDurationHours?: number | null;
  variabilityPercent?: number | null;
  includeAiAnalysis?: boolean | null;
  randomSeed?: number | null;
  createdBy?: string | null;
  createdAt?: string | null;
  result?: unknown;
}

export interface PolicyComparisonRequest {
  firstPolicyId: string;
  secondPolicyId: string;
  instances: number;
  scenarioName: string;
  baseNodeDurationHours: number;
  variabilityPercent: number;
  includeAiAnalysis: boolean;
  randomSeed?: number | null;
}

export interface PolicyComparisonResponse {
  policyAResult: SimulationResult;
  policyBResult: SimulationResult;
  winner?: 'A' | 'B' | 'TIE' | string | null;
  moreEfficientPolicyId?: string | null;
  moreEfficientPolicyName?: string | null;
  averageTimeDifferenceHours?: number | null;
  bottleneckDifference?: number | null;
  conclusion?: string | null;
  aiAnalysis?: AiAnalysisResponse | null;
}

export interface PolicyComparisonApiResponse {
  result?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function hasValues(record: Record<string, unknown>): boolean {
  return Object.values(record).some((value) => {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(asRecord(value)).length > 0;
    }

    return true;
  });
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }

  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }

      const record = asRecord(item);
      return (
        asString(record['name']) ||
        asString(record['label']) ||
        asString(record['nodeName']) ||
        asString(record['message'])
      );
    })
    .filter(Boolean);
}

function pickEmbeddedRecord(
  source: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> {
  for (const key of keys) {
    const record = asRecord(source[key]);
    if (hasValues(record)) {
      return record;
    }
  }

  return {};
}

function buildAiAnalysisFromFields(source: Record<string, unknown>): AiAnalysisResponse | null {
  return normalizeAiAnalysis({
    summary:
      source['summary'] ??
      source['aiSummary'] ??
      source['analysis'] ??
      source['text'],
    conclusion:
      source['conclusion'] ??
      source['executiveConclusion'],
    recommendations:
      source['recommendations'] ??
      source['suggestions'] ??
      source['comparisonHighlights'] ??
      source['strengths'],
    warnings:
      source['warnings'] ??
      source['detectedIssues'] ??
      source['risks'],
    source: source['source'] ?? source['aiSource'],
    available: source['available'] ?? source['aiAvailable'],
    rawText: source['rawText'] ?? source['text'],
  });
}

function roundPercentage(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 1000) / 10;
}

export function normalizeAiAnalysis(value: unknown): AiAnalysisResponse | null {
  const record = asRecord(value);

  const analysis: AiAnalysisResponse = {
    summary:
      asOptionalString(record['summary']) ??
      asOptionalString(record['analysis']) ??
      asOptionalString(record['text']),
    conclusion:
      asOptionalString(record['conclusion']) ??
      asOptionalString(record['executiveConclusion']),
    recommendations: asStringArray(
      record['recommendations'] ?? record['suggestions'] ?? record['strengths']
    ),
    warnings: asStringArray(
      record['warnings'] ?? record['detectedIssues'] ?? record['risks']
    ),
    source: asOptionalString(record['source']) ?? asOptionalString(record['aiSource']),
    available: asBoolean(record['available']) ?? asBoolean(record['aiAvailable']),
    rawText: asOptionalString(record['rawText']) ?? asOptionalString(record['text']),
  };

  const analysisRecord = {
    summary: analysis.summary,
    conclusion: analysis.conclusion,
    recommendations: analysis.recommendations,
    warnings: analysis.warnings,
    source: analysis.source,
    available: analysis.available,
    rawText: analysis.rawText,
  };

  return hasValues(analysisRecord) ? analysis : null;
}

export function normalizeNodeStats(value: unknown): NodeSimulationStats[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const record = asRecord(entry);

    return {
      nodeId: asOptionalString(record['nodeId']) ?? asOptionalString(record['id']),
      nodeName:
        asString(record['nodeName']) ||
        asString(record['name']) ||
        asString(record['node']) ||
        'Nodo sin nombre',
      nodeType: asOptionalString(record['nodeType']) ?? asOptionalString(record['type']),
      averageDurationHours:
        asNumber(record['averageDurationHours']) ??
        asNumber(record['avgDurationHours']) ??
        asNumber(record['averageTimeHours']) ??
        asNumber(record['averageEstimatedTimeHours']),
      totalEstimatedTimeHours:
        asNumber(record['totalEstimatedTimeHours']) ??
        asNumber(record['totalTimeHours']),
      totalExecutions:
        asNumber(record['totalExecutions']) ??
        asNumber(record['executions']) ??
        asNumber(record['count']),
      loadPercentage:
        asNumber(record['loadPercentage']) ??
        asNumber(record['percentageLoad']) ??
        asNumber(record['loadPercent']),
      waitingTimeHours:
        asNumber(record['waitingTimeHours']) ?? asNumber(record['queueTimeHours']),
      bottleneck:
        asBoolean(record['bottleneck']) ??
        asBoolean(record['isBottleneck']) ??
        false,
    };
  });
}

export function normalizeDecisionStats(value: unknown): DecisionSimulationStats[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const record = asRecord(entry);
    const totalDecisions =
      asNumber(record['totalDecisions']) ??
      asNumber(record['takenCount']) ??
      asNumber(record['count']) ??
      0;
    const outcomes = asRecord(record['outcomes']);

    if (hasValues(outcomes)) {
      return Object.entries(outcomes)
        .map(([label, count]) => ({
          nodeId: asOptionalString(record['nodeId']) ?? asOptionalString(record['id']),
          nodeName:
            asString(record['nodeName']) ||
            asString(record['decisionName']) ||
            asString(record['name']) ||
            'Decision',
          decisionName:
            asOptionalString(record['decisionName']) ??
            asOptionalString(record['name']) ??
            asOptionalString(record['nodeName']),
          optionLabel: label,
          takenCount: asNumber(count),
          takenPercentage: roundPercentage(asNumber(count) ?? 0, totalDecisions),
          totalDecisions,
        }))
        .sort((left, right) => (right.takenCount ?? 0) - (left.takenCount ?? 0));
    }

    return [
      {
        nodeId: asOptionalString(record['nodeId']) ?? asOptionalString(record['id']),
        nodeName:
          asString(record['nodeName']) ||
          asString(record['decisionName']) ||
          asString(record['name']) ||
          'Decision',
        decisionName:
          asOptionalString(record['decisionName']) ?? asOptionalString(record['name']),
        optionLabel:
          asString(record['optionLabel']) ||
          asString(record['option']) ||
          asString(record['result']) ||
          'Sin etiqueta',
        takenCount:
          asNumber(record['takenCount']) ??
          asNumber(record['count']) ??
          asNumber(record['executions']),
        takenPercentage:
          asNumber(record['takenPercentage']) ??
          asNumber(record['percentage']) ??
          asNumber(record['ratio']),
        totalDecisions,
      },
    ];
  });
}

export function normalizeSimulationResult(value: unknown): SimulationResult {
  const record = asRecord(value);
  const embeddedResult = pickEmbeddedRecord(record, 'result', 'simulation');
  const data = hasValues(embeddedResult) ? embeddedResult : record;
  const summary = asRecord(record['summary']);

  const policyId =
    asOptionalString(record['policyId']) ??
    asOptionalString(data['policyId']) ??
    asOptionalString(asRecord(record['policy'])['id']);
  const policyName =
    asOptionalString(record['policyName']) ??
    asOptionalString(data['policyName']) ??
    asOptionalString(asRecord(record['policy'])['nombre']) ??
    asOptionalString(asRecord(record['policy'])['name']);
  const createdAt =
    asOptionalString(record['createdAt']) ??
    asOptionalString(data['generatedAt']) ??
    asOptionalString(data['createdAt']) ??
    asOptionalString(record['executedAt']) ??
    asOptionalString(record['fechaCreacion']);

  const aiAnalysis =
    normalizeAiAnalysis(
      record['aiAnalysis'] ??
        record['ai'] ??
        data['aiAnalysis'] ??
        data['ai']
    ) ??
    buildAiAnalysisFromFields({
      summary: data['aiSummary'] ?? record['aiSummary'],
      source: data['aiSource'] ?? record['aiSource'],
      available: data['aiAvailable'] ?? record['aiAvailable'],
      recommendations:
        data['recommendations'] ??
        record['recommendations'] ??
        record['comparisonHighlights'],
      detectedIssues: data['detectedIssues'] ?? record['detectedIssues'],
      risks: data['risks'] ?? record['risks'],
      executiveConclusion:
        data['executiveConclusion'] ?? record['executiveConclusion'],
    });

  return {
    id:
      asString(record['id']) ||
      asString(record['simulationId']) ||
      asString(data['id']) ||
      asString(summary['simulationId']) ||
      '',
    policyId,
    policyName,
    scenarioName:
      asString(record['scenarioName']) ||
      asString(data['scenarioName']) ||
      asString(summary['scenarioName']) ||
      asString(policyName) ||
      'Simulacion',
    status: asOptionalString(record['status']),
    createdAt,
    summary:
      asOptionalString(data['summaryText']) ??
      asOptionalString(summary['summary']) ??
      asOptionalString(record['description']),
    averageEstimatedTimeHours:
      asNumber(data['averageEstimatedTimeHours']) ??
      asNumber(data['averageTimeHours']) ??
      asNumber(summary['averageEstimatedTimeHours']) ??
      asNumber(summary['averageTimeHours']),
    totalSimulatedInstances:
      asNumber(data['instancesSimulated']) ??
      asNumber(data['totalSimulatedInstances']) ??
      asNumber(record['instances']) ??
      asNumber(summary['totalSimulatedInstances']) ??
      asNumber(summary['instances']),
    maxLoadNodeName:
      asOptionalString(data['highestLoadNodeName']) ??
      asOptionalString(data['maxLoadNodeName']) ??
      asOptionalString(record['mostLoadedNode']) ??
      asOptionalString(summary['maxLoadNodeName']),
    maxLoadPercentage:
      asNumber(data['highestLoadPercentage']) ??
      asNumber(data['maxLoadPercentage']) ??
      asNumber(record['loadPercentage']) ??
      asNumber(summary['maxLoadPercentage']),
    bottlenecks: asStringArray(
      data['bottleneckNodeNames'] ??
        data['bottlenecks'] ??
        summary['bottlenecks']
    ),
    nodeStats: normalizeNodeStats(
      data['nodeStats'] ?? data['nodeSimulationStats'] ?? data['nodeStatistics']
    ),
    decisionStats: normalizeDecisionStats(
      data['decisionStats'] ??
        data['decisionSimulationStats'] ??
        data['decisionStatistics']
    ),
    warnings: asStringArray(data['warnings']),
    aiAnalysis,
  };
}

export function normalizeSimulationRunResponse(value: unknown): SimulationRunResponse {
  const record = asRecord(value);
  const resultRecord = pickEmbeddedRecord(record, 'result', 'simulation');

  return {
    simulationId:
      asOptionalString(record['simulationId']) ??
      asOptionalString(record['id']) ??
      null,
    policyId: asOptionalString(record['policyId']),
    policyName: asOptionalString(record['policyName']),
    instances: asNumber(record['instances']),
    createdAt: asOptionalString(record['createdAt']),
    status: asOptionalString(record['status']),
    message: asOptionalString(record['message']),
    result: hasValues(resultRecord) || hasValues(record) ? normalizeSimulationResult(record) : null,
  };
}

export function normalizeComparisonResponse(value: unknown): PolicyComparisonResponse {
  const record = asRecord(value);
  const result = pickEmbeddedRecord(record, 'result', 'comparison');

  const policyAResult = hasValues(result)
    ? normalizeSimulationResult({
        policyId: result['firstPolicyId'],
        policyName: result['firstPolicyName'],
        createdAt: result['comparedAt'],
        result: result['firstPolicyResult'],
      })
    : normalizeSimulationResult(
        record['policyAResult'] ?? record['resultA'] ?? record['simulationA']
      );

  const policyBResult = hasValues(result)
    ? normalizeSimulationResult({
        policyId: result['secondPolicyId'],
        policyName: result['secondPolicyName'],
        createdAt: result['comparedAt'],
        result: result['secondPolicyResult'],
      })
    : normalizeSimulationResult(
        record['policyBResult'] ?? record['resultB'] ?? record['simulationB']
      );

  const moreEfficientPolicyId =
    asOptionalString(result['moreEfficientPolicyId']) ??
    asOptionalString(record['moreEfficientPolicyId']) ??
    asOptionalString(record['bestPolicyId']);
  const firstPolicyId =
    asOptionalString(result['firstPolicyId']) ?? policyAResult.policyId ?? null;
  const secondPolicyId =
    asOptionalString(result['secondPolicyId']) ?? policyBResult.policyId ?? null;
  const firstBottleneckCount =
    asNumber(result['firstBottleneckCount']) ?? policyAResult.bottlenecks.length;
  const secondBottleneckCount =
    asNumber(result['secondBottleneckCount']) ?? policyBResult.bottlenecks.length;

  const aiAnalysis =
    normalizeAiAnalysis(
      result['aiAnalysis'] ??
        result['ai'] ??
        record['aiAnalysis'] ??
        record['ai']
    ) ??
    buildAiAnalysisFromFields({
      summary: result['aiSummary'] ?? record['aiSummary'],
      source: result['aiSource'] ?? record['aiSource'],
      available: result['aiAvailable'] ?? record['aiAvailable'],
      recommendations:
        result['comparisonHighlights'] ?? record['comparisonHighlights'],
      executiveConclusion:
        result['executiveConclusion'] ?? record['executiveConclusion'],
      conclusion: result['conclusion'] ?? record['conclusion'],
    });

  let winner: 'A' | 'B' | 'TIE' | string | null = null;
  if (moreEfficientPolicyId && firstPolicyId && moreEfficientPolicyId === firstPolicyId) {
    winner = 'A';
  } else if (
    moreEfficientPolicyId &&
    secondPolicyId &&
    moreEfficientPolicyId === secondPolicyId
  ) {
    winner = 'B';
  }

  if (
    winner === null &&
    policyAResult.averageEstimatedTimeHours !== null &&
    policyAResult.averageEstimatedTimeHours !== undefined &&
    policyBResult.averageEstimatedTimeHours !== null &&
    policyBResult.averageEstimatedTimeHours !== undefined &&
    policyAResult.averageEstimatedTimeHours === policyBResult.averageEstimatedTimeHours
  ) {
    winner = 'TIE';
  }

  return {
    policyAResult,
    policyBResult,
    winner,
    moreEfficientPolicyId,
    moreEfficientPolicyName:
      asOptionalString(result['moreEfficientPolicyName']) ??
      asOptionalString(record['moreEfficientPolicyName']) ??
      asOptionalString(record['bestPolicyName']),
    averageTimeDifferenceHours:
      asNumber(result['averageTimeDifferenceHours']) ??
      asNumber(record['averageTimeDifferenceHours']) ??
      asNumber(record['timeDifferenceHours']),
    bottleneckDifference:
      asNumber(result['bottleneckDifference']) ??
      asNumber(record['bottleneckDifference']) ??
      Math.abs((firstBottleneckCount ?? 0) - (secondBottleneckCount ?? 0)),
    conclusion:
      asOptionalString(result['conclusion']) ??
      asOptionalString(record['conclusion']),
    aiAnalysis,
  };
}
