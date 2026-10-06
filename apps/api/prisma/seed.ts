import { PrismaClient, OrgRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/** M2 auth seed skeleton — expands in M10 with full demo dataset */
async function main() {
  const passwordHash = await argon2.hash('FlowOps!demo1');

  const maya = await prisma.user.upsert({
    where: { email: 'maya.chen@northstar.io' },
    update: {},
    create: {
      email: 'maya.chen@northstar.io',
      fullName: 'Maya Chen',
      passwordHash,
    },
  });

  const jordan = await prisma.user.upsert({
    where: { email: 'jordan.blake@northstar.io' },
    update: {},
    create: {
      email: 'jordan.blake@northstar.io',
      fullName: 'Jordan Blake',
      passwordHash,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'northstar-commerce' },
    update: {},
    create: {
      name: 'Northstar Commerce',
      slug: 'northstar-commerce',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: maya.id,
      },
    },
    update: { role: OrgRole.admin },
    create: {
      organizationId: org.id,
      userId: maya.id,
      role: OrgRole.admin,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: jordan.id,
      },
    },
    update: { role: OrgRole.devops },
    create: {
      organizationId: org.id,
      userId: jordan.id,
      role: OrgRole.devops,
    },
  });

  console.log('Seeded auth skeleton:');
  console.log(`  org: ${org.slug} (${org.id})`);
  console.log(`  admin: ${maya.email} / FlowOps!demo1`);
  console.log(`  devops: ${jordan.email} / FlowOps!demo1`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
