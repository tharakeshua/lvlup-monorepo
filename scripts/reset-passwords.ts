import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync("./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json", "utf-8")
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "lvlup-ff6fa",
});

const auth = admin.auth();
const NEW_PASSWORD = "Test@12345";

const emails = [
  "superadmin@levelup.app",
  "admin@greenwood.edu",
  "priya.sharma@greenwood.edu",
  "rajesh.kumar@greenwood.edu",
  "anita.desai@greenwood.edu",
  "vikram.singh@greenwood.edu",
  "aarav.patel@greenwood.edu",
  "diya.gupta@greenwood.edu",
  "arjun.nair@greenwood.edu",
  "ananya.reddy@greenwood.edu",
  "rohan.sharma@greenwood.edu",
  "meera.iyer@greenwood.edu",
  "karan.singh@greenwood.edu",
  "priya.menon@greenwood.edu",
  "aditya.joshi@greenwood.edu",
  "sneha.das@greenwood.edu",
  "vivek.tiwari@greenwood.edu",
  "ishita.verma@greenwood.edu",
  "rahul.mehta@greenwood.edu",
  "kavya.pillai@greenwood.edu",
  "nikhil.saxena@greenwood.edu",
  "riya.chopra@greenwood.edu",
  "amit.pandey@greenwood.edu",
  "sanya.rao@greenwood.edu",
  "dev.kulkarni@greenwood.edu",
  "nisha.bhat@greenwood.edu",
  "suresh.patel@gmail.com",
  "meena.gupta@gmail.com",
  "ramesh.nair@gmail.com",
  "sunita.sharma@gmail.com",
  "mohit.singh@gmail.com",
  "neeta.joshi@gmail.com",
  "dinesh.saxena@gmail.com",
  "pooja.pandey@gmail.com",
];

async function main() {
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, { password: NEW_PASSWORD });
      console.log(`✓ Reset: ${email}`);
    } catch (e: any) {
      console.error(`✗ Failed: ${email} — ${e.message}`);
    }
  }
  console.log("\nDone! All passwords reset to Test@12345");
  process.exit(0);
}

main();
