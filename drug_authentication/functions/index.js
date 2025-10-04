// This function sets a new user's role and status upon creation.

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Import the v2 functions SDK for 2nd Generation functions
const { onUserCreated } = require("firebase-functions/v2/auth");

admin.initializeApp();

// Use the 2nd Generation syntax for the trigger
exports.setInitialUserRole = onUserCreated({ region: 'us-central1' }, async (event) => {
  const user = event.data;
  const userEmail = user.email || "";
  let role = "customer";
  let status = "approved";

  // Assign role based on email
  if (userEmail === "admin@example.com") {
    role = "admin";
    status = "approved";
  } else if (userEmail.endsWith("@manufacturer.com")) {
    role = "manufacturer";
    status = "pending_approval";
  } else if (userEmail.endsWith("@qc.com")) {
    role = "qc_uploader";
    status = "pending_approval";
  }

  try {
    await admin.firestore().collection("users").doc(user.uid).set({
      email: userEmail,
      role: role,
      status: status,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `✅ User ${userEmail} assigned role: ${role} with status: ${status}`
    );
  } catch (error) {
    console.error("❌ Error creating user document:", error);
  }
});