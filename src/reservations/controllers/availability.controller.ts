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
    summary: 'Huecos libres de un recurso en un rango',
    description:
      'Parte del horario operativo del recurso y le resta bloqueos y reservas ' +
      'confirmadas. Los huecos son semiabiertos `[inicio, fin)`, igual que las ' +
      'reservas: uno que termina a las 11:00 deja las 11:00 libres.\n\n' +
      'Un recurso sin horario configurado está disponible las 24 horas.',
  })
  @ApiOkResponse({ type: [AvailabilitySlotDto] })
  @ApiUnprocessableEntityResponse({ description: 'Rango inválido o superior a 60 días' })
  findSlots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilitySlotDto[]> {
    return this.service.findSlots(id, query);
  }
}
