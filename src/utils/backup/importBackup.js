export async function importBackup(file) {
  if (!file) {
    throw new Error("Please select a backup file.");
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    throw new Error("Please select a valid JSON backup file.");
  }

  const text = await file.text();

  let backup;

  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  // Basic validation
  if (backup.app !== "Bill Sheet") {
    throw new Error("This is not a Bill Sheet backup.");
  }

  if (!backup.version) {
    throw new Error("Backup version is missing.");
  }

  if (!backup.collections) {
    throw new Error("Backup data is incomplete.");
  }

  const users = backup.collections.users || [];
  const payments = backup.collections.payments || [];
  const categories = backup.collections.categories || [];
  const settings = backup.collections.settings || {};

  return {
    backup,

    info: {
      fileName: file.name,
      createdAt: backup.createdAt,
      ownerEmail: backup.ownerEmail,
      ownerId: backup.ownerId,

      users: users.length,
      payments: payments.length,
      categories: categories.length,
      hasSettings: Object.keys(settings).length > 0,
    },
  };
}
