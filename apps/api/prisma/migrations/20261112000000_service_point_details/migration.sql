-- Service points get an optional one-line hint and an icon key, shown on the patient screen.
ALTER TABLE "service_points" ADD COLUMN "description" TEXT;
ALTER TABLE "service_points" ADD COLUMN "icon" TEXT;
ALTER TABLE "service_points" ADD CONSTRAINT service_points_description_chk CHECK ("description" IS NULL OR char_length("description") <= 140);
ALTER TABLE "service_points" ADD CONSTRAINT service_points_icon_chk CHECK ("icon" IS NULL OR "icon" ~ '^[a-z-]{1,24}$');
