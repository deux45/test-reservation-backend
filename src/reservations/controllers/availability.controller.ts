import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AvailabilityQueryDto, AvailabilitySlotDto } from '../dtos/availability.dto';
import { AvailabilityService } from '../services/availability.service';

@ApiTags('Availability')
@Controller('resources/:id/availability')
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Get()
  @ApiOperation({
    summary: 'Free slots for a resource within a range',
    description:
      "Starts from the resource's operating hours and subtracts maintenance " +
      'blocks and confirmed reservations. Slots are half-open `[start, end)`, ' +
      'exactly like reservations: one ending at 11:00 leaves 11:00 free.\n\n' +
      'A resource with no schedule configured is available around the clock.',
  })
  @ApiOkResponse({ type: [AvailabilitySlotDto] })
  @ApiUnprocessableEntityResponse({ description: 'Invalid range, or longer than 60 days' })
  findSlots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilitySlotDto[]> {
    return this.service.findSlots(id, query);
  }
}
