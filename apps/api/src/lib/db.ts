import {PrismaClient} from '@prisma/client';

export const prisma = new PrismaClient();

/** The client type inside prisma.$transaction callbacks. */
export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
