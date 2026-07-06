import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuoteTables1711234567898 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "quote" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "marketplace_quote_number" character varying NOT NULL,
                "current_version" integer NOT NULL,
                "data" jsonb NOT NULL,
                "details" jsonb NOT NULL,
                CONSTRAINT "PK_quote" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_quote_marketplace_quote_number" UNIQUE ("marketplace_quote_number")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_quote_marketplace_quote_number"
            ON "quote" ("marketplace_quote_number")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "quote_version" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "marketplace_quote_number" character varying NOT NULL,
                "version" integer NOT NULL,
                "data" jsonb NOT NULL,
                "details" jsonb NOT NULL,
                "diff_quote" text,
                "diff_details" text,
                "quote_id" uuid,
                CONSTRAINT "PK_quote_version" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_quote_version_quote_version" UNIQUE ("quote_id", "version"),
                CONSTRAINT "FK_quote_version_quote" FOREIGN KEY ("quote_id")
                    REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_quote_version_marketplace_quote_number"
            ON "quote_version" ("marketplace_quote_number")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_quote_data_gin" ON "quote" USING GIN ("data")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_quote_details_gin" ON "quote" USING GIN ("details")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_quote_version_data_gin" ON "quote_version" USING GIN ("data")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_quote_version_details_gin" ON "quote_version" USING GIN ("details")
        `);

        await queryRunner.query(`
            ALTER TYPE "job_status_job_type_enum" ADD VALUE IF NOT EXISTS 'quote'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quote_version_details_gin"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quote_version_data_gin"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quote_details_gin"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quote_data_gin"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quote_version_marketplace_quote_number"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "quote_version"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quote_marketplace_quote_number"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "quote"`);
    }
}
