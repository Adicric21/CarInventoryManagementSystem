import { createApp } from './app.js';
import { loadEnvironment } from './config/environment.js';
import { loadRootEnvironment } from './config/load-root-environment.js';
import { createAuthModule } from './modules/auth/auth-module.js';
import { createDashboardModule } from './modules/dashboard/dashboard-module.js';
import { PrismaDashboardRepository } from './modules/dashboard/infrastructure/prisma-dashboard-repository.js';
import { BcryptPasswordHasher } from './modules/auth/infrastructure/bcrypt-password-hasher.js';
import { JwtTokenProvider } from './modules/auth/infrastructure/jwt-token-provider.js';
import { createPrismaClient } from './modules/auth/infrastructure/prisma-client.js';
import { PrismaUserRepository } from './modules/auth/infrastructure/prisma-user-repository.js';
import { createInventoryActivityModule } from './modules/inventory-activity/inventory-activity-module.js';
import { PrismaInventoryActivityRepository } from './modules/inventory-activity/infrastructure/prisma-inventory-activity-repository.js';
import { PrismaPurchaseRepository } from './modules/purchases/infrastructure/prisma-purchase-repository.js';
import { createPurchaseModule } from './modules/purchases/purchase-module.js';
import { PrismaBulkVehicleRepository } from './modules/vehicle-csv/infrastructure/prisma-bulk-vehicle-repository.js';
import { createVehicleCsvModule } from './modules/vehicle-csv/vehicle-csv-module.js';
import { PrismaVehicleRepository } from './modules/vehicles/infrastructure/prisma-vehicle-repository.js';
import { createVehicleModule } from './modules/vehicles/vehicle-module.js';
import { STARTUP_MESSAGE } from './startup-message.js';

loadRootEnvironment();

const environment = loadEnvironment();
const prisma = createPrismaClient(environment.databaseUrl);
const tokenProvider = new JwtTokenProvider(environment.jwtSecret, environment.jwtExpiresInSeconds);
const auth = createAuthModule({
  userRepository: new PrismaUserRepository(prisma.user),
  passwordHasher: new BcryptPasswordHasher(),
  tokenProvider,
});
const vehicles = createVehicleModule({
  vehicleRepository: new PrismaVehicleRepository(prisma),
  lowStockThreshold: environment.lowStockThreshold,
  tokenProvider,
});
const inventoryActivities = createInventoryActivityModule({
  inventoryActivityRepository: new PrismaInventoryActivityRepository(prisma.inventoryActivity),
  tokenProvider,
});
const purchases = createPurchaseModule({
  purchaseRepository: new PrismaPurchaseRepository(prisma.purchase),
  tokenProvider,
});
const dashboard = createDashboardModule({
  dashboardRepository: new PrismaDashboardRepository(prisma),
  lowStockThreshold: environment.lowStockThreshold,
  tokenProvider,
});
const vehicleCsv = createVehicleCsvModule({
  bulkVehicleRepository: new PrismaBulkVehicleRepository(prisma),
  tokenProvider,
});
const app = createApp(
  auth.api,
  vehicles.router,
  inventoryActivities.router,
  vehicles.adminRouter,
  purchases.router,
  purchases.adminRouter,
  dashboard.router,
  vehicleCsv.router,
);

app.listen(environment.port, () => {
  console.info(`${STARTUP_MESSAGE} on port ${environment.port}`);
});
