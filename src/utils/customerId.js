const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const nextLetters = (letters) => {
  const chars = letters.split("");

  for (let i = chars.length - 1; i >= 0; i--) {
    const index = LETTERS.indexOf(chars[i]);

    if (index < 25) {
      chars[i] = LETTERS[index + 1];

      for (let j = i + 1; j < chars.length; j++) {
        chars[j] = "A";
      }

      return chars.join("");
    }
  }

  return null;
};

export const getNextCustomerId = (existingUsers = []) => {
  const ids = existingUsers
    .map((u) => u.customerId)
    .filter(Boolean)
    .sort();

  if (!ids.length) {
    return "AAA-001";
  }

  const last = ids[ids.length - 1];

  const [letters, numberPart] = last.split("-");

  let number = Number(numberPart);

  if (number < 999) {
    number++;

    return `${letters}-${String(number).padStart(3, "0")}`;
  }

  const next = nextLetters(letters);

  if (!next) {
    throw new Error("Customer ID limit reached.");
  }

  return `${next}-001`;
};
