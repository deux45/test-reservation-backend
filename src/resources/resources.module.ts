import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourceTypesController } from './controllers/resource-types.controller';
import { ResourcesController } from './controllers/resources.controller';
import { ResourceAvailability } from './entities/resource-availability.entity';
import { ResourceBlock } from './entities/resource-block.entity';
import { ResourceType } from './entities/resource-type.entity';
import { Resource } from './entities/resource.entity';
import { ResourceTypeRepository } from './repositories/resource-type.repository';
import { ResourceRepository } from './repositories/resource.repository';
import { ResourceAttributesService } from './services/resource-attributes.service';
import { ResourceTypeService } from './services/resource-type.service';
import { ResourceService } from './services/resource.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resource, ResourceType, ResourceAvailability, ResourceBlock]),
  ],
  controllers: [ResourcesController, ResourceTypesController],
  providers: [
    ResourceService,
    ResourceTypeService,
    ResourceAttributesService,
    ResourceRepository,
    ResourceTypeRepository,
  ],
  // Only the repository is exported. The reservations module needs to read a
  // resource, not to create or deactivate one -- a narrow surface it cannot
  // misuse even by accident.
  exports: [ResourceRepository],
})
export class ResourcesModule {}
