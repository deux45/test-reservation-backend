import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the identifier-style attributes from every resource type.
 *
 * A previous migration made these optional. That was the narrower reading of
 * the intent: what was actually wanted was for them to go.
 *
 * They were the attributes a form asked for and nobody filled in -- a floor, a
 * serial number, a number plate. None of them affects whether a resource can
 * be booked, which is the only question this system exists to answer. Serial
 * numbers and plates identify physical assets, and that belongs in an asset
 * register rather than in a booking tool that happens to know the asset exists.
 *
 * What remains on each type is what actually distinguishes one resource from
 * another when someone is choosing which to book: a car's fuel and seats, a
 * projector's resolution, a van's load capacity.
 *
 * meeting-room is left with no attributes at all, so the form drops the
 * "Atributos propios de este tipo de recurso" section for it entirely --
 * AttributesFields renders nothing when a schema has no properties. A meeting
 * room is fully described by its name and location.
 */
export class DropIdentifierAttributes1756700000009 implements MigrationInterface {
  name = 'DropIdentifierAttributes1756700000009';

  private readonly removals: { code: string; property: string }[] = [
    { code: 'meeting-room', property: 'floor' },
    { code: 'laptop', property: 'serialNumber' },
    { code: 'projector', property: 'serialNumber' },
    { code: 'car', property: 'plate' },
    { code: 'van', property: 'plate' },
    { code: 'motorcycle', property: 'plate' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { code, property } of this.removals) {
      await queryRunner.query(
        `UPDATE resource_type
            SET attributes_schema = attributes_schema #- ARRAY['properties', $2]
          WHERE code = $1`,
        [code, property],
      );

      // The stored values go with the definition. Left behind they would be
      // data no schema describes, and additionalProperties:false would reject
      // the next edit that resubmitted them.
      await queryRunner.query(
        `UPDATE resource
            SET attributes = attributes - $2
          FROM resource_type
          WHERE resource.resource_type_id = resource_type.id
            AND resource_type.code = $1
            AND resource.attributes ? $2`,
        [code, property],
      );
    }
  }

  public async down(): Promise<void> {
    // Deliberately empty. Restoring the definitions would describe values that
    // no longer exist anywhere.
  }
}
