import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateResourceDto } from './create-resource.dto';

/**
 * Every field optional except the two that are not editable.
 *
 * `code` is the stable public identifier that other systems and people refer
 * to, and `resourceTypeId` decides what the resource fundamentally is.
 * Changing either would silently turn one resource into a different one, so
 * both require creating a new resource instead.
 */
export class UpdateResourceDto extends PartialType(
  OmitType(CreateResourceDto, ['code', 'resourceTypeId'] as const),
) {}
