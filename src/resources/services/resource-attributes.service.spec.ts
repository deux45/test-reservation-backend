import { InvalidAttributesError, InvalidAttributesSchemaError } from '../errors/resource.errors';
import { ResourceAttributesService } from './resource-attributes.service';

const meetingRoomSchema = {
  type: 'object',
  required: ['floor'],
  properties: {
    floor: { type: 'integer', minimum: 0 },
    hasProjector: { type: 'boolean' },
    phone: { type: 'string', format: 'email' },
  },
  additionalProperties: false,
};

describe('ResourceAttributesService', () => {
  let service: ResourceAttributesService;

  beforeEach(() => {
    service = new ResourceAttributesService();
  });

  const validate = (attributes: Record<string, unknown>) =>
    service.assertValidAttributes('type-1', meetingRoomSchema, attributes);

  it('accepts attributes that satisfy the schema', () => {
    expect(() => validate({ floor: 2, hasProjector: true })).not.toThrow();
  });

  it('rejects a missing required attribute', () => {
    expect(() => validate({ hasProjector: true })).toThrow(InvalidAttributesError);
  });

  it('rejects a wrong type', () => {
    expect(() => validate({ floor: 'segunda' })).toThrow(InvalidAttributesError);
  });

  it('rejects an unknown attribute when the schema forbids extras', () => {
    // additionalProperties: false is what stops `attributes` degenerating into
    // an untyped bag that accumulates typos over time.
    expect(() => validate({ floor: 1, colour: 'azul' })).toThrow(InvalidAttributesError);
  });

  it('reports every violation, not just the first', () => {
    // allErrors: true. A client fixing one field at a time across four
    // round trips is a worse experience than seeing all four at once.
    try {
      validate({ floor: -1, colour: 'azul' });
      fail('should have thrown');
    } catch (error) {
      const violations = (error as InvalidAttributesError).details?.violations as string[];
      expect(violations.length).toBeGreaterThan(1);
    }
  });

  it('supports format validators such as email', () => {
    expect(() => validate({ floor: 1, phone: 'no-es-un-email' })).toThrow(InvalidAttributesError);
    expect(() => validate({ floor: 1, phone: 'sala@example.com' })).not.toThrow();
  });

  it('accepts an empty object schema, which allows anything', () => {
    // The default for a type that declares no attributes at all.
    expect(() =>
      service.assertValidAttributes('type-2', { type: 'object' }, { whatever: 1 }),
    ).not.toThrow();
  });

  it('rejects a malformed JSON Schema at the point it enters the system', () => {
    // Storing this would turn every later resource write into a confusing 500.
    expect(() => service.assertValidSchema({ type: 'not-a-real-type' })).toThrow(
      InvalidAttributesSchemaError,
    );
  });

  it('stops using a cached validator once the schema is invalidated', () => {
    service.assertValidAttributes('type-3', { type: 'object' }, { anything: true });
    service.invalidate('type-3');

    expect(() =>
      service.assertValidAttributes(
        'type-3',
        { type: 'object', required: ['floor'], properties: { floor: { type: 'integer' } } },
        { anything: true },
      ),
    ).toThrow(InvalidAttributesError);
  });
});
