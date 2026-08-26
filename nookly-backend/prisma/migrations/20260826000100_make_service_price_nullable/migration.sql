-- Make a service's price optional (nullable) so a service can be listed
-- without a price (e.g. "Contact for quote").
ALTER TABLE "service_items" ALTER COLUMN "price" DROP NOT NULL;
