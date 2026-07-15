require("dotenv").config();
const { listRegistrations } = require("./lib/sheets");

async function test() {
  try {
    console.log("Fetching registrations...");
    const registrations = await listRegistrations();
    console.log(`Success! Total registrations found: ${registrations.length}`);
    console.log("Registrations detail:", JSON.stringify(registrations, null, 2));
  } catch (err) {
    console.error("Error fetching registrations:", err);
  }
}

test();
