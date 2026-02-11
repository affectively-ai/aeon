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

import { logger } from '../utils/logger';

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
  errors: Array<{ item: unknown; error: string }>;
  warnings: string[];
  duration: number;
}

/**
 * Data Transformer
 * Transforms data structures during schema migrations
 */
export class DataTransformer {
  private rules: Map<string, TransformationRule> = new Map();
  private transformationHistory: TransformationResult[] = [];

  /**
   * Register a transformation rule
   */
  registerRule(rule: TransformationRule): void {
    this.rules.set(rule.field, rule);

    logger.debug('[DataTransformer] Rule registered', {
      field: rule.field,
      required: rule.required,
      hasDefault: rule.defaultValue !== undefined,
    });
  }

  /**
   * Transform a single field value
   */
  transformField(field: string, value: unknown): unknown {
    const rule = this.rules.get(field);
    if (!rule) {
      // No rule = no transformation
      return value;
    }

    try {
      return rule.transformer(value);
    } catch (error) {
      if (rule.required) {
        throw new Error(
          `Failed to transform required field ${field}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Return default value or original value
      return rule.defaultValue !== undefined ? rule.defaultValue : value;
    }
  }

  /**
   * Transform a single object
   */
  transformObject(data: Record<string, unknown>): Record<string, unknown> {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      try {
        transformed[key] = this.transformField(key, value);
      } catch (error) {
        logger.warn('[DataTransformer] Field transformation failed', {
          field: key,
          error: error instanceof Error ? error.message : String(error),
        });

        // If field is not required, include original value
        const rule = this.rules.get(key);
        if (!rule || !rule.required) {
          transformed[key] = value;
        }
      }
    }

    return transformed;
  }

  /**
   * Transform a collection of items
   */
  transformCollection(items: unknown[]): TransformationResult {
    const startTime = Date.now();
    const result: TransformationResult = {
      success: true,
      itemsTransformed: 0,
      itemsFailed: 0,
      errors: [],
      warnings: [],
      duration: 0,
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          this.transformObject(item as Record<string, unknown>);
          result.itemsTransformed++;
        } else {
          // Cannot transform non-object items
          result.warnings.push(`Item ${i} is not a transformable object`);
        }
      } catch (error) {
        result.errors.push({
          item,
          error: error instanceof Error ? error.message : String(error),
        });
        result.itemsFailed++;
      }
    }

    result.duration = Date.now() - startTime;
    result.success = result.itemsFailed === 0;

    this.transformationHistory.push(result);

    logger.debug('[DataTransformer] Collection transformed', {
      total: items.length,
      transformed: result.itemsTransformed,
      failed: result.itemsFailed,
      duration: result.duration,
    });

    return result;
  }

  /**
   * Validate transformed data
   */
  validateTransformation(
    original: unknown[],
    transformed: unknown[],
  ): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (original.length !== transformed.length) {
      issues.push(
        `Item count mismatch: ${original.length} -> ${transformed.length}`,
      );
    }

    // Check that all items were processed
    for (let i = 0; i < Math.min(original.length, transformed.length); i++) {
      const orig = original[i];
      const trans = transformed[i];

      if (!this.validateItem(orig, trans)) {
        issues.push(`Item ${i} validation failed`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Validate a single item transformation
   */
  private validateItem(original: unknown, transformed: unknown): boolean {
    // Basic validation: ensure transformed exists if original exists
    if (original === null || original === undefined) {
      return true;
    }

    if (typeof original === 'object' && typeof transformed !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Get transformation history
   */
  getTransformationHistory(): TransformationResult[] {
    return [...this.transformationHistory];
  }

  /**
   * Get transformation statistics
   */
  getStatistics() {
    const totalTransformed = this.transformationHistory.reduce(
      (sum, r) => sum + r.itemsTransformed,
      0,
    );
    const totalFailed = this.transformationHistory.reduce(
      (sum, r) => sum + r.itemsFailed,
      0,
    );
    const totalDuration = this.transformationHistory.reduce(
      (sum, r) => sum + r.duration,
      0,
    );

    return {
      totalBatches: this.transformationHistory.length,
      totalTransformed,
      totalFailed,
      successRate:
        totalTransformed + totalFailed > 0
          ? (totalTransformed / (totalTransformed + totalFailed)) * 100
          : 0,
      totalDurationMs: totalDuration,
      averageBatchDurationMs:
        this.transformationHistory.length > 0
          ? totalDuration / this.transformationHistory.length
          : 0,
    };
  }

  /**
   * Get registered rules
   */
  getRules(): TransformationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule for field
   */
  getRule(field: string): TransformationRule | undefined {
    return this.rules.get(field);
  }

  /**
   * Clear all rules (for testing)
   */
  clearRules(): void {
    this.rules.clear();
  }

  /**
   * Clear history (for testing)
   */
  clearHistory(): void {
    this.transformationHistory = [];
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.clearRules();
    this.clearHistory();
  }
}
