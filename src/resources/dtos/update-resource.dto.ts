import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateResourceDto } from './create-resource.dto';

/**
 * Every field optional except the two that are not editable.
 *
 * `code` is the stable public identifier and `resourceTypeId` decides which
 * attribute schema applies -- changing either would silently invalidate the
 * attributes already stored, so both require creating a new resource.
 */
export class UpdateResourceDto extends PartialType(
  OmitType(CreateResourceDto, ['code', 'resourceTypeId'] as const),
) {}
