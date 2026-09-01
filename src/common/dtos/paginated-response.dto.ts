import { ApiProperty } from '@nestjs/swagger';
import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 137 })
  total: number;

  @ApiProperty({ example: 7 })
  totalPages: number;
}

/** The envelope every listing returns. Same shape everywhere, by design. */
export class PaginatedResponseDto<T> {
  /**
   * Declared explicitly as an untyped array.
   *
   * Swagger cannot resolve `T` at runtime, and letting the CLI plugin infer
   * it makes the schema self-referential -- the app fails to boot with
   * "circular dependency detected (property key: data)". The real item type
   * is composed by ApiPaginatedResponse() below, via allOf.
   */
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

/**
 * Documents a paginated endpoint without repeating the envelope schema.
 *
 * Swagger cannot infer a generic's type argument at runtime, so the model is
 * passed explicitly and composed with allOf.
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(model: TModel) =>
  applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
          },
        ],
      },
    }),
  );
