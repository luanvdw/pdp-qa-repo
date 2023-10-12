import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());

async function createData() {
  const lastCount = await prisma.user.count();
  await prisma.user.createMany({
    data: Array.from({ length: 10 }).map((_, index) => ({
      email: `user${lastCount + index + 1}@prisma.io`,
    })),
  });
}

async function getData() {
  const requestsCount = 35000;
  const chunkSize = 100;
  let totalTime = 0;

  const queryWithInfo = async (index: number) => {
    const startTime = Date.now();
    const { data, info } = await prisma.user
      .findMany({
        cacheStrategy: { ttl: 30, swr: 0 },
      })
      .withAccelerateInfo();
    const endTime = Date.now() - startTime;
    totalTime = totalTime + endTime;
    return {
      index: index,
      duration: endTime,
      data: data,
      cacheStatus: info?.cacheStatus,
    };
  };

  for (let i = 0; i < requestsCount; i += chunkSize) {
    const promises = [];

    for (let j = i; j < i + chunkSize && j < requestsCount; j++) {
      promises.push(queryWithInfo(j));
    }

    const results = await Promise.all(promises);
    results.forEach((result) => {
        console.log(`Request ${result.index} with ${result.cacheStatus} took ${result.duration}ms`);
    });
  }

  console.log("\n All requests finished!");
  console.log("Total time", totalTime);
  console.log("Average request time", totalTime / requestsCount);
}

async function main() {
  if (process.argv[2] === "seed") {
    await createData();
  } else {
    await getData();
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
