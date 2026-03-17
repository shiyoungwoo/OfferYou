export type DatabaseClient = {
  status: "uninitialized";
  reason: "prisma-generate-required";
};

// Prisma client generation is blocked until the runtime can fetch Prisma engines.
// Keep a typed placeholder so the app shell can build while persistence services are wired next.
export const db: DatabaseClient = {
  status: "uninitialized",
  reason: "prisma-generate-required"
};
