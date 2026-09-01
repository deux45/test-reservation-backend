import { Injectable } from '@nestjs/common';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { InvalidAttributesError, InvalidAttributesSchemaError } from '../errors/resource.errors';

/**
 * Validates a resource's attributes against its type's JSON Schema.
 *
 * This is what makes the generic model safe. Without it, `attributes` would be
 * an untyped jsonb bag that accumulates typos and half-migrated shapes; with
 * it, a "meeting room" is guaranteed to carry whatever a meeting room is
 * declared to need, and adding a new resource type still requires no code.
 */
@Injectable()
export class ResourceAttributesService {
  private readonly ajv: Ajv;

  /**
   * Compiled validators, keyed by resource type id.
   *
   * Compilation is the expensive step and a type's schema changes rarely, so
   * caching turns per-request validation into a function call.
   */
  private readonly compiled = new Map<string, ValidateFunction>();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true, // report every violation, not just the first
      strict: false, // tolerate vendor keywords in a user-supplied schema
      removeAdditional: false,
    });
    addFormats(this.ajv);
  }

  /**
   * Checks that a schema is itself a valid JSON Schema.
   *
   * Called when a resource type is created or updated. Storing a malformed
   * schema would turn every later resource write into a confusing 500, so it
   * is rejected at the point it enters the system.
   */
  assertValidSchema(schema: Record<string, unknown>): void {
    try {
      this.ajv.compile(schema);
    } catch (error) {
      throw new InvalidAttributesSchemaError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /** Throws InvalidAttributesError listing every violation, or returns. */
  assertValidAttributes(
    resourceTypeId: string,
    schema: Record<string, unknown>,
    attributes: Record<string, unknown>,
  ): void {
    const validate = this.validatorFor(resourceTypeId, schema);

    if (!validate(attributes)) {
      const violations = (validate.errors ?? []).map((error) =>
        `${error.instancePath || '/'} ${error.message ?? 'no es válido'}`.trim(),
      );
      throw new InvalidAttributesError(violations);
    }
  }

  /** Drops a cached validator after its type's schema changes. */
  invalidate(resourceTypeId: string): void {
    this.compiled.delete(resourceTypeId);
  }

  private validatorFor(resourceTypeId: string, schema: Record<string, unknown>): ValidateFunction {
    const cached = this.compiled.get(resourceTypeId);
    if (cached) return cached;

    const validate = this.ajv.compile(schema);
    this.compiled.set(resourceTypeId, validate);
    return validate;
  }
}
