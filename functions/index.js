const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const setCorsHeaders = (req, res) => {
  const origin = req.get("Origin");

  res.setHeader(
    "Access-Control-Allow-Origin",
    origin || "*"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "3600"
  );
};

// --------------------------------------------------
// VERIFY PHONE + PASSCODE
// POST /verifyPhonePasscode
// Body: { phone, passcode }
// Returns: { token }
// --------------------------------------------------

exports.verifyPhonePasscode = onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  try {
    const { phone, passcode } = req.body || {};

    if (!phone || !passcode) {
      return res.status(400).json({
        error: "Missing phone or passcode",
      });
    }

    const normalizedPhone = String(phone).replace(/\D/g, "");

    if (!/^01\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({
        error: "Invalid phone number",
      });
    }

    if (!/^\d{6}$/.test(String(passcode))) {
      return res.status(400).json({
        error: "Passcode must be 6 digits",
      });
    }

    const passcodeHash = crypto
      .createHash("sha256")
      .update(String(passcode))
      .digest("hex");

    const snapshot = await admin
      .firestore()
      .collection("authAccounts")
      .where("phone", "==", normalizedPhone)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        error: "No matching account was found.",
      });
    }

    const accountDoc = snapshot.docs[0];
    const account = accountDoc.data();

    if (
      !account.passcodeHash ||
      account.passcodeHash !== passcodeHash
    ) {
      return res.status(403).json({
        error: "Incorrect passcode.",
      });
    }

    const uid = account.uid || accountDoc.id;

    const token = await admin.auth().createCustomToken(uid);

    return res.status(200).json({
      token,
    });
  } catch (error) {
    console.error("verifyPhonePasscode error:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
});

// --------------------------------------------------
// CHECK PHONE / EMAIL AVAILABILITY
// POST /checkPhoneAvailable
// Body: { phone, email }
// --------------------------------------------------

exports.checkPhoneAvailable = onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  try {
    const { phone, email } = req.body || {};

    const normalizedPhone = phone
      ? String(phone).replace(/\D/g, "")
      : "";

    let phoneExists = false;
    let emailExists = false;
    let foundEmail = null;

    // Check phone
    if (normalizedPhone) {
      const phoneSnapshot = await admin
        .firestore()
        .collection("authAccounts")
        .where("phone", "==", normalizedPhone)
        .limit(1)
        .get();

      if (!phoneSnapshot.empty) {
        phoneExists = true;
        foundEmail =
          phoneSnapshot.docs[0].data().email || null;
      }
    }

    // Check email
    if (email) {
      const normalizedEmail = String(email)
        .trim()
        .toLowerCase();

      const emailSnapshot = await admin
        .firestore()
        .collection("authAccounts")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

      if (!emailSnapshot.empty) {
        emailExists = true;
      }
    }

    return res.status(200).json({
      phoneExists,
      emailExists,
      email: foundEmail,
    });
  } catch (error) {
    console.error("checkPhoneAvailable error:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
});