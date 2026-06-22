/**
 * Translation Dictionary for Biodiesel Georgia (ბიოდიზელი ჯორჯია)
 * Centralized Georgian terms and common phrases to maintain clean and consistent translations.
 */

export const formatPhone = (val: string) => {
  let cleaned = val.replace(/[^0-9+]/g, '');
  if (!cleaned || cleaned === '+') return '+';
  if (cleaned[0] !== '+') cleaned = '+' + cleaned;
  
  if (cleaned.startsWith('+995')) {
    let right = cleaned.slice(4);
    let chunks = [];
    if (right.length > 0) chunks.push(right.slice(0, 3));
    if (right.length > 3) chunks.push(right.slice(3, 6));
    if (right.length > 6) chunks.push(right.slice(6, 9));
    let tail = chunks.join(' ');
    if (right.length > 9) tail += right.slice(9);
    return '+995' + (tail ? ' ' + tail : '');
  }
  
  let right = cleaned.slice(1);
  if (right.length < 4) return '+' + right;
  let chunks = right.match(/.{1,3}/g) || [];
  return '+' + chunks.join(' ');
};

export const formatWorkingHours = (val: string) => {
  let cleaned = val.replace(/[^0-9]/g, '').slice(0, 8);
  if (cleaned.length === 0) return '';
  let res = cleaned.slice(0, 2);
  if (cleaned.length >= 3) res += ':' + cleaned.slice(2, 4);
  if (cleaned.length >= 5) res += ' - ' + cleaned.slice(4, 6);
  if (cleaned.length >= 7) res += ':' + cleaned.slice(6, 8);
  return res;
};

export const LANG = {
  // Navigation & Sections
  brand: 'ბიოდიზელი ჯორჯია',
  portalVersion: 'პორტალი v2.0',
  dashboard: 'პანელი',
  analytics: 'ანალიტიკა',
  suppliers: 'მომწოდებლები',
  communications: 'კომუნიკაციები',
  orders: 'შეკვეთები',
  employees: 'მომხმარებლები',
  reports: 'რეპორტები',
  lookups: 'პარამეტრები',
  history: 'ცვლილებების ისტორია',
  settings: 'პარამეტრები',
  logout: 'გამოსვლა',
  structureDesc: 'სტრუქტურის აღწერა',

  // Roles & Privileges
  actions: {
    save: 'მონაცემების შენახვა',
    cancel: 'გაუქმება',
    delete: 'წაშლა',
    edit: 'რედაქტირება',
    add: 'დამატება',
    importExcel: 'Excel-იდან იმპორტი',
    newSupplier: 'ახალი მომწოდებელი',
    newComm: 'ახალი კომუნიკაცია',
  },

  roles: {
    admin: 'ადმინისტრატორი',
    manager: 'მენეჯერი',
  },
};

const GEORGIAN_DICTIONARY: Record<string, string> = {
  // General Buttons & Actions
  "Save": "შენახვა",
  "Save Changes": "ცვლილებების შენახვა",
  "Cancel": "გაუქმება",
  "Delete": "წაშლა",
  "Edit": "რედაქტირება",
  "Add": "დამატება",
  "Close": "დახურვა",
  "Go Back": "უკან დაბრუნება",
  "Search": "ძებნა",
  "Fill Dummy": "ტესტური შევსება",
  "Filter by period": "პერიოდით ფილტრაცია",
  "Create": "შექმნა",
  "Log Out": "გამოსვლა",
  "Staff": "პერსონალი",
  "Administrator": "ადმინისტრატორი",
  "Manager": "მენეჯერი",
  "Driver": "მძღოლი",

  // Side Navigation & Tabs
  "Dashboard": "პანელი",
  "Suppliers": "მომწოდებლები",
  "Communications": "კომუნიკაციები",
  "Orders": "შეკვეთები",
  "Reports": "რეპორტები",
  "Settings": "პარამეტრები",
  "Users": "მომხმარებლები",
  "Cities": "ქალაქები",
  "Vehicles": "ტრანსპორტი",
  "Warehouses": "საწყობები",
  "Changes History": "ცვლილებების ისტორია",

  // Suppliers / Vendors
  "Supplier": "მომწოდებელი",
  "Add Supplier": "მომწოდებლის დამატება",
  "Core Parameters": "ძირითადი პარამეტრები",
  "Trade Name": "სავაჭრო სახელი",
  "Trade/Commercial Name": "სავაჭრო სახელი",
  "Legal Name": "იურიდიული სახელი",
  "Legal/Registered Name (Company Name)": "იურიდიული სახელი",
  "Identification Code": "საიდენტიფიკაციო კოდი",
  "Code": "კოდი",
  "Phone": "ტელეფონი",
  "Address": "მისამართი",
  "Status": "სტატუსი",
  "Type": "ტიპი",
  "Payment Method": "გადახდის მეთოდი",
  "Cash": "ნაღდი",
  "Bank Transfer": "ანგარიშსწორება",
  "Price Rate (per Litre)": "ფასი (ლიტრზე)",
  "Base Price per Litre": "ფასი (ლიტრზე)",
  "Base Price per Litre (₾)": "ფასი (ლიტრზე)",
  "Assigned Base Warehouse": "მინიჭებული საწყობი",
  "Exact Address (Details, Floor, Entry)": "ზუსტი მისამართი (დეტალები, სართული, შესასვლელი)",
  "Supplier / Vendor Status": "მომწოდებლის სტატუსი",
  "Active": "აქტიური",
  "Under Negotiation": "მოლაპარაკების პროცესში",
  "Cancelled": "გაუქმებული",
  "Barrels Amount": "კასრების რაოდენობა",
  "Sales Manager": "გაყიდვების მენეჯერი",
  "Operation Manager": "ოპერაციების მენეჯერი",
  "Working Hours": "სამუშაო საათები",
  "City": "ქალაქი",
  "District": "რაიონი",
  "IBAN / Bank Account": "IBAN / საბანკო ანგარიში",
  "Contacts": "კონტაქტები",

  "Add Supplier Contact": "მომწოდებლის კონტაქტის დამატება",
  "Contact Name": "კონტაქტის სახელი",
  "Mobile Phone Number": "მობილურის ნომერი",
  "Add Contact": "კონტაქტის დამატება",
  "Save Contact": "კონტაქტის შენახვა",
  "No contacts recorded": "კონტაქტები არ არის დამატებული",

  "Comments": "კომენტარები",
  "Add Comment": "კომენტარის დამატება",
  "Save Comment": "კომენტარის შენახვა",
  "No comments": "კომენტარები არ არის",
  "Discard Comment": "კომენტარის წაშლა",
  "Are you sure you want to discard this comment?": "დარწმუნებული ხართ, რომ გსურთ ამ კომენტარის წაშლა?",

  // Communications
  "New Communication": "ახალი კომუნიკაცია",
  "Add Communication": "კომუნიკაციის დამატება",
  "Save Communication": "კომუნიკაციის შენახვა",
  "Edit Communication": "კომუნიკაციის რედაქტირება",
  "Date & Time": "თარიღი და დრო",
  "Interaction/Details": "ინტერაქციის დეტალები",
  "Interaction Details / Comment": "ინტერაქციის დეტალები / კომენტარი",
  "Logged By": "ავტორი",
  "Responsible": "პასუხისმგებელი",
  "User Rep": "წარმომადგენელი",
  "Responsible User": "პასუხისმგებელი პირი",
  "Task Status": "დავალების სტატუსი",
  "Reminder Due Time": "შეხსენების დრო",
  "Notes / Discussion Content": "შენიშვნები / დისკუსიის შინაარსი",
  "Action": "აქტივობა",
  "Reminder": "შეხსენება",
  "Task": "დავალება",
  "Pending": "მოლოდინში",
  "In Progress": "მიმდინარეობს",
  "Completed": "დასრულებულია",
  "No previous interactions logged for this supplier": "ამ მომწოდებლისთვის წინა ინტერაქციები არ არის.",
  "Direct / No contact selected": "პირდაპირები / არჩეული კონტაქტი არ არის",

  // Misc
  "Yes": "დიახ",
  "No": "არა",
  "Primary Contact": "პირველადი კონტაქტი",
  "Mark as Primary": "პირველადად მონიშვნა",
  "Delete Log": "ჩანაწერის წაშლა",
  "Discard Supplier?": "მომწოდებლის წაშლა?",
  "Are you sure you want to delete supplier": "დარწმუნებული ხართ, რომ გსურთ წაშალოთ მომწოდებელი",
  "Showing": "ნაჩვენებია",
  "to": "-",
  "of": "დან",
  "records": "ჩანაწერი",
  "No records found.": "ჩანაწერები ვერ მოიძებნა.",
  "Previous": "წინა",
  "Next": "შემდეგი",
  "Today": "დღეს",
  "Yesterday": "გუშინ",
  "This Week": "ამ კვირაში",
  "Last Week": "წინა კვირას",
  "This Month": "ამ თვეში",

  // Months
  "January": "იანვარი",
  "February": "თებერვალი",
  "March": "მარტი",
  "April": "აპრილი",
  "May": "მაისი",
  "June": "ივნისი",
  "July": "ივლისი",
  "August": "აგვისტო",
  "September": "სექტემბერი",
  "October": "ოქტომბერი",
  "November": "ნოემბერი",
  "December": "დეკემბერი",
  "January 2026": "იანვარი 2026",
  "February 2026": "თებერვალი 2026",
  "March 2026": "მარტი 2026",
  "April 2026": "აპრილი 2026",
  "May 2026": "მაისი 2026",
  "June 2026": "ივნისი 2026",
  "July 2026": "ივლისი 2026",
  "August 2026": "აგვისტო 2026",
  "September 2026": "სექტემბერი 2026",
  "October 2026": "ოქტომბერი 2026",
  "November 2026": "ნოემბერი 2026",
  "December 2026": "დეკემბერი 2026",
  "January 2025": "იანვარი 2025",
  "February 2025": "თებერვალი 2025",
  "March 2025": "მარტი 2025",
  "April 2025": "აპრილი 2025",
  "May 2025": "მაისი 2025",
  "June 2025": "ივნისი 2025",
  "July 2025": "ივლისი 2025",
  "August 2025": "აგვისტო 2025",
  "September 2025": "სექტემბერი 2025",
  "October 2025": "ოქტომბერი 2025",
  "November 2025": "ნოემბერი 2025",
  "December 2025": "დეკემბერი 2025",
};

export function t(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  
  // If the key already contains Georgian characters, do not double-translate
  if (/[\u10A0-\u10FF]/.test(trimmed)) {
    return trimmed;
  }
  
  // Stripping trailing asterisks/colons for matching but keeping them in output
  const hasAsterisk = trimmed.endsWith('*');
  const hasColon = trimmed.endsWith(':');
  
  let lookupKey = trimmed;
  if (hasAsterisk) {
    lookupKey = trimmed.slice(0, -1).trim();
  } else if (hasColon) {
    lookupKey = trimmed.slice(0, -1).trim();
  }

  const translated = GEORGIAN_DICTIONARY[lookupKey] || GEORGIAN_DICTIONARY[trimmed];
  if (translated) {
    let suffix = '';
    if (hasAsterisk && !translated.endsWith('*')) suffix += ' *';
    if (hasColon && !translated.endsWith(':')) suffix += ':';
    return translated + suffix;
  }

  // Fallback to dictionary
  return GEORGIAN_DICTIONARY[key] || key;
}
