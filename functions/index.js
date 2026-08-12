const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const setCorsHeaders = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.get("Origin") || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
};

// POST /verifyPhonePasscode
// body: { phone, passcode }
// Returns: { token } (custom auth token) on success
exports.verifyPhonePasscode = onRequest(async (req, res) => {
	setCorsHeaders(req, res);
	if (req.method === "OPTIONS") return res.status(204).send("");
	if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
	try {
	const { phone, passcode } = req.body || {};
		if (!phone || !passcode) return res.status(400).json({ error: "Missing phone or passcode" });
		const normalized = String(phone).replace(/\D/g, "");
		const passcodeHash = crypto.createHash("sha256").update(String(passcode)).digest("hex");

		const snapshot = await admin.firestore().collection("authAccounts").where("phone", "==", normalized).get();
		if (snapshot.empty) return res.status(404).json({ error: "No matching account was found." });
		const doc = snapshot.docs[0];
		const account = doc.data();
		if (!account.passcodeHash || account.passcodeHash !== passcodeHash) {
			return res.status(403).json({ error: "Incorrect passcode." });
		}
		const uid = account.uid || doc.id;
		const token = await admin.auth().createCustomToken(uid);
		return res.json({ token });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: "Server error" });
		}
	});
});

// POST /checkPhoneAvailable
// body: { phone, email }
// Returns: { phoneExists, emailExists, email }
exports.checkPhoneAvailable = onRequest(async (req, res) => {
	setCorsHeaders(req, res);
	if (req.method === "OPTIONS") return res.status(204).send("");
	if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
	try {
	const { phone, email } = req.body || {};
		const normalized = phone ? String(phone).replace(/\D/g, "") : "";
		let phoneExists = false;
		let emailExists = false;
		let foundEmail = null;

		if (normalized) {
			const s = await admin.firestore().collection("authAccounts").where("phone", "==", normalized).get();
			if (!s.empty) {
				phoneExists = true;
				foundEmail = s.docs[0].data().email || null;
			}
		}
		if (email) {
			const s2 = await admin.firestore().collection("authAccounts").where("email", "==", String(email).toLowerCase()).get();
			if (!s2.empty) emailExists = true;
		}
		return res.json({ phoneExists, emailExists, email: foundEmail });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: "Server error" });
		}
	});
});
