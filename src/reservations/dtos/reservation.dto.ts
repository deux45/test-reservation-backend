import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ResourceDto } from '../../resources/dtos/resource.dto';
import { type Reservation } from '../entities/reservation.entity';
import { ReservationStatus } from '../enums/reservation-status.enum';

export class CancelReservationDto {
  /** Motivo de la cancelación. Queda registrado. */
  @ApiPropertyOptional({ example: 'Se pospone la reunión' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ReservationDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;

  /** Inicio en UTC. Inclusivo. */
  @ApiProperty() startAt: Date;

  /** Fin en UTC. **Exclusivo.** */
  @ApiProperty() endAt: Date;

  @ApiProperty({ enum: ReservationStatus }) status: ReservationStatus;
  @ApiPropertyOptional() attendees: number | null;
  @ApiPropertyOptional() notes: string | null;
  @ApiProperty() userId: string;
  @ApiProperty() resourceId: string;
  @ApiPropertyOptional({ type: ResourceDto }) resource?: ResourceDto;
  @ApiPropertyOptional() cancelledAt: Date | null;
  @ApiPropertyOptional() cancellationReason: string | null;
  @ApiProperty() createdAt: Date;

  static from(entity: Reservation): ReservationDto {
    return {
      id: entity.id,
      title: entity.title,
      startAt: entity.startAt,
      endAt: entity.endAt,
      status: entity.status,
      attendees: entity.attendees,
      notes: entity.notes,
      userId: entity.userId,
      resourceId: entity.resourceId,
      resource: entity.resource ? ResourceDto.from(entity.resource) : undefined,
      cancelledAt: entity.cancelledAt,
      cancellationReason: entity.cancellationReason,
      createdAt: entity.createdAt,
    };
  }
}
