export type { CreateVehicle } from '../application/create-vehicle.js';
export type { DeleteVehicle } from '../application/delete-vehicle.js';
export type { ListVehicles } from '../application/list-vehicles.js';
export type { SearchVehicles } from '../application/search-vehicles.js';
export type { UpdateVehicle } from '../application/update-vehicle.js';
export type {
  CreateVehicleData,
  FindVehiclesQuery,
  UpdateVehicleData,
  VehicleDependencies,
  VehicleFilters,
  VehicleRepository,
  VehicleSort,
} from '../domain/vehicle-repository.js';
export { VEHICLE_SORT_FIELDS } from '../domain/vehicle-types.js';
export type {
  CreateVehicleInput,
  PaginationMeta,
  PersistedVehicle,
  SortOrder,
  UpdateVehicleInput,
  Vehicle,
  VehiclePage,
  VehicleSortField,
} from '../domain/vehicle-types.js';
