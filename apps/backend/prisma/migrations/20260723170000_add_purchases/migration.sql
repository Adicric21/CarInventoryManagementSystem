-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "vehicle_make" VARCHAR(100) NOT NULL,
    "vehicle_model" VARCHAR(100) NOT NULL,
    "vehicle_category" VARCHAR(100) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_amount" DECIMAL(24,2) NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "purchases_unit_price_positive" CHECK ("unit_price" > 0),
    CONSTRAINT "purchases_total_amount_positive" CHECK ("total_amount" > 0),
    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchases_user_id_purchased_at_idx" ON "purchases"("user_id", "purchased_at");
CREATE INDEX "purchases_vehicle_id_purchased_at_idx" ON "purchases"("vehicle_id", "purchased_at");
CREATE INDEX "purchases_purchased_at_idx" ON "purchases"("purchased_at");

ALTER TABLE "purchases"
ADD CONSTRAINT "purchases_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchases"
ADD CONSTRAINT "purchases_vehicle_id_fkey"
FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
