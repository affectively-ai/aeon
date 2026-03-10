/**
 * Data Transformer
 *
 * Transforms data structures during schema migrations.
 * Handles field transformation, type casting, and validation.
 *
 * Features:
 * - Field-level transformation
 * - Type conversion and casting
 * - Validation during transformation
 * - Error handling and reporting
 * - Batch transformation support
 */
export interface FieldTransformer {
    (value: unknown): unknown;
}
export interface TransformationRule {
    field: string;
    transformer: FieldTransformer;
    required?: boolean;
    defaultValue?: unknown;
}
export interface TransformationResult {
    success: boolean;
    itemsTransformed: number;
    itemsFailed: number;
    errors: Array<{
        item: unknown;
        error: string;
    }>;
    warnings: string[];
    duration: number;
}
/**
 * Data Transformer
 * Transforms data structures during schema migrations
 */
export declare class DataTransformer {
    private rules;
    private transformationHistory;
    /**
     * Register a transformation rule
     */
    registerRule(rule: TransformationRule): void;
    /**
     * Transform a single field value
     */
    transformField(field: string, value: unknown): unknown;
    /**
     * Transform a single object
     */
    transformObject(data: Record<string, unknown>): Record<string, unknown>;
    /**
     * Transform a collection of items
     */
    transformCollection(items: unknown[]): TransformationResult;
    /**
     * Validate transformed data
     */
    validateTransformation(original: unknown[], transformed: unknown[]): {
        valid: boolean;
        issues: string[];
    };
    /**
     * Validate a single item transformation
     */
    private validateItem;
    /**
     * Get transformation history
     */
    getTransformationHistory(): TransformationResult[];
    /**
     * Get transformation statistics
     */
    getStatistics(): {
        totalBatches: number;
        totalTransformed: number;
        totalFailed: number;
        successRate: number;
        totalDurationMs: number;
        averageBatchDurationMs: number;
    };
    /**
     * Get registered rules
     */
    getRules(): TransformationRule[];
    /**
     * Get rule for field
     */
    getRule(field: string): TransformationRule | undefined;
    /**
     * Clear all rules (for testing)
     */
    clearRules(): void;
    /**
     * Clear history (for testing)
     */
    clearHistory(): void;
    /**
     * Clear all state (for testing)
     */
    clear(): void;
}
