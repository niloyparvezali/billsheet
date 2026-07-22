const enToBnDigits = {
  "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
  "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯"
};

const monthMapBn = {
  "January": "জানুয়ারী",
  "February": "ফেব্রুয়ারী",
  "March": "মার্চ",
  "April": "এপ্রিল",
  "May": "মে",
  "June": "জুন",
  "July": "জুলাই",
  "August": "আগস্ট",
  "September": "সেপ্টেম্বর",
  "October": "অক্টোবর",
  "November": "নভেম্বর",
  "December": "ডিসেম্বর"
};

export const toBengaliNumerals = (str) => {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[0-9]/g, (digit) => enToBnDigits[digit] || digit);
};

export const formatNumberByLang = (num, lang = "en") => {
  if (num === null || num === undefined || num === "" || isNaN(Number(num))) return "0";
  const formatted = Number(num).toLocaleString("en-US");
  return lang === "bn" ? toBengaliNumerals(formatted) : formatted;
};

export const formatMoneyByLang = (amount, lang = "en") => {
  if (amount === null || amount === undefined) return "৳0";
  const formatted = formatNumberByLang(amount, lang);
  return `৳${formatted}`;
};

export const translateStatus = (status, lang = "en") => {
  if (!status) return "—";
  if (lang !== "bn") return status;
  const statusMap = {
    Paid: "পরিশোধিত",
    Due: "বকেয়া",
    Partial: "আংশিক",
    Advance: "অগ্রিম",
    Pending: "অপেক্ষমাণ",
    Inactive: "নিষ্ক্রিয়",
    "Not Joined": "যুক্ত হননি",
    "N/A": "প্রযোজ্য নয়",
    Active: "সক্রিয়",
    Voided: "বাতিলকৃত",
    Completed: "সম্পন্ন",
    "Outstanding Balance": "বকেয়া ব্যালেন্স",
    "Credit Carry Forward": "ক্রেডিট জের",
    "Account Settled": "হিসাব সমাপ্ত"
  };
  return statusMap[status] || status;
};

export const translateMonth = (monthName, lang = "en") => {
  if (!monthName) return "";
  if (lang !== "bn") return monthName;
  return monthMapBn[monthName] || monthName;
};
