import type {
  CreateVehicle,
  DeleteVehicle,
  ListVehicles,
  SearchVehicles,
  UpdateVehicle,
  VehicleDependencies,
} from './vehicle-contracts.js';
import { CreateVehicleService } from '../application/create-vehicle.js';
import { DeleteVehicleService } from '../application/delete-vehicle.js';
import { ListVehiclesService } from '../application/list-vehicles.js';
import { SearchVehiclesService } from '../application/search-vehicles.js';
import { UpdateVehicleService } from '../application/update-vehicle.js';

export class MissingVehicleBehaviourError extends Error {
  constructor(behaviour: string) {
    super(`${behaviour} is not implemented`);
    this.name = 'MissingVehicleBehaviourError';
  }
}

export function createCreateVehicleSubject(dependencies: VehicleDependencies): CreateVehicle {
  return new CreateVehicleService(dependencies);
}

export function createListVehiclesSubject(dependencies: VehicleDependencies): ListVehicles {
  return new ListVehiclesService(dependencies);
}

export function createSearchVehiclesSubject(dependencies: VehicleDependencies): SearchVehicles {
  return new SearchVehiclesService(dependencies);
}

export function createUpdateVehicleSubject(dependencies: VehicleDependencies): UpdateVehicle {
  return new UpdateVehicleService(dependencies);
}

export function createDeleteVehicleSubject(dependencies: VehicleDependencies): DeleteVehicle {
  return new DeleteVehicleService(dependencies);
}
