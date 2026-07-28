-- CreateEnum
CREATE TYPE "InventoryActivityAction" AS ENUM (
    'VEHICLE_CREATED',
    'VEHICLE_UPDATED',
    'VEHICLE_DELETED',
    'VEHICLE_PURCHASED',
    'VEHICLE_RESTOCKED'
);

-- CreateTable
CREATE TABLE "inventory_activities" (
    "id" UUID NOT NULL,
    "action" "InventoryActivityAction" NOT NULL,
    "vehicle_id" UUID,
    "vehicle_make" VARCHAR(100) NOT NULL,
    "vehicle_model" VARCHAR(100) NOT NULL,
    "vehicle_category" VARCHAR(100) NOT NULL,
    "quantity_before" INTEGER,
    "quantity_change" INTEGER,
    "quantity_after" INTEGER,
    "performed_by_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_activities_action_created_at_idx"
ON "inventory_activities"("action", "created_at");

-- CreateIndex
CREATE INDEX "inventory_activities_vehicle_id_created_at_idx"
ON "inventory_activities"("vehicle_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_activities_performed_by_id_created_at_idx"
ON "inventory_activities"("performed_by_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_activities_created_at_idx"
ON "inventory_activities"("created_at");

-- AddForeignKey
ALTER TABLE "inventory_activities"
ADD CONSTRAINT "inventory_activities_vehicle_id_fkey"
FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_activities"
ADD CONSTRAINT "inventory_activities_performed_by_id_fkey"
FOREIGN KEY ("performed_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
