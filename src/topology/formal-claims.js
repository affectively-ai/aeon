function assertPositiveInteger(name, value) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
    return value;
}
function assertUnitIntervalOpen(name, value) {
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new Error(`${name} must be in [0, 1)`);
    }
    return value;
}
function assertNonNegativeFinite(name, value) {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${name} must be a non-negative finite number`);
    }
    return value;
}
function assertNonNegativeInteger(name, value) {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${name} must be a non-negative integer`);
    }
    return value;
}
function assertNonEmptyFrontier(frontierByLayer) {
    if (frontierByLayer.length === 0) {
        throw new Error('frontierByLayer must contain at least one layer');
    }
    frontierByLayer.forEach((width, index) => {
        assertNonNegativeInteger(`frontierByLayer[${index}]`, width);
    });
    return frontierByLayer;
}
export function worthingtonWhipSavings(shards) {
    const normalizedShards = assertPositiveInteger('shards', shards);
    const numerator = normalizedShards - 1;
    const denominator = 2 * normalizedShards;
    return {
        shards: normalizedShards,
        numerator,
        denominator,
        savingsFraction: numerator / denominator,
    };
}
export function speculativeTreeExpectedAccepted(alpha, depth) {
    const normalizedAlpha = assertUnitIntervalOpen('alpha', alpha);
    const normalizedDepth = assertPositiveInteger('depth', depth);
    const denominator = 1 - normalizedAlpha;
    return {
        alpha: normalizedAlpha,
        depth: normalizedDepth,
        expectedAccepted: (1 - Math.pow(normalizedAlpha, normalizedDepth)) / denominator,
        denominator,
    };
}
export function turbulentIdleFraction(stageCount, chunkCount) {
    const normalizedStageCount = assertPositiveInteger('stageCount', stageCount);
    const normalizedChunkCount = assertPositiveInteger('chunkCount', chunkCount);
    const numerator = normalizedStageCount * (normalizedStageCount - 1);
    const denominator = normalizedStageCount * (normalizedChunkCount + normalizedStageCount - 1);
    return {
        stageCount: normalizedStageCount,
        chunkCount: normalizedChunkCount,
        numerator,
        denominator,
        idleFraction: numerator / denominator,
    };
}
export function frontierFill(frontierByLayer) {
    const normalizedFrontier = assertNonEmptyFrontier(frontierByLayer);
    const layerCount = normalizedFrontier.length;
    const frontierArea = normalizedFrontier.reduce((sum, width) => sum + width, 0);
    const peakFrontier = normalizedFrontier.reduce((peak, width) => Math.max(peak, width), 0);
    const envelopeArea = layerCount * peakFrontier;
    const fill = envelopeArea === 0 ? 1 : frontierArea / envelopeArea;
    const wallaceNumber = 1 - fill;
    return {
        frontierByLayer: [...normalizedFrontier],
        layerCount,
        frontierArea,
        peakFrontier,
        envelopeArea,
        frontierFill: fill,
        wallaceNumber,
        wally: wallaceNumber,
        frontierDeficit: wallaceNumber,
    };
}
export function pipelineOccupancy(stageCount, chunkCount) {
    const normalizedStageCount = assertPositiveInteger('stageCount', stageCount);
    const normalizedChunkCount = assertPositiveInteger('chunkCount', chunkCount);
    const frontierArea = normalizedStageCount * normalizedChunkCount;
    const capacityArea =
        normalizedStageCount *
            (normalizedChunkCount + normalizedStageCount - 1);
    const fill = frontierArea / capacityArea;
    return {
        stageCount: normalizedStageCount,
        chunkCount: normalizedChunkCount,
        frontierArea,
        capacityArea,
        frontierFill: fill,
        occupancyDeficit: 1 - fill,
    };
}
export function classifyPipelineRegime(stageCount, chunkCount) {
    const normalizedStageCount = assertPositiveInteger('stageCount', stageCount);
    const normalizedChunkCount = assertPositiveInteger('chunkCount', chunkCount);
    const reynoldsEstimate = normalizedStageCount / normalizedChunkCount;
    if (reynoldsEstimate < 0.3) {
        return 'laminar';
    }
    if (reynoldsEstimate > 0.7) {
        return 'turbulent';
    }
    return 'transitional';
}
export function adaptiveParallelismPolicy(config) {
    const intrinsicBeta1 = assertNonNegativeFinite('intrinsicBeta1', config.intrinsicBeta1);
    const actualBeta1 = assertNonNegativeFinite('actualBeta1', config.actualBeta1);
    const occupancy = pipelineOccupancy(config.stageCount, config.chunkCount);
    const topologyDeficit = intrinsicBeta1 - actualBeta1;
    const regime = classifyPipelineRegime(config.stageCount, config.chunkCount);
    const highOccupancyDeficit = occupancy.occupancyDeficit >= 0.2;
    const reynoldsEstimate = config.stageCount / config.chunkCount;
    let action;
    let rationale;
    if (topologyDeficit > 0 && highOccupancyDeficit) {
        action = 'staggered-expand';
        rationale =
            'Natural parallelism exceeds the current topology, but warm-up overhead is still high; widen gradually rather than forking to the limit immediately.';
    }
    else if (topologyDeficit > 0) {
        action = 'expand';
        rationale =
            'The current implementation is too sequential for the problem and the wavefront is already filling efficiently enough to justify more parallelism.';
    }
    else if (topologyDeficit < 0 && highOccupancyDeficit) {
        action = 'constrain';
        rationale =
            'The system is already over-forked relative to the problem and early occupancy is poor; reduce single-request fan-out.';
    }
    else if (regime === 'turbulent') {
        action = 'multiplex';
        rationale =
            'The topology is not the bottleneck, but the pipeline is in a high-Reynolds turbulent regime; fill idle slots with cross-request work instead of widening one request.';
    }
    else {
        action = 'hold';
        rationale =
            'Topology and occupancy are aligned well enough that the current degree of parallelism should remain stable.';
    }
    return {
        intrinsicBeta1,
        actualBeta1,
        topologyDeficit,
        stageCount: config.stageCount,
        chunkCount: config.chunkCount,
        reynoldsEstimate,
        regime,
        frontierFill: occupancy.frontierFill,
        occupancyDeficit: occupancy.occupancyDeficit,
        highOccupancyDeficit,
        action,
        rationale,
    };
}
export function quantumDeficitIdentity(sqrtN) {
    const normalizedSqrtN = assertPositiveInteger('sqrtN', sqrtN);
    const searchSize = normalizedSqrtN * normalizedSqrtN;
    const classicalDeficit = normalizedSqrtN - 1;
    return {
        sqrtN: normalizedSqrtN,
        searchSize,
        classicalDeficit,
        quantumDeficit: 0,
        speedup: searchSize / normalizedSqrtN,
    };
}
export function protocolDeficits(streamCount) {
    const normalizedStreamCount = assertPositiveInteger('streamCount', streamCount);
    if (normalizedStreamCount <= 1) {
        throw new Error('streamCount must be greater than 1');
    }
    const intrinsicBeta1 = normalizedStreamCount - 1;
    return {
        streamCount: normalizedStreamCount,
        intrinsicBeta1,
        tcpDeficit: intrinsicBeta1,
        quicDeficit: 0,
        flowDeficit: 0,
    };
}
export function settlementDeficits() {
    return {
        intrinsicBeta1: 2,
        sequentialDeficit: 2,
        parallelDeficit: 0,
    };
}
export function beta2FromBandGap(forbiddenEnergyCount) {
    const normalizedForbiddenCount = assertNonNegativeFinite('forbiddenEnergyCount', forbiddenEnergyCount);
    return normalizedForbiddenCount > 0 ? 1 : 0;
}
export function firstLawConserved(forkEnergy, foldWork, ventEnergy, tolerance = 1e-9) {
    const normalizedForkEnergy = assertNonNegativeFinite('forkEnergy', forkEnergy);
    const normalizedFoldWork = assertNonNegativeFinite('foldWork', foldWork);
    const normalizedVentEnergy = assertNonNegativeFinite('ventEnergy', ventEnergy);
    if (normalizedFoldWork > normalizedForkEnergy) {
        return false;
    }
    const delta = Math.abs(normalizedForkEnergy - (normalizedFoldWork + normalizedVentEnergy));
    return delta <= Math.max(tolerance, 0);
}
