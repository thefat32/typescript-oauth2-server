import child from "child_process";
import { join } from "path";
import util from "util";

import { PrismaClient } from "@prisma/client";

const exec = util.promisify(child.exec);

const prismaBinary = join(__dirname, "node_modules/.bin/prisma");
const prisma = new PrismaClient();

// A `main` function so that you can use async/await
(async () => {
  await exec(`${prismaBinary} migrate dev`);
  await prisma.user.create({
    data: {
      email: "jason@raimondi.us",
      passwordHash: "abc123",
    },
  });
  //
  // console.log(
  //   await prisma.user.findUnique({
  //     rejectOnNotFound: true,
  //     where: { email: "jason@raimondi.us" },
  //     include: {
  //       OAuthTokens: true,
  //       OAuthAuthCodes: true,
  //     }
  //   })
  // )
})()

