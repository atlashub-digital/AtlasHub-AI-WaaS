import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
export default defineConfig({schema:'packages/db/prisma/schema.prisma',experimental:{adapter:true},adapter:async()=>new PrismaPg({connectionString:process.env.DATABASE_URL})});
