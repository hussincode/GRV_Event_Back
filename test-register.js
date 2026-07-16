require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { appendRegistration, listRegistrations } = require("./lib/sheets");

async function run() {
  try {
    console.log("Adding a registration...");
    const reg = await appendRegistration({
      fullName: "Test User",
      email: "test@example.com",
      mobileNumber: "12345678",
      whatsappNumber: "12345678",
      gender: "Male",
      age: 20,
      governorate: "Cairo",
      educationalStage: "University",
      consentMediaUsage: true,
      nationalIdFileUrl: "http://localhost:3000/uploads/test.pdf",
      birthPaperFileUrl: ""
    });
    console.log("Successfully registered:", reg);

    console.log("Listing registrations...");
    const list = await listRegistrations();
    console.log(`Total registrations in sheet: ${list.length}`);
    console.log("Registrations:", JSON.stringify(list, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
