import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The resource type catalogue.
 *
 * Reference data, not sample data, which is why it is a migration rather than
 * a seed. The application is unusable without at least one type -- a resource
 * cannot exist without one -- so every environment needs these rows, including
 * production. Seeds are for the demo rooms and fake bookings that only a
 * developer wants.
 *
 * Each type carries the JSON Schema its resources must satisfy. The frontend
 * builds the attribute form from it, so adding "bicicleta" tomorrow is one
 * more row here and no code at all, on either side.
 *
 * Note the language split, which is the project convention showing through in
 * data: property KEYS are English because they are identifiers, and `title` is
 * Spanish because it becomes the form label the user reads.
 */
export class ResourceTypeCatalogue1756700000005 implements MigrationInterface {
  name = 'ResourceTypeCatalogue1756700000005';

  private readonly types = [
    {
      code: 'meeting-room',
      name: 'Sala de reuniones',
      description: 'Espacio para reuniones presenciales.',
      schema: {
        type: 'object',
        required: ['floor'],
        properties: {
          floor: { type: 'integer', minimum: 0, title: 'Planta' },
          hasProjector: { type: 'boolean', title: 'Tiene proyector' },
          hasVideoconference: { type: 'boolean', title: 'Tiene videoconferencia' },
        },
        additionalProperties: false,
      },
    },
    {
      code: 'laptop',
      name: 'Portátil',
      description: 'Equipo portátil de préstamo.',
      schema: {
        type: 'object',
        required: ['serialNumber'],
        properties: {
          serialNumber: { type: 'string', title: 'Número de serie' },
          model: { type: 'string', title: 'Modelo' },
          ramGb: { type: 'integer', minimum: 1, title: 'Memoria RAM (GB)' },
          operatingSystem: {
            type: 'string',
            enum: ['Windows', 'macOS', 'Linux'],
            title: 'Sistema operativo',
          },
        },
        additionalProperties: false,
      },
    },
    {
      code: 'projector',
      name: 'Videobeam',
      description: 'Proyector de vídeo.',
      schema: {
        type: 'object',
        required: ['serialNumber'],
        properties: {
          serialNumber: { type: 'string', title: 'Número de serie' },
          lumens: { type: 'integer', minimum: 1, title: 'Luminosidad (lúmenes)' },
          resolution: {
            type: 'string',
            enum: ['720p', '1080p', '4K'],
            title: 'Resolución',
          },
          hasHdmi: { type: 'boolean', title: 'Entrada HDMI' },
        },
        additionalProperties: false,
      },
    },
    {
      code: 'car',
      name: 'Automóvil',
      description: 'Vehículo de empresa para desplazamientos.',
      schema: {
        type: 'object',
        // The plate is the physical identifier of the vehicle. Without it a
        // booking cannot be matched to a key or a parking space.
        required: ['plate'],
        properties: {
          plate: { type: 'string', title: 'Matrícula' },
          brand: { type: 'string', title: 'Marca' },
          model: { type: 'string', title: 'Modelo' },
          seats: { type: 'integer', minimum: 1, title: 'Plazas' },
          fuel: {
            type: 'string',
            enum: ['Gasolina', 'Diésel', 'Eléctrico', 'Híbrido'],
            title: 'Combustible',
          },
        },
        additionalProperties: false,
      },
    },
    {
      code: 'van',
      name: 'Furgón',
      description: 'Vehículo de carga.',
      schema: {
        type: 'object',
        required: ['plate'],
        properties: {
          plate: { type: 'string', title: 'Matrícula' },
          brand: { type: 'string', title: 'Marca' },
          cargoCapacityKg: { type: 'integer', minimum: 1, title: 'Carga máxima (kg)' },
          cargoVolumeM3: { type: 'number', minimum: 0, title: 'Volumen de carga (m³)' },
          hasTailLift: { type: 'boolean', title: 'Tiene plataforma elevadora' },
        },
        additionalProperties: false,
      },
    },
    {
      code: 'motorcycle',
      name: 'Motocicleta',
      description: 'Motocicleta de empresa.',
      schema: {
        type: 'object',
        required: ['plate'],
        properties: {
          plate: { type: 'string', title: 'Matrícula' },
          brand: { type: 'string', title: 'Marca' },
          engineCc: { type: 'integer', minimum: 1, title: 'Cilindrada (cc)' },
          requiresLicenseA: { type: 'boolean', title: 'Requiere carné A' },
        },
        additionalProperties: false,
      },
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const type of this.types) {
      // ON CONFLICT DO NOTHING, so this is safe on a database where a type was
      // already created through the API -- which is exactly the state of any
      // environment that has been used before this migration existed.
      await queryRunner.query(
        `INSERT INTO resource_type (code, name, description, attributes_schema)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (code) DO NOTHING`,
        [type.code, type.name, type.description, JSON.stringify(type.schema)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only types with no resources attached. The foreign key is ON DELETE
    // RESTRICT, so deleting one that is in use would fail and take the whole
    // rollback with it -- and losing a type while its resources survive is not
    // a state worth reaching anyway.
    await queryRunner.query(
      `DELETE FROM resource_type
        WHERE code = ANY($1)
          AND NOT EXISTS (SELECT 1 FROM resource WHERE resource.resource_type_id = resource_type.id)`,
      [this.types.map((type) => type.code)],
    );
  }
}
