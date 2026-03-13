export interface WorthingtonWhipResult {
    readonly shards: number;
    readonly numerator: number;
    readonly denominator: number;
    readonly savingsFraction: number;
}
export interface SpeculativeTreeResult {
    readonly alpha: number;
    readonly depth: number;
    readonly expectedAccepted: number;
    readonly denominator: number;
}
export interface TurbulentIdleResult {
    readonly stageCount: number;
    readonly chunkCount: number;
    readonly numerator: number;
    readonly denominator: number;
    readonly idleFraction: number;
}
export interface FrontierFillResult {
    readonly frontierByLayer: readonly number[];
    readonly layerCount: number;
    readonly frontierArea: number;
    readonly peakFrontier: number;
    readonly envelopeArea: number;
    readonly frontierFill: number;
    readonly wallaceNumber: number;
    readonly wally: number;
    readonly frontierDeficit: number;
}
export interface PipelineOccupancyResult {
    readonly stageCount: number;
    readonly chunkCount: number;
    readonly frontierArea: number;
    readonly capacityArea: number;
    readonly frontierFill: number;
    readonly occupancyDeficit: number;
}
export type PipelineRegime = 'laminar' | 'transitional' | 'turbulent';
export type ParallelismAction = 'expand' | 'staggered-expand' | 'hold' | 'multiplex' | 'constrain';
export interface AdaptiveParallelismPolicyResult {
    readonly intrinsicBeta1: number;
    readonly actualBeta1: number;
    readonly topologyDeficit: number;
    readonly stageCount: number;
    readonly chunkCount: number;
    readonly reynoldsEstimate: number;
    readonly regime: PipelineRegime;
    readonly frontierFill: number;
    readonly occupancyDeficit: number;
    readonly highOccupancyDeficit: boolean;
    readonly action: ParallelismAction;
    readonly rationale: string;
}
export interface QuantumDeficitResult {
    readonly sqrtN: number;
    readonly searchSize: number;
    readonly classicalDeficit: number;
    readonly quantumDeficit: number;
    readonly speedup: number;
}
export interface ProtocolDeficitResult {
    readonly streamCount: number;
    readonly intrinsicBeta1: number;
    readonly tcpDeficit: number;
    readonly quicDeficit: number;
    readonly flowDeficit: number;
}
export interface SettlementDeficitResult {
    readonly intrinsicBeta1: number;
    readonly sequentialDeficit: number;
    readonly parallelDeficit: number;
}
export declare function worthingtonWhipSavings(shards: number): WorthingtonWhipResult;
export declare function speculativeTreeExpectedAccepted(alpha: number, depth: number): SpeculativeTreeResult;
export declare function turbulentIdleFraction(stageCount: number, chunkCount: number): TurbulentIdleResult;
export declare function frontierFill(frontierByLayer: readonly number[]): FrontierFillResult;
export declare function pipelineOccupancy(stageCount: number, chunkCount: number): PipelineOccupancyResult;
export declare function classifyPipelineRegime(stageCount: number, chunkCount: number): PipelineRegime;
export declare function adaptiveParallelismPolicy(config: {
    intrinsicBeta1: number;
    actualBeta1: number;
    stageCount: number;
    chunkCount: number;
}): AdaptiveParallelismPolicyResult;
export declare function quantumDeficitIdentity(sqrtN: number): QuantumDeficitResult;
export declare function protocolDeficits(streamCount: number): ProtocolDeficitResult;
export declare function settlementDeficits(): SettlementDeficitResult;
export declare function beta2FromBandGap(forbiddenEnergyCount: number): number;
export declare function firstLawConserved(forkEnergy: number, foldWork: number, ventEnergy: number, tolerance?: number): boolean;
