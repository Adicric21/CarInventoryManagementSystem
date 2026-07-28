-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "make" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_price_positive" CHECK ("price" > 0),
    CONSTRAINT "vehicles_quantity_nonnegative" CHECK ("quantity" >= 0),
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);
