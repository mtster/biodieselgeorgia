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
  "Management Panel": "მართვის პანელი",
  "Here you can manage suppliers, plan collection orders, monitor warehouse balances and view detailed analytics.": "აქ შეგიძლიათ მართოთ მომწოდებლები, დაგეგმოთ შეკვეთები, აკონტროლოთ საწყობის ნაშთები და იხილოთ დეტალური ანალიტიკა.",
  "Total Volume (Actual)": "ჯამური მოცულობა (ფაქტობრივი)",
  "Drivers": "მძღოლები",
  "Latest Active Orders": "უახლესი აქტიური შეკვეთები",
  "View All": "ყველას ნახვა",
  "Qty": "რაოდენობა",
  "Operations Status": "ოპერაციების სტატუსი",
  "Total Vehicles:": "ტრანსპორტის რაოდენობა:",
  "Active Locations:": "აქტიური ლოკაციები:",
  "Collected Oil:": "შეგროვებული ზეთი:",
  "The system automatically notifies the accountant once the driver completes an order.": "სისტემა ავტომატურად აცნობებს ბუღალტერს, როგორც კი მძღოლი დაასრულებს შეკვეთას.",
  "Unspecified": "არ არის მითითებული",
  "Unknown Supplier": "უცნობი მომწოდებელი",
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
  "Directions": "მიმართულება",
  "mimartulebebi": "მიმართულება",
  "mimartuleba": "მიმართულება",
  "vada": "ვადა (დღეები)",
  "Vada": "ვადა (დღეები)",
  "Direction is required.": "მიმართულება სავალდებულოა",
  "Direction": "მიმართულება",
  "Add New Direction": "ახალი მიმართულების დამატება",
  "Direction Details": "მიმართულების დეტალები",
  "Create New Direction": "ახალი მიმართულების შექმნა",
  "e.g. East Route": "მაგ: აღმოსავლეთის მარშრუტი",
  "Delete Direction?": "წაშალოთ მიმართულება?",
  "Are you sure you want to delete direction": "დარწმუნებული ხართ, რომ გსურთ წაშალოთ მიმართულება",
  "It will hide it from the UI immediately. This action is soft-deleted in the database.": "ეს დაუყოვნებლივ დამალავს მას ინტერფეისიდან. ეს მოქმედება არის პროგრამული წაშლა ბაზაში.",
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
  "Company Code": "კომპანიის კოდი",
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
  "gegmiuri": "გეგმიური",
  "monday": "ორშაბათი",
  "tuesday": "სამშაბათი",
  "wednesday": "ოთხშაბათი",
  "thursday": "ხუთშაბათი",
  "friday": "პარასკევი",
  "saturday": "შაბათი",
  "sunday": "კვირა",
  "Day of the week *": "კვირის დღე *",
  "Barrels Amount": "კასრების რაოდენობა",
  "Sales Manager": "გაყიდვების მენეჯერი",
  "Operation Manager": "ოპერაციების მენეჯერი",
  "Working Hours": "სამუშაო საათები",
  "City": "ქალაქი",
  "e.g. Tbilisi": "მაგ: თბილისი",
  "District": "რაიონი",
  "City Details": "ქალაქის დეტალები",
  "Create New City": "ახალი ქალაქის შექმნა",
  "Districts": "რაიონები",
  "New district name...": "რაიონის სახელი...",
  "IBAN / Bank Account": "IBAN / საბანკო ანგარიში",
  "Contacts": "კონტაქტები",

  "Add Supplier Contact": "მომწოდებლის კონტაქტის დამატება",
  "Contact Name": "კონტაქტის სახელი",
  "Contact Name *": "საკონტაქტო პირის სახელი *",
  "Mobile Phone Number": "მობილურის ნომერი",
  "Mobile Phone Number *": "მობილური ტელეფონის ნომერი *",
  "Add Contact": "კონტაქტის დამატება",
  "Save Contact": "კონტაქტის შენახვა",
  "No contacts recorded": "კონტაქტები არ არის დამატებული",
  "No contacts recorded.": "კონტაქტები არ არის დამატებული",
  "Edit Contact Person": "საკონტაქტო პირის რედაქტირება",
  "Add Contact Person": "საკონტაქტო პირის დამატება",
  "Contact Person": "კონტაქტი",
  "Confirm": "დადასტურება",
  "Position / Role": "თანამდებობა / როლი",
  "Accountant": "ბუღალტერი",
  "Director/Owner": "დირექტორი / მფლობელი",
  "Operations Mgr": "ოპერაციების მენეჯერი",
  "Other Position": "სხვა თანამდებობა",
  "Short Note (e.g. call instructions)": "მოკლე ჩანაწერი (მაგ: ზარის ინსტრუქცია)",
  "Please fill in contact name and phone number": "გთხოვთ შეავსოთ საკონტაქტო პირის სახელი და ტელეფონის ნომერი",

  "Comments": "კომენტარები",
  "Add Comment": "კომენტარის დამატება",
  "Save Comment": "კომენტარის შენახვა",
  "No comments": "კომენტარები არ არის",
  "No comments.": "კომენტარები არ არის",
  "No previous interactions logged for this supplier.": "ამ მომწოდებლისთვის წინა ინტერაქციები არ არის.",
  "Write specific supplier memo here...": "დაწერეთ მომწოდებლის კონკრეტული მემო აქ...",
  "Submit": "შენახვა",
  "No communications": "კომუნიკაციები არ არის",
  "System": "სისტემა",
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
  "Supplier / Subject": "მომწოდებელი / თემა",
  "Operator / User": "ოპერატორი / მომხმარებელი",
  "Interaction Comment": "ინტერაქციის კომენტარი",
  "Reminder Time": "შეხსენების დრო",
  "All Types": "ყველა ტიპი",
  "All Responsible": "ყველა პასუხისმგებელი",
  "All Statuses": "ყველა სტატუსი",
  "All Users": "ყველა მომხმარებელი",
  "Search communications logs...": "ძებნა კომუნიკაციებში...",
  "No communication records found.": "კომუნიკაციის ჩანაწერები არ მოიძებნა.",
  "Interaction Type": "ინტერაქციის ტიპი",
  "Date & Time *": "თარიღი და დრო *",
  "User Rep *": "წარმომადგენელი *",
  "Responsible User *": "პასუხისმგებელი პირი *",
  "Task Status *": "დავალების სტატუსი *",
  "Supplier *": "მომწოდებელი *",
  "Comment *": "კომენტარი *",
  "Select Employee": "აირჩიეთ თანამშრომელი",
  "Type to search supplier...": "ჩაწერეთ მომწოდებლის მოსაძებნად...",
  "Comment": "კომენტარი",
  "e.g. Phone call completed, promised dispatch on Monday...": "მაგ: სატელეფონო საუბარი შედგა, დაგვპირდა გამოგზავნას ორშაბათს...",
  "Delete Log Entry": "ჩანაწერის წაშლა",
  "Are you sure you want to delete this communication log entry? This operation is permanent.": "დარწმუნებული ხართ, რომ გსურთ ამ ჩანაწერის წაშლა? ეს ოპერაცია შეუქცევადია.",
  "Confirm Bulk Logs Deleted": "ჩანაწერების ჯგუფური წაშლის დადასტურება",
  "No, Keep Them": "არა, დატოვება",
  "Please enter a comment": "გთხოვთ შეიყვანოთ კომენტარი",
  "Columns Manager": "სვეტების მართვა",
  "Are you sure you want to permanently delete": "დარწმუნებული ხართ, რომ გსურთ სამუდამოდ წაშალოთ",
  "selected communication entries": "არჩეული კომუნიკაციის ჩანაწერი",
  "This cannot be undone.": "ამ მოქმედების გაუქმება შეუძლებელია.",
  "Yes, Delete": "დიახ, წაშლა",
  "Default": "ნაგულისხმევი",
  "Add New Column": "ახალი სვეტის დამატება",
  "Enter column name...": "შეიყვანეთ სვეტის სახელი...",

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

  // Orders: Navigation & general labels
  "New Order": "ახალი შეკვეთა",
  "Actions": "ქმედებები",
  "SMS Logs": "SMS ლოგები",
  "Assign Driver": "მძღოლის მინიჭება",
  "Order": "შეკვეთა",
  "Search dispatches by supplier trade name, legal entity, or document coordinate...": "ძებნა მომწოდებლის დასახელებით, იურიდიული პირით ან დოკუმენტის კოდით...",
  "Registered": "რეგისტრირებული",
  "Driver Assigned": "მძღოლი მინიჭებულია",
  "Picked Up": "გატანილია",
  "Cancel & Delete Order?": "გაუქმება და შეკვეთის წაშლა?",
  "Are you sure you want to completely cancel and soft delete high-priority order dispatch": "დარწმუნებული ხართ, რომ გსურთ მთლიანად გააუქმოთ და წაშალოთ მაღალი პრიორიტეტის შეკვეთა",
  "Confirm Bulk Orders Deleted": "ჯგუფური შეკვეთების წაშლის დადასტურება",
  "Are you sure you want to soft delete": "გსურთ წაშალოთ",
  "selected orders": "არჩეული შეკვეთები",
  "They will hide from the UI immediately.": "ისინი დაუყოვნებლივ გაქრება ინტერფეისიდან.",
  "No active collection order entries were located.": "აქტიური შეკვეთის ჩანაწერები ვერ მოიძებნა.",
  "registered": "რეგისტრირებული",
  "driver_assigned": "მძღოლი მინიჭებულია",
  "picked_up": "გატანილია",
  "completed": "დასრულებულია",
  "cancelled": "გაუქმებული",

  // Orders: Column Headers & Labels
  "Date": "თარიღი",
  "Doc Num": "დოკუმენტის კოდი",
  "Warehouse": "საწყობი",
  "Dispatch Date": "გატანის თარიღი",
  "Planned Qty": "გეგმიური მარაგი",
  "Planned": "დაგეგმილი",
  "Fact QTY": "ფაქტობრივი მარაგი",
  "Dropoff Tanks": "ჩასაბარებელი კასრები",
  "Dropoff": "ჩაბარება",
  "Fact Tank Dropoff": "ფაქტობრივი ჩაბარება",
  "Pickup Tanks": "წამოსაღები კასრები",
  "Pickup": "წამოღება",
  "Fact Tank Pickup": "ფაქტობრივი წამოღება",
  "Sel": "მონ",

  // Orders Form Fields captions & validation errors
  "Core Transaction Details": "შეკვეთის ძირითადი დეტალები",
  "Supplier / Vendor Restaurant": "მომწოდებელი / რესტორანი",
  "Document Dispatch ID": "დოკუმენტის კოდი",
  "Order Dispatch Date": "შეკვეთის გატანის თარიღი",
  "Planned QTY (L)": "გეგმიური რაოდენობა (ლ)",
  "Tanks Dropoff": "კასრების ჩაბარება",
  "Tanks Pickup": "კასრების წამოღება",
  "Fulfillment Status": "შესრულების სტატუსი",
  "Fact QTY (L)": "ფაქტობრივი რაოდენობა (ლ)",
  "Fulfillment Clock & Calendar Details": "შესრულების დრო და კალენდარი",
  "PRIORITY UX": "პრიორიტეტული UX",
  "Specify Pickup Time First": "ჯერ მიუთითეთ გატანის დრო",
  "Override Standard Date Selection?": "სტანდარტული თარიღის შეცვლა?",
  "By default, order registers today's date context.": "ნაგულისხმევად შეკვეთა რეგისტრირდება დღევანდელი თარიღით.",
  "Hours": "საათი",
  "Mins": "წუთი",
  "Handover Comments / Navigation Note on Location": "გადაცემის კომენტარები / ნავიგაციის ჩანაწერი ლოკაციაზე",
  "Operations Vehicle Crew": "ლოგისტიკის ეკიპაჟი",
  "Assigned Fleet Driver": "მინიჭებული მძღოლი",
  "Operations Dispatcher / Co-Driver Helper": "ოპერაციების დისპეტჩერი / დამხმარე მძღოლი",
  "Assigned Vehicle Plate Asset": "მინიჭებული ტრანსპორტი",
  "Select Driver": "აირჩიეთ მძღოლი",
  "Select Vehicle": "აირჩიეთ ტრანსპორტი",
  "Select Companion": "აირჩიეთ დამხმარე",
  "No suppliers found matching": "მომწოდებელი არ მოიძებნა მითითებული სახელით",
  
  "Please select a Supplier / Vendor.": "გთხოვთ აირჩიოთ მომწოდებელი.",
  "Please select a Base Destination Warehouse.": "გთხოვთ აირჩიოთ დანიშნულების საწყობი.",
  "Document dispatch number is required.": "დოკუმენტის გატანის ნომერი სავალდებულიოა.",
  "Please select an Assigned Fleet Driver.": "გთხოვთ აირჩიოთ მინიჭებული მძღოლი.",
  "Please select an Assigned Vehicle.": "გთხოვთ აირჩიოთ მინიჭებული ტრანსპორტი.",
  "Please specify Actual Volume Received (Liters) for completed orders.": "გთხოვთ მიუთითოთ მიღებული ფაქტობრივი მოცულობა (ლიტრებში).",

  // SMS Logs & Assign modal
  "SMS Logs (Fulfillment Dispatches)": "SMS ლოგები (შეკვეთის შესრულება)",
  "System notifications auto-delivered to accounting logs upon successful driver pickup sequence:": "ავტომატური სისტემური შეტყობინებები ბუღალტრული აღრიცხვისთვის მძღოლის მიერ გატანისას:",
  "No notifications recorded.": "შეტყობინებები არ არის ჩაწერილი.",
  "Assign Driver (": "მძღოლის მინიჭება (",
  "Vehicle": "ტრანსპორტი",
  "Companion": "დამხმარე",
  "Assign": "მინიჭება",

  // Reports
  "Delivered Orders by Suppliers": "მიწოდებული შეკვეთები მომწოდებლების მიხედვით",
  "Review total liters, visit counts, and total cost aggregated per individual commercial supplier.": "იხილეთ ჯამური ლიტრები, ვიზიტების რაოდენობა და ჯამური ღირებულება თითოეული მომწოდებლის ჭრილში.",
  "Supplier Insights": "მომწოდებლის ანალიტიკა",
  "Delivered Orders by Regions": "მიწოდებული შეკვეთები რეგიონების მიხედვით",
  "Analyze localized biodiesel feedstock collections by regional city and municipality districts.": "გააანალიზეთ ბიოდიზელის ნედლეულის შეგროვება რეგიონალური ქალაქებისა და მუნიციპალიტეტების მიხედვით.",
  "Geographic Analysis": "გეოგრაფიული ანალიზი",
  "Delivered Orders by Managers": "მიწოდებული შეკვეთები მენეჯერების მიხედვით",
  "Measure manager performance in servicing accounts, visit coordinates, and total values.": "შეაფასეთ მენეჯერების მუშაობა ლოკაციების მომსახურების, ვიზიტებისა და ჯამური მაჩვენებლების მიხედვით.",
  "Staff Ledger": "პერსონალის უწყისი",
  "Tanks Turnover by Suppliers": "კასრების ბრუნვა მომწოდებლების მიხედვით",
  "Audit dropoff ledger operations, initial container balance, filled count, and final storage balance.": "კასრების ბრუნვის აუდიტი, საწყისი ნაშთი, სავსე კასრები და საბოლოო ნაშთი.",
  "Logistics Turnover": "ლოგისტიკის ბრუნვა",
  "Last Deliveries Tracker": "ბოლო მიწოდებების კონტროლი",
  "Monitor temporal intervals and safety alert coordinates since the final commercial delivery date.": "აკონტროლეთ დროითი ინტერვალები ბოლო კომერციული მიწოდების თარიღის შემდეგ.",
  "Activity History": "აქტივობის ისტორია",
  "Last Deliveries": "ბოლო მიწოდებები",

  "Search suppliers by name, legal entity or taxation credentials...": "მოძებნეთ მომწოდებლები სახელით, იურიდიული პირით ან საგადასახადო მონაცემებით...",
  "Search regions by city name or district representation...": "მოძებნეთ რეგიონები ქალაქის სახელით ან რაიონით...",
  "Search managers by employee legal name...": "მოძებნეთ მენეჯერები თანამშრომლის სახელით...",
  "Search suppliers by name, code, or account managers...": "ძებნა მომწოდებლის სახელით, კოდით ან მენეჯერით...",
  "Search last deliveries by company, code, manager, city, region, or status...": "ძებნა კომპანიით, კოდით, მენეჯერით, ქალაქით, რეგიონით ან სტატუსით...",
  "All Cities": "ყველა ქალაქი",
  "All Directions": "ყველა მიმართულება",
  "Region": "რეგიონი",
  "All Regions": "ყველა რეგიონი",
  "All Managers": "ყველა მენეჯერი",

  "Company Name": "კომპანიის სახელი",
  "Visits Amount": "ვიზიტების რაოდენობა",
  "Oil Amount (Liters)": "ზეთის რაოდენობა (ლიტრები)",
  "Cost (₾)": "ღირებულება (₾)",
  "No matching supplier records found.": "შესაბამისი მომწოდებლის ჩანაწერები ვერ მოიძებნა.",
  "TOTAL SUMMARY": "ჯამური რეზიუმე",
  "active suppliers": "აქტიური მომწოდებელი",
  "active regions": "აქტიური რეგიონი",
  "No matching regional record aggregates found.": "რეგიონალური ჩანაწერების აგრეგატები ვერ მოიძებნა.",
  "Region (District)": "რეგიონი (რაიონი)",
  "Manager Name": "მენეჯერის სახელი",
  "No matching manager record aggregates found.": "მენეჯერების ჩანაწერების აგრეგატები ვერ მოიძებნა.",
  "active managers": "აქტიური მენეჯერი",
  "Opening Balance": "საწყისი ნაშთი",
  "Filled": "სავსე",
  "Returned": "დაბრუნებული",
  "Final Balance": "საბოლოო ნაშთი",
  "No matching supplier records found for tank turnovers.": "კასრების ბრუნვის შესაბამისი ჩანაწერები ვერ მოიძებნა.",
  "total active suppliers": "აქტიური მომწოდებელი ჯამში",
  "Days Since Last Delivery": "ბოლო მიწოდებიდან გასული დღეები",
  "Last Delivery Date": "ბოლო მიწოდების თარიღი",
  "No delivery coordinates records located.": "მიწოდების კოორდინატები ვერ მოიძებნა.",
  "Average Innactivity": "საშუალო უმოქმედობა",
  "days average": "დღე საშუალოდ",
  "monitored suppliers": "მონიტორინგის ქვეშ მყოფი მომწოდებელი",
  "Final Delivery Date": "ბოლო მიწოდების თარიღი",
  "Days Ago": "დღის წინ",
  "No deliveries": "მიწოდება არ არის",
  "City / Region": "ქალაქი / რეგიონი",
  "No matching supplier records found for last deliveries.": "ბოლო მიწოდების შესაბამისი ჩანაწერები ვერ მოიძებნა.",
  "Avg:": "საშუალოდ:",
  "days": "დღე",

  // Settings & Vehicles / Warehouses / Cities additions
  "None": "არცერთი",
  "Unassigned": "გაუნაწილებელი",
  "Manage Asset": "მონაცემების მართვა",
  "Add New Vehicle": "ტრანსპორტის დამატება",
  "Vehicle Specifications": "ტრანსპორტის დეტალები",
  "Add Vehicle to Fleet": "ტრანსპორტის დამატება",
  "License Plate Number": "სახელმწიფო ნომერი",
  "e.g. AA-123-BB": "მაგ: AA-123-BB",
  "Vehicle Brand / Model": "ბრენდი / მოდელი",
  "e.g. Mercedes Sprinter": "მაგ: Mercedes Sprinter",
  "Select a City": "აირჩიეთ ქალაქი",
  "Assigned Warehouse": "მინიჭებული საწყობი",
  "Select a Warehouse": "აირჩიეთ საწყობი",
  "Assigned Default Driver": "მინიჭებული მძღოლი",
  "Assigned Co-Driver / Companion": "მეწყვილე / დამხმარე",
  "Decommission vehicle?": "ჩამოვწეროთ ტრანსპორტი?",
  "Are you sure you want to delete vehicle license plate": "დარწმუნებული ხართ, რომ გსურთ წაშალოთ ტრანსპორტი სახელმწიფო ნომრით",
  "This will mark it as soft-deleted and prevent active log assignments.": "ეს მონიშნავს მას როგორც წაშლილს და შეზღუდავს აქტიურ რეისებში მის გამოყენებას.",
  "districts active": "რაიონი აქტიურია",

  // Warehouses
  "Active Storage Unit": "აქტიური საცავი",
  "Configure Cards": "ბარათების მართვა",
  "Add New Warehouse": "საწყობის დამატება",
  "Warehouse Specifications": "საწყობის დეტალები",
  "Add Warehouse": "საწყობის დამატება",
  "Warehouse / Storage Facility Name": "საწყობის / საცავის სახელი",
  "e.g. Tbilisi Central Depot": "მაგ: თბილისის ცენტრალური საწყობი",
  "Delete warehouse?": "წაშალოთ საწყობი?",
  "Are you sure you want to permanently delete warehouse": "დარწმუნებული ხართ, რომ გსურთ სამუდამოდ წაშალოთ საწყობი",
  "This action cannot be undone.": "ამ მოქმედების გაუქმება შეუძლებელია.",

  // History / Logs & Table
  "Change History": "ცვლილებების ისტორია",
  "Search change history logs...": "მოძებნეთ ცვლილებების ისტორიის ჟურნალი...",
  "Old Value": "ძველი მნიშვნელობა",
  "New Value": "ახალი მნიშვნელობა",
  "No change history logs match current filters.": "ცვლილებების ისტორიის ჟურნალი არ ემთხვევა მოცემულ ფილტრებს.",
  "User": "მომხმარებელი",
  "All Operations": "ყველა ოპერაცია",
  "Operation": "ოპერაცია",
  "All Fields": "ყველა ველი",
  "Field": "ველი",

  // Operational Database Audit Labels
  "insert": "შექმნა",
  "insert_warehouse": "საწყობის შექმნა",
  "update": "განახლება",
  "delete": "წაშლა",
  "create": "შექმნა",
  "status": "სტატუსი",
  "phone": "ტელეფონი",
  "address": "მისამართი",
  "city_id": "ქალაქი",
  "warehouse_id": "საწყობი",
  "payment_method": "გადახდის მეთოდი",
  "price_rate": "ტარიფი",
  "barrels_amount": "კასრების რაოდენობა",
  "is_active": "აქტიურია",
  "name": "სახელი",
  "plate_number": "სახელმწიფო ნომერი",
  "model": "მოდელი",
  "driver_id": "მძღოლი",
  "companion_id": "დამხმარე მძღოლი",

  // Roles & Companion labels
  "driver": "მძღოლი",
  "companion": "დამხმარე",
  "none": "არცერთი",

  // Period / Calendar Presets
  "Start Date": "დაწყების თარიღი",
  "End Date": "დასრულების თარიღი",
  "Clear Dates": "თარიღების გასუფთავება",
  "Tomorrow": "ხვალ",

  // Additional translations requested
  "All Districts": "ყველა რაიონი",
  "All Sales Managers": "ყველა გაყიდვების მენეჯერი",
  "All Operation Managers": "ყველა ოპერაციების მენეჯერი",
  "Taxation ID": "საიდენტიფიკაციო კოდი",
  "Rate (₾)": "ტარიფი (₾)",
  "Location": "მდებარეობა",
  "Assigned Code": "მინიჭებული კოდი",
  "Additional Contacts": "დამატებითი კონტაქტები",
  "Memos / Internal Notes": "შიდა ჩანიშვნები",
  "No Contact": "კონტაქტი არ არის",
  "Search...": "ძებნა...",
  "Search suppliers by trade name, legal entity, or registered taxation ID coordinates...": "ძებნა მომწოდებლის დასახელებით, იურიდიული პირით ან საიდენტიფიკაციო კოდით...",
  "Add New User": "მომხმარებლის დამატება",
  "Add New City": "ქალაქის დამატება",
  "Biodiesel Georgia": "ბიოდიზელ ჯორჯია",
  "Welcome to Biodiesel Georgia Portal": "კეთილი იყოს თქვენი მობრძანება ბიოდიზელ ჯორჯიას პორტალზე",
  "No custom privileges": "სპეციალური პრივილეგიების გარეშე",
  "Privileges": "პრივილეგიები",
  "Personal ID": "პირადი ნომერი",
  "Personal ID (11 digits)": "პირადი ნომერი (11 ციფრი)",
  "Email Address": "ელ. ფოსტის მისამართი",
  "Email or Username": "ელ. ფოსტა ან მომხმარებლის სახელი",
  "Email": "ელ. ფოსტა",
  "Role / Designation": "როლი / დანიშნულება",
  "Assigned Warehouse (Optional)": "მიმაგრებული საწყობი (არასავალდებულო)",
  "Assigned Supplier *": "მინიჭებული მომწოდებელი *",
  "Select a Supplier": "აირჩიეთ მომწოდებელი",
  "Select a Warehouse (Unassigned)": "აირჩიეთ საწყობი (მიუმაგრებელი)",
  "Menu Permissions": "მენიუს ნებართვები",
  "Edit Permissions": "რედაქტირების ნებართვები",
  "Modules / Pages": "მოდულები / გვერდები",
  "Profile Information": "პროფილის ინფორმაცია",
  "Full Name": "სრული სახელი",
  "Password": "პაროლი",
  "Change Password (Optional)": "პაროლის შეცვლა (არასავალდებულო)",
  "Username": "მომხმარებლის სახელი",
  "Username / Email": "მომხმარებლის სახელი / ელ.ფოსტა",
  "Supplier Login Account": "მომწოდებლის ანგარიში",
  "Leave blank to keep existing password": "დატოვეთ ცარიელი არსებული პაროლის შესანარჩუნებლად",
  "Enter password": "შეიყვანეთ პაროლი",
  "Either both fields must be filled to create/edit an account, or both must be empty to save without/delete access.": "ანგარიშის შესაქმნელად/რედაქტირებისთვის ორივე ველი უნდა შეივსოს, ან ორივე უნდა იყოს ცარიელი წვდომის გარეშე შესანახად.",
  "Username is required when password is provided.": "მომხმარებლის სახელი სავალდებულოა პაროლის მითითებისას.",
  "Password is required when username is provided or changed.": "პაროლი სავალდებულოა მომხმარებლის სახელის მითითებისას ან შეცვლისას.",
  "Failed to create or update supplier login account": "მომწოდებლის მომხმარებლის ანგარიშის შექმნა ან განახლება ვერ მოხერხდა",
  "All": "ყველა",
  "Remove User?": "წაშალოთ მომხმარებელი?",
  "Are you sure you want to completely delete user account profile for": "დარწმუნებული ხართ, რომ გსურთ სრულად წაშალოთ მომხმარებლის პროფილი: ",
  "This is a permanent administrative soft-deletion.": "ეს არის შეუმცდარი ადმინისტრაციული წაშლა.",
  "Remove Supplier?": "წაშალოთ მომწოდებელი?",
  "This supplier profile coordinates will be soft deleted.": "ეს მომწოდებლის პროფილი წაიშლება.",
  "No, Go Back": "არა, უკან დაბრუნება",
  "Administrator (Admin)": "ადმინისტრატორი (Admin)",
  "Warehouse Manager": "საწყობის მენეჯერი",
  "Assistant": "ასისტენტი",
  "Supplier (Vendor)": "მომწოდებელი",
  "Role": "როლი",
  "Blocked": "დაბლოკილი",
  "Your user account has been blocked by administrators.": "თქვენი მომხმარებელი დაბლოკილია ადმინისტრატორის მიერ.",
  "Unknown": "უცნობი",
  "User Management": "მომხმარებლების მართვა",
  "Assigned Tasks Only": "მხოლოდ მინიჭებული დავალებები",
  "Analytics": "ანალიტიკა",
  "Location Parameters": "ლოკაციის პარამეტრები",
  "Management & Operations": "მართვა და ოპერაციები",
  "zednadebit raodenoba": "ზედნადებით რაოდენობა",
  "Waybill Quantity": "ზედნადებით რაოდენობა",
  "Delete Column?": "წავშალოთ სვეტი?",
  "Are you sure you want to delete this custom column? This will remove it from the table.": "დარწმუნებული ხართ, რომ გსურთ ამ სვეტის წაშლა? ეს მას ცხრილიდანაც წაშლის.",
  "Custom": "დამატებითი",
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

export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
